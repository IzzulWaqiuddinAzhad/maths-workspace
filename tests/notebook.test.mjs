import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {MODULE_PAGE,PAGE_GRAPHS,graphToPage,fitPage,fitQuestion,constrainPage,saveLesson,restoreLesson} from '../dist/notebook-model.js';
import {screenToWorld,worldToScreen,zoomAt,DocumentStore,newDocument,createObject} from '../dist/core.js?v=14';

test('printed module points agree with all four calibrated graph origins',()=>{
  const expected=[[196.5,293],[408,255.5],[221.5,601],[383,663.5]];
  const svg=readFileSync(new URL('../dist/notebook-assets/rotation-a3.svg',import.meta.url),'utf8');
  PAGE_GRAPHS.forEach((g,i)=>{
    const p=graphToPage(g,g.question.given);assert.deepEqual([p.x,p.y],expected[i]);
    const dots=[...svg.matchAll(/<circle cx="([^"]+)" cy="([^"]+)"/g)].map(m=>({x:+m[1],y:+m[2]}));
    assert.ok(dots.some(d=>d.x===p.x&&d.y===p.y));
    const lowerLeft=graphToPage(g,{x:-8,y:-8});assert.deepEqual(lowerLeft,{x:g.x,y:g.y+200});
  });
});
test('page, ink and graph share coordinates through pinch zoom and pan',()=>{
  for(const g of PAGE_GRAPHS){
    const p=graphToPage(g,g.question.given),v=fitPage(768,1024);
    const midpoint={x:250,y:390},under=screenToWorld(midpoint,v),z=zoomAt(v,midpoint,1.7);
    const stable=worldToScreen(under,z);assert.ok(Math.hypot(stable.x-midpoint.x,stable.y-midpoint.y)<1e-8);
    z.x-=83;z.y-=297;const q=screenToWorld(worldToScreen(p,z),z);
    assert.ok(Math.hypot(p.x-q.x,p.y-q.y)<1e-8);
  }
});
test('iPad portrait and landscape fit the complete active question beside controls',()=>{
  for(const [width,height]of[[1024,710],[768,966],[1366,966]])for(const g of PAGE_GRAPHS){
    const v=fitQuestion(g,width,height,{right:290}),b=g.questionBox;
    const a=worldToScreen(b,v),c=worldToScreen({x:b.x+b.w,y:b.y+b.h},v);
    assert.ok(a.x>=15&&a.y>=75);assert.ok(c.x<=width-290-15&&c.y<=height-15);
  }
  assert.ok(MODULE_PAGE.height>MODULE_PAGE.width);
});
test('every graph keeps its own construction, order, angle and correct answer',()=>{
  const expected=[{x:2,y:-3},{x:-6,y:3},{x:5,y:-2},{x:-2,y:-5}];
  PAGE_GRAPHS.forEach((g,i)=>{
    for(const axis of ['x','y']){
      const l=restoreLesson(g.question,null);l.selectFirstAxis(axis);l.advanceConstruction();
      for(let j=0;j<8;j++){const s=l.segmentInfo();l.setBuildCount(s.axis,s.target);l.advanceConstruction();}
      assert.ok(l.constructionMatches);l.scrub(g.question.degrees);assert.ok(l.reveal());
      assert.deepEqual(l.answer,expected[i]);const copy=restoreLesson(g.question,saveLesson(l));
      assert.ok(copy.answerVisible);assert.equal(copy.firstAxis,axis);assert.deepEqual(copy.buildCounts,l.buildCounts);
      copy.buildCounts[0]++;assert.notDeepEqual(copy.buildCounts,l.buildCounts);
      l.scrub(-180);assert.equal(l.answerVisible,false);
    }
  });
});
test('invalid stored lessons cannot restore NaN geometry or expose a wrong answer',()=>{
  const q=PAGE_GRAPHS[0].question;
  for(const data of [null,{}, {stage:2,buildIndex:99}, {stage:2,buildIndex:0,buildCounts:Array(8).fill(NaN),firstAxis:'x',progress:0}])assert.equal(restoreLesson(q,data).stage,0);
  const l=restoreLesson(q,null);l.goTo(9);l.scrub(32);const d=saveLesson(l);d.answerVisible=true;
  assert.equal(restoreLesson(q,d).answerVisible,false);
});
test('demo changes leave writing history alone and undo never removes the printed page',()=>{
  const store=new DocumentStore(newDocument()),l=restoreLesson(PAGE_GRAPHS[0].question,null);
  store.transact(d=>d.objects.push(createObject('InkStroke',{points:[{x:0,y:0},{x:20,y:10}]})));
  l.goTo(9);l.scrub(-90);l.reveal();l.reset();assert.equal(store.document.objects.length,1);
  store.undo();assert.equal(store.document.objects.length,0);store.redo();assert.equal(store.document.objects.length,1);
});

test('large scroll deltas cannot move the page completely off screen',()=>{
  for(const width of [390,768,1024])for(const zoom of [.1,1,3,8])for(const n of [-100000,100000]){
    const height=768,v=constrainPage({x:n,y:n,zoom},width,height);
    assert.ok(v.x<width&&v.x+MODULE_PAGE.width*zoom>0);
    assert.ok(v.y<height&&v.y+MODULE_PAGE.height*zoom>0);
  }
});
