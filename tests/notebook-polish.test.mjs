import test from 'node:test';
import assert from 'node:assert/strict';
import {NOTEBOOK_GRAPHS,NotebookRotationLesson,saveLesson,restoreLesson,graphSummaryBounds} from '../dist/notebook-model.js';
import {NotebookSession} from '../dist/notebook-session.js';
import {notebookReadoutPlacement,graphViewport,paintNotebookGraph} from '../dist/notebook-render.js';
import {PRINTED_LABELS} from '../dist/notebook-assets/label-anchors.js';
import {coordinateGuideFrame,coordinateGuideDuration,paintCoordinateGuide,coordinateReadoutLayout} from '../dist/module-coordinate-guide.js';
import {LabelLayout} from '../dist/label-layout.js';
const graph=id=>NOTEBOOK_GRAPHS.find(g=>g.id===id);
function canvas(){
  const texts=[],paths=[],arcs=[];let path=[];
  const target={measureText:s=>({width:String(s).length*12}),fillText:(text,x,y)=>texts.push({text,x,y}),beginPath:()=>{path=[];},moveTo:(x,y)=>path.push([x,y]),lineTo:(x,y)=>path.push([x,y]),stroke:()=>paths.push({path:[...path],width:target.lineWidth}),arc:(...a)=>arcs.push(a)};
  const ctx=new Proxy(target,{get:(o,k)=>o[k]??(()=>{}),set:(o,k,v)=>(o[k]=v,true)});
  return {ctx,texts,paths,arcs};
}
test('cross-first revisits every saved tip, survives reload, then completes with the same image',()=>{
  for(const id of ['9','10','11','12'])for(const axis of ['x','y']){
    let l=new NotebookSession(graph(id)).lesson;l.stage=1;l.selectFirstAxis(axis);
    for(let arm=0;arm<4;arm++){
      const segment=l.segmentInfo(arm*2);l.moveConstruction(segment.axis,segment.target);l.advanceArm();
    }
    assert.equal(l.constructionComplete,false);assert.equal(l.activeArm,0);
    assert.deepEqual(l.constructionCursor,l.constructionPaths[0].corner);
    for(let arm=0;arm<4;arm++){
      const counts=[...l.buildCounts];l=restoreLesson(l.question,saveLesson(l));
      assert.deepEqual(l.buildCounts,counts);assert.equal(l.activeArm,arm);
      assert.deepEqual(l.constructionCursor,l.constructionPaths[arm].corner);
      const bend=l.segmentInfo(arm*2+1);l.moveConstruction(bend.axis,bend.target);l.advanceArm();
    }
    assert.equal(l.constructionComplete,true);assert.equal(l.constructionMatches,true);
    l.scrub(l.movementDegrees);assert.equal(l.reveal(),true);
  }
});
test('axis-aligned points do not require artificial nonzero bends',()=>{
  const q={...new NotebookSession(graph('9')).lesson.question,given:{x:3,y:0}},l=new NotebookRotationLesson(q);l.stage=1;
  for(let i=0;i<4;i++){const a=l.segmentInfo(i*2);l.moveConstruction(a.axis,a.target);l.advanceArm();}
  assert.ok(l.constructionComplete&&l.constructionMatches);
});
test('a legacy straight cross is reopened at its saved tip rather than incorrectly marked complete',()=>{
  const q=new NotebookSession(graph('9')).lesson.question;
  const l=restoreLesson(q,{stage:9,buildIndex:8,buildCounts:[3,0,3,0,-3,0,-3,0],firstAxis:'x',progress:-90,constructionVersion:2});
  assert.equal(l.constructionComplete,false);assert.deepEqual(l.constructionCursor,{x:3,y:0});assert.equal(l.angle,0);
});
test('original printed letters receive only the coordinate suffix, in the same position during and after reading',()=>{
  const g=graph('9'),s=new NotebookSession(g),{ctx,texts}=canvas(),viewport=graphViewport(g);
  const placement=notebookReadoutPlacement(ctx,g,s,'source'),anchor=PRINTED_LABELS[s.source.id][0];
  assert.ok(placement.omitLabel);assert.ok(placement.x>anchor.x*40/g.unit);
  const options={point:s.source.points[0],label:'A',...viewport,placement};
  const layout=coordinateReadoutLayout(ctx,options);
  assert.equal(layout.parts[0],'(');assert.ok(layout.y+layout.fontSize*.65<viewport.view.y-options.point.y*40);
  paintCoordinateGuide(ctx,{...options,mode:'read',elapsed:4800});
  assert.ok(!texts.some(t=>t.text.includes('A')));assert.ok(texts.some(t=>t.text==='3'));
  s.lesson.readPoints.source=true;texts.length=0;paintNotebookGraph(ctx,{...g,session:s,layout:new LabelLayout()});
  assert.ok(!texts.some(t=>t.text.includes('A')));assert.ok(texts.some(t=>t.text==='('));
});
test('all original point labels have matching printed anchors',()=>{
  for(const g of NOTEBOOK_GRAPHS)for(const o of g.objects)if(o.labels?.length)for(let i=0;i<o.labels.length;i++){
    const a=PRINTED_LABELS[o.id]?.[i];assert.ok(a,`${o.id} ${i}`);assert.ok(a.text.split('/').includes(o.labels[i]));assert.ok(Number.isFinite(a.x+a.y+a.size));
  }
});
test('origin reads and plots only pulse; no axis values, flights or duplicate centre label',()=>{
  for(const mode of ['read','plot']){
    assert.equal(coordinateGuideDuration(mode,{x:0,y:0}),900);
    const {ctx,texts,paths,arcs}=canvas();
    paintCoordinateGuide(ctx,{point:{x:0,y:0},label:'Centre',mode,elapsed:350,view:{x:320,y:320,zoom:1},width:640,height:640,placement:{}});
    assert.equal(texts.length,0);assert.ok(paths.every(p=>p.path.length===0));assert.ok(arcs.length>=2);
    assert.ok(coordinateGuideFrame({x:0,y:0},mode,900).done);
  }
});
test('earlier rotation and translation evidence stays rendered after selecting the image and after reload',()=>{
  for(const id of ['9','1']){
    const g=graph(id);let s=new NotebookSession(g);const l=s.lesson;
    if(id==='9'){l.goTo(9);l.scrub(-90);}else{l.move('x',6);l.move('y',-2);}
    l.readPoints.image=true;assert.ok(s.keepImage());
    s=new NotebookSession(g,s.save());assert.equal(s.presentations.length,1);
    const old=s.presentations[0];assert.ok(old.imageReady);
    const {ctx,paths,texts}=canvas();paintNotebookGraph(ctx,{...g,session:s,layout:new LabelLayout()});
    if(id==='9')assert.ok(paths.filter(p=>p.width===4.6).length>=8);
    else{assert.ok(texts.some(t=>t.text==='6 →'));assert.ok(texts.some(t=>t.text==='2 ↓'));}
    assert.ok(s.deleteSelected());assert.equal(s.presentations.length,0);
  }
});
test('switching modes retains earlier work and resetting that mode removes only its work',()=>{
  const s=new NotebookSession(graph('1'));s.lesson.move('x',3);s.chooseMode('rotation');
  assert.equal(s.presentations.length,1);s.lesson.goTo(9);s.lesson.scrub(90);
  s.chooseMode('translation');assert.equal(s.presentations.length,1);s.reset();
  assert.equal(s.imageReady,false);assert.equal(s.presentations[0].mode,'rotation');
});
test('summary tracks the graph width through pan and zoom within iPad controls',()=>{
  const g={x:30,y:160,width:240};
  for(const width of [768,1024,1366])for(const zoom of [.5,1,1.5]){
    const view={x:0,y:0,zoom},b=graphSummaryBounds(g,view,width,768,80,290);
    assert.equal(b.left,g.x*zoom);assert.equal(b.width,Math.min(g.width*zoom,width-290-12-b.left));
    assert.ok(b.top>=58);assert.ok(b.left+b.width<=width-290-12);
  }
});

test('returning to the original object does not duplicate the kept image label during a coordinate read',()=>{
  const g=graph('1'),s=new NotebookSession(g);s.lesson.move('x',6);s.lesson.move('y',-2);s.keepImage();s.chooseObject(s.base[0].id);
  s.lesson.readPoints.image=true;
  const {ctx,texts}=canvas();paintNotebookGraph(ctx,{...g,session:s,layout:new LabelLayout()});
  assert.equal(texts.filter(t=>t.text.includes('A′')).length,1);
});
