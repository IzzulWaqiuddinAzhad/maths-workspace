import { translatePoint, reflectPoint, flipPoint, lineFoot, GRID_UNIT } from './transform-model.js?v=29';

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
export const REFLECTION_QUESTIONS = Object.freeze([
  { id: '5', label: 'A', find: 'image', given: { x: -3, y: 4 }, mirror: { kind: 'vertical', k: 1 } },
  { id: '6', label: 'B', find: 'image', given: { x: 4, y: 3 }, mirror: { kind: 'horizontal', k: -2 } },
  { id: '7', label: 'C', find: 'object', given: { x: 5, y: -2 }, mirror: { kind: 'slanted', slope: 1 } },
  { id: '8', label: 'D', find: 'object', given: { x: -4, y: 2 }, mirror: { kind: 'slanted', slope: -1 } },
].map(q => Object.freeze({
  ...q, number: q.id.padStart(2, '0'), section: 'A2', type: 'reflection',
  given: Object.freeze(q.given), mirror: Object.freeze(q.mirror),
  bounds: Object.freeze({ xmin: -8, xmax: 8, ymin: -8, ymax: 8 }),
  prompt: Object.freeze({
    en: `${q.label}′ is the image of ${q.label} under a reflection in the line ${reflectionEquation(q.mirror)}. ${q.find === 'image' ? 'Find its coordinates.' : `Find the coordinates of ${q.label}.`}`,
    bm: `${q.label}′ ialah imej bagi ${q.label} di bawah pantulan pada garis ${reflectionEquation(q.mirror)}. Cari koordinat ${q.label}${q.find === 'image' ? '′' : ''}.`,
  }),
})));
export const MODULE_QUESTIONS = Object.freeze([...TRANSLATION_QUESTIONS, ...REFLECTION_QUESTIONS]);
export const findModuleQuestion = id => MODULE_QUESTIONS.find(q => q.id === id);
export const createModuleLesson = q => q.type === 'reflection' ? new ReflectionLesson(q) : new TranslationLesson(q);

export function reflectionEquation(choice) {
  if (!choice) return '';
  if (choice.kind === 'slanted') return choice.slope === -1 ? 'y = −x' : 'y = x';
  return `${choice.kind === 'horizontal' ? 'y' : 'x'} = ${String(choice.k).replace('-', '−')}`;
}
export function reflectionLine(choice) {
  if (!choice) return null;
  if (choice.kind === 'slanted') return { a: -choice.slope, b: 1, c: 0 };
  return { a: choice.kind === 'vertical' ? 1 : 0, b: choice.kind === 'horizontal' ? 1 : 0, c: -choice.k };
}

class PointLesson {
  constructor(question) { this.question = question; this.reset(); }
  get inverse() { return this.question.find === 'object'; }
  get givenLabel() { return this.question.label + (this.inverse ? '′' : ''); }
  get answerLabel() { return this.question.label + (this.inverse ? '' : '′'); }
  get object() { return this.inverse ? this.answer : this.question.given; }
  get image() { return this.inverse ? this.question.given : this.answer; }
}

export class ReflectionLesson extends PointLesson {
  constructor(question = REFLECTION_QUESTIONS[0]) { super(question); }
  reset() { this.choice = null; this.guideVisible = false; this.stage = 0; this.progress = 0; this.answerVisible = false; }
  get line() { return reflectionLine(this.choice); }
  get equation() { return reflectionEquation(this.choice); }
  get answer() { return reflectPoint(this.question.given, reflectionLine(this.question.mirror)); }
  get trialAnswer() { return this.line ? reflectPoint(this.question.given, this.line) : null; }
  get bounds() {
    const b = this.question.bounds, p = this.trialAnswer;
    return !p ? b : { xmin: Math.min(b.xmin, Math.floor(p.x) - 1), xmax: Math.max(b.xmax, Math.ceil(p.x) + 1), ymin: Math.min(b.ymin, Math.floor(p.y) - 1), ymax: Math.max(b.ymax, Math.ceil(p.y) + 1) };
  }
  get foot() { return this.line ? lineFoot(this.question.given, this.line) : null; }
  get matchesQuestion() {
    const wanted = this.question.mirror, choice = this.choice;
    return !!choice && choice.kind === wanted.kind && (choice.kind === 'slanted' ? choice.slope === wanted.slope : choice.k === wanted.k);
  }
  get canReveal() { return this.matchesQuestion && this.progress === 1; }
  changeLine(choice) {
    if (JSON.stringify(choice) === JSON.stringify(this.choice)) return false;
    this.choice = choice; this.progress = 0; this.answerVisible = false;
    this.stage = this.guideVisible ? 2 : 1;
    return true;
  }
  chooseOrientation(kind) {
    if (!['horizontal', 'vertical', 'slanted'].includes(kind) || this.choice?.kind === kind) return false;
    return this.changeLine(kind === 'slanted' ? { kind, slope: 1 } : { kind, k: 0 });
  }
  setPosition(value) {
    if (!this.choice || this.choice.kind === 'slanted' || !Number.isFinite(value)) return false;
    const { kind } = this.choice, bounds = this.question.bounds;
    const min = kind === 'horizontal' ? bounds.ymin : bounds.xmin, max = kind === 'horizontal' ? bounds.ymax : bounds.xmax;
    return this.changeLine({ kind, k: Math.max(min, Math.min(max, Math.round(value))) });
  }
  setSlope(slope) {
    return this.choice?.kind === 'slanted' && [1, -1].includes(slope) ? this.changeLine({ kind: 'slanted', slope }) : false;
  }
  toggleGuides() {
    if (!this.choice) return;
    this.guideVisible = !this.guideVisible;
    if (!this.progress) this.stage = this.guideVisible ? 2 : 1;
  }
  scrub(value) {
    if (!this.choice) return;
    this.progress = Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
    this.answerVisible = false; this.stage = this.progress > 0 ? 3 : this.guideVisible ? 2 : 1;
  }
  reveal() {
    if (!this.canReveal) return false;
    this.answerVisible = true; this.stage = 4; return true;
  }
  pointAt(progress = this.progress) { return this.line ? flipPoint(this.question.given, this.line, progress) : this.question.given; }
}


export class TranslationLesson extends PointLesson {
  constructor(question = QUESTION_ONE) { super(question); }
  reset() { this.stage = 0; this.progress = 0; this.answerVisible = false; }
  get movementVector() { const v = this.question.vector, sign = this.inverse ? -1 : 1; return { x: sign * v.x, y: sign * v.y }; }
  get answer() { return translatePoint(this.question.given, this.movementVector); }
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
