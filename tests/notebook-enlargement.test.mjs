import test from 'node:test';
import assert from 'node:assert/strict';
import {EnlargementFinding,givenEnlargementPair} from '../dist/notebook-enlargement.js';
import {pairLineSegment} from '../dist/notebook-enlargement-render.js';
import {NOTEBOOK_GRAPHS} from '../dist/notebook-model.js';
import {NotebookSession} from '../dist/notebook-session.js';
import {paintNotebookGraph} from '../dist/notebook-render.js';
const graph=id=>NOTEBOOK_GRAPHS.find(g=>g.id===String(id));
const study=id=>new NotebookSession(graph(id)).enlargementFinding;
const near=(a,b)=>assert.ok(Math.hypot(a.x-b.x,a.y-b.y)<1e-7,JSON.stringify([a,b]));
const intersection=(a,b,c,d)=>{
  const u={x:b.x-a.x,y:b.y-a.y},v={x:d.x-c.x,y:d.y-c.y},det=u.x*v.y-u.y*v.x;
  if(Math.abs(det)<1e-8)return null;
  const t=((c.x-a.x)*v.y-(c.y-a.y)*v.x)/det;return {x:a.x+t*u.x,y:a.y+t*u.y};
};

test('all printed enlargement pairs use the explicit line study, including mixed-question source and image identities',()=>{
  const ids=['41','42','43','44','45','46','47','48','49','50','55','56','57','58','59','60','61-2','62-1','63-2','64-2'];
  for(const g of NOTEBOOK_GRAPHS){const s=new NotebookSession(g);assert.equal(!!s.enlargementFinding,ids.includes(g.id),g.id);if(s.enlargementFinding){assert.deepEqual(s.enlargementFinding.lines,[]);assert.equal(s.findingEnlargement,s.mode==='enlargement');}}
  assert.deepEqual(study(47).objects.map(o=>o.name),['Q','R']);assert.deepEqual(study('62-1').objects.map(o=>o.name),['EFGH','JKLM']);
  assert.deepEqual(study('63-2').objects.map(o=>o.labels),[['P','Q','R','S','T'],['A','B','C','D','E']]);
});
test('selecting a pair never draws; Add line retains earlier lines and cannot duplicate one',()=>{
  const f=study(55);assert.equal(f.addLine(),false);assert.ok(f.selectPair(1));assert.deepEqual(f.lines,[]);assert.ok(f.canAddLine);
  assert.ok(f.addLine());assert.equal(f.progress,0);assert.equal(f.addLine(),false);f.progress=.4;f.selectPair(2);
  assert.deepEqual(f.lines,[1]);assert.equal(f.drawingIndex,null);assert.ok(f.addLine());f.finishLine();assert.deepEqual(f.lines,[1,2]);
  f.selectPair(1);assert.equal(f.canAddLine,false);assert.deepEqual(f.lines,[1,2]);assert.equal(f.undoLine(),2);assert.deepEqual(f.lines,[1]);
  f.reset();assert.deepEqual(f.lines,[]);assert.equal(f.index,null);
});
test('coincident vertices pulse but cannot invent a line or centre; invalid saved lines are rejected',()=>{
  const f=study(55);assert.ok(f.selectPair(0));assert.equal(f.distinctPair(0),false);assert.equal(f.canAddLine,false);assert.equal(f.addLine(),false);
  assert.equal(f.selectPair(-1),false);assert.equal(f.selectPair(100),false);
  const restored=new EnlargementFinding(f.objects,{index:2,lines:[0,1,1,-1,500,2,'3']});assert.deepEqual(restored.lines,[1,2]);assert.equal(restored.index,2);
});
test('saved line studies and trial enlargements remain independent across reload and mode changes',()=>{
  const g=graph(41),s=new NotebookSession(g),f=s.enlargementFinding;s.setCentre({x:2,y:3});s.lesson.scrub(1.75);const before=structuredClone(s.save().engines);
  f.selectPair(1);f.addLine();f.finishLine();f.selectPair(2);s.enlargementStudyEnabled=false;
  const restored=new NotebookSession(g,s.save());assert.equal(restored.findingEnlargement,false);assert.deepEqual(restored.enlargementFinding.save(),f.save());assert.deepEqual(restored.save().engines,before);
  restored.enlargementStudyEnabled=true;restored.chooseMode('rotation');assert.equal(restored.findingEnlargement,false);restored.chooseMode('enlargement');assert.ok(restored.findingEnlargement);
});
test('staged lines join the pair before extending to both graph edges, for horizontal, vertical and either diagonal',()=>{
  for(const [a,b]of [[{x:30,y:20},{x:60,y:70}],[{x:60,y:70},{x:30,y:20}],[{x:30,y:40},{x:60,y:40}],[{x:40,y:20},{x:40,y:70}]]){
    const initial=pairLineSegment(a,b,100,100,0);near(initial[0],a);near(initial[1],a);
    const joined=pairLineSegment(a,b,100,100,.45);near(joined[0],a);near(joined[1],b);
    const ends=pairLineSegment(a,b,100,100,1);assert.equal(ends.length,2);
    for(const p of ends){assert.ok([p.x,p.y].every(n=>n>=-1e-8&&n<=100+1e-8));assert.ok([p.x,p.y,100-p.x,100-p.y].some(n=>Math.abs(n)<1e-8));assert.ok(Math.abs((p.x-a.x)*(b.y-a.y)-(p.y-a.y)*(b.x-a.x))<1e-7);}
  }
  assert.deepEqual(pairLineSegment({x:1,y:2},{x:1,y:2},100,100),[]);
});
test('two nonparallel corresponding lines meet at a centre consistent with every vertex and the scale',()=>{
  for(const g of NOTEBOOK_GRAPHS){const f=new NotebookSession(g).enlargementFinding;if(!f)continue;
    const pairs=f.source.map((p,i)=>[p,f.target[i]]).filter(([a,b])=>Math.hypot(a.x-b.x,a.y-b.y)>1e-8);let c;
    for(const a of pairs)for(const b of pairs)c??=intersection(...a,...b);
    assert.ok(c,g.id);const [a,b]=pairs[0],k=((b.x-c.x)*(a.x-c.x)+(b.y-c.y)*(a.y-c.y))/((a.x-c.x)**2+(a.y-c.y)**2);
    f.source.forEach((p,i)=>near({x:c.x+k*(p.x-c.x),y:c.y+k*(p.y-c.y)},f.target[i]));
  }
});
test('the first enlargement view has no guide strokes, and only explicitly added lines are painted',()=>{
  const s=new NotebookSession(graph(41)),g={...graph(41),session:s};let strokes=0;
  const ctx=new Proxy({measureText:t=>({width:String(t).length*12}),stroke:()=>strokes++},{get:(o,k)=>o[k]??(()=>{}),set:(o,k,v)=>(o[k]=v,true)});
  paintNotebookGraph(ctx,g,{now:0,active:false});assert.equal(strokes,0);
  s.enlargementFinding.selectPair(1);paintNotebookGraph(ctx,g,{now:0,active:false});assert.equal(strokes,0);
  s.enlargementFinding.addLine();s.enlargementFinding.finishLine();paintNotebookGraph(ctx,g,{now:0,active:false});assert.equal(strokes,1);
});
test('uniform negative scale pairs are accepted without accepting rotations or reflections',()=>{
  const a={name:'A',points:[{x:1,y:1},{x:3,y:1},{x:2,y:4}]},scaled={name:'B',points:a.points.map(p=>({x:2-2*(p.x-2),y:3-2*(p.y-3)}))},plans=[{steps:[{describe:true,type:'enlargement',sourceName:'A',targetName:'B'}]}];
  assert.ok(givenEnlargementPair([a,scaled],plans));const reflected={...scaled,points:a.points.map(p=>({x:-p.x,y:p.y}))};assert.equal(givenEnlargementPair([a,reflected],plans),null);
});

test('Reveal centre waits for two completed intersecting lines and never reveals automatically',()=>{
  const f=study(41);assert.equal(f.revealCentre(),false);assert.equal(f.centreVisible,false);
  f.selectPair(3);f.addLine();f.finishLine();assert.equal(f.canRevealCentre,false);
  f.selectPair(0);f.addLine();f.progress=.7;assert.equal(f.canRevealCentre,false);assert.equal(f.revealCentre(),false);
  f.finishLine();assert.ok(f.canRevealCentre);assert.equal(f.centreVisible,false);near(f.centre,{x:-2,y:-1});
  assert.ok(f.revealCentre());assert.ok(f.centreVisible);f.selectPair(1);assert.ok(f.centreVisible);
});
test('coincident or parallel lines cannot unlock the centre reveal',()=>{
  for(const target of [[{x:2,y:0},{x:4,y:0},{x:6,y:0}],[{x:2,y:0},{x:2,y:1},{x:2,y:2}]]){
    const source=target[0].y===target[1].y?[{x:1,y:0},{x:2,y:0},{x:3,y:0}]:[{x:0,y:0},{x:0,y:1},{x:0,y:2}];
    const f=new EnlargementFinding([{name:'P',points:source},{name:'Q',points:target}]);
    for(const i of [0,1]){f.selectPair(i);f.addLine();f.finishLine();}assert.equal(f.centre,null);assert.equal(f.canRevealCentre,false);
  }
});
test('centre reveal persists but Undo and Reset remove a reveal that no longer has two lines',()=>{
  const f=study(41);for(const i of [3,0,1]){f.selectPair(i);f.addLine();f.finishLine();}f.revealCentre();
  const copy=new EnlargementFinding(f.objects,f.save());assert.ok(copy.centreVisible);near(copy.centre,{x:-2,y:-1});
  copy.undoLine();assert.ok(copy.centreVisible);copy.undoLine();assert.equal(copy.centreVisible,false);assert.equal(copy.canRevealCentre,false);
  const invalid=new EnlargementFinding(f.objects,{index:0,lines:[3],centreVisible:true});assert.equal(invalid.centreVisible,false);
  f.reset();assert.equal(f.centreVisible,false);assert.equal(f.centre,null);
});
test('every supported enlargement reveals the constructed intersection, including Q60 and the origin',()=>{
  for(const g of NOTEBOOK_GRAPHS){const f=new NotebookSession(g).enlargementFinding;if(!f)continue;
    f.source.forEach((p,i)=>{f.selectPair(i);if(f.addLine())f.finishLine();});assert.ok(f.canRevealCentre,g.id);assert.ok(f.revealCentre());
    assert.ok(Number.isFinite(f.centre.x)&&Number.isFinite(f.centre.y));
    if(g.id==='60')near(f.centre,{x:1,y:1});if(g.id==='55')near(f.centre,{x:0,y:0});
  }
});
test('the centre marker is drawn at the intersection only after pressing Reveal centre',()=>{
  const s=new NotebookSession(graph(41)),g={...graph(41),session:s},f=s.enlargementFinding;
  for(const i of [3,0]){f.selectPair(i);f.addLine();f.finishLine();}
  const ctx=new Proxy({measureText:t=>({width:String(t).length*12})},{get:(o,k)=>o[k]??(()=>{}),set:(o,k,v)=>(o[k]=v,true)});
  assert.equal(paintNotebookGraph(ctx,g).some(r=>r.id==='enlargement-centre'),false);f.revealCentre();
  const label=paintNotebookGraph(ctx,g).find(r=>r.id==='enlargement-centre');assert.ok(label.coordinates);near(label.point,{x:-2,y:-1});
});
