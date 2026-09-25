import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTransformationRenderer } from '../dist/transform-render.js';
import { rotationGuide, rotatePoint } from '../dist/transform-model.js';

test('rotation renderer paints signed reflex/full-turn wedges and clears them when hidden', () => {
  const oldDocument = globalThis.document, oldDpr = globalThis.devicePixelRatio;
  globalThis.document = { body: { classList: { contains: () => false } } }; globalThis.devicePixelRatio = 1;
  try {
    const arcs = [], texts = [], clears = [];
    const ctx = new Proxy({ measureText: s => ({ width: s.length * 7 }), arc: (...a) => arcs.push(a), fillText: s => texts.push(s), clearRect: (...a) => clears.push(a) }, { get(target, key) { return target[key] ?? (() => {}); } });
    const draw = createTransformationRenderer({ clientWidth: 800, clientHeight: 600, getContext: () => ctx });
    const source = { id: 'a', labels: ['A', 'B', 'C'], points: [{ x: 6, y: 0 }, { x: 1, y: 2 }, { x: 0, y: 1 }] }, centre = { x: 0, y: 0 };
    const state = { view: { x: 400, y: 300, zoom: 1 }, objects: [source], selected: source.id, annotations: [], transform: 'rotation', centre, rotationWedge: true };
    for (const degrees of [90, 270, -270, 360, -360]) {
      arcs.length = 0; texts.length = 0;
      draw({ ...state, angle: degrees, rotationGuide: rotationGuide(source.points, centre, degrees), rotationLabel: `${Math.abs(degrees)}°`, preview: { ...source, id: 'preview', points: source.points.map(p => rotatePoint(p, centre, degrees)) } });
      const wedge = arcs.find(a => a[2] === 72);
      assert.ok(wedge); assert.ok(Math.abs((wedge[4] - wedge[3]) + degrees * Math.PI / 180) < 1e-8);
      assert.equal(wedge[5], degrees > 0); assert.ok(texts.includes(`${Math.abs(degrees)}°`));
    }
    arcs.length = 0; texts.length = 0;
    draw({ ...state, rotationWedge: false, angle: 270, rotationGuide: rotationGuide(source.points, centre, 270), rotationLabel: '270°' });
    assert.equal(arcs.some(a => a[2] === 72), false); assert.equal(texts.includes('270°'), false); assert.equal(clears.length, 6);
  } finally { if (oldDocument === undefined) delete globalThis.document; else globalThis.document = oldDocument; if (oldDpr === undefined) delete globalThis.devicePixelRatio; else globalThis.devicePixelRatio = oldDpr; }
});
