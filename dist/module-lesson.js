import { translatePoint, GRID_UNIT } from './transform-model.js?v=29';

// A1, printed page 1 (PDF page 2), BIJAK Transformasi Bengkel v4.2.
// Read each given point from the original diagram, not from the answer scheme.
// Q3–4 supply the IMAGE, so the missing object uses the inverse vector.
export const TRANSLATION_QUESTIONS = Object.freeze([
  { id: '1', label: 'A', find: 'image', given: { x: -4, y: 3 }, vector: { x: 6, y: -2 } },
  { id: '2', label: 'B', find: 'image', given: { x: 3, y: -2 }, vector: { x: -5, y: 6 } },
  { id: '3', label: 'C', find: 'object', given: { x: 5, y: 4 }, vector: { x: 3, y: -2 } },
  { id: '4', label: 'D', find: 'object', given: { x: -3, y: -4 }, vector: { x: -4, y: 3 } },
].map(q => Object.freeze({
  ...q, number: q.id.padStart(2, '0'), section: 'A1', type: 'translation',
  given: Object.freeze(q.given), vector: Object.freeze(q.vector),
  bounds: Object.freeze({ xmin: -8, xmax: 8, ymin: -8, ymax: 8 }),
  prompt: Object.freeze({
    en: `${q.label}′ is the image of ${q.label} under translation T. ${q.find === 'image' ? 'Find its coordinates.' : `Find the coordinates of ${q.label}.`}`,
    bm: `${q.label}′ ialah imej bagi ${q.label} di bawah translasi T. Cari koordinat ${q.label}${q.find === 'image' ? '′' : ''}.`,
  }),
})));
export const QUESTION_ONE = TRANSLATION_QUESTIONS[0];
export const findModuleQuestion = id => TRANSLATION_QUESTIONS.find(q => q.id === id);

export class TranslationLesson {
  constructor(question = QUESTION_ONE) { this.question = question; this.reset(); }
  reset() { this.stage = 0; this.progress = 0; this.answerVisible = false; }
  get inverse() { return this.question.find === 'object'; }
  get givenLabel() { return this.question.label + (this.inverse ? '′' : ''); }
  get answerLabel() { return this.question.label + (this.inverse ? '' : '′'); }
  get movementVector() { const v = this.question.vector, sign = this.inverse ? -1 : 1; return { x: sign * v.x, y: sign * v.y }; }
  get answer() { return translatePoint(this.question.given, this.movementVector); }
  get object() { return this.inverse ? this.answer : this.question.given; }
  get image() { return this.inverse ? this.question.given : this.answer; }
  get targetProgress() { return Math.max(0, Math.min(2, this.stage - 1)); }
  goTo(stage) {
    this.stage = Math.max(0, Math.min(4, Math.round(stage)));
    this.answerVisible = this.stage === 4;
    this.progress = this.targetProgress;
  }
  scrub(progress) {
    this.progress = Number.isFinite(progress) ? Math.max(0, Math.min(2, progress)) : 0;
    this.stage = this.progress > 1 ? 3 : this.progress > 0 ? 2 : 1;
    // Returning to an intermediate state never leaves the final answer visible.
    this.answerVisible = false;
  }
  pointAt(progress = this.progress) {
    const p = Math.max(0, Math.min(2, progress)), v = this.movementVector;
    return translatePoint(this.question.given, { x: v.x * Math.min(1, p), y: v.y * Math.max(0, p - 1) });
  }
}

export function fitQuestion(bounds, width, height) {
  const zoom = Math.max(.1, Math.min(2.5,
    (width - 96) / ((bounds.xmax - bounds.xmin) * GRID_UNIT),
    (height - 96) / ((bounds.ymax - bounds.ymin) * GRID_UNIT)));
  return { zoom, x: width / 2 - (bounds.xmin + bounds.xmax) * GRID_UNIT * zoom / 2,
    y: height / 2 + (bounds.ymin + bounds.ymax) * GRID_UNIT * zoom / 2 };
}
