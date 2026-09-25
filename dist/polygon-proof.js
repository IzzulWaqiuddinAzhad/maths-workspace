const EPS = 1e-7,
  TAU = 2 * Math.PI;
const cross = (a, b, c) =>
  (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
export const signedArea = (ps) =>
  ps.reduce(
    (s, p, i) =>
      s + p.x * ps[(i + 1) % ps.length].y - p.y * ps[(i + 1) % ps.length].x,
    0,
  ) / 2;
const on = (p, a, b) =>
  Math.abs(cross(a, b, p)) < EPS &&
  p.x >= Math.min(a.x, b.x) - EPS &&
  p.x <= Math.max(a.x, b.x) + EPS &&
  p.y >= Math.min(a.y, b.y) - EPS &&
  p.y <= Math.max(a.y, b.y) + EPS;
export function intersects(a, b, c, d) {
  return (
    (cross(a, b, c) * cross(a, b, d) < -EPS &&
      cross(c, d, a) * cross(c, d, b) < -EPS) ||
    on(a, c, d) ||
    on(b, c, d) ||
    on(c, a, b) ||
    on(d, a, b)
  );
}
export function inside(p, ps) {
  let yes = false;
  for (let i = 0, j = ps.length - 1; i < ps.length; j = i++) {
    const a = ps[i],
      b = ps[j];
    if (on(p, a, b)) return false;
    if (
      a.y > p.y !== b.y > p.y &&
      p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x
    )
      yes = !yes;
  }
  return yes;
}
export function polygonError(ps) {
  if (
    ps.length < 3 ||
    ps.some((p) => !Number.isFinite(p.x) || !Number.isFinite(p.y))
  )
    return "incomplete";
  for (let i = 0; i < ps.length; i++) {
    const a = ps[i],
      b = ps[(i + 1) % ps.length],
      c = ps[(i + 2) % ps.length];
    if (
      Math.hypot(a.x - b.x, a.y - b.y) < 1e-4 ||
      Math.abs(cross(a, b, c)) < EPS
    )
      return "degenerate";
    for (let j = i + 1; j < ps.length; j++) {
      if (j === i + 1 || (i === 0 && j === ps.length - 1)) continue;
      if (intersects(a, b, ps[j], ps[(j + 1) % ps.length])) return "simple";
    }
  }
  return Math.abs(signedArea(ps)) < EPS ? "degenerate" : null;
}
export function interior(ps, i) {
  const p = ps[i],
    a = ps[(i + ps.length - 1) % ps.length],
    b = ps[(i + 1) % ps.length],
    start = Math.atan2(a.y - p.y, a.x - p.x);
  let sweep = (Math.atan2(b.y - p.y, b.x - p.x) - start + TAU) % TAU;
  if (signedArea(ps) > 0) sweep -= TAU;
  return { p, start, sweep, degrees: (Math.abs(sweep) * 180) / Math.PI };
}
function split(faces, a, b) {
  const i = faces.findIndex((f) => f.includes(a) && f.includes(b));
  if (i < 0) return false;
  const f = faces[i],
    x = f.indexOf(a),
    y = f.indexOf(b),
    lo = Math.min(x, y),
    hi = Math.max(x, y);
  if (hi - lo === 1 || hi - lo === f.length - 1) return false;
  faces.splice(i, 1, f.slice(lo, hi + 1), [
    ...f.slice(hi),
    ...f.slice(0, lo + 1),
  ]);
  return true;
}
export function triangulation(ps, cuts = []) {
  const error = polygonError(ps);
  if (error) return { error, faces: [], complete: false };
  const faces = [ps.map((_, i) => i)],
    accepted = [];
  for (const [a, b] of cuts) {
    if (
      !Number.isInteger(a) ||
      !Number.isInteger(b) ||
      !ps[a] ||
      !ps[b] ||
      a === b
    )
      return { error: "diagonal", faces: [], complete: false };
    const A = ps[a],
      B = ps[b];
    if (!inside({ x: (A.x + B.x) / 2, y: (A.y + B.y) / 2 }, ps))
      return { error: "diagonal", faces: [], complete: false };
    for (let i = 0; i < ps.length; i++) {
      const j = (i + 1) % ps.length;
      if (i === a || j === a || i === b || j === b) continue;
      if (intersects(A, B, ps[i], ps[j]))
        return { error: "diagonal", faces: [], complete: false };
    }
    for (const [c, d] of accepted) {
      if (c === a || c === b || d === a || d === b) continue;
      if (intersects(A, B, ps[c], ps[d]))
        return { error: "crossing", faces: [], complete: false };
    }
    if (!split(faces, a, b))
      return { error: "diagonal", faces: [], complete: false };
    accepted.push([a, b]);
  }
  return { error: null, faces, complete: faces.every((f) => f.length === 3) };
}
export function nextDiagonal(ps, cuts) {
  const state = triangulation(ps, cuts);
  if (state.error || state.complete) return null;
  for (const f of state.faces) {
    if (f.length === 3) continue;
    for (let i = 0; i < f.length; i++) {
      const a = f[i],
        b = f[(i + 2) % f.length];
      if (!triangulation(ps, [...cuts, [a, b]]).error) return [a, b];
    }
  }
  return null;
}
export function regularPolygon(n) {
  return Array.from({ length: n }, (_, i) => ({
    x: 220 + 145 * Math.cos(-Math.PI / 2 + (i * TAU) / n),
    y: 230 + 145 * Math.sin(-Math.PI / 2 + (i * TAU) / n),
  }));
}
export class PolygonProof {
  constructor(n = 3) {
    this.reset(n);
  }
  reset(n) {
    this.points = regularPolygon(n);
    this.cuts = [];
    this.progress = 0;
    this.notice = null;
    this.triangleIds = new Map();
    this.nextTriangleId = 1;
  }
  get state() {
    return triangulation(this.points, this.cuts);
  }
  get triangles() {
    return this.state.faces
      .filter((face) => face.length === 3)
      .map((face) => {
        const key = [...face].sort((a, b) => a - b).join(":");
        if (!this.triangleIds.has(key))
          this.triangleIds.set(key, this.nextTriangleId++);
        return { id: this.triangleIds.get(key), key, face };
      })
      .sort((a, b) => a.id - b.id);
  }

  add(a, b) {
    const state = triangulation(this.points, [...this.cuts, [a, b]]);
    if (state.error) {
      this.notice = state.error;
      return false;
    }
    this.cuts.push([a, b]);
    this.progress = 0;
    this.notice = null;
    return true;
  }
  move(i, p) {
    this.points[i] = p;
    const state = this.state;
    if (state.error) {
      if (this.cuts.length) this.notice = "reset";
      else this.notice = state.error;
      this.cuts = [];
      this.progress = 0;
    } else this.notice = null;
  }
  auto() {
    let cut;
    while ((cut = nextDiagonal(this.points, this.cuts))) this.add(...cut);
  }
  scrub(value) {
    this.progress = this.state.complete ? Math.max(0, Math.min(1, value)) : 0;
  }
}
// Use the same sectors before, during and after extraction. A cut splits its
// endpoint angles even when the remaining faces have not all become triangles.
export function faceAngles(points, face) {
  const ps = face.map((i) => points[i]),
    key = [...face].sort((a, b) => a - b).join(":");
  return ps.map((_, i) => {
    const a = interior(ps, i);
    return {
      ...a,
      id: `${key}@${face[i]}`,
      vertex: face[i],
      start: a.sweep < 0 ? a.start + a.sweep : a.start,
      sweep: Math.abs(a.sweep),
    };
  });
}

// Each triangle contributes a half-turn. Preserve sector size throughout rotation.
export function anglePieces(points, face, progress, target) {
  const ps = face.map((i) => points[i]),
    centre = {
      x: ps.reduce((s, p) => s + p.x, 0) / 3,
      y: ps.reduce((s, p) => s + p.y, 0) / 3,
    };
  let cursor = -Math.PI;
  progress = Math.max(0, Math.min(1, progress));
  return faceAngles(points, face).map((a) => {
    const { p, sweep: size, start } = a;
    const endStart = cursor;
    cursor += size;
    const extract = Math.min(1, progress / 0.35),
      travel = Math.max(0, (progress - 0.35) / 0.65),
      dx = p.x - centre.x,
      dy = p.y - centre.y,
      d = Math.hypot(dx, dy) || 1;
    const source = {
      x: p.x + (dx / d) * 22 * extract,
      y: p.y + (dy / d) * 22 * extract,
    };
    const rotation = Math.atan2(
      Math.sin(endStart - start),
      Math.cos(endStart - start),
    );
    return {
      ...a,
      sourceP: p,
      target,
      rotation,
      travel,
      p: {
        x: source.x + (target.x - source.x) * travel,
        y: source.y + (target.y - source.y) * travel,
      },
      start: start + rotation * travel,
      sweep: size,
      degrees: a.degrees,
    };
  });
}

// Carry the label in the wedge's local frame. The text stays upright while its
// anchor translates, rotates and grows with the sector, including reverse scrub.
export function carryAngleLabel(piece, sourceLabel, targetLabel) {
  const rotate = (p, a) => ({
    x: p.x * Math.cos(a) - p.y * Math.sin(a),
    y: p.x * Math.sin(a) + p.y * Math.cos(a),
  });
  const from = {
      x: sourceLabel.x - piece.sourceP.x,
      y: sourceLabel.y - piece.sourceP.y,
    },
    to = rotate(
      { x: targetLabel.x - piece.target.x, y: targetLabel.y - piece.target.y },
      -piece.rotation,
    ),
    t = piece.travel,
    offset = rotate(
      { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t },
      piece.rotation * t,
    );
  return { ...sourceLabel, x: piece.p.x + offset.x, y: piece.p.y + offset.y };
}
