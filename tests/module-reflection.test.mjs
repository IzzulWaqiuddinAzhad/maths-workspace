import { test } from 'node:test';
import assert from 'node:assert/strict';
import { REFLECTION_QUESTIONS, ReflectionLesson, createModuleLesson, reflectionEquation, reflectionLine, findModuleQuestion } from '../dist/module-lesson.js';
import { reflectPoint, lineFoot, graphToScreen, screenToGraph, ReflectionScrub } from '../dist/transform-model.js';
import { reflectionSegment, paintReflectionLesson } from '../dist/module-reflection-render.js';

function setCorrectLine(lesson) {
  const mirror = lesson.question.mirror;
  lesson.chooseOrientation(mirror.kind);
  if (mirror.kind === 'slanted') lesson.setSlope(mirror.slope); else lesson.setPosition(mirror.k);
}

test('reflection questions 5–8 match the printed diagrams and independent scheme answers', () => {
  const givens = [{ x: -3, y: 4 }, { x: 4, y: 3 }, { x: 5, y: -2 }, { x: -4, y: 2 }];
  const answers = [{ x: 5, y: 4 }, { x: 4, y: -7 }, { x: -2, y: 5 }, { x: -2, y: 4 }];
  const equations = ['x = 1', 'y = −2', 'y = x', 'y = −x'];
  for (const [i, q] of REFLECTION_QUESTIONS.entries()) {
    const lesson = createModuleLesson(q), original = JSON.stringify(q);
    assert.ok(lesson instanceof ReflectionLesson); assert.equal(findModuleQuestion(String(i + 5)), q);
    assert.deepEqual(q.given, givens[i]); assert.deepEqual(lesson.answer, answers[i]);
    assert.equal(reflectionEquation(q.mirror), equations[i]);
    assert.equal(lesson.choice, null); assert.equal(lesson.reveal(), false);
    setCorrectLine(lesson); assert.equal(lesson.matchesQuestion, true); assert.equal(lesson.reveal(), false);
    assert.deepEqual(lesson.pointAt(0), givens[i]); assert.deepEqual(lesson.pointAt(1), answers[i]);
    const foot = lineFoot(q.given, lesson.line), halfway = lesson.pointAt(.5);
    assert.ok(Math.hypot(halfway.x - foot.x, halfway.y - foot.y) < 1e-8);
    lesson.scrub(1); assert.equal(lesson.answerVisible, false); assert.equal(lesson.reveal(), true);
    assert.deepEqual(reflectPoint(lesson.object, reflectionLine(q.mirror)), lesson.image, 'final mapping always means object → image');
    assert.equal(lesson.givenLabel, q.label + (i > 1 ? '′' : ''));
    assert.equal(lesson.answerLabel, q.label + (i > 1 ? '' : '′'));
    assert.equal(JSON.stringify(q), original);
  }
});

test('wrong suggestions remain exploratory; line changes and scrubbing invalidate reveals', () => {
  const lesson = new ReflectionLesson();
  lesson.chooseOrientation('horizontal'); lesson.setPosition(1); lesson.toggleGuides(); lesson.scrub(1);
  assert.equal(lesson.equation, 'y = 1'); assert.deepEqual(lesson.trialAnswer, { x: -3, y: -2 });
  assert.equal(lesson.reveal(), false); assert.equal(lesson.answerVisible, false);
  lesson.chooseOrientation('vertical'); assert.equal(lesson.progress, 0); assert.equal(lesson.guideVisible, true);
  lesson.setPosition(1); lesson.scrub(1); assert.equal(lesson.reveal(), true);
  assert.equal(lesson.setPosition(1), false); assert.equal(lesson.answerVisible, true, 'no movement does not discard the reveal');
  lesson.setPosition(2); assert.equal(lesson.progress, 0); assert.equal(lesson.answerVisible, false);
  lesson.setPosition(1); lesson.scrub(1); lesson.reveal(); lesson.scrub(.4); assert.equal(lesson.answerVisible, false);
  lesson.reset(); assert.equal(lesson.choice, null); assert.equal(lesson.guideVisible, false); assert.equal(lesson.progress, 0);
});

test('line position snaps without direction drift under pan and zoom; invalid input is ignored', () => {
  for (const kind of ['horizontal', 'vertical']) for (const view of [{ x: 200, y: 300, zoom: .35 }, { x: -40, y: 550, zoom: 2.3 }]) {
    const lesson = new ReflectionLesson(); lesson.chooseOrientation(kind);
    const start = { x: 2, y: 2 }, current = { x: 5.2, y: -1.8 };
    const p = screenToGraph(graphToScreen(current, view), view), axis = kind === 'horizontal' ? 'y' : 'x';
    lesson.setPosition(p[axis] - start[axis]);
    assert.equal(lesson.choice.kind, kind); assert.equal(lesson.choice.k, kind === 'horizontal' ? -4 : 3);
    const before = lesson.equation; assert.equal(lesson.setPosition(NaN), false); assert.equal(lesson.equation, before);
    lesson.setPosition(100); assert.equal(lesson.choice.k, 8); lesson.setPosition(-100); assert.equal(lesson.choice.k, -8);
    assert.equal(lesson.chooseOrientation('circle'), false);
  }
});

test('every allowed trial has equal perpendicular distances and fits its extended grid', () => {
  for (const q of REFLECTION_QUESTIONS) for (const kind of ['horizontal', 'vertical', 'slanted']) for (const k of [-8, -2, 0, 1, 8]) {
    const lesson = new ReflectionLesson(q); lesson.chooseOrientation(kind);
    if (kind === 'slanted') lesson.setSlope(k < 0 ? -1 : 1); else lesson.setPosition(k);
    const p = q.given, f = lesson.foot, image = lesson.trialAnswer, line = lesson.line;
    assert.ok(Math.abs(Math.hypot(p.x-f.x,p.y-f.y)-Math.hypot(image.x-f.x,image.y-f.y)) < 1e-8);
    assert.ok(Math.abs(line.a*f.x+line.b*f.y+line.c) < 1e-8);
    assert.ok(Math.abs((p.x-image.x)*line.b-(p.y-image.y)*line.a) < 1e-8);
    assert.deepEqual(reflectPoint(image,line),p);
    assert.ok(image.x >= lesson.bounds.xmin && image.x <= lesson.bounds.xmax && image.y >= lesson.bounds.ymin && image.y <= lesson.bounds.ymax);
    for (const end of reflectionSegment(lesson.choice,lesson.bounds)) {
      assert.ok(Number.isFinite(end.x) && Number.isFinite(end.y)); assert.ok(Math.abs(line.a*end.x+line.b*end.y+line.c)<1e-8);
    }
  }
});

test('reflection guides show equality only at completion and no square for a point on the mirror', () => {
  const ctx = new Proxy({ measureText: s => ({ width: s.length * 8 }) }, { get: (t,k) => t[k] ?? (()=>{}) });
  const lesson = new ReflectionLesson(); lesson.chooseOrientation('vertical'); lesson.setPosition(1); lesson.toggleGuides();
  const draw = () => paintReflectionLesson(ctx, { lesson, view: { x:300,y:300,zoom:1 }, bounds:lesson.bounds, dark:false });
  lesson.scrub(.5); const half = draw(); lesson.scrub(1); const full = draw();
  assert.equal(full.segments.length, half.segments.length + 2, 'matching tick marks only on equal completed halves');
  lesson.setPosition(-3); lesson.scrub(1); const fixed = draw(); assert.ok(fixed.segments.length < full.segments.length);
  assert.deepEqual(lesson.pointAt(.4),lesson.question.given);
  const scrub = new ReflectionScrub(); scrub.move(.7); scrub.move(.3); assert.equal(scrub.target(),0);
  const forward = new ReflectionScrub(); forward.move(.2); assert.equal(forward.target(),1);
});
