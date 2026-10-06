import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ROTATION_QUESTIONS, RotationLesson, createModuleLesson, findModuleQuestion } from '../dist/module-lesson.js';
import { rotatePoint, RotationSnap, graphToScreen } from '../dist/transform-model.js';
import { clockHandAt, paintRotationLesson } from '../dist/module-rotation-render.js';
const length = (a,b) => Math.hypot(a.x-b.x,a.y-b.y);
const near = (a,b) => assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);

test('rotation 9–16 preserve the printed givens and match independent scheme answers',()=>{
  const givens=[[3,2],[-2,5],[5,4],[-4,-1],[5,-2],[-2,6],[5,-1],[-5,3]];
  const answers=[[2,-3],[-6,3],[5,-2],[-2,-5],[-1,-4],[6,0],[-2,-2],[-4,-6]];
  for(const [i,q] of ROTATION_QUESTIONS.entries()) {
    assert.deepEqual(q.given,{x:givens[i][0],y:givens[i][1]});
    const lesson=createModuleLesson(q);assert.ok(lesson instanceof RotationLesson);
    assert.equal(findModuleQuestion(String(i+9)),q);
    assert.deepEqual(lesson.answer,{x:answers[i][0],y:answers[i][1]});
    assert.deepEqual(rotatePoint(lesson.object,q.centre,q.degrees),lesson.image);
    assert.ok(Object.isFrozen(q) && Object.isFrozen(q.given) && Object.isFrozen(q.centre));
  }
});

test('each constructed L is a rigid quarter-turn about the specified centre, including signed offsets',()=>{
  for(const q of ROTATION_QUESTIONS) {
    const lesson=new RotationLesson(q), c=q.centre;
    for(const [i,arm] of lesson.arms.entries()) {
      near(length(arm.centre,arm.corner),Math.abs(q.given.x-c.x));
      near(length(arm.corner,arm.end),Math.abs(q.given.y-c.y));
      near((arm.corner.x-c.x)*(arm.end.x-arm.corner.x)+(arm.corner.y-c.y)*(arm.end.y-arm.corner.y),0);
      assert.deepEqual(arm.end,rotatePoint(q.given,c,i*90));
    }
    assert.deepEqual(lesson.arms[0].end,q.given);
    const index=((q.degrees/90)%4+4)%4;assert.deepEqual(lesson.arms[index].end,lesson.answer);
    lesson.goTo(9);
    for(let progress=-360;progress<=360;progress+=7) {
      const p=lesson.pointAt(progress),b=lesson.bounds;
      near(length(p,c),length(q.given,c));
      assert.ok(p.x>=b.xmin && p.x<=b.xmax && p.y>=b.ymin && p.y<=b.ymax);
    }
  }
});

test('construction is paced, clock is gated, scrubbing and backtracking hide answers',()=>{
  const lesson=new RotationLesson();
  assert.equal(lesson.toggleClock(),false);lesson.scrub(1);assert.equal(lesson.progress,0);
  for(let stage=0;stage<=9;stage++) {
    lesson.goTo(stage); assert.equal(lesson.answerVisible,false);assert.equal(lesson.progress,0);
    assert.equal(lesson.armCount,Math.min(4,Math.ceil(Math.max(0,stage-1)/2)));
    assert.equal(lesson.bendCount,Math.min(4,Math.floor(Math.max(0,stage-1)/2)));
  }
  lesson.toggleClock();assert.equal(lesson.clockVisible,true);
  lesson.goTo(10);assert.deepEqual(lesson.pointAt(),lesson.answer);assert.equal(lesson.answerVisible,false);
  lesson.goTo(11);assert.equal(lesson.answerVisible,true);
  const state=JSON.stringify([lesson.stage,lesson.progress,lesson.pointAt(),lesson.answerVisible]);
  lesson.toggleClock();assert.equal(lesson.clockVisible,false);
  assert.equal(JSON.stringify([lesson.stage,lesson.progress,lesson.pointAt(),lesson.answerVisible]),state);
  lesson.scrub(-45);assert.equal(lesson.answerVisible,false);near(length(lesson.pointAt(),{x:0,y:0}),Math.sqrt(13));
  lesson.scrub(-90);assert.equal(lesson.answerVisible,false);
  lesson.goTo(8);assert.equal(lesson.clockVisible,false);assert.equal(lesson.progress,0);
  lesson.goTo(9);lesson.toggleClock();lesson.reset();assert.equal(lesson.clockVisible,false);assert.equal(lesson.stage,0);
  lesson.goTo(NaN);assert.equal(lesson.stage,0);
});

test('clock rotates clockwise on screen, independently of clockwise or anticlockwise questions',()=>{
  const positions=[[0,-1],[1,0],[0,1],[-1,0],[0,-1]];
  for(let i=0;i<5;i++) {const p=clockHandAt(i*1500);near(p.x,positions[i][0]);near(p.y,positions[i][1]);}
  const ctx=new Proxy({measureText:s=>({width:s.length*8})},{get:(t,k)=>t[k]??(()=>{})});
  for(const q of ROTATION_QUESTIONS) {
    const lesson=new RotationLesson(q);lesson.goTo(9);lesson.toggleClock();lesson.scrub(-37);
    const before=JSON.stringify(lesson), view={x:300,y:300,zoom:1};
    for(const dark of [false,true]) for(const clockTime of [0,1500,3000,4500]) {
      const result=paintRotationLesson(ctx,{lesson,view,dark,clockTime});
      assert.ok(result.obstacles.length>0);assert.equal(JSON.stringify(lesson),before);
    }
  }
});


test('free turns cover both complete circles and retain rigid geometry at arbitrary angles',()=>{
  for(const q of ROTATION_QUESTIONS) {
    const lesson=new RotationLesson(q);lesson.goTo(9);
    for(const angle of [-360,-315,-270,-180,-123,-90,-17,0,17,45,90,180,225,270,360]) {
      lesson.scrub(angle);assert.equal(lesson.angle,angle);assert.equal(lesson.answerVisible,false);
      assert.deepEqual(lesson.pointAt(),rotatePoint(q.given,q.centre,angle));
      near(length(lesson.pointAt(),q.centre),length(q.given,q.centre));
      near(length(lesson.pointAt(),lesson.cornerAt()),Math.abs(q.given.y-q.centre.y));
      assert.deepEqual(lesson.pointAt(lesson.equivalentAngle),lesson.pointAt());
      if(Math.abs(angle)===360 || angle===0) {assert.equal(lesson.atStart,true);assert.deepEqual(lesson.pointAt(),q.given);}
      else assert.equal(lesson.atStart,false);
    }
    lesson.scrub(900);assert.equal(lesson.angle,360);lesson.scrub(-900);assert.equal(lesson.angle,-360);
    lesson.scrub(NaN);assert.equal(lesson.angle,-360);
  }
});

test('trial turns never expose an answer under the wrong question operation',()=>{
  for(const q of ROTATION_QUESTIONS) {
    const lesson=new RotationLesson(q);lesson.goTo(9);lesson.scrub(35);
    assert.equal(lesson.reveal(),false);assert.equal(lesson.answerVisible,false);
    lesson.scrub(q.degrees);assert.equal(lesson.reveal(),true);assert.deepEqual(lesson.pointAt(),lesson.answer);
    lesson.scrub(q.degrees-Math.sign(q.degrees)*360);assert.equal(lesson.answerVisible,false);
    assert.deepEqual(lesson.pointAt(),lesson.answer,'same position can have a different direction and amount');
    assert.equal(lesson.canReveal,Math.abs(q.degrees)===180,'180° permits either direction; 270° is not the stated 90° turn');
    lesson.scrub(0);assert.equal(lesson.reveal(),false);
    lesson.setDirection(-1);assert.equal(lesson.direction,-1);lesson.scrub(270*lesson.direction);assert.equal(lesson.angle,-270);
    lesson.setDirection(1);assert.equal(lesson.angle,270);assert.equal(lesson.answerVisible,false);
  }
});

test('quarter-turn snap captures, holds and releases in both directions without blocking arbitrary turns',()=>{
  for(const sign of [-1,1]) {
    const snap=new RotationSnap();
    assert.equal(snap.move(35*sign),35*sign);
    for(const stop of [90,180,270,360]) {
      assert.equal(snap.move((stop-7)*sign),stop*sign);
      assert.equal(snap.move((stop-15)*sign),stop*sign);
      if(stop<360) assert.equal(snap.move((stop+24)*sign),(stop+24)*sign);
    }
    assert.equal(snap.move(5*sign),0);
  }
  const l=new RotationLesson();l.goTo(9);l.scrub(89);assert.equal(l.angle,89,'keyboard and exact buttons do not get stuck at snap points');
});

test('both counting orders build the same four endpoints from every non-origin centre',()=>{
  for(const q of ROTATION_QUESTIONS)for(const order of ['x','y']) {
    const l=new RotationLesson(q);l.selectFirstAxis(order);l.advanceConstruction();
    for(let i=0;i<8;i++) {
      const {axis,target}=l.segmentInfo();assert.equal(l.buildIndex,i);
      assert.equal(l.constructionComplete,false);assert.equal(l.reveal(),false);
      l.setBuildCount(axis,target+1);assert.equal(l.segmentMatches,false);
      l.setBuildCount(axis,target);assert.equal(l.segmentMatches,true);
      const arm=Math.floor(i/2);
      if(i%2)assert.deepEqual(l.constructionPaths[arm].end,rotatePoint(q.given,q.centre,arm*90));
      else assert.deepEqual(l.constructionPaths[arm].end,l.constructionPaths[arm].corner,'the bend waits for Next');
      for(const path of l.constructionPaths.slice(arm+1)) {
        assert.deepEqual(path.corner,q.centre,'later arms remain empty until the current bend is kept');
        assert.deepEqual(path.end,q.centre);
      }
      l.advanceConstruction();
    }
    assert.equal(l.constructionComplete,true);assert.equal(l.answerVisible,false);
    l.scrub(q.degrees);assert.deepEqual(l.pointAt(),l.answer);assert.equal(l.reveal(),true);
    l.selectFirstAxis(order==='x'?'y':'x');assert.equal(l.answerVisible,false);assert.equal(l.clockVisible,false);assert.equal(l.constructionComplete,false);
  }
});
test('manual first direction chooses order, corrections preserve earlier segments, and back/reset remove stale construction',()=>{
  const l=new RotationLesson();l.advanceConstruction();l.setBuildCount('y',1);assert.equal(l.firstAxis,'y');
  l.setBuildCount('x',3);assert.equal(l.buildCounts[0],1,'wrong axis cannot add a third bend');
  l.setBuildCount('y',2);l.advanceConstruction();l.setBuildCount('x',4);l.clearConstructionSegment();
  assert.deepEqual(l.buildCounts.slice(0,2),[2,0]);l.setBuildCount('x',3);l.advanceConstruction();
  l.previousConstruction();assert.equal(l.buildIndex,1);assert.deepEqual(l.buildCounts.slice(0,3),[2,0,0]);
  l.setBuildCount('x',NaN);assert.equal(l.buildCounts[1],0);l.reset();assert.equal(l.firstAxis,'x');assert.equal(l.stage,0);
});

test('only Next changes segment; each straight arm is followed by its bend before the next arm',()=>{
  const l=new RotationLesson();l.advanceConstruction();l.nudgeConstruction('y',1);l.nudgeConstruction('y',1);
  assert.equal(l.firstAxis,'y');assert.equal(l.nudgeConstruction('x',1),false);
  assert.equal(l.buildIndex,0);assert.deepEqual(l.constructionPaths[0].corner,{x:0,y:2});
  l.advanceConstruction();assert.equal(l.buildIndex,1);assert.deepEqual(l.buildCounts,[2,0,0,0,0,0,0,0]);
  l.nudgeConstruction('x',-1);l.advanceConstruction();assert.equal(l.buildCounts[1],-1,'a trial count is kept without snapping to the answer');
  assert.deepEqual(l.constructionPaths[0].end,{x:-1,y:2});
  assert.equal(l.armCount,1);assert.equal(l.bendCount,1);
  assert.deepEqual(l.constructionPaths[1].corner,l.question.centre);
  for(let i=2;i<4;i++){const {axis,target}=l.segmentInfo();l.setBuildCount(axis,target);l.advanceConstruction();}
  assert.equal(l.armCount,2);assert.equal(l.bendCount,2);assert.equal(l.buildIndex,4);
  l.nudgeConstruction('y',-1);assert.equal(l.armCount,3);assert.equal(l.bendCount,2);assert.equal(l.buildIndex,4);
});

test('incorrect trial lengths cannot reveal a correct answer, and completing twice cannot add a ninth segment',()=>{
  const l=new RotationLesson();l.advanceConstruction();
  for(let i=0;i<8;i++){const {axis,target}=l.segmentInfo();l.setBuildCount(axis,target+(i===7?1:0));l.advanceConstruction();}
  assert.equal(l.constructionComplete,true);assert.equal(l.constructionMatches,false);
  l.scrub(l.movementDegrees);assert.equal(l.reveal(),false);
  l.advanceConstruction();assert.equal(l.buildIndex,8);
  l.previousConstruction();const {axis,target}=l.segmentInfo();l.setBuildCount(axis,target);l.advanceConstruction();
  assert.equal(l.constructionMatches,true);l.scrub(l.movementDegrees);assert.equal(l.reveal(),true);
});


test('rotation count labels avoid the graph axis-number rectangles',()=>{
  const lesson=new RotationLesson();lesson.goTo(9);
  for(const zoom of [.4,.7,1]){
    const view={x:300,y:300,zoom};
    const overlays=[-2,2].flatMap(n=>{
      const x=graphToScreen({x:n,y:0},view),y=graphToScreen({x:0,y:n},view);
      return [{x:x.x-12,y:x.y+8,w:24,h:16},{x:y.x-28,y:y.y-8,w:24,h:16}];
    });
    const ctx=new Proxy({measureText:s=>({width:s.length*11})},{get:(t,k)=>t[k]??(()=>{})});
    const drawn=paintRotationLesson(ctx,{lesson,view,dark:false,width:700,height:600,overlays});
    for(const label of drawn.obstacles)for(const axis of overlays){
      const overlap=label.x<axis.x+axis.w&&label.x+label.w>axis.x&&label.y<axis.y+axis.h&&label.y+label.h>axis.y;
      assert.equal(overlap,false,'count must not obscure a coordinate');
    }
  }
});
