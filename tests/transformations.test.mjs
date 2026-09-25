import { test } from 'node:test';
import assert from 'node:assert/strict';
import { zoomAt } from '../dist/core.js';
import {
  translatePoint, rotatePoint, reflectPoint, flipPoint, lineFoot, lineFromPoints,
  parseMirrorEquation, lineEquation, lineHandles, snapRotation, leverAngle,
  graphToScreen, screenToGraph, polygonValid, nextLabels, imageLabels,
  newAnnotation, eraseAnnotations, openTransformations, validTransformationDocument,
  transformationDocument, objectHit, ReflectionScrub,
} from '../dist/transform-model.js';
const near = (a, b, eps = 1e-8) => assert.ok(Math.abs(a - b) < eps, `${a} ≠ ${b}`);
const same = (a, b) => { near(a.x, b.x); near(a.y, b.y); };

test('trial-paper translation and rotation examples use mathematical positive y', () => {
  same(translatePoint({ x: 4, y: 2 }, { x: -4, y: 2 }), { x: 0, y: 4 });
  same(rotatePoint({ x: 0, y: 4 }, { x: 6, y: 3 }, -90), { x: 7, y: 9 });
  same(rotatePoint({ x: -2, y: -4 }, { x: 0, y: -1 }, 90), { x: 3, y: -3 });
});
test('translations are based on the source; arbitrary rotations preserve lengths and signed full turns', () => {
  const original = [{ x: -4, y: 1 }, { x: -1, y: 1 }, { x: -3, y: 4 }], centre = { x: 2.5, y: -1.5 };
  for (const angle of [-360, -270, -180, -90, -35, 0, 17, 90, 180, 270, 360]) {
    const result = original.map(p => rotatePoint(p, centre, angle));
    result.forEach((p, i) => { same(rotatePoint(p, centre, -angle), original[i]); near(Math.hypot(p.x - centre.x, p.y - centre.y), Math.hypot(original[i].x - centre.x, original[i].y - centre.y)); });
    near(Math.hypot(result[0].x - result[1].x, result[0].y - result[1].y), 3);
  }
  same(translatePoint(original[0], { x: 3, y: 1 }), { x: -1, y: 2 });
  assert.deepEqual(original[0], { x: -4, y: 1 });
});
test('mirror equations accept horizontal, vertical, slanted and fractional affine forms', () => {
  for (const [source, p, q] of [
    ['x=3', { x: 1, y: 4 }, { x: 5, y: 4 }],
    ['y=-2', { x: 1, y: 4 }, { x: 1, y: -8 }],
    ['y=x', { x: 2, y: 5 }, { x: 5, y: 2 }],
    ['y=-x', { x: 2, y: 5 }, { x: -5, y: -2 }],
    ['2x+2y=4', { x: 0, y: 0 }, { x: 2, y: 2 }],
    ['y=(1/2)x+1', { x: 0, y: 1 }, { x: 0, y: 1 }],
    ['x=1/2', { x: -1, y: 4 }, { x: 2, y: 4 }],
  ]) same(reflectPoint(p, parseMirrorEquation(source)), q);
  assert.equal(lineEquation(parseMirrorEquation('y=-x')), 'y = −x');
});
test('mirror parser rejects nonlinear, executable, degenerate and malformed expressions', () => {
  for (const source of ['x*x=0', 'y=sin(x)', 'x/y=2', 'y=1/x', 'x=x', '0=4', 'x=1/0', 'y=', 'x<3', 'alert(1)=y', 'x=1=2', 'y=x^2', 'x=1..3']) assert.throws(() => parseMirrorEquation(source), source);
  assert.throws(() => lineFromPoints({ x: 1, y: 1 }, { x: 1, y: 1 }));
});
test('reflection is an involution and its hinge is the perpendicular bisector at any orientation', () => {
  for (let i = 0; i < 40; i++) {
    const line = lineFromPoints({ x: -3, y: 2 }, { x: i / 7 - 2, y: 5 - i / 6 }), p = { x: i / 3 - 7, y: 8 - i / 4 };
    const q = reflectPoint(p, line), f = lineFoot(p, line);
    same(reflectPoint(q, line), p); same({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 }, f);
    near(line.a * f.x + line.b * f.y + line.c, 0);
    near((q.x - p.x) * -line.b + (q.y - p.y) * line.a, 0);
  }
});
test('book flip starts at original, is edge-on at halfway, finishes at exact reflection and fixes hinge points', () => {
  const line = parseMirrorEquation('y=2x+1'), p = { x: 5, y: -3 }, f = lineFoot(p, line);
  same(flipPoint(p, line, 0), p); same(flipPoint(p, line, .5), f); same(flipPoint(p, line, 1), reflectPoint(p, line));
  for (const t of [0, .1, .25, .5, .8, 1]) same(flipPoint(f, line, t), f);
  for (const p of lineHandles(line)) near(line.a * p.x + line.b * p.y + line.c, 0);
});
test('lever is bidirectional, clamps at full turns and snaps gently without losing arbitrary angles', () => {
  assert.equal(leverAngle(100, 100, 400), 360); assert.equal(leverAngle(300, 100, 400), 0); assert.equal(leverAngle(500, 100, 400), -360);
  for (const stop of [-360, -270, -180, -90, 0, 90, 180, 270, 360]) { assert.equal(snapRotation(stop + 1), stop); assert.equal(snapRotation(stop - 1), stop); }
  assert.equal(snapRotation(35), 35); assert.equal(snapRotation(120), 120); assert.equal(snapRotation(89, false), 89);
});
test('reflection follows continuous drag and releases toward the last deliberate movement, not nearest endpoint', () => {
  const up = new ReflectionScrub(0); near(up.move(.1234), .1234); assert.equal(up.target(), 1);
  const down = new ReflectionScrub(1); down.move(.9); assert.equal(down.target(), 0);
  const reverse = new ReflectionScrub(0); reverse.move(.8); reverse.move(.65); reverse.move(.651); assert.equal(reverse.target(), 0);
  assert.equal(reverse.move(-2), 0); assert.equal(reverse.move(2), 1);
  assert.equal(new ReflectionScrub(0).target(), 0); assert.equal(new ReflectionScrub(1).target(), 1);
});
test('shared world/canvas conversion survives pan, zoom, resize and midpoint-anchored zoom', () => {
  const p = { x: -3.2, y: 4.8 };
  for (const view of [{ x: 420, y: 280, zoom: 1 }, { x: -67, y: 531, zoom: .65 }, { x: 998, y: -304, zoom: 2.5 }]) {
    same(screenToGraph(graphToScreen(p, view), view), p);
    const midpoint = { x: 300, y: 170 }, before = screenToGraph(midpoint, view), after = screenToGraph(midpoint, zoomAt(view, midpoint, 1.25)); same(before, after);
  }
});
test('custom polygons allow concave trial-paper shapes but reject crossing, touching and flat shapes', () => {
  assert.ok(polygonValid([{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 2, y: 1 }, { x: 4, y: 3 }, { x: 0, y: 3 }]));
  assert.equal(polygonValid([{ x: 0, y: 0 }, { x: 4, y: 3 }, { x: 0, y: 3 }, { x: 4, y: 0 }]), false);
  assert.equal(polygonValid([{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 2 }]), false);
  assert.equal(polygonValid([{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 2, y: 0 }, { x: 0, y: 3 }]), false);
  assert.ok(objectHit({ x: 1, y: 1 }, { points: [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 0, y: 4 }] }, .1));
});
test('source and successive image labels do not collide', () => {
  const objects = [{ labels: ['A', 'B', 'C', 'A′'] }];
  assert.deepEqual(nextLabels(objects, 3), ['D', 'E', 'F']); assert.deepEqual(imageLabels(['A', 'B', 'C'], objects), ['A′′', 'B′', 'C′']);
});
test('annotation eraser removes only touched ink; stored graph history and reload remain independent', () => {
  const memory = new Map(), storage = { getItem: k => memory.get(k), setItem: (k, v) => memory.set(k, v) };
  const a = openTransformations(storage);
  const stroke = newAnnotation([{ x: 0, y: 0 }, { x: 4, y: 0 }]), other = newAnnotation([{ x: 0, y: 3 }, { x: 4, y: 3 }]);
  a.store.transact(d => { d.transformation.objects.push({ id: 'object', name: 'Point A', labels: ['A'], points: [{ x: 2, y: 0 }] }); d.transformation.annotations.push(stroke, other); });
  a.store.transact(d => { d.transformation.annotations = eraseAnnotations(d.transformation.annotations, { x: 2, y: -1 }, { x: 2, y: 1 }, .3); });
  assert.deepEqual(a.store.document.transformation.annotations.map(s => s.id), [other.id]); assert.equal(a.store.document.transformation.objects.length, 1);
  a.store.undo(); assert.equal(a.store.document.transformation.annotations.length, 2); a.store.redo();
  const b = openTransformations(storage); assert.deepEqual(b.store.document.transformation, a.store.document.transformation); assert.ok(validTransformationDocument(b.store.document));
  a.dispose(); b.dispose();
});
test('malformed stored explorations are rejected', () => {
  const d = transformationDocument(); assert.ok(validTransformationDocument(d));
  d.transformation.objects.push({ id: 'x', name: 'x', points: [{ x: Infinity, y: 0 }], labels: ['A'] }); assert.equal(validTransformationDocument(d), false);
  const recovered = openTransformations({ getItem: () => JSON.stringify(d), setItem() {} }); assert.equal(recovered.store.document.transformation.objects.length, 0); recovered.dispose();
});

test('eraser catches sparse diagonal strokes and fast crossings without rounding to grid units', () => {
  const stroke = newAnnotation([{ x: 0, y: 0 }, { x: 8, y: 8 }]);
  assert.equal(eraseAnnotations([stroke], { x: .31, y: .39 }, { x: .39, y: .31 }, .01).length, 0);
  assert.equal(eraseAnnotations([stroke], { x: 3.35, y: 3.35 }, { x: 3.35, y: 3.35 }, .01).length, 0);
  assert.equal(eraseAnnotations([stroke], { x: 1, y: 3 }, { x: 2, y: 4 }, .1).length, 1);
});
test('many successive image labels still fit the saved-document schema', () => {
  const d = transformationDocument(); let label = 'A';
  for (let i = 0; i < 80; i++) { [label] = imageLabels([label], d.transformation.objects); d.transformation.objects.push({ id: String(i), name: 'Image', labels: [label], points: [{ x: 0, y: 0 }] }); }
  assert.ok(validTransformationDocument(d)); assert.equal(new Set(d.transformation.objects.map(o => o.labels[0])).size, 80);
});

test('storage failures retain current work and do not falsely report it saved', () => {
  const studio = openTransformations({ getItem() { throw Error('blocked'); }, setItem() { throw Error('quota'); } });
  studio.store.transact(d => d.transformation.objects.push({ id: 'a', name: 'A', labels: ['A'], points: [{ x: 1, y: 2 }] }));
  assert.equal(studio.isSaved(), false); assert.equal(studio.store.document.transformation.objects.length, 1);
  studio.store.undo(); assert.equal(studio.store.document.transformation.objects.length, 0); studio.dispose();
  const bad = transformationDocument(); bad.transformation.objects = [null]; assert.equal(validTransformationDocument(bad), false);
});
