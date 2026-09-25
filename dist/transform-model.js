import { DocumentStore, newDocument, createObject, screenToWorld, worldToScreen } from './core.js?v=14';
import { pointInPolygon, segmentDistance } from './geometry.js?v=14';

export const TRANSFORM_STORAGE = 'maths-workspace:transformations:v1';
export const GRID_UNIT = 40;
const clean = n => Math.abs(n) < 1e-10 ? 0 : Number(n.toFixed(10));
export const tidyPoint = p => ({ x: clean(p.x), y: clean(p.y) });
export const snapPoint = (p, enabled = true) => enabled ? { x: Math.round(p.x), y: Math.round(p.y) } : tidyPoint(p);
// The shared camera uses downwards-positive screen/world y; mathematical y points up.
export const graphToScreen = (p, view) => worldToScreen({ x: p.x * GRID_UNIT, y: -p.y * GRID_UNIT }, view);
export function screenToGraph(p, view) { const w = screenToWorld(p, view); return { x: w.x / GRID_UNIT, y: -w.y / GRID_UNIT }; }
export const translatePoint = (p, vector) => tidyPoint({ x: p.x + vector.x, y: p.y + vector.y });
export function rotatePoint(p, centre, degrees) {
  const t = degrees * Math.PI / 180, x = p.x - centre.x, y = p.y - centre.y;
  return tidyPoint({ x: centre.x + x * Math.cos(t) - y * Math.sin(t), y: centre.y + x * Math.sin(t) + y * Math.cos(t) });
}
export function normaliseLine({ a, b, c }) {
  const length = Math.hypot(a, b);
  if (![a, b, c].every(Number.isFinite) || length < 1e-10) throw Error('line');
  return { a: a / length, b: b / length, c: c / length };
}
export function lineFromPoints(p, q) {
  return normaliseLine({ a: p.y - q.y, b: q.x - p.x, c: p.x * q.y - q.x * p.y });
}
export function lineFoot(p, line) {
  const { a, b, c } = normaliseLine(line), distance = a * p.x + b * p.y + c;
  return { x: p.x - a * distance, y: p.y - b * distance };
}
export function reflectPoint(p, line) {
  const f = lineFoot(p, line);
  return tidyPoint({ x: 2 * f.x - p.x, y: 2 * f.y - p.y });
}
// Orthographic projection of a 180° page turn about the mirror line (the hinge).
// A point on the hinge is fixed throughout, and the halfway image is edge-on.
export function flipPoint(p, line, progress) {
  const f = lineFoot(p, line), t = Math.max(0, Math.min(1, progress)), turn = Math.cos(Math.PI * t);
  return tidyPoint({ x: f.x + (p.x - f.x) * turn, y: f.y + (p.y - f.y) * turn });
}
export function snapRotation(degrees, snap = true) {
  const d = Math.max(-360, Math.min(360, degrees)), stop = Math.round(d / 90) * 90;
  return clean(snap && Math.abs(d - stop) <= 3 ? stop : d);
}
export function leverAngle(y, top, height, snapping = true) {
  return snapRotation(360 - Math.max(0, Math.min(1, (y - top) / height)) * 720, snapping);
}
// Capture and release use different thresholds, so a quarter turn stays put
// through small pointer movements. Exact input and keyboard nudges bypass this.
export class RotationSnap {
  constructor(angle = 0) { this.held = angle % 90 === 0 ? angle : null; }
  move(value) {
    const angle = snapRotation(value, false);
    if (this.held !== null && Math.abs(angle - this.held) <= 18) return this.held;
    const nearest = clean(Math.round(angle / 90) * 90);
    this.held = Math.abs(angle - nearest) <= 10 ? nearest : null;
    return this.held ?? angle;
  }
}
export function rotationGuide(points, centre, degrees) {
  if (!centre || !points.length) return null;
  // Choose from the source, never the moving image. Ties keep the first vertex.
  let index = 0;
  const distance = p => Math.hypot(p.x - centre.x, p.y - centre.y);
  points.forEach((p, i) => { if (distance(p) > distance(points[index]) + 1e-9) index = i; });
  const source = points[index];
  if (distance(source) < 1e-9) return null;
  return { index, source, image: rotatePoint(source, centre, degrees), start: Math.atan2(source.y - centre.y, source.x - centre.x), sweep: degrees * Math.PI / 180 };
}
export const mirrorGrip = handles => ({ x: (handles[0].x + handles[1].x) / 2, y: (handles[0].y + handles[1].y) / 2 });
export function moveMirror(handles, delta) { return handles.map(p => translatePoint(p, delta)); }
export function completedImage(source, points, objects) {
  return { id: crypto.randomUUID(), name: source.name.slice(0, 39) + '′', points: structuredClone(points), labels: imageLabels(source.labels, objects), image: true };
}
export class ReflectionScrub {
  constructor(progress = 0) { this.start = progress; this.progress = progress; this.last = progress; this.direction = 0; }
  move(value) {
    this.progress = Math.max(0, Math.min(1, value));
    // Ignore pointer jitter at rest without rounding the visible progress.
    if (Math.abs(this.progress - this.last) >= .004) { this.direction = Math.sign(this.progress - this.last); this.last = this.progress; }
    return this.progress;
  }
  target() { return this.direction ? (this.direction > 0 ? 1 : 0) : this.start >= .5 ? 1 : 0; }
}
export const formatNumber = n => String(Number(n.toFixed(3)));
export function lineEquation(line) {
  const { a, b, c } = normaliseLine(line);
  if (Math.abs(b) < 1e-9) return `x = ${formatNumber(-c / a)}`;
  const slope = -a / b, intercept = -c / b;
  if (Math.abs(slope) < 1e-9) return `y = ${formatNumber(intercept)}`;
  return `y = ${Math.abs(slope - 1) < 1e-9 ? '' : Math.abs(slope + 1) < 1e-9 ? '−' : formatNumber(slope)}x${Math.abs(intercept) < 1e-9 ? '' : ` ${intercept < 0 ? '−' : '+'} ${formatNumber(Math.abs(intercept))}`}`;
}

// Exact affine structure is checked during parsing; sampling an arbitrary equation
// at a few points could mistake a nonlinear curve for a valid mirror line.
export function parseMirrorEquation(source) {
  const s = source.replace(/\s/g, '').replaceAll('−', '-').replaceAll('×', '*').replaceAll('÷', '/');
  if (s.length > 120 || s.split('=').length !== 2) throw Error('line');
  function parse(expression) {
    const tokens = expression.match(/(?:\d*\.)?\d+|[xy()+*/-]/g) || [];
    if (!tokens.length || tokens.join('') !== expression) throw Error('line');
    let i = 0, depth = 0;
    const constant = p => Math.abs(p.a) < 1e-12 && Math.abs(p.b) < 1e-12;
    const scale = (p, n) => ({ a: p.a * n, b: p.b * n, c: p.c * n });
    const add = (p, q, n = 1) => ({ a: p.a + n * q.a, b: p.b + n * q.b, c: p.c + n * q.c });
    const atom = () => {
      if (++depth > 24) throw Error('line');
      const t = tokens[i++]; let p;
      if (t === '(') { p = sum(); if (tokens[i++] !== ')') throw Error('line'); }
      else if (t === 'x') p = { a: 1, b: 0, c: 0 };
      else if (t === 'y') p = { a: 0, b: 1, c: 0 };
      else if (/^(?:\d*\.)?\d+$/.test(t || '')) p = { a: 0, b: 0, c: Number(t) };
      else throw Error('line');
      depth--; return p;
    };
    const unary = () => {
      if (tokens[i] === '+' || tokens[i] === '-') { const sign = tokens[i++] === '-' ? -1 : 1; return scale(unary(), sign); }
      return atom();
    };
    const product = () => {
      let p = unary();
      while (i < tokens.length) {
        const t = tokens[i], implicit = ['x', 'y', '('].includes(t);
        if (!implicit && t !== '*' && t !== '/') break;
        if (!implicit) i++;
        const q = unary();
        if (t === '/') { if (!constant(q) || Math.abs(q.c) < 1e-12) throw Error('line'); p = scale(p, 1 / q.c); }
        else if (constant(q)) p = scale(p, q.c);
        else if (constant(p)) p = scale(q, p.c);
        else throw Error('line');
      }
      return p;
    };
    const sum = () => { let p = product(); while (tokens[i] === '+' || tokens[i] === '-') { const sign = tokens[i++] === '-' ? -1 : 1; p = add(p, product(), sign); } return p; };
    const p = sum(); if (i !== tokens.length) throw Error('line'); return p;
  }
  const [left, right] = s.split('=').map(parse);
  return normaliseLine({ a: left.a - right.a, b: left.b - right.b, c: left.c - right.c });
}
export function lineHandles(line, anchor = { x: 0, y: 0 }, radius = 3) {
  const f = lineFoot(anchor, line), n = normaliseLine(line);
  return [{ x: f.x - n.b * radius, y: f.y + n.a * radius }, { x: f.x + n.b * radius, y: f.y - n.a * radius }];
}
export function objectHit(p, object, tolerance) {
  const ps = object.points;
  if (ps.length > 2 && pointInPolygon(p, ps)) return true;
  return ps.some((a, i) => segmentDistance(p, a, ps[(i + 1) % ps.length]) <= tolerance);
}
export function polygonValid(points) {
  if (points.length < 3 || points.length > 30 || points.some((p, i) => points.some((q, j) => i !== j && Math.hypot(p.x - q.x, p.y - q.y) < 1e-7))) return false;
  const cross = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  for (let i = 0; i < points.length; i++) for (let j = i + 1; j < points.length; j++) {
    if (j === i + 1 || (i === 0 && j === points.length - 1)) continue;
    const a = points[i], b = points[(i + 1) % points.length], c = points[j], d = points[(j + 1) % points.length];
    if (cross(a, b, c) * cross(a, b, d) < 0 && cross(c, d, a) * cross(c, d, b) < 0) return false;
    if ([segmentDistance(a, c, d), segmentDistance(b, c, d), segmentDistance(c, a, b), segmentDistance(d, a, b)].some(n => n < 1e-8)) return false;
  }
  return Math.abs(points.reduce((s, p, i) => { const q = points[(i + 1) % points.length]; return s + p.x * q.y - q.x * p.y; }, 0)) > 1e-6;
}
export function nextLabels(objects, count) {
  const used = new Set(objects.flatMap(o => o.labels)); let i = 0; const labels = [];
  while (labels.length < count) { const label = String.fromCharCode(65 + i % 26) + (i >= 26 ? Math.floor(i / 26) : ''); if (!used.has(label)) labels.push(label); i++; }
  return labels;
}
export function imageLabels(labels, objects) {
  const used = new Set(objects.flatMap(o => o.labels));
  return labels.map(label => {
    let next = label + '′', serial = 1;
    while (used.has(next) || next.length > 40) {
      next = next.length < 40 ? next + '′' : label.replace(/′+$/, '').slice(0, 32) + '′' + serial++;
    }
    used.add(next); return next;
  });
}
export function eraseAnnotations(strokes, a, b, radius) {
  // Whole-stroke erasing in mathematical units: exact segment crossings also
  // catch fast pen/eraser movements with few samples, at any canvas zoom.
  const cross = (p, q, r) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
  return strokes.filter(s => !s.points.some((p, i) => {
    const q = s.points[Math.max(0, i - 1)], reach = radius + s.strokeWidth / 2;
    const crossing = cross(a, b, p) * cross(a, b, q) < 0 && cross(p, q, a) * cross(p, q, b) < 0;
    return crossing || Math.min(segmentDistance(p, a, b), segmentDistance(q, a, b), segmentDistance(a, p, q), segmentDistance(b, p, q)) <= reach;
  }));
}
export function newAnnotation(points, colour = '#d04d40', width = .065) {
  return createObject('InkStroke', { points, strokeColour: colour, strokeWidth: width });
}
export function transformationDocument() {
  return { ...newDocument(), title: 'Transformations', transformation: { version: 1, objects: [], annotations: [] } };
}
export function validTransformationDocument(doc) {
  const finite = n => Number.isFinite(n) && Math.abs(n) <= 1e5;
  const point = p => p && finite(p.x) && finite(p.y);
  const data = doc?.transformation;
  return doc?.schemaVersion === 1 && typeof doc.id === 'string' && data?.version === 1 &&
    Array.isArray(data.objects) && data.objects.length <= 100 && new Set(data.objects.map(o => o?.id)).size === data.objects.length &&
    data.objects.every(o => o && typeof o.id === 'string' && typeof o.name === 'string' && o.name.length <= 40 &&
      Array.isArray(o.points) && o.points.length >= 1 && o.points.length <= 30 && o.points.every(point) &&
      Array.isArray(o.labels) && o.labels.length === o.points.length && o.labels.every(s => typeof s === 'string' && s.length <= 40)) &&
    Array.isArray(data.annotations) && data.annotations.length <= 1000 && data.annotations.every(s => s && s.type === 'InkStroke' && typeof s.id === 'string' &&
      Array.isArray(s.points) && s.points.length > 0 && s.points.length <= 10000 && s.points.every(point) && point(s.position) &&
      s.rotation === 0 && s.scale?.x === 1 && s.scale?.y === 1 && finite(s.strokeWidth) && s.strokeWidth > 0 && s.strokeWidth <= 1 && /^#[0-9a-f]{6}$/i.test(s.strokeColour));
}
export function openTransformations(storage) {
  let doc, saved = true; try { storage ??= globalThis.localStorage; } catch { saved = false; }
  try { const stored = JSON.parse(storage.getItem(TRANSFORM_STORAGE)); if (validTransformationDocument(stored)) doc = stored; } catch { saved = false; }
  const store = new DocumentStore(doc || transformationDocument());
  const dispose = store.subscribe(d => { try { storage.setItem(TRANSFORM_STORAGE, JSON.stringify(d)); saved = true; } catch { saved = false; } });
  return { store, dispose, isSaved: () => saved };
}
