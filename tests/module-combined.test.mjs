import {test} from 'node:test';
import assert from 'node:assert/strict';
import {COMBINED_QUESTIONS,CombinedLesson,TranslationLesson,ReflectionLesson,RotationLesson,createModuleLesson,findModuleQuestion} from '../dist/module-lesson.js';

// Independent coordinates read from printed page 6 and checked against scheme A6.
const expected=[
  ['21',{x:-3,y:2},{x:-3,y:0},{x:1,y:-1},['P','T']],
  ['22',{x:4,y:3},{x:2,y:4},{x:4,y:0},['T','R']],
  ['23',{x:-2,y:4},{x:-4,y:2},{x:-1,y:-7},['P','R']],
  ['24',{x:-5,y:5},{x:-2,y:3},{x:1,y:1},['K','K']],
];
function reveal(l) {
  if(l instanceof TranslationLesson)l.goTo(4);
  else if(l instanceof ReflectionLesson){l.chooseOrientation(l.question.mirror.kind);if(l.question.mirror.kind==='slanted')l.setSlope(l.question.mirror.slope);else l.setPosition(l.question.mirror.k);l.scrub(1);assert.equal(l.reveal(),true);}
  else {l.goTo(9);l.scrub(l.question.degrees);assert.equal(l.reveal(),true);}
}

test('combined questions preserve the printed points, right-to-left order and both scheme answers',()=>{
  assert.equal(COMBINED_QUESTIONS.length,4);
  for(const [id,given,intermediate,answer,order] of expected){
    const q=findModuleQuestion(id),before=JSON.stringify(q),s=createModuleLesson(q);
    assert.ok(s instanceof CombinedLesson);assert.deepEqual(q.given,given);assert.deepEqual(s.intermediate,intermediate);assert.deepEqual(s.answer,answer);
    assert.deepEqual(q.steps.map(o=>o.symbol),order);
    assert.deepEqual(s.lessons[1].question.given,intermediate,'second operation starts at the first image');
    assert.equal(s.lessons[0].givenLabel,q.label);assert.equal(s.lessons[0].answerLabel,q.label+'′');
    assert.equal(s.lessons[1].givenLabel,q.label+'′');assert.equal(s.lessons[1].answerLabel,q.label+'″');
    assert.equal(s.answerVisible,false);s.start();reveal(s.current);assert.equal(s.answerVisible,false);
    assert.equal(s.select(1),true);reveal(s.current);assert.equal(s.answerVisible,true);
    assert.equal(JSON.stringify(q),before,'original question is immutable');
  }
});

test('combined sequence cannot skip the first transformation or accept a wrong trial',()=>{
  const s=new CombinedLesson();assert.equal(s.select(1),false);assert.equal(s.select(0),false);s.start();
  const first=s.current;first.chooseOrientation('vertical');first.scrub(1);assert.equal(first.reveal(),false);assert.equal(s.select(1),false);
  first.chooseOrientation('horizontal');first.setPosition(1);first.scrub(.5);assert.equal(first.reveal(),false);assert.equal(s.select(1),false);
  first.scrub(1);assert.equal(first.reveal(),true);assert.equal(s.select(1),true);
  assert.equal(s.current.stage,0);assert.equal(s.answerVisible,false);assert.equal(s.select(2),false);
});

test('editing the first operation invalidates second-step work; merely reviewing it preserves work',()=>{
  for(const q of COMBINED_QUESTIONS){
    const s=new CombinedLesson(q);s.start();reveal(s.current);s.select(1);reveal(s.current);
    assert.equal(s.answerVisible,true);s.select(0);s.reconcile();assert.equal(s.answerVisible,false);
    assert.equal(s.lessons[1].answerVisible,true,'review alone does not lose a completed second operation');
    s.select(1);assert.equal(s.answerVisible,true);s.select(0);s.current.scrub(0);s.reconcile();
    assert.equal(s.lessons[1].stage,0);assert.equal(s.lessons[1].answerVisible,false);assert.equal(s.select(1),false);
    reveal(s.current);s.select(1);assert.equal(s.current.stage,0);assert.equal(s.answerVisible,false);
    s.reset();assert.equal(s.started,false);assert.equal(s.index,0);assert.ok(s.lessons.every(l=>l.stage===0&&!l.answerVisible));
  }
});

test('each combined step uses its existing engine including count guides and trial validation',()=>{
  assert.ok(new CombinedLesson(COMBINED_QUESTIONS[0]).lessons[0] instanceof ReflectionLesson);
  const s=new CombinedLesson(COMBINED_QUESTIONS[1]);
  assert.ok(s.lessons[0] instanceof TranslationLesson);assert.ok(s.lessons[1] instanceof RotationLesson);
  const rotation=s.lessons[1];assert.deepEqual(rotation.offset,{x:1,y:3});rotation.selectFirstAxis('y');
  rotation.goTo(9);rotation.scrub(90);assert.equal(rotation.reveal(),false);rotation.scrub(-90);assert.equal(rotation.reveal(),true);
  assert.deepEqual(rotation.pointAt(),{x:4,y:0});
  const twice=new CombinedLesson(COMBINED_QUESTIONS[3]);
  assert.deepEqual(twice.lessons[0].movementVector,{x:3,y:-2});assert.deepEqual(twice.lessons[1].movementVector,{x:3,y:-2});
});

test('combined camera bounds include both images and stay stable between correct steps',()=>{
  for(const q of COMBINED_QUESTIONS){
    const s=new CombinedLesson(q),bounds=s.focusBounds;
    for(const p of [q.given,s.intermediate,s.answer])assert.ok(p.x>bounds.xmin&&p.x<bounds.xmax&&p.y>bounds.ymin&&p.y<bounds.ymax);
    s.start();reveal(s.current);s.select(1);assert.deepEqual(s.focusBounds,bounds);
    const second=s.current;
    if(second instanceof RotationLesson)for(const angle of [-360,-135,0,72,270,360]){
      const p=second.pointAt(angle);assert.ok(p.x>=bounds.xmin&&p.x<=bounds.xmax&&p.y>=bounds.ymin&&p.y<=bounds.ymax);
    }
  }
});

test('intermediate captions have a distinct colour without changing original/image rendering',async()=>{
  const {createTransformationRenderer}=await import('../dist/transform-render.js');
  const {fitQuestion}=await import('../dist/module-lesson.js');
  const oldDocument=globalThis.document,oldDpr=globalThis.devicePixelRatio;
  globalThis.devicePixelRatio=1;
  try {
    for(const dark of [false,true]){
      globalThis.document={body:{classList:{contains:()=>dark}}};
      const s=new CombinedLesson(COMBINED_QUESTIONS[0]),texts=[];
      const ctx=new Proxy({measureText:t=>({width:t.length*9}),fillText(text,x,y){texts.push({text,x,y,colour:this.fillStyle});}},{get:(t,k)=>t[k]??(()=>{})});
      createTransformationRenderer({clientWidth:650,clientHeight:500,getContext:()=>ctx})({view:fitQuestion(s.focusBounds,650,500),gridBounds:s.question.bounds,annotations:[],labelFontSize:23,pointLabelSpread:Math.PI/2,pointLabelRings:12,
        objects:[{id:'original',points:[s.question.given],labels:['P']},{id:'intermediate',points:[s.intermediate],labels:['P′'],role:'intermediate'}],
        preview:{id:'final',points:[s.answer],labels:['P″'],image:true}});
      assert.equal(texts.find(t=>t.text==='P').colour,dark?'#edf0f5':'#20242c');
      assert.equal(texts.find(t=>t.text==='P′').colour,dark?'#ffc47f':'#a95c14');
      assert.equal(texts.find(t=>t.text==='P″').colour,dark?'#83b6ff':'#2367c8');
    }
  }finally{
    if(oldDocument===undefined)delete globalThis.document;else globalThis.document=oldDocument;
    if(oldDpr===undefined)delete globalThis.devicePixelRatio;else globalThis.devicePixelRatio=oldDpr;
  }
});
