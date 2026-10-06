import {test} from 'node:test';
import assert from 'node:assert/strict';
import {coordinateGuideFrame,paintCoordinateGuide,COORDINATE_GUIDE_DURATION} from '../dist/module-coordinate-guide.js';
import {graphToScreen} from '../dist/transform-model.js';

test('reading projects each point to its own perpendicular axis, including signed and zero coordinates',()=>{
  for(const point of [{x:7,y:2},{x:-4,y:3},{x:0,y:-2},{x:0,y:0}]){
    const before=structuredClone(point),f=coordinateGuideFrame(point,'read',2600);
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
    for(let t=0;t<=COORDINATE_GUIDE_DURATION;t+=10){
      const f=coordinateGuideFrame(point,mode,t);
      assert.equal(f.xLine[0].x,f.xLine[1].x);assert.equal(f.yLine[0].y,f.yLine[1].y);
      assert.ok(!f.yRead||f.xRead);
      for(const k of ['xProgress','yProgress','opacity','xFlight','yFlight'])assert.ok(f[k]>=0&&f[k]<=1);
    }
    const first=coordinateGuideFrame(point,mode,1300);assert.equal(first.xRead,true);assert.equal(first.yRead,false);assert.equal(first.yProgress,0);
    const final=coordinateGuideFrame(point,mode,COORDINATE_GUIDE_DURATION);assert.equal(final.done,true);assert.equal(final.opacity,0);
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
