import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ENLARGEMENT_QUESTIONS, EnlargementLesson, EnlargementSnap, enlargePoint, createModuleLesson, findModuleQuestion, fitQuestion } from '../dist/module-lesson.js';
import { graphToScreen } from '../dist/transform-model.js';
import { paintEnlargementLesson } from '../dist/module-enlargement-render.js';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} differs from ${b}`);

test('enlargement Q17 follows printed page 5 and independently checked scheme answer',()=>{
 const q=findModuleQuestion('17'),l=createModuleLesson(q);
 assert.equal(q,ENLARGEMENT_QUESTIONS[0]);assert.ok(l instanceof EnlargementLesson);
 assert.deepEqual(q.given,{x:3,y:2});assert.deepEqual(q.centre,{x:1,y:-1});assert.equal(q.factor,2);
 assert.deepEqual(l.offset,{x:2,y:3});assert.deepEqual(l.answer,{x:5,y:5});
 assert.deepEqual(l.pointAt(),q.given);assert.equal(l.answerVisible,false);
});

test('signed enlargement scales centre-relative distances, with fixed centre and exact reduction',()=>{
 const c={x:1,y:-1},p={x:3,y:2};
 const samples=[[-3,{x:-5,y:-10}],[-2,{x:-3,y:-7}],[-1,{x:-1,y:-4}],[0,c],[.5,{x:2,y:.5}],[1,p],[2,{x:5,y:5}],[3,{x:7,y:8}]];
 for(const [k,wanted] of samples) {
  const result=enlargePoint(p,c,k);assert.deepEqual(result,wanted);
  near(Math.hypot(result.x-c.x,result.y-c.y),Math.abs(k)*Math.sqrt(13));
  near((result.x-c.x)*3-(result.y-c.y)*2,0);
  assert.deepEqual(enlargePoint(c,c,k),c);
 }
 // Scale relative to arbitrary centres, including left/down offsets.
 const other={x:-6,y:-5},centre={x:-2,y:3};
 assert.deepEqual(enlargePoint(other,centre,-.5),{x:0,y:7});
 assert.deepEqual(enlargePoint(enlargePoint(other,centre,2),centre,.5),other);
});

test('staged teaching never reveals a trial answer and reset/backtracking remove the reveal',()=>{
 const l=new EnlargementLesson(),before=JSON.stringify(l.question);
 l.scrub(2);assert.equal(l.factor,1);assert.equal(l.reveal(),false);
 for(const stage of [1,2,3]) {l.goTo(stage);assert.equal(l.factor,1);assert.equal(l.answerVisible,false);}
 for(const k of [-2,0,.5,1,1.99,3]) {l.scrub(k);assert.equal(l.canReveal,false);assert.equal(l.reveal(),false);}
 l.scrub(2);assert.equal(l.reveal(),true);assert.deepEqual(l.pointAt(),l.answer);
 l.scrub(1);assert.equal(l.stage,3);assert.equal(l.answerVisible,false);
 l.goTo(2);l.scrub(-2);assert.equal(l.factor,1);
 l.goTo(3);l.scrub(50);assert.equal(l.factor,3);l.scrub(-50);assert.equal(l.factor,-3);
 l.scrub(NaN);assert.equal(l.factor,-3);l.goTo(Infinity);assert.equal(l.stage,4);
 l.reset();assert.equal(l.stage,0);assert.equal(l.factor,1);assert.equal(l.answerVisible,false);
 assert.equal(JSON.stringify(l.question),before);
});

test('scale snap captures and releases stops without preventing exact keyboard factors',()=>{
 const snap=new EnlargementSnap(1);
 assert.equal(snap.move(1.1),1);assert.equal(snap.move(1.2),1.2);
 for(const k of [-3,-2,-1,0,.5,1,2,3]) {
  assert.equal(snap.move(k+.04),k);assert.equal(snap.move(k+.09),k);
 }
 const l=new EnlargementLesson();l.goTo(3);l.scrub(.49);assert.equal(l.factor,.49);
});

test('enlargement camera bounds cover the entire slider without jumping during a drag',()=>{
 const l=new EnlargementLesson();assert.deepEqual(l.bounds,l.question.bounds);l.goTo(3);
 const bounds=l.bounds;
 for(const size of [[1000,500],[390,420],[800,700]]) {
  const view=fitQuestion(bounds,...size);
  for(const k of [-3,-2,-.5,0,.5,1,2,3]) {
   l.scrub(k);assert.deepEqual(l.bounds,bounds);
   const p=graphToScreen(l.pointAt(),view);assert.ok(p.x>=47 && p.x<=size[0]-47);assert.ok(p.y>=47 && p.y<=size[1]-47);
  }
 }
});

test('enlargement guides stay finite at zero and negative factors and do not mutate the lesson',()=>{
 const l=new EnlargementLesson(),paths=[];
 const ctx=new Proxy({measureText:s=>({width:s.length*8}),moveTo:(...p)=>paths.push(p),lineTo:(...p)=>paths.push(p),fillText:(s,...p)=>paths.push(p)},{get:(t,k)=>t[k]??(()=>{})});
 for(const stage of [0,1,2,3,4,5]) for(const dark of [false,true]) {
  l.goTo(stage);
  for(const k of [-3,-1,0,.5,1,2,3]) {
   if(l.ready)l.scrub(k);
   const before=JSON.stringify(l),output=paintEnlargementLesson(ctx,{lesson:l,view:{x:300,y:300,zoom:.7},dark});
   assert.equal(JSON.stringify(l),before);assert.ok(output.obstacles.every(o=>Object.values(o).every(Number.isFinite)));
  }
 }
 assert.ok(paths.length>0);assert.ok(paths.flat().every(Number.isFinite));
});

test('reduction point labels stay separate on a narrow teaching canvas in EN and BM',async()=>{
 const {createTransformationRenderer}=await import('../dist/transform-render.js');
 const oldDocument=globalThis.document,oldDpr=globalThis.devicePixelRatio;
 globalThis.document={body:{classList:{contains:()=>false}}};globalThis.devicePixelRatio=1;
 try {
  const l=new EnlargementLesson();l.goTo(3);l.scrub(.5);
  const width=390,height=450,view=fitQuestion(l.bounds,width,height),texts=[];
  const ctx=new Proxy({measureText:s=>({width:s.length*9}),fillText:(text,x,y)=>texts.push({text,x,y,w:text.length*9})},{get:(t,k)=>t[k]??(()=>{})});
  const draw=createTransformationRenderer({clientWidth:width,clientHeight:height,getContext:()=>ctx});
  for(const trial of ['Trial','Cubaan']) {
   texts.length=0;
   draw({view,gridBounds:l.bounds,objects:[{id:'given',points:[l.question.given],labels:['A'],coordinates:true}],
    preview:{id:'moving',points:[l.pointAt()],labels:[trial]},annotations:[],labelFontSize:19,pointLabelSpread:Math.PI/2,pointLabelRings:8,
    geometryOverlay:ctx=>paintEnlargementLesson(ctx,{lesson:l,view,dark:false,width,height})});
   const a=texts.find(p=>p.text.startsWith('A (')),b=texts.find(p=>p.text===trial);
   assert.ok(a&&b);assert.ok(Math.abs(a.x-b.x)>=(a.w+b.w)/2 || Math.abs(a.y-b.y)>=21,`${trial} overlaps the given point label`);
  }
 } finally {
  if(oldDocument===undefined)delete globalThis.document;else globalThis.document=oldDocument;
  if(oldDpr===undefined)delete globalThis.devicePixelRatio;else globalThis.devicePixelRatio=oldDpr;
 }
});

test('centre and distance labels avoid the revealed answer card',()=>{
 const lesson=new EnlargementLesson();lesson.goTo(5);
 const width=1000,height=434,view=fitQuestion(lesson.bounds,width,height);
 const card={x:260,y:258,w:600,h:100};
 const ctx=new Proxy({measureText:s=>({width:s.length*8})},{get:(t,k)=>t[k]??(()=>{})});
 const result=paintEnlargementLesson(ctx,{lesson,view,dark:false,width,height,overlays:[card]});
 for(const r of result.obstacles) assert.ok(r.x+r.w<=card.x || r.x>=card.x+card.w || r.y+r.h<=card.y || r.y>=card.y+card.h,'guide label overlaps the answer card');
});
