import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ROTATION_QUESTIONS, RotationLesson, createModuleLesson, findModuleQuestion } from '../dist/module-lesson.js';
import { rotatePoint, RotationSnap } from '../dist/transform-model.js';
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
    assert.equal(lesson.armCount,Math.min(4,Math.max(0,stage-1)));
    assert.equal(lesson.bendCount,Math.min(4,Math.max(0,stage-5)));
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
