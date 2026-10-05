import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TRANSLATION_QUESTIONS, QUESTION_ONE, findModuleQuestion, TranslationLesson, fitQuestion } from '../dist/module-lesson.js';
import { graphToScreen, translatePoint } from '../dist/transform-model.js';

test('module Q1 uses the exact printed point and vector, matching scheme Q1', () => {
  const lesson = new TranslationLesson();
  assert.deepEqual(QUESTION_ONE.given, { x: -4, y: 3 });
  assert.deepEqual(lesson.answer, { x: 2, y: 1 });
  assert.equal(lesson.answerVisible, false);
  lesson.goTo(1); assert.deepEqual(lesson.pointAt(), { x: -4, y: 3 });
  lesson.goTo(2); assert.deepEqual(lesson.pointAt(), { x: 2, y: 3 });
  lesson.goTo(3); assert.deepEqual(lesson.pointAt(), { x: 2, y: 1 });
  assert.equal(lesson.answerVisible, false);
  lesson.goTo(4); assert.equal(lesson.answerVisible, true);
  lesson.goTo(3); assert.equal(lesson.answerVisible, false);
  lesson.reset(); assert.equal(lesson.stage, 0); assert.equal(lesson.progress, 0);
});

test('teacher scrubbing follows component directions and clears a revealed answer', () => {
  const lesson = new TranslationLesson(); lesson.goTo(4);
  lesson.scrub(.5); assert.deepEqual(lesson.pointAt(), { x: -1, y: 3 });
  assert.equal(lesson.answerVisible, false);
  lesson.scrub(1.5); assert.deepEqual(lesson.pointAt(), { x: 2, y: 2 });
  lesson.scrub(2); assert.deepEqual(lesson.pointAt(), lesson.answer);
  assert.equal(lesson.answerVisible, false);
  lesson.scrub(-1); assert.deepEqual(lesson.pointAt(), QUESTION_ONE.given);
  assert.deepEqual(QUESTION_ONE.given, { x: -4, y: 3 });
  lesson.scrub(NaN); assert.ok(Number.isFinite(lesson.pointAt().x));
});

test('all four printed translation questions match their independent answer-scheme coordinates', () => {
  const answers = [{ x: 2, y: 1 }, { x: -2, y: 4 }, { x: 2, y: 6 }, { x: 1, y: -7 }];
  const corners = [{ x: 2, y: 3 }, { x: -2, y: -2 }, { x: 2, y: 4 }, { x: 1, y: -4 }];
  for (const [i, q] of TRANSLATION_QUESTIONS.entries()) {
    const lesson = new TranslationLesson(q), before = JSON.stringify(q);
    assert.deepEqual(lesson.answer, answers[i]);
    assert.deepEqual(translatePoint(lesson.object, q.vector), lesson.image, 'final mapping always uses the stated forward vector');
    lesson.goTo(1); assert.deepEqual(lesson.pointAt(), q.given);
    lesson.goTo(2); assert.deepEqual(lesson.pointAt(), corners[i]);
    lesson.goTo(3); assert.deepEqual(lesson.pointAt(), answers[i]);
    assert.equal(lesson.answerVisible, false);
    lesson.goTo(4); assert.equal(lesson.answerVisible, true);
    lesson.scrub(.5); assert.equal(lesson.answerVisible, false);
    lesson.reset(); assert.deepEqual(lesson.pointAt(), q.given);
    assert.equal(JSON.stringify(q), before);
    assert.equal(findModuleQuestion(q.id), q);
  }
  assert.equal(findModuleQuestion('9'), undefined);
  assert.equal(findModuleQuestion('not-a-question'), undefined);
});

test('inverse questions distinguish the given image from the unknown original object', () => {
  const c = new TranslationLesson(findModuleQuestion('3'));
  assert.equal(c.givenLabel, 'C′'); assert.equal(c.answerLabel, 'C');
  assert.deepEqual(c.movementVector, { x: -3, y: 2 });
  assert.deepEqual(c.image, { x: 5, y: 4 }); assert.deepEqual(c.object, { x: 2, y: 6 });
  const d = new TranslationLesson(findModuleQuestion('4'));
  assert.equal(d.givenLabel, 'D′'); assert.equal(d.answerLabel, 'D');
  assert.deepEqual(d.movementVector, { x: 4, y: -3 });
  assert.deepEqual(d.image, { x: -3, y: -4 }); assert.deepEqual(d.object, { x: 1, y: -7 });
});

test('module fitting keeps the complete original grid visible with square units', () => {
  for (const [w, h] of [[1160, 710], [600, 950], [390, 410]]) {
    const view = fitQuestion(QUESTION_ONE.bounds, w, h);
    for (const x of [-8, 8]) for (const y of [-8, 8]) {
      const p = graphToScreen({ x, y }, view);
      assert.ok(p.x >= 47 && p.x <= w - 47);
      assert.ok(p.y >= 47 && p.y <= h - 47);
    }
    const a = graphToScreen({ x: 0, y: 0 }, view), b = graphToScreen({ x: 1, y: 1 }, view);
    assert.ok(Math.abs((b.x - a.x) - (a.y - b.y)) < 1e-9);
  }
});
