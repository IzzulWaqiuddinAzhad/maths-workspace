import {test} from 'node:test';
import assert from 'node:assert/strict';
import {coordinateGuideFrame,paintCoordinateGuide,paintCoordinateReadout,coordinateGuideDuration} from '../dist/module-coordinate-guide.js';
import {graphToScreen} from '../dist/transform-model.js';

test('reading projects each point to its own perpendicular axis, including signed and zero coordinates',()=>{
  for(const point of [{x:7,y:2},{x:-4,y:3},{x:0,y:-2},{x:0,y:0}]){
    const before=structuredClone(point),f=coordinateGuideFrame(point,'read',4000);
    assert.deepEqual(f.xLine,[point,{x:point.x,y:0}]);
    assert.deepEqual(f.yLine,[point,{x:0,y:point.y}]);
    assert.deepEqual(point,before);
  }
});
test('plotting travels from the axes and reveals the centre only after both guides reach it',()=>{
  const point={x:7,y:2};
  for(const time of [0,400,1250,1900,2499])assert.equal(coordinateGuideFrame(point,'plot',time).showPoint,false);
  const f=coordinateGuideFrame(point,'plot',2500);
  assert.deepEqual(f.xLine,[{x:7,y:0},point]);assert.deepEqual(f.yLine,[{x:0,y:2},point]);assert.equal(f.showPoint,true);
});
test('x is read before y, each moving line remains on its axis projection and both fade at completion',()=>{
  for(const mode of ['read','plot']){
    const point={x:-5,y:-3};
    for(let t=0;t<=coordinateGuideDuration(mode);t+=10){
      const f=coordinateGuideFrame(point,mode,t);
      assert.equal(f.xLine[0].x,f.xLine[1].x);assert.equal(f.yLine[0].y,f.yLine[1].y);
      assert.ok(!f.yRead||f.xRead);
      for(const k of ['xProgress','yProgress','opacity','xFlight','yFlight'])assert.ok(f[k]>=0&&f[k]<=1);
    }
    const first=coordinateGuideFrame(point,mode,mode==='read'?2200:1300);assert.equal(first.xRead,true);assert.equal(first.yRead,false);assert.equal(first.yProgress,0);
    const final=coordinateGuideFrame(point,mode,coordinateGuideDuration(mode));assert.equal(final.done,true);assert.equal(final.opacity,0);
  }
});
test('coordinate overlay follows the existing pan/zoom conversion without mutating geometry or camera',()=>{
  for(const view of [{x:320,y:300,zoom:.4},{x:150,y:120,zoom:1.3}])for(const dark of [false,true]){
    const point={x:2,y:1},arcs=[],before=JSON.stringify({view,point});
    const ctx=new Proxy({measureText:s=>({width:s.length*11}),arc:(...args)=>arcs.push(args)},{get:(t,k)=>t[k]??(()=>{})});
    paintCoordinateGuide(ctx,{point,label:'A',mode:'read',elapsed:2600,view,dark,width:800,height:600});
    const screen=graphToScreen(point,view);assert.ok(arcs.length>0);
    for(const arc of arcs){assert.equal(arc[0],screen.x);assert.equal(arc[1],screen.y);assert.ok(arc.every(Number.isFinite));}
    assert.equal(JSON.stringify({view,point}),before);
  }
});


test('reading blinks, reaches each axis, then flies its value into the empty coordinate slot',()=>{
  const p={x:7,y:2},f=t=>coordinateGuideFrame(p,'read',t);
  assert.equal(f(300).phase,'point');assert.equal(f(300).xProgress,0);
  for(let t=0;t<1200;t+=10)assert.equal(f(t).xAxisVisible,false);
  assert.equal(f(1200).xProgress,1);assert.equal(f(1200).xAxisVisible,true);
  assert.equal(f(1200).xFlight,0);assert.equal(f(1600).xRead,false);
  assert.ok(f(1600).xFlight>0);assert.equal(f(2100).xRead,true);
  assert.equal(f(2100).yProgress,0);assert.equal(f(2999).yAxisVisible,false);
  assert.equal(f(3000).yProgress,1);assert.equal(f(3000).yAxisVisible,true);
  assert.equal(f(3000).yFlight,0);assert.equal(f(3400).yRead,false);
  assert.ok(f(3400).yFlight>0);assert.equal(f(3900).yRead,true);
});
test('axis values are not painted early, and completed coordinates remain when guides have faded',()=>{
  const texts=[],stack=[];
  const target={globalAlpha:1,measureText:s=>({width:s.length*11}),fillText:(text,x,y)=>texts.push({text,x,y,alpha:target.globalAlpha}),save:()=>stack.push(target.globalAlpha),restore:()=>{target.globalAlpha=stack.pop();}};
  const ctx=new Proxy(target,{get:(t,k)=>t[k]??(()=>{})});
  const options={point:{x:7,y:2},label:'A',mode:'read',view:{x:320,y:320,zoom:1},dark:false,width:640,height:724};
  paintCoordinateGuide(ctx,{...options,elapsed:1100});
  assert.ok(!texts.some(t=>['7','2'].includes(t.text)));
  texts.length=0;paintCoordinateGuide(ctx,{...options,elapsed:coordinateGuideDuration('read')});
  for(const text of ['7','2'])assert.ok(texts.some(t=>t.text===text&&t.alpha===1));
  texts.length=0;paintCoordinateReadout(ctx,{...options,point:{x:-6,y:0}});
  assert.ok(texts.some(t=>t.text==='−6'));assert.ok(texts.some(t=>t.text==='0'));
  assert.ok(texts.every(t=>t.x>=0&&t.x<=640&&t.y>=0&&t.y<=724));
});
