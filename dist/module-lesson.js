import { translatePoint, reflectPoint, flipPoint, lineFoot, rotatePoint, snapRotation, tidyPoint, GRID_UNIT, normaliseLine, moveMirror } from './transform-model.js?v=29';

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
// A3–A4, printed pages 3–4 (PDF pages 4–5), read from the original diagrams.
export const ROTATION_QUESTIONS = Object.freeze([
  { id: '9', label: 'A', given: { x: 3, y: 2 }, centre: { x: 0, y: 0 }, degrees: -90 },
  { id: '10', label: 'B', given: { x: -2, y: 5 }, centre: { x: -3, y: 2 }, degrees: 90 },
  { id: '11', label: 'C', given: { x: 5, y: 4 }, centre: { x: 2, y: 1 }, degrees: -90 },
  { id: '12', label: 'D', given: { x: -4, y: -1 }, centre: { x: -1, y: -2 }, degrees: 90 },
  { id: '13', label: 'E', given: { x: 5, y: -2 }, centre: { x: 2, y: -3 }, degrees: 180 },
  { id: '14', label: 'F', given: { x: -2, y: 6 }, centre: { x: 2, y: 3 }, degrees: 180 },
  { id: '15', label: 'G', given: { x: 5, y: -1 }, centre: { x: 1, y: 2 }, degrees: -90 },
  { id: '16', label: 'H', given: { x: -5, y: 3 }, centre: { x: 0, y: -1 }, degrees: 90 },
].map(q => {
  const about = `(${q.centre.x}, ${q.centre.y})`;
  const enDirection = q.degrees === 180 ? '' : q.degrees < 0 ? ' clockwise' : ' anticlockwise';
  const bmDirection = q.degrees === 180 ? '' : q.degrees < 0 ? ' ikut arah jam' : ' lawan arah jam';
  return Object.freeze({ ...q, type: 'rotation', find: 'image', number: q.id.padStart(2, '0'), section: Number(q.id) < 13 ? 'A3' : 'A4',
    given: Object.freeze(q.given), centre: Object.freeze(q.centre),
    bounds: Object.freeze({ xmin: -8, xmax: 8, ymin: -8, ymax: 8 }),
    prompt: Object.freeze({
      en: `${q.label}′ is the image of ${q.label} under a ${Math.abs(q.degrees)}°${enDirection} rotation about ${about}. Find its coordinates.`,
      bm: `${q.label}′ ialah imej bagi ${q.label} di bawah putaran ${Math.abs(q.degrees)}°${bmDirection} berpusat di ${about}. Cari koordinat ${q.label}′.`,
    }),
  });
}));
// A5, printed page 5 (PDF page 6). Q20 supplies the image, not the object.
export const ENLARGEMENT_QUESTIONS = Object.freeze([
  { id:'17', label:'A', find:'image', given:{x:3,y:2}, centre:{x:1,y:-1}, factor:2 },
  { id:'18', label:'B', find:'image', given:{x:-1,y:1}, centre:{x:-2,y:2}, factor:3 },
  { id:'19', label:'C', find:'image', given:{x:6,y:2}, centre:{x:2,y:-2}, factor:.5 },
  { id:'20', label:'D', find:'object', given:{x:5,y:5}, centre:{x:-1,y:1}, factor:2 },
].map(q=>Object.freeze({
  ...q, number:q.id, section:'A5', type:'enlargement',
  given:Object.freeze(q.given), centre:Object.freeze(q.centre),
  bounds: Object.freeze({ xmin: -8, xmax: 8, ymin: -8, ymax: 8 }),
  prompt: Object.freeze({
    en: `${q.label}′ is the image of ${q.label} under an enlargement with centre (${q.centre.x}, ${q.centre.y}), scale factor ${q.factor===.5?'½':q.factor}. ${q.find==='object'?`Find the coordinates of ${q.label}.`:'Find its coordinates.'}`,
    bm: `${q.label}′ ialah imej bagi ${q.label} di bawah pembesaran berpusat di (${q.centre.x}, ${q.centre.y}), faktor skala ${q.factor===.5?'½':q.factor}. Cari koordinat ${q.label}${q.find==='image'?'′':''}.`,
  }),
})));
// A6, printed page 6 (PDF page 7). Steps are in EXECUTION order:
// TP applies P first, then T. K² applies K twice; it does not square coordinates.
export const COMBINED_QUESTIONS = Object.freeze([
  { id:'21', label:'P', given:{x:-3,y:2}, composition:'TP', definitions:[1,0], steps:[
    {symbol:'P',type:'reflection',mirror:{kind:'horizontal',k:1}},
    {symbol:'T',type:'translation',vector:{x:4,y:-1}},
  ]},
  { id:'22', label:'Q', given:{x:4,y:3}, composition:'RT', definitions:[0,1], steps:[
    {symbol:'T',type:'translation',vector:{x:-2,y:1}},
    {symbol:'R',type:'rotation',centre:{x:1,y:1},degrees:-90},
  ]},
  { id:'23', label:'R', given:{x:-2,y:4}, composition:'RP', definitions:[0,1], steps:[
    {symbol:'P',type:'reflection',mirror:{kind:'slanted',slope:-1}},
    {symbol:'R',type:'rotation',centre:{x:2,y:-1},degrees:90},
  ]},
  { id:'24', label:'S', given:{x:-5,y:5}, composition:'K²', definitions:[0], steps:[
    {symbol:'K',type:'translation',vector:{x:3,y:-2}},
    {symbol:'K',type:'translation',vector:{x:3,y:-2}},
  ]},
].map(q=>Object.freeze({...q,type:'combined',find:'image',number:q.id,section:'A6',
  given:Object.freeze(q.given),definitions:Object.freeze(q.definitions),
  steps:Object.freeze(q.steps.map(step=>Object.freeze({...step,
    ...(step.vector?{vector:Object.freeze(step.vector)}:{}),
    ...(step.mirror?{mirror:Object.freeze(step.mirror)}:{}),
    ...(step.centre?{centre:Object.freeze(step.centre)}:{}),
  }))),
  bounds:Object.freeze({xmin:-8,xmax:8,ymin:-8,ymax:8}),
  prompt:Object.freeze({
    en:`Find the image of ${q.label} under transformation ${q.composition}.`,
    bm:`Cari imej ${q.label} di bawah transformasi ${q.composition}.`,
  }),
})));
export const MODULE_QUESTIONS = Object.freeze([...TRANSLATION_QUESTIONS, ...REFLECTION_QUESTIONS, ...ROTATION_QUESTIONS, ...ENLARGEMENT_QUESTIONS, ...COMBINED_QUESTIONS]);
export const findModuleQuestion = id => MODULE_QUESTIONS.find(q => q.id === id);
export const createModuleLesson = q => q.type === 'combined' ? new CombinedLesson(q) : q.type === 'enlargement' ? new EnlargementLesson(q) : q.type === 'rotation' ? new RotationLesson(q) : q.type === 'reflection' ? new ReflectionLesson(q) : new TranslationLesson(q);

// Compose the existing lesson engines. Each owns its normal construction,
// animation and trial state; the sequence only owns order and reveal gating.
export class CombinedLesson {
  constructor(question=COMBINED_QUESTIONS[0]) { this.question=question;this.reset(); }
  reset() {
    this.started=false;this.index=0;
    let given=this.question.given;
    this.lessons=this.question.steps.map((operation,i)=>{
      const child=createModuleLesson({...this.question,...operation,find:'image',given,
        label:this.question.label+(i?'′':''),
        givenLabel:this.question.label+(i?'′':''),
        answerLabel:this.question.label+(i?'″':'′'),
      });
      given=child.answer;
      return child;
    });
  }
  get current() { return this.lessons[this.index]; }
  get intermediate() { return this.lessons[0].answer; }
  get answer() { return this.lessons[1].answer; }
  get answerLabel() { return this.question.label+'″'; }
  get answerVisible() { return this.started && this.index===1 && this.lessons.every(l=>l.answerVisible); }
  get focusBounds() {
    const points=[this.question.given,this.intermediate,this.answer];
    for(const child of this.lessons)if(child instanceof RotationLesson){
      const c=child.question.centre,r=Math.hypot(child.offset.x,child.offset.y);
      points.push({x:c.x-r,y:c.y-r},{x:c.x+r,y:c.y+r});
    }
    if(this.current.trialAnswer)points.push(this.current.trialAnswer);
    // A stable camera includes both correct operations from the start. Moving
    // trial mirrors can expand it, but ordinary step changes never crop a point.
    return {xmin:Math.floor(Math.min(0,...points.map(p=>p.x)))-1,xmax:Math.ceil(Math.max(0,...points.map(p=>p.x)))+1,
      ymin:Math.floor(Math.min(0,...points.map(p=>p.y)))-1,ymax:Math.ceil(Math.max(0,...points.map(p=>p.y)))+1};
  }
  start() { this.started=true; }
  select(index) {
    if(!this.started || ![0,1].includes(index) || (index===1&&!this.lessons[0].answerVisible))return false;
    this.index=index;return true;
  }
  reconcile() {
    // Revising the first operation invalidates all work based on its old reveal.
    if(!this.lessons[0].answerVisible){this.lessons[1].reset();this.index=0;}
  }
}

export function reflectionEquation(choice) {
  if(!choice)return '';
  const number=n=>{
    if(Math.abs(n-Number(n.toFixed(3)))<1e-10)return String(Number(n.toFixed(3))).replace(/-/g,'−');
    for(let d=2;d<=1000;d++){const top=Math.round(n*d);if(Math.abs(n-top/d)<1e-10)return `${top}/${d}`.replace(/-/g,'−');}
    return String(Number(n.toFixed(6))).replace(/-/g,'−');
  };
  if(choice.kind!=='slanted')return `${choice.kind==='horizontal'?'y':'x'} = ${number(choice.k)}`;
  const m=choice.slope,c=choice.intercept||0,coefficient=Math.abs(m-1)<1e-9?'':Math.abs(m+1)<1e-9?'−':number(m);
  return `y = ${coefficient.includes('/')?'('+coefficient+')':coefficient}x${Math.abs(c)<1e-9?'':` ${c<0?'−':'+'} ${number(Math.abs(c))}`}`;
}
export function reflectionLine(choice) {
  if (!choice) return null;
  if (choice.kind === 'slanted') return { a: -choice.slope, b: 1, c: -(choice.intercept || 0) };
  return { a: choice.kind === 'vertical' ? 1 : 0, b: choice.kind === 'horizontal' ? 1 : 0, c: -choice.k };
}
export function mirrorChoiceFromHandles(handles) {
  if (!Array.isArray(handles) || handles.length!==2 || !handles.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y))) return null;
  const [p,q]=handles.map(tidyPoint),dx=q.x-p.x,dy=q.y-p.y;
  if(Math.hypot(dx,dy)<.25) return null;
  const saved=[p,q];
  if(Math.abs(dx)<1e-9) return {kind:'vertical',k:p.x,handles:saved};
  if(Math.abs(dy)<1e-9) return {kind:'horizontal',k:p.y,handles:saved};
  return {kind:'slanted',slope:dy/dx,intercept:p.y-dy/dx*p.x,handles:saved};
}

class PointLesson {
  constructor(question) { this.question = question; this.reset(); }
  get inverse() { return this.question.find === 'object'; }
  get givenLabel() { return this.question.givenLabel ?? this.question.label + (this.inverse ? '′' : ''); }
  get answerLabel() { return this.question.answerLabel ?? this.question.label + (this.inverse ? '' : '′'); }
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
    if(!this.choice) return false;
    const a=normaliseLine(this.line),b=normaliseLine(reflectionLine(this.question.mirror));
    return [1,-1].some(sign=>['a','b','c'].every(key=>Math.abs(a[key]-sign*b[key])<1e-8));
  }
  get canReveal() { return this.matchesQuestion && this.progress === 1; }
  get handles() { return this.choice?.handles || []; }
  changeLine(choice) {
    if (!choice || JSON.stringify(choice) === JSON.stringify(this.choice)) return false;
    this.choice = structuredClone(choice); this.progress = 0; this.answerVisible = false;
    this.stage = this.guideVisible ? 2 : 1;
    return true;
  }
  chooseOrientation(kind, bounds=this.question.bounds) {
    if (!['horizontal', 'vertical', 'slanted'].includes(kind) || this.choice?.kind === kind) return false;
    const cx=Math.round((bounds.xmin+bounds.xmax)/2),cy=Math.round((bounds.ymin+bounds.ymax)/2);
    const offset=(mid,min,max)=>Math.max(min+.5,Math.min(max-.5,mid+2)) || 1;
    const x=offset(cx,bounds.xmin,bounds.xmax),y=offset(cy,bounds.ymin,bounds.ymax);
    const span=Math.max(.5,Math.min(2,(bounds.xmax-bounds.xmin)/4,(bounds.ymax-bounds.ymin)/4));
    const handles=kind==='horizontal'?[{x:cx-span,y},{x:cx+span,y}]:kind==='vertical'?[{x,y:cy-span},{x,y:cy+span}]:[{x:cx-span,y:cy-span},{x:cx+span,y:cy+span}];
    return this.setHandles(handles);
  }
  resetLine(bounds=this.question.bounds) { if(!this.choice)return false;const kind=this.choice.kind;this.choice=null;return this.chooseOrientation(kind,bounds); }
  setHandles(handles) { const choice=mirrorChoiceFromHandles(handles); return choice ? this.changeLine(choice) : false; }
  setPosition(value) {
    if (!this.choice || this.choice.kind === 'slanted' || !Number.isFinite(value)) return false;
    const { kind } = this.choice, bounds = this.question.bounds;
    const min = kind === 'horizontal' ? bounds.ymin : bounds.xmin, max = kind === 'horizontal' ? bounds.ymax : bounds.xmax;
    const k=Math.max(min,Math.min(max,Math.round(value))),axis=kind==='horizontal'?'y':'x';
    return this.setHandles(moveMirror(this.handles,{x:axis==='x'?k-this.choice.k:0,y:axis==='y'?k-this.choice.k:0}));
  }
  shift(dx,dy,handles=this.handles) {
    if(!this.choice || ![dx,dy].every(Number.isFinite)) return false;
    return this.setHandles(moveMirror(handles,{x:dx,y:dy}));
  }
  setSlope(slope) {
    return this.choice && [1,-1].includes(slope) ? this.setHandles([{x:-2,y:-2*slope},{x:2,y:2*slope}]) : false;
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

// Each arm is the same two-segment path rotated about the actual centre.
// Signed offsets are essential when the point lies left of / below that centre.
export class RotationLesson extends PointLesson {
  constructor(question = ROTATION_QUESTIONS[0]) { super(question); }
  reset() {
    this.stage=0;this.progress=0;this.answerVisible=false;this.clockVisible=false;
    this.direction=Math.sign(this.movementDegrees)||1;
    this.firstAxis='x';this.buildIndex=0;this.buildCounts=Array(8).fill(0);this.counting=false;this.countAnimation=null;
  }
  get offset() { return {x:this.question.given.x-this.question.centre.x,y:this.question.given.y-this.question.centre.y}; }
  segmentInfo(index=this.buildIndex) {
    const axis=index%2 ? (this.firstAxis==='x'?'y':'x') : this.firstAxis;
    const basis=rotatePoint(axis==='x'?{x:1,y:0}:{x:0,y:1},{x:0,y:0},Math.floor(index/2)*90);
    const worldAxis=Math.abs(basis.x)>.5?'x':'y';
    return {axis:worldAxis,target:this.offset[axis]*basis[worldAxis],part:index%2,arm:Math.floor(index/2)};
  }
  get segmentMatches() { return this.buildIndex<8 && Math.abs(this.buildCounts[this.buildIndex]-this.segmentInfo().target)<1e-8; }
  get constructionPaths() {
    return Array.from({length:4},(_,arm)=>{
      const centre=this.question.centre, first=this.segmentInfo(arm*2),second=this.segmentInfo(arm*2+1);
      const corner={...centre,[first.axis]:centre[first.axis]+this.buildCounts[arm*2]};
      const end={...corner,[second.axis]:corner[second.axis]+this.buildCounts[arm*2+1]};
      return {centre,corner,end};
    });
  }
  selectFirstAxis(axis) {
    if(!['x','y'].includes(axis) || this.firstAxis===axis || this.counting)return false;
    this.firstAxis=axis;this.buildCounts.fill(0);this.buildIndex=0;this.stage=this.stage?1:0;
    this.progress=0;this.answerVisible=false;this.clockVisible=false;return true;
  }
  setBuildCount(axis,value) {
    if(!this.stage || this.constructionComplete || this.counting || !Number.isFinite(value)) return false;
    if(this.buildIndex===0 && this.buildCounts.every(n=>n===0))this.selectFirstAxis(axis);
    if(axis!==this.segmentInfo().axis)return false;
    this.buildCounts[this.buildIndex]=Math.max(-100,Math.min(100,value));
    this.stage=Math.min(8,this.buildIndex+2);this.answerVisible=false;return true;
  }
  nudgeConstruction(axis,delta) {
    if(!this.stage || this.constructionComplete || this.counting || !['x','y'].includes(axis)||!Number.isFinite(delta))return false;
    if(axis!==this.segmentInfo().axis && this.segmentMatches && this.buildIndex<7 && axis===this.segmentInfo(this.buildIndex+1).axis)this.advanceConstruction();
    const current=axis===this.segmentInfo().axis?this.buildCounts[this.buildIndex]:0;
    return this.setBuildCount(axis,current+delta);
  }
  advanceConstruction() {
    if(this.counting)return;
    if(!this.stage) {this.stage=1;return;}
    if(this.segmentMatches) {
      this.buildIndex++;
      if(this.buildIndex===8){this.stage=9;return;}
    }
    this.stage=Math.min(8,this.buildIndex+2);
  }
  previousConstruction() {
    if(this.buildIndex===8)this.buildIndex=7;
    else if(this.buildCounts[this.buildIndex]===0 && this.buildIndex>0)this.buildIndex--;
    else if(this.buildIndex===0 && this.buildCounts[0]===0){this.stage=0;return;}
    this.buildCounts.fill(0,this.buildIndex);this.stage=this.buildIndex?Math.min(8,this.buildIndex+2):1;
    this.progress=0;this.answerVisible=false;this.clockVisible=false;
  }
  clearConstructionSegment() {
    if(this.constructionComplete||this.counting)return;
    this.buildCounts[this.buildIndex]=0;this.answerVisible=false;
  }
  displayedBuildCount() {
    const n=this.buildCounts[this.buildIndex]||0,a=this.countAnimation;
    return a ? a.from+Math.sign(a.to-a.from)*Math.floor(Math.abs(n-a.from)+1e-8) : n;
  }
  get movementDegrees() { return this.question.degrees * (this.inverse ? -1 : 1); }
  get answer() { return rotatePoint(this.question.given, this.question.centre, this.movementDegrees); }
  get corner() { return this.firstAxis==='x'?{x:this.question.given.x,y:this.question.centre.y}:{x:this.question.centre.x,y:this.question.given.y}; }
  get arms() {
    return [0, 90, 180, 270].map(degrees => ({
      centre: this.question.centre,
      corner: rotatePoint(this.corner, this.question.centre, degrees),
      end: rotatePoint(this.question.given, this.question.centre, degrees),
    }));
  }
  get armCount() { return this.buildCounts.filter((n,i)=>i%2===0 && n!==0).length; }
  get bendCount() { return this.buildCounts.filter((n,i)=>i%2===1 && n!==0).length; }
  get constructionComplete() { return this.buildIndex===8; }
  // Shared animation progress is measured in signed degrees for this activity.
  get angle() { return this.progress; }
  get targetProgress() { return this.stage >= 10 ? this.movementDegrees : 0; }
  get matchesQuestion() {
    return Math.abs(this.question.degrees) === 180 ? Math.abs(this.angle) === 180 : this.angle === this.movementDegrees;
  }
  get canReveal() { return this.constructionComplete && this.matchesQuestion; }
  get atStart() { return Math.abs(this.angle) === 360 || this.angle === 0; }
  get equivalentAngle() { return this.angle === 0 ? 0 : this.angle - Math.sign(this.angle) * 360; }
  reveal() {
    if (!this.canReveal) return false;
    this.stage = 11; this.answerVisible = true; return true;
  }
  setDirection(direction) {
    if (!this.constructionComplete || ![-1, 1].includes(direction)) return;
    this.direction = direction; this.scrub(Math.abs(this.angle) * direction);
  }
  get bounds() {
    const b = this.question.bounds;
    if (!this.stage) return b;
    const c = this.question.centre, r = Math.hypot(this.question.given.x - c.x, this.question.given.y - c.y);
    const points=this.constructionPaths.flatMap(p=>[p.corner,p.end]);
    return { xmin: Math.min(b.xmin, Math.floor(c.x-r)-1,...points.map(p=>Math.floor(p.x)-1)), xmax: Math.max(b.xmax, Math.ceil(c.x+r)+1,...points.map(p=>Math.ceil(p.x)+1)),
      ymin: Math.min(b.ymin, Math.floor(c.y-r)-1,...points.map(p=>Math.floor(p.y)-1)), ymax: Math.max(b.ymax, Math.ceil(c.y+r)+1,...points.map(p=>Math.ceil(p.y)+1)) };
  }
  goTo(value) {
    if (!Number.isFinite(value)) return;
    this.stage = Math.max(0, Math.min(11, Math.round(value)));
    this.buildIndex=Math.min(8,Math.max(0,this.stage-1));
    this.buildCounts=this.buildCounts.map((_,i)=>i<this.buildIndex?this.segmentInfo(i).target:0);
    this.progress = this.targetProgress; this.direction = Math.sign(this.progress) || this.direction; this.answerVisible = this.stage === 11;
    if (!this.constructionComplete) this.clockVisible = false;
  }
  scrub(value) {
    if (!this.constructionComplete) return;
    if (!Number.isFinite(value)) return;
    this.progress = snapRotation(value, false);
    this.direction = Math.sign(this.progress) || this.direction;
    this.stage = this.progress !== 0 ? 10 : 9; this.answerVisible = false;
  }
  toggleClock() {
    if (!this.constructionComplete) return false;
    this.clockVisible = !this.clockVisible; return true;
  }
  pointAt(progress = this.progress) {
    return rotatePoint(this.question.given, this.question.centre, snapRotation(progress, false));
  }
  cornerAt(progress = this.progress) {
    return rotatePoint(this.corner, this.question.centre, snapRotation(progress, false));
  }
}

export const ENLARGEMENT_STOPS = Object.freeze([-3, -2, -1, 0, .5, 1, 2, 3]);
const limitFactor = value => Math.max(-3, Math.min(3, value));
export const enlargePoint = (point, centre, factor) => tidyPoint({
  x: centre.x + factor * (point.x - centre.x), y: centre.y + factor * (point.y - centre.y),
});
export class EnlargementSnap {
  constructor(factor = 1) { this.held = ENLARGEMENT_STOPS.includes(factor) ? factor : null; }
  move(value) {
    const factor = limitFactor(value);
    if (this.held !== null && Math.abs(factor - this.held) <= .12) return this.held;
    const nearest = ENLARGEMENT_STOPS.reduce((a,b) => Math.abs(factor-a) <= Math.abs(factor-b) ? a : b);
    this.held = Math.abs(factor-nearest) <= .06 ? nearest : null;
    return this.held ?? factor;
  }
}
export class EnlargementLesson extends PointLesson {
  constructor(question = ENLARGEMENT_QUESTIONS[0]) { super(question); }
  reset() {
    this.stage = 0; this.progress = 1; this.answerVisible = false;
    this.mode = 'count'; this.countAxis = 'x'; this.counting = false; this.countAnimation=null;
    this.givenCounts = {x:0,y:0}; this.imageCounts = {x:0,y:0}; this.imageStarted = false;
  }
  get factor() { return this.progress; }
  get offset() { const p=this.question.given,c=this.question.centre; return {x:p.x-c.x,y:p.y-c.y}; }
  get requiredFactor() { return this.inverse ? 1/this.question.factor : this.question.factor; }
  get answer() { return enlargePoint(this.question.given,this.question.centre,this.requiredFactor); }
  get requiredCounts() { const v=this.offset,k=this.requiredFactor; return tidyPoint({x:v.x*k,y:v.y*k}); }
  get nextCountAxis() {
    if (!this.imageStarted) return 'x';
    if (this.stage===5 && Math.abs(this.imageCounts.y-this.requiredCounts.y)>1e-9) return 'y';
    if (Math.abs(this.imageCounts[this.countAxis]-this.requiredCounts[this.countAxis])>1e-9) return this.countAxis;
    return this.countAxis==='x'?'y':'x';
  }
  get ready() { return this.stage >= 4; }
  displayedCount(source,axis) {
    const value=(source==='given'?this.givenCounts:this.imageCounts)[axis],a=this.countAnimation;
    if (!a || a.source!==source || a.axis!==axis) return value;
    // Hold the last completed square in either direction, including counting back.
    return a.from+Math.sign(a.to-a.from)*Math.floor(Math.abs(value-a.from)+1e-8);
  }
  get matchesQuestion() {
    if (this.counting) return false;
    if (this.mode === 'scale') return Math.abs(this.factor-this.requiredFactor) < 1e-9;
    return this.imageStarted && ['x','y'].every(axis=>Math.abs(this.imageCounts[axis]-this.requiredCounts[axis])<1e-9);
  }
  get canReveal() { return this.ready && this.matchesQuestion; }
  get targetProgress() { return this.stage >= 6 ? this.requiredFactor : 1; }
  get onGuide() {
    const v=this.offset,p=this.imageCounts;
    return Math.abs(v.x*p.y-v.y*p.x)<1e-8;
  }
  get bounds() {
    const b = this.question.bounds;
    // Counting uses the question's full construction from the start, avoiding
    // a camera jump between the horizontal and vertical steps.
    const ends = this.mode === 'scale' ? [-3,3].map(k => this.pointAt(k)) : [this.answer,this.pointAt()];
    return {xmin:Math.min(b.xmin,...ends.map(p=>Math.floor(p.x)-1)),xmax:Math.max(b.xmax,...ends.map(p=>Math.ceil(p.x)+1)),
      ymin:Math.min(b.ymin,...ends.map(p=>Math.floor(p.y)-1)),ymax:Math.max(b.ymax,...ends.map(p=>Math.ceil(p.y)+1))};
  }
  goTo(value) {
    if (!Number.isFinite(value)) return;
    this.stage = Math.max(0,Math.min(7,Math.round(value)));
    this.mode='count'; this.counting=false; this.countAnimation=null; this.countAxis=this.stage>=6?'y':'x';
    this.givenCounts={x:this.stage>=3?this.offset.x:0,y:this.stage>=4?this.offset.y:0};
    this.imageCounts={x:this.stage>=5?this.requiredCounts.x:0,y:this.stage>=6?this.requiredCounts.y:0};
    this.imageStarted=this.stage>=5;
    this.progress = this.targetProgress; this.answerVisible = this.stage === 7;
  }
  setMode(mode) {
    if (!this.ready || this.counting || !['count','scale'].includes(mode)) return;
    this.mode=mode; this.answerVisible=false;
    this.stage=mode==='scale'?6:this.imageStarted?6:4;
  }
  selectCountAxis(axis) {
    if (!this.ready || this.counting || !['x','y'].includes(axis)) return;
    this.countAxis=axis;
  }
  setCount(axis,value) {
    if (!this.ready || this.mode!=='count' || !['x','y'].includes(axis) || !Number.isFinite(value)) return;
    this.imageCounts[axis]=Math.max(-100,Math.min(100,Number(value.toFixed(10))));
    this.imageStarted=true; this.countAxis=axis; this.stage=axis==='x'?5:6; this.answerVisible=false;
  }
  scrub(value) {
    if (!this.ready || !Number.isFinite(value)) return;
    this.progress = Number(limitFactor(value).toFixed(10));
    this.mode='scale'; this.stage = 6; this.answerVisible = false;
  }
  reveal() { if (!this.canReveal) return false; this.stage=7; this.answerVisible=true; return true; }
  pointAt(factor) {
    if (factor !== undefined || this.mode==='scale') return enlargePoint(this.question.given,this.question.centre,limitFactor(factor??this.factor));
    if (!this.imageStarted) return {...this.question.given};
    return tidyPoint({x:this.question.centre.x+this.imageCounts.x,y:this.question.centre.y+this.imageCounts.y});
  }
}

// Pause briefly at each completed square, including when counting backwards.
export function squareCountAt(from,to,elapsed,unitDuration=340) {
  const distance=Math.abs(to-from),units=Math.ceil(distance);
  if (!units || elapsed>=units*unitDuration) return to;
  const step=Math.max(0,elapsed)/unitDuration,index=Math.floor(step);
  const phase=Math.min(1,(step-index)/.72),eased=phase*phase*(3-2*phase);
  return from+Math.sign(to-from)*(index+Math.min(1,distance-index)*eased);
}

export function fitQuestion(bounds, width, height) {
  const zoom = Math.max(.1, Math.min(2.5,
    (width - 96) / ((bounds.xmax - bounds.xmin) * GRID_UNIT),
    (height - 96) / ((bounds.ymax - bounds.ymin) * GRID_UNIT)));
  return { zoom, x: width / 2 - (bounds.xmin + bounds.xmax) * GRID_UNIT * zoom / 2,
    y: height / 2 + (bounds.ymin + bounds.ymax) * GRID_UNIT * zoom / 2 };
}
