import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ENLARGEMENT_QUESTIONS, EnlargementLesson, EnlargementSnap, enlargePoint, createModuleLesson, findModuleQuestion, fitQuestion, squareCountAt } from '../dist/module-lesson.js';
import { graphToScreen } from '../dist/transform-model.js';
import { paintEnlargementLesson, enlargementGuideSegment } from '../dist/module-enlargement-render.js';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} differs from ${b}`);

test('enlargement Q17 follows printed page 5 and independently checked scheme answer',()=>{
 const q=findModuleQuestion('17'),l=createModuleLesson(q);
 assert.equal(q,ENLARGEMENT_QUESTIONS[0]);assert.ok(l instanceof EnlargementLesson);
 assert.deepEqual(q.given,{x:3,y:2});assert.deepEqual(q.centre,{x:1,y:-1});assert.equal(q.factor,2);
 assert.deepEqual(l.offset,{x:2,y:3});assert.deepEqual(l.answer,{x:5,y:5});
 assert.deepEqual(l.pointAt(),q.given);assert.equal(l.answerVisible,false);
});

test('all four enlargement lessons match the booklet diagrams and independent answers',()=>{
 const expected=[
  ['17',{x:3,y:2},{x:1,y:-1},2,'image',{x:5,y:5}],
  ['18',{x:-1,y:1},{x:-2,y:2},3,'image',{x:1,y:-1}],
  ['19',{x:6,y:2},{x:2,y:-2},.5,'image',{x:4,y:0}],
  ['20',{x:5,y:5},{x:-1,y:1},2,'object',{x:2,y:3}],
 ];
 assert.equal(ENLARGEMENT_QUESTIONS.length,4);
 for(const [id,given,centre,factor,find,answer] of expected) {
  const q=findModuleQuestion(id),l=createModuleLesson(q);
  assert.deepEqual(q.given,given);assert.deepEqual(q.centre,centre);assert.equal(q.factor,factor);assert.equal(q.find,find);
  assert.deepEqual(l.answer,answer);assert.equal(l.answerVisible,false);
  l.goTo(4);l.scrub(l.requiredFactor);assert.equal(l.reveal(),true);assert.deepEqual(l.pointAt(),answer);
  // The final mapping always uses the original forward operation, even Q20.
  assert.deepEqual(enlargePoint(l.object,centre,factor),l.image);
 }
});

test('Q20 recovers the object using a reciprocal factor without treating factor 2 as a correct return',()=>{
 const l=createModuleLesson(findModuleQuestion('20'));
 assert.equal(l.givenLabel,'D′');assert.equal(l.answerLabel,'D');assert.equal(l.requiredFactor,.5);
 l.goTo(4);l.scrub(2);assert.equal(l.canReveal,false);assert.equal(l.reveal(),false);
 l.goTo(6);assert.equal(l.factor,.5);assert.equal(l.canReveal,true);assert.deepEqual(l.pointAt(),{x:2,y:3});
 assert.equal(l.reveal(),true);l.scrub(-1);assert.equal(l.answerVisible,false);
 l.goTo(2);assert.equal(l.factor,1);l.reset();assert.equal(l.stage,0);assert.equal(l.answerVisible,false);
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
 for(const stage of [1,2,3,4]) {l.goTo(stage);assert.equal(l.factor,1);assert.equal(l.answerVisible,false);}
 for(const k of [-2,0,.5,1,1.99,3]) {l.scrub(k);assert.equal(l.canReveal,false);assert.equal(l.reveal(),false);}
 l.scrub(2);assert.equal(l.reveal(),true);assert.deepEqual(l.pointAt(),l.answer);
 l.scrub(1);assert.equal(l.stage,6);assert.equal(l.answerVisible,false);
 l.goTo(2);l.scrub(-2);assert.equal(l.factor,1);
 l.goTo(4);l.scrub(50);assert.equal(l.factor,3);l.scrub(-50);assert.equal(l.factor,-3);
 l.scrub(NaN);assert.equal(l.factor,-3);l.goTo(Infinity);assert.equal(l.stage,6);
 l.reset();assert.equal(l.stage,0);assert.equal(l.factor,1);assert.equal(l.answerVisible,false);
 assert.equal(JSON.stringify(l.question),before);
});

test('scale snap captures and releases stops without preventing exact keyboard factors',()=>{
 const snap=new EnlargementSnap(1);
 assert.equal(snap.move(1.1),1);assert.equal(snap.move(1.2),1.2);
 for(const k of [-3,-2,-1,0,.5,1,2,3]) {
  assert.equal(snap.move(k+.04),k);assert.equal(snap.move(k+.09),k);
 }
 const l=new EnlargementLesson();l.goTo(4);l.scrub(.49);assert.equal(l.factor,.49);
});

test('enlargement camera bounds cover the entire slider without jumping during a drag',()=>{
 const l=new EnlargementLesson();assert.deepEqual(l.bounds,l.question.bounds);l.goTo(4);l.setMode('scale');
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
 for(const stage of [0,1,2,3,4,5,6,7]) for(const dark of [false,true]) {
  l.goTo(stage);
  for(const k of [-3,-1,0,.5,1,2,3]) {
   if(l.ready)l.scrub(k);
   const before=JSON.stringify(l),output=paintEnlargementLesson(ctx,{lesson:l,view:{x:300,y:300,zoom:.7},dark,width:1000,height:600});
   assert.equal(JSON.stringify(l),before);assert.ok(output.obstacles.every(o=>Object.values(o).every(Number.isFinite)));
  }
 }
 assert.ok(paths.length>0);assert.ok(paths.flat().every(Number.isFinite));
});

test('the enlargement guide reaches both canvas edges through pan, zoom, resize and every scale factor',()=>{
 const lesson=new EnlargementLesson();lesson.goTo(4);
 for(const [width,height] of [[1280,434],[390,450],[900,700]]) for(const zoom of [.4,1,2.5]) {
  const view={x:width/2-70,y:height/2+45,zoom};
  const c=graphToScreen(lesson.question.centre,view),a=graphToScreen(lesson.question.given,view);
  const ends=enlargementGuideSegment(c,a,width,height);
  assert.equal(ends.length,2);
  for(const p of ends) {
   assert.ok(p.x>=-1e-8&&p.x<=width+1e-8&&p.y>=-1e-8&&p.y<=height+1e-8);
   near(Math.min(Math.abs(p.x),Math.abs(p.x-width),Math.abs(p.y),Math.abs(p.y-height)),0);
   near((p.x-c.x)*(a.y-c.y)-(p.y-c.y)*(a.x-c.x),0);
  }
  for(const factor of [-3,0,.5,1,2,3]) {
   lesson.scrub(factor);
   const strokes=[];
   const ctx=new Proxy({measureText:s=>({width:s.length*8}),stroke(){strokes.push(this.lineWidth);}},{get:(t,k)=>t[k]??(()=>{})});
   const result=paintEnlargementLesson(ctx,{lesson,view,width,height,dark:false});
   assert.deepEqual(result.segments[0],ends,'guide extent must not depend on the image scale');
   assert.ok(strokes[0]>=3,'guide must remain bold at every camera zoom');
  }
 }
 assert.deepEqual(enlargementGuideSegment({x:20,y:20},{x:20,y:30},100,80),[{x:20,y:0},{x:20,y:80}]);
 assert.deepEqual(enlargementGuideSegment({x:20,y:20},{x:30,y:20},100,80),[{x:0,y:20},{x:100,y:20}]);
 assert.deepEqual(enlargementGuideSegment({x:120,y:20},{x:120,y:30},100,80),[]);
});

test('square counts remain beside their own vertical legs instead of the diagonal',()=>{
 const lesson=new EnlargementLesson();lesson.goTo(4);
 for(const zoom of [.5,1,1.5]) for(const factor of [-2,.5,1,2]) {
  const view={x:500,y:450,zoom},texts=[];
  lesson.scrub(factor);
  const ctx=new Proxy({measureText:s=>({width:s.length*8}),fillText(text,x,y){texts.push({text,x,y,colour:this.fillStyle});}},{get:(t,k)=>t[k]??(()=>{})});
  paintEnlargementLesson(ctx,{lesson,view,width:1200,height:900,dark:false});
  for(const [k,colour] of [[1,'#a95c14'],...(factor===1?[]:[[factor,'#2468c4']])]) {
   const p=graphToScreen(lesson.pointAt(k),view),c=graphToScreen(lesson.question.centre,view);
   const label=texts.find(t=>t.text===String(3*Math.abs(k))&&t.colour===colour);
   assert.ok(label);
   assert.ok((label.x-p.x)*Math.sign(p.x-c.x)>0,'vertical count must be outside its leg');
   assert.ok(Math.abs(label.x-p.x)<=42,'vertical count must stay adjacent to its leg');
   assert.ok(label.y>Math.min(p.y,c.y)&&label.y<Math.max(p.y,c.y),'vertical count must remain between the leg endpoints');
  }
 }
});

test('reduction point labels stay separate on a narrow teaching canvas in EN and BM',async()=>{
 const {createTransformationRenderer}=await import('../dist/transform-render.js');
 const oldDocument=globalThis.document,oldDpr=globalThis.devicePixelRatio;
 globalThis.document={body:{classList:{contains:()=>false}}};globalThis.devicePixelRatio=1;
 try {
  const l=new EnlargementLesson();l.goTo(4);l.scrub(.5);
  const width=390,height=450,view=fitQuestion(l.bounds,width,height),texts=[];
  const ctx=new Proxy({measureText:s=>({width:s.length*9}),fillText:(text,x,y)=>texts.push({text,x,y,w:text.length*9})},{get:(t,k)=>t[k]??(()=>{})});
  const draw=createTransformationRenderer({clientWidth:width,clientHeight:height,getContext:()=>ctx});
  for(const trial of ['Trial','Cubaan']) {
   texts.length=0;
   draw({view,labelOverlapPenalty:2000,tickStride:40*view.zoom<14?5:2,axisFontSize:15,pointRadius:5,gridBounds:l.bounds,objects:[{id:'given',points:[l.question.given],labels:['A'],coordinates:true}],
    preview:{id:'moving',points:[l.pointAt()],labels:[trial],labelPlacement:'below'},annotations:[],labelFontSize:19,pointLabelSpread:Math.PI/2,pointLabelRings:12,
    geometryOverlay:ctx=>paintEnlargementLesson(ctx,{lesson:l,view,dark:false,width,height})});
   const a=texts.find(p=>p.text.startsWith('A (')),b=texts.find(p=>p.text===trial);
   assert.ok(a&&b);assert.ok(Math.abs(a.x-b.x)>=(a.w+b.w)/2 || Math.abs(a.y-b.y)>=21,`${trial} overlaps the given point label`);
  }
 } finally {
  if(oldDocument===undefined)delete globalThis.document;else globalThis.document=oldDocument;
  if(oldDpr===undefined)delete globalThis.devicePixelRatio;else globalThis.devicePixelRatio=oldDpr;
 }
});

test('all enlargement point captions sit below their images with large, non-overlapping component labels',async()=>{
 const {createTransformationRenderer}=await import('../dist/transform-render.js');
 const oldDocument=globalThis.document,oldDpr=globalThis.devicePixelRatio;
 globalThis.document={body:{classList:{contains:()=>false}}};globalThis.devicePixelRatio=1;
 try {
  for(const q of ENLARGEMENT_QUESTIONS) for(const [width,height] of [[1000,550],[390,460]]) {
   const l=createModuleLesson(q);l.goTo(7);
   const texts=[],view=fitQuestion(l.bounds,width,height);
   const ctx=new Proxy({measureText(s){return {width:s.length*(Number(this.font?.match(/(\d+)px/)?.[1])||15)*.55};},fillText(text,x,y){texts.push({text,x,y,font:this.font,w:this.measureText(text).width});}},{get:(t,k)=>t[k]??(()=>{})});
   const draw=createTransformationRenderer({clientWidth:width,clientHeight:height,getContext:()=>ctx});
   draw({view,labelOverlapPenalty:2000,tickStride:40*view.zoom<14?5:2,axisFontSize:15,pointRadius:5,gridBounds:l.bounds,objects:[{id:'given',points:[q.given],labels:[l.givenLabel],coordinates:true,image:l.inverse,labelPlacement:l.inverse?'below':undefined}],
    preview:{id:'moving',points:[l.pointAt()],labels:[l.answerLabel],coordinates:true,image:!l.inverse,labelPlacement:'below'},annotations:[],labelFontSize:width<500?19:23,pointLabelSpread:Math.PI/2,pointLabelRings:12,
    geometryOverlay:(ctx,base)=>paintEnlargementLesson(ctx,{lesson:l,view,dark:false,width,height,overlays:base.obstacles,centreLabel:q.label==='C'?'Centre':'C'})});
   const imagePoint=graphToScreen(l.image,view),imageLabel=texts.find(p=>p.text.startsWith(q.label+'′ ('));
   assert.ok(imageLabel);assert.ok(imageLabel.y>imagePoint.y+10,`Q${q.id} image label must remain below its point`);
   const captions=texts.filter(p=>/^\d+(\.\d+)?$/.test(p.text)&&p.font.startsWith('700 '));
   assert.equal(captions.length,4);assert.ok(captions.every(p=>Number(p.font.match(/(\d+)px/)[1])>=22));
   for(let i=0;i<captions.length;i++) for(const b of captions.slice(i+1)) {const a=captions[i];assert.ok(Math.abs(a.x-b.x)>=(a.w+b.w)/2 || Math.abs(a.y-b.y)>=(Number(a.font.match(/(\d+)px/)[1])+Number(b.font.match(/(\d+)px/)[1]))/2,`Q${q.id} count ${JSON.stringify(a)} overlaps ${JSON.stringify(b)} at width ${width}`);}
   const letterLabels=texts.filter(p=>p.font.startsWith('italic'));
   for(const a of letterLabels) for(const b of captions) assert.ok(Math.abs(a.x-b.x)>=(a.w+b.w)/2 || Math.abs(a.y-b.y)>=(Number(a.font.match(/(\d+)px/)[1])+Number(b.font.match(/(\d+)px/)[1]))/2,`Q${q.id} ${JSON.stringify(a)} overlaps ${JSON.stringify(b)} at width ${width}`);
  }
 } finally {
  if(oldDocument===undefined)delete globalThis.document;else globalThis.document=oldDocument;
  if(oldDpr===undefined)delete globalThis.devicePixelRatio;else globalThis.devicePixelRatio=oldDpr;
 }
});

test('centre and distance labels avoid the revealed answer card',()=>{
 const lesson=new EnlargementLesson();lesson.goTo(7);
 const width=1000,height=434,view=fitQuestion(lesson.bounds,width,height);
 const card={x:260,y:258,w:600,h:100};
 const ctx=new Proxy({measureText:s=>({width:s.length*8})},{get:(t,k)=>t[k]??(()=>{})});
 const result=paintEnlargementLesson(ctx,{lesson,view,dark:false,width,height,overlays:[card]});
 for(const r of result.obstacles) assert.ok(r.x+r.w<=card.x || r.x>=card.x+card.w || r.y+r.h<=card.y || r.y>=card.y+card.h,'guide label overlaps the answer card');
});

test('original and image components are revealed separately for all four questions',()=>{
 for(const q of ENLARGEMENT_QUESTIONS) {
  const l=createModuleLesson(q),v=l.offset,target=l.requiredCounts;
  l.goTo(2);assert.deepEqual(l.givenCounts,{x:0,y:0});assert.equal(l.imageStarted,false);
  l.goTo(3);assert.deepEqual(l.givenCounts,{x:v.x,y:0});assert.equal(l.ready,false);
  l.goTo(4);assert.deepEqual(l.givenCounts,v);assert.deepEqual(l.imageCounts,{x:0,y:0});assert.equal(l.canReveal,false);
  for(let n=1;n<=Math.abs(target.x);n++) {
   l.setCount('x',Math.sign(target.x)*n);
   assert.equal(l.imageCounts.y,0);assert.equal(l.canReveal,false);assert.deepEqual(l.givenCounts,v);
  }
  for(let n=1;n<=Math.abs(target.y);n++) {
   l.setCount('y',Math.sign(target.y)*n);
   assert.equal(l.canReveal,n===Math.abs(target.y));assert.deepEqual(l.givenCounts,v);
  }
  assert.deepEqual(l.pointAt(),l.answer);assert.equal(l.answerVisible,false);
  assert.equal(l.reveal(),true);l.setCount('x',target.x+1);assert.equal(l.canReveal,false);assert.equal(l.answerVisible,false);
 }
});

test('a guide intersection with a wrong scale is not accepted as the correct image',()=>{
 const l=new EnlargementLesson();l.goTo(4);
 l.setCount('x',6);l.setCount('y',9);
 assert.equal(l.onGuide,true);assert.equal(l.canReveal,false);assert.equal(l.reveal(),false);
 assert.equal(l.nextCountAxis,'y');
 l.setCount('x',4);assert.equal(l.onGuide,false);assert.equal(l.canReveal,false);
 l.setCount('y',6);assert.equal(l.onGuide,true);assert.equal(l.canReveal,true);
 l.counting=true;assert.equal(l.canReveal,false);assert.equal(l.reveal(),false);
 l.counting=false;assert.equal(l.canReveal,true);
 l.setCount('x',3);assert.equal(l.nextCountAxis,'x','Next must correct a wrong horizontal count when the vertical is already correct');
});

test('switching between counting and free scale preserves the teacher construction',()=>{
 const l=new EnlargementLesson();l.goTo(4);l.setCount('x',3);l.setCount('y',5);
 const counts={...l.imageCounts};l.setMode('scale');l.scrub(-2);assert.deepEqual(l.pointAt(),{x:-3,y:-7});
 l.setMode('count');assert.deepEqual(l.imageCounts,counts);assert.deepEqual(l.pointAt(),{x:4,y:4});assert.equal(l.canReveal,false);
 l.selectCountAxis('x');assert.equal(l.countAxis,'x');assert.deepEqual(l.imageCounts,counts);
 l.reset();assert.deepEqual(l.imageCounts,{x:0,y:0});assert.deepEqual(l.givenCounts,{x:0,y:0});assert.equal(l.mode,'count');assert.equal(l.imageStarted,false);
});

test('count animation pauses at whole squares, moves continuously, and never overshoots',()=>{
 for(const [from,to] of [[0,4],[0,-3],[6,2],[-1,2],[0,.5],[2,-.5]]) {
  const duration=Math.ceil(Math.abs(to-from))*340,values=[];
  for(let t=0;t<=duration;t+=10) values.push(squareCountAt(from,to,t));
  near(values[0],from);near(values.at(-1),to);
  for(let i=1;i<values.length;i++) {
   assert.ok((values[i]-values[i-1])*Math.sign(to-from)>=-1e-8);
   assert.ok(values[i]>=Math.min(from,to)-1e-8 && values[i]<=Math.max(from,to)+1e-8);
  }
  near(squareCountAt(from,to,duration+100),to);
 }
 near(squareCountAt(0,4,270),1);near(squareCountAt(0,4,330),1);
 near(squareCountAt(0,-3,270),-1);near(squareCountAt(0,-3,330),-1);
});

test('partial count renderer draws only completed components and keeps source counts',()=>{
 const l=new EnlargementLesson(),texts=[];
 const ctx=new Proxy({measureText:s=>({width:s.length*8}),fillText(text,x,y){texts.push({text,colour:this.fillStyle,x,y});}},{get:(t,k)=>t[k]??(()=>{})});
 const paint=()=>{texts.length=0;return paintEnlargementLesson(ctx,{lesson:l,view:{x:400,y:400,zoom:1},dark:false,width:1000,height:700});};
 l.goTo(3);paint();assert.ok(texts.some(t=>t.text==='2'&&t.colour==='#a95c14'));assert.ok(!texts.some(t=>t.text==='3'));
 l.goTo(4);l.setCount('x',4);paint();assert.ok(texts.some(t=>t.text==='3'&&t.colour==='#a95c14'));assert.ok(texts.some(t=>t.text==='4'&&t.colour==='#2468c4'));assert.ok(!texts.some(t=>t.text==='6'));
 l.counting=true;l.countAnimation={source:'image',axis:'y',from:0,to:6};l.imageCounts.y=2.4;paint();assert.ok(texts.some(t=>t.text==='2'&&t.colour==='#2468c4'));assert.ok(!texts.some(t=>t.text==='2.4'));
});


test('displayed count advances only after reaching each square, also when counting backwards',()=>{
 const l=new EnlargementLesson();l.goTo(4);
 for(const [from,to,value,wanted] of [[6,2,5.8,6],[6,2,5,5],[-3,2,-2.2,-3],[-3,2,-2,-2],[0,-3,-1.9,-1]]) {
  l.countAnimation={source:'image',axis:'y',from,to};l.imageCounts.y=value;
  assert.equal(l.displayedCount('image','y'),wanted);
  assert.equal(l.displayedCount('given','y'),3);
 }
});
