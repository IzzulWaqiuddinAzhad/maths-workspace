import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {NOTEBOOK_PAGES,NOTEBOOK_GRAPHS,pageAt,graphToPage,pageToGraph,fitGraph} from '../dist/notebook-model.js';
import {NotebookSession,TRANSFORMATION_TYPES,migrateNotebookDocument} from '../dist/notebook-session.js';
import {paintNotebookGraph} from '../dist/notebook-render.js';
import {LabelLayout} from '../dist/label-layout.js';
import {worldToScreen} from '../dist/core.js';
const graph=id=>NOTEBOOK_GRAPHS.find(g=>g.id===id);
const session=id=>new NotebookSession(graph(id));

test('the full original module has 23 pages and 63 calibrated interactive graphs',()=>{
  assert.equal(NOTEBOOK_PAGES.length,23);assert.equal(NOTEBOOK_GRAPHS.length,63);
  assert.equal(new Set(NOTEBOOK_GRAPHS.map(g=>g.id)).size,63);
  for(const p of NOTEBOOK_PAGES){
    assert.equal(pageAt(p.y+p.height/2),p);
    const svg=readFileSync(new URL(`../dist/notebook-assets/${p.asset}`,import.meta.url),'utf8');
    assert.ok(svg.includes(`viewBox="0 0 ${p.width} ${p.height}"`));
  }
  for(const g of NOTEBOOK_GRAPHS){
    const p=NOTEBOOK_PAGES[g.page];assert.ok(g.x>=p.x&&g.y>=p.y&&g.x+g.width<=p.x+p.width&&g.y+g.height<=p.y+p.height);
    assert.ok(g.objects.length>0);assert.ok(g.objects.every(o=>typeof o.name==='string'&&!o.name.startsWith('Shape ')));
    if(g.id==='62-1')assert.deepEqual(g.objects.map(o=>o.labels.join('')),['ABCD','EFGH','JKLM']);
    if(g.id==='64-2')assert.deepEqual(g.objects.map(o=>o.name),['P','Q','R']);
    if(g.id==='63-2')assert.equal(g.objects[0].name,'PQRST');
    for(const o of g.objects)for(const [x,y]of o.points){
      const q=graphToPage(g,{x,y}),back=pageToGraph(g,q);
      assert.ok(Math.abs(back.x-x)<1e-8&&Math.abs(back.y-y)<1e-8);
      assert.ok(q.x>=g.x-1e-8&&q.x<=g.x+g.width+1e-8&&q.y>=g.y-1e-8&&q.y<=g.y+g.height+1e-8);
    }
  }
});
test('all module graphs fit beside iPad controls, including landscape pages',()=>{
  for(const g of NOTEBOOK_GRAPHS)for(const [w,h]of[[768,920],[1024,710]]){
    const v=fitGraph(g,w,h,{right:290}),a=worldToScreen({x:g.x,y:g.y},v),b=worldToScreen({x:g.x+g.width,y:g.y+g.height},v);
    assert.ok(a.x>=0&&a.y>=75);assert.ok(b.x<w-290&&b.y<h-12);
  }
});
test('translation is freely adjustable in both directions, including inverse questions',()=>{
  for(const id of ['1','2','3','4']){
    const s=session(id),l=s.lesson,target=l.movementVector;
    l.move('y',2);l.move('x',-3);assert.deepEqual(l.vector,{x:-3,y:2});
    l.move('x',target.x+3);l.move('y',target.y-2);assert.ok(l.canReveal);
    assert.deepEqual(s.imagePoints[0],l.answer);
    assert.deepEqual(new NotebookSession(graph(id),s.save()).lesson.vector,target);
  }
});
test('Next keeps a free trial arm but an incorrect construction cannot reveal the question answer',()=>{
  const s=session('9'),l=s.lesson;l.stage=1;assert.equal(l.advanceArm(),false);
  for(let i=0;i<4;i++){l.moveConstruction('x',7);assert.equal(l.completedArms,i);assert.equal(l.advanceArm(),true);assert.deepEqual(l.constructionCursor,i===3?null:l.question.centre);}
  assert.equal(l.constructionComplete,true);assert.equal(l.constructionMatches,false);l.scrub(l.movementDegrees);assert.equal(l.reveal(),false);
});
test('all source objects can use all four existing transformation models and preserve valid state',()=>{
  for(const g of NOTEBOOK_GRAPHS){const s=new NotebookSession(g);for(const o of s.objects){s.chooseObject(o.id);for(const mode of TRANSFORMATION_TYPES){
    s.chooseMode(mode);const l=s.lesson;
    if(mode==='translation'){l.move('x',2);l.move('y',-1);}
    if(mode==='reflection'){l.chooseOrientation('slanted');l.shift(1,2);l.scrub(1);}
    if(mode==='rotation'){l.goTo(9);l.scrub(-90);}
    if(mode==='enlargement'){l.goTo(4);l.scrub(-.5);}
    const expected=s.imagePoints;assert.ok(expected.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)));
    l.readPoints['source-1']=true;l.readPoints['image-1']=true;
    const copy=new NotebookSession(g,s.save());assert.deepEqual(copy.imagePoints,expected);assert.equal(copy.lesson.readPoints['image-1'],true);
  }}}
});
test('a kept image becomes the next source without altering the printed source or other graphs',()=>{
  const s=session('1'),other=session('2');s.lesson.move('x',6);s.lesson.move('y',-2);assert.ok(s.keepImage());
  assert.deepEqual(s.source.points,[{x:2,y:1}]);s.chooseMode('reflection');s.lesson.chooseOrientation('vertical');s.lesson.setHandles([{x:0,y:-2},{x:0,y:2}]);s.lesson.scrub(1);
  assert.deepEqual(s.imagePoints,[{x:-2,y:1}]);assert.ok(s.keepImage());
  assert.deepEqual(s.base[0].points,[{x:-4,y:3}]);assert.deepEqual(other.lesson.vector,{x:0,y:0});
  assert.ok(s.deleteSelected());assert.equal(s.kept.length,1);assert.equal(s.deleteSelected(),false);
});
test('moving the rotation centre resets its construction; reading labels survives other movements',()=>{
  const s=session('10');s.lesson.goTo(9);s.lesson.scrub(90);s.lesson.readPoints.image=true;s.setCentre({x:7,y:2});
  assert.equal(s.lesson.angle,0);assert.equal(s.lesson.constructionComplete,false);assert.deepEqual(s.lesson.constructionCursor,{x:7,y:2});assert.equal(s.lesson.readPoints.image,false);
});
test('legacy A3 writing and camera migrate to the same screen position without mutating the old save',()=>{
  const old={document:{objects:[{position:{x:200,y:310}},{position:{x:1400,y:1600}}]},view:{x:20,y:-15,zoom:2}},before=structuredClone(old),page=NOTEBOOK_PAGES[3];
  const next=migrateNotebookDocument(old,page);
  assert.deepEqual(worldToScreen(old.document.objects[0].position,old.view),worldToScreen(next.document.objects[0].position,next.view));assert.deepEqual(worldToScreen(old.document.objects[1].position,old.view),worldToScreen(next.document.objects[1].position,next.view));assert.deepEqual(old,before);
  assert.equal(migrateNotebookDocument({},page),null);assert.equal(migrateNotebookDocument({document:{objects:[{}]},view:old.view},page),null);
});
test('rendering every graph and transformation produces finite drawing coordinates',()=>{
  const numeric=new Set(['moveTo','lineTo','arc','ellipse','fillRect','strokeRect','rect','translate','scale','bezierCurveTo','quadraticCurveTo']);
  const ctx=new Proxy({measureText:text=>({width:String(text).length*12}),setLineDash:()=>{}},{get(target,key){return target[key]??((...args)=>{if(numeric.has(key))for(const value of args)assert.ok(typeof value==='boolean'||Number.isFinite(value),`${key}(${args})`);});},set(target,key,v){target[key]=v;return true;}});
  for(const g of NOTEBOOK_GRAPHS){const s=new NotebookSession(g);for(const mode of TRANSFORMATION_TYPES){s.chooseMode(mode);const l=s.lesson;if(mode==='translation')l.move('x',2);if(mode==='rotation'){l.goTo(9);l.scrub(90);}if(mode==='reflection'){l.chooseOrientation('slanted');l.scrub(.5);}if(mode==='enlargement'){l.goTo(4);l.scrub(2);}l.readPoints.source=true;l.readPoints.image=true;paintNotebookGraph(ctx,{...g,session:s,layout:new LabelLayout()},{now:1000,active:true});}}
});

test('shared mirror equation buttons and hardware keys edit the same expression safely',async()=>{
  const {editLineEquation}=await import('../dist/line-equation-input.js');let s={value:'',cursor:0};
  for(const k of ['y','=','2','×','x','+','3'])s=editLineEquation(s,k);assert.equal(s.value,'y=2*x+3');
  s=editLineEquation(s,'ArrowLeft');s=editLineEquation(s,'Backspace');s=editLineEquation(s,'−');assert.equal(s.value,'y=2*x-3');
  assert.deepEqual(editLineEquation(s,'<script>'),s);assert.deepEqual(editLineEquation(s,'C'),{value:'',cursor:0});
});

test('a rotation point at the chosen centre stays fixed and does not require zero-length arms',()=>{
  const s=session('9');s.setCentre(s.source.points[0]);assert.ok(s.lesson.constructionComplete);s.lesson.scrub(270);assert.deepEqual(s.imagePoints,s.source.points);
});
test('the pulsing halo follows the active tip, returns to the centre on Next, and ends after four arms',async()=>{
  const {paintRotationLesson}=await import('../dist/module-rotation-render.js');const l=session('9').lesson;l.stage=1;
  const arcs=[],ctx=new Proxy({measureText:t=>({width:String(t).length*12}),arc:(...args)=>arcs.push(args)},{get:(o,k)=>o[k]??(()=>{}),set:(o,k,v)=>(o[k]=v,true)});
  const paint=()=>{arcs.length=0;paintRotationLesson(ctx,{lesson:l,view:{x:320,y:320,zoom:1},width:640,height:640,dark:false,cursorPulse:1,countLabels:new LabelLayout()});return arcs.filter(a=>a[2]===14);};
  l.moveConstruction('x',3);l.moveConstruction('y',2);assert.deepEqual(paint().map(a=>a.slice(0,2)),[[440,240]]);
  l.advanceArm();assert.deepEqual(paint().map(a=>a.slice(0,2)),[[320,320]]);
  for(let i=1;i<4;i++){l.moveConstruction('x',1);l.advanceArm();}assert.deepEqual(paint(),[]);
});
