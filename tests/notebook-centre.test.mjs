import test from 'node:test';
import assert from 'node:assert/strict';
import {CentreFinding,rotationCandidates,rotationError,pointDistance} from '../dist/notebook-centre.js';
import {NOTEBOOK_GRAPHS} from '../dist/notebook-model.js';
import {NotebookSession} from '../dist/notebook-session.js';
import {paintNotebookGraph} from '../dist/notebook-render.js';
import {LabelLayout} from '../dist/label-layout.js';
const graph=id=>NOTEBOOK_GRAPHS.find(g=>g.id===String(id));
const session=id=>new NotebookSession(graph(id));
const towards=(f,target,order=['x','y'])=>{for(const axis of order){if(Math.abs(f.cursor[axis]-target[axis])%1)f.step=.5;let n=0;while(Math.abs(f.cursor[axis]-target[axis])>1e-8){assert.ok(n++<100);assert.ok(f.move(axis,Math.sign(target[axis]-f.cursor[axis])));}}};
const complete=f=>{towards(f,f.midpoint);assert.ok(f.next());towards(f,f.candidates[1].point);assert.ok(f.next());};

test('all Questions 33–40 and all corresponding pairs produce the correct centre without an answer key',()=>{
  const expected={33:[-3,0,-90],34:[1,-1,90],35:[-2,1,-90],36:[2,2,90],37:[-1,1,180],38:[2,1,180],39:[0,3,-90],40:[3,-2,90]};
  for(let id=33;id<=40;id++)for(const side of [0,1]){
    const f=session(id).centreFinding;
    for(let i=0;i<f.source.length;i++){
      if(!f.selectPair(i,side))continue;
      const [x,y,deg]=expected[id],angle=deg;
      const c=f.candidates.find(c=>pointDistance(c.point,{x,y})<1e-8);
      assert.ok(c,`Q${id} vertex ${i}`);assert.ok(rotationError(f.source,f.target,c.point,angle)<1e-8);
      for(const candidate of f.candidates.filter(a=>a.id!==c.id))assert.ok([-90,90,180].every(a=>rotationError(f.source,f.target,candidate.point,a)>1e-8));
    }
  }
});
test('half-square movement reaches fractional midpoints and preserves opposed cursors',()=>{
  const f=session(39).centreFinding;f.selectPair(0);f.step=.5;assert.deepEqual(f.midpoint,{x:-1.5,y:5.5});
  f.move('x',1);assert.deepEqual(f.cursor,{x:-3.5,y:4});assert.deepEqual(f.pairedCursor,{x:.5,y:7});assert.equal(f.canNext,false);
  towards(f,f.midpoint);assert.deepEqual(f.cursor,f.pairedCursor);assert.ok(f.canNext);
});
test('either coordinate can be constructed first; reversed pairs and whole-square mode stay correct',()=>{
  for(let id=33;id<=40;id++)for(const side of [0,1])for(const order of [['x','y'],['y','x']]){
    const f=session(id).centreFinding;f.selectPair(1,side);f.step=1;if([f.midpoint.x-f.a.x,f.midpoint.y-f.a.y].some(n=>n%1))f.step=.5;towards(f,f.midpoint,order);assert.ok(f.next());
    towards(f,f.candidates[2].point,order);assert.ok(f.next());assert.equal(f.phase,'check');assert.equal(f.paths.length,4);
  }
});
test('construction is gated on meeting and completing the two other arms',()=>{
  const f=session(34).centreFinding;assert.equal(f.next(),false);assert.equal(f.chooseCandidate('first'),false);
  f.selectPair(0);f.move('x',-1);assert.equal(f.next(),false);towards(f,f.midpoint);assert.ok(f.next());
  assert.equal(f.next(),false);f.move('x',1);assert.equal(f.next(),false);towards(f,f.candidates[1].point);assert.ok(f.next());
  f.undo();assert.equal(f.phase,'arms');f.undo();assert.equal(f.canNext,false);
});
test('a second pair rejects the false 90-degree centre; equal distances alone never establish a rotation',()=>{
  const f=session(33).centreFinding;f.selectPair(0);complete(f);f.chooseCandidate('second');
  assert.notEqual(f.compareIndex,f.index);f.compare(f.compareIndex);assert.equal(f.equalDistances,false);
  f.compare(f.index);assert.ok(f.equalDistances);for(const d of [-90,90]){f.startTest(d);f.testProgress=1;assert.equal(f.testMatches,false);}
  f.chooseCandidate('first');f.compare(f.compareIndex);assert.ok(f.equalDistances);f.startTest(-90);f.testProgress=1;assert.ok(f.testMatches);
  f.startTest(90);f.testProgress=1;assert.equal(f.testMatches,false);
});
test('180-degree questions reject both 90-degree candidates and accept the midpoint',()=>{
  for(const id of [37,38]){const f=session(id).centreFinding;f.selectPair(0);complete(f);
    for(const c of ['first','second']){f.chooseCandidate(c);for(const d of [-90,90]){f.startTest(d);assert.equal(f.testMatches,false);}}
    f.chooseCandidate('midpoint');f.startTest(180);f.testProgress=1;assert.ok(f.testMatches);
  }
});
test('save/reload retains each construction stage and completed tests while leaving trial rotation untouched',()=>{
  const g=graph(40),s=session(40);s.setCentre({x:2,y:3});s.lesson.scrub(-70);s.lesson.readPoints.centre=true;
  const before=structuredClone(s.save().engines),f=s.centreFinding;s.findingCentre=true;s.trialVisible=false;f.selectPair(0);f.move('x',-1);
  let restored=new NotebookSession(g,s.save());assert.deepEqual(restored.centreFinding.save(),f.save());
  towards(f,f.midpoint);f.next();f.move('x',-1);restored=new NotebookSession(g,s.save());assert.deepEqual(restored.centreFinding.save(),f.save());
  towards(f,f.candidates[2].point);f.next();f.chooseCandidate('second');f.compare(f.compareIndex);f.startTest(90);f.testProgress=.5;
  restored=new NotebookSession(g,s.save());assert.equal(restored.centreFinding.testDegrees,null);
  f.testProgress=1;restored=new NotebookSession(g,s.save());assert.ok(restored.centreFinding.testMatches);assert.deepEqual(restored.save().engines,before);assert.equal(restored.trialVisible,false);
  f.reset();assert.equal(f.phase,'pair');assert.deepEqual(s.save().engines,before);
});
test('invalid saved paths, invalid moves and fixed vertices cannot create a false construction',()=>{
  const objects=[{name:'P',points:[{x:0,y:0},{x:1,y:0}]},{name:'Q',points:[{x:0,y:0},{x:0,y:1}]}];
  const f=new CentreFinding(objects);assert.equal(f.selectPair(0),false);assert.equal(f.selectPair(-1),false);assert.equal(f.selectPair(1,2),false);f.selectPair(1);
  assert.equal(f.move('z',1),false);assert.equal(f.move('x',NaN),false);
  const restored=new CentreFinding(objects,{index:1,side:0,path:[{x:1,y:0},{x:NaN,y:0}],phase:'check',candidate:'first'});
  assert.equal(restored.phase,'meet');assert.deepEqual(restored.path,[{x:1,y:0}]);assert.equal(restored.chosen,undefined);
});
test('starting on the image changes the controlled tip but preserves the printed P to Q rotation',()=>{
  const f=session(33).centreFinding;f.selectPair(0,1);assert.deepEqual(f.a,{x:-1,y:-2});complete(f);
  const c=f.candidates.find(c=>pointDistance(c.point,{x:-3,y:0})<1e-8);f.chooseCandidate(c.id);f.startTest(-90);f.testProgress=1;assert.ok(f.testMatches);f.startTest(90);assert.equal(f.testMatches,false);
});
test('every printed rotation pair including mixed questions has the same study, without including translations or reflections',()=>{
  const supported=['33','34','35','36','37','38','39','40','47','49','50','60','62-1','64-2'];
  for(const g of NOTEBOOK_GRAPHS){const s=new NotebookSession(g);assert.equal(!!s.centreFinding,supported.includes(g.id),g.id);}
  assert.deepEqual(session('49').centreFinding.objects.map(o=>o.name),['Q','R']);
  assert.deepEqual(session('62-1').centreFinding.objects.map(o=>o.name),['ABCD','EFGH']);
  for(const id of supported){const f=session(id).centreFinding;assert.ok(f.selectPair(1));complete(f);assert.equal(f.phase,'check');}
});
test('distance reading waits for each Next, clears the previous pair, and preserves the construction',()=>{
  const f=session(33).centreFinding;f.selectPair(0);complete(f);f.chooseCandidate('first');const paths=structuredClone(f.paths);
  f.compare(1);assert.deepEqual(f.distanceFractions,[0,0]);assert.equal(f.distanceStage,1);
  assert.ok(f.nextDistance());f.distanceProgress=.5;assert.deepEqual(f.distanceFractions,[.5,0]);assert.equal(f.nextDistance(),false);
  f.distanceProgress=1;assert.ok(f.nextDistance());f.distanceProgress=.25;assert.deepEqual(f.distanceFractions,[1,.25]);f.distanceProgress=1;
  assert.deepEqual(f.distanceFractions,[1,1]);assert.equal(f.nextDistance(),false);assert.equal(f.distanceStage,1);
  f.compare(2);assert.deepEqual(f.distanceFractions,[0,0]);assert.deepEqual(f.paths,paths);
  const restored=new CentreFinding(f.objects,f.save());assert.equal(restored.distanceStage,1);assert.equal(restored.compareIndex,2);
});
test('the distance renderer only draws the two radii and small point pulses, never a comparison circle',()=>{
  const s=session(33),f=s.centreFinding,g={...graph(33),session:s,layout:new LabelLayout()};s.findingCentre=true;f.selectPair(0);complete(f);f.chooseCandidate('first');f.compare(1);
  const radii=[],ctx=new Proxy({measureText:t=>({width:String(t).length*12}),arc:(x,y,r)=>radii.push(r)},{get:(o,k)=>o[k]??(()=>{}),set:(o,k,v)=>(o[k]=v,true)});
  f.nextDistance();f.distanceProgress=1;f.nextDistance();f.distanceProgress=1;paintNotebookGraph(ctx,g,{now:2000,active:true});assert.ok(radii.every(r=>r<25));
});
test('find-centre rendering handles fractional centres, off-grid candidates, animation and every question without invalid geometry',()=>{
  const numerical=new Set(['moveTo','lineTo','arc','rect','fillRect','translate','scale']);
  const ctx=new Proxy({measureText:t=>({width:String(t).length*12})},{get:(o,k)=>o[k]??((...args)=>{if(numerical.has(k))assert.ok(args.every(a=>typeof a==='boolean'||Number.isFinite(a)),`${k}: ${args}`);}),set:(o,k,v)=>(o[k]=v,true)});
  for(let id=33;id<=40;id++){
    const s=session(id),f=s.centreFinding,g={...graph(id),session:s,layout:new LabelLayout()};s.findingCentre=true;
    f.selectPair(0);paintNotebookGraph(ctx,g,{now:500,active:true});complete(f);
    for(const c of f.candidates){f.chooseCandidate(c.id);f.compare(f.compareIndex);f.startTest(c.id==='midpoint'?180:90);
      for(const progress of [0,.5,1]){f.testProgress=progress;paintNotebookGraph(ctx,g,{now:1e9,active:true});}}
    s.findingCentre=false;s.trialVisible=false;paintNotebookGraph(ctx,g);
  }
});

test('rotation centre construction defaults to one square and retains an explicit saved half-square choice',()=>{
  const f=session(33).centreFinding;assert.equal(f.step,1);f.selectPair(0);assert.equal(f.step,1);const a={...f.a};f.move('x',1);assert.equal(f.cursor.x,a.x+1);
  f.step=.5;const restored=new CentreFinding(f.objects,f.save());assert.equal(restored.step,.5);restored.reset();assert.equal(restored.step,1);
});
