import test from 'node:test';
import assert from 'node:assert/strict';
import {NOTEBOOK_GRAPHS,rotationFromSlider,rotationToSlider} from '../dist/notebook-model.js';
import {NotebookSession} from '../dist/notebook-session.js';
import {NotebookLabels} from '../dist/notebook-labels.js';
import {paintNotebookGraph,graphViewport} from '../dist/notebook-render.js';
import {LabelLayout} from '../dist/label-layout.js';
import {paintCoordinateGuide} from '../dist/module-coordinate-guide.js';
import {paintReflectionLesson} from '../dist/module-reflection-render.js';
import {RotationSnap} from '../dist/transform-model.js';

function canvas(){
  const text=[],stack=[];const c={globalAlpha:1,font:'',save(){stack.push({globalAlpha:this.globalAlpha,font:this.font});},restore(){Object.assign(this,stack.pop());},measureText:s=>({width:String(s).length*12}),fillText(s,x,y){text.push({s,x,y,alpha:this.globalAlpha});}};
  return {ctx:new Proxy(c,{get:(o,k)=>o[k]??(()=>{}),set:(o,k,v)=>(o[k]=v,true)}),text};
}
const graph=id=>NOTEBOOK_GRAPHS.find(g=>g.id===id);
function inspect(g,s,annotations=[]){
  const {ctx}=canvas(),full={...g,session:s,layout:new LabelLayout()},labels=new NotebookLabels(ctx,full,graphViewport(g),annotations);
  paintNotebookGraph(ctx,full,{labels,active:true});
  const placements=labels.place(),check=new LabelLayout();check.begin({segments:labels.segments});
  for(const {label,box}of placements){
    const centre={x:box.x+box.w/2,y:box.y+box.h/2};
    assert.equal(check.score(centre,box.w-6,box.h-4),0,`${g.id}: ${label} crosses visible geometry`);
    assert.ok(box.x>=0&&box.y>=0&&box.x+box.w<=labels.width&&box.y+box.h<=labels.height-76,`${g.id}: ${label} outside graph`);
  }
  return placements;
}
test('coordinate labels clear rotation arms, reflection lines, translation paths and enlargement guides',()=>{
  for(const id of ['1','5','9','10','13','17','18','21']){
    const g=graph(id),s=new NotebookSession(g),l=s.lesson;
    if(s.mode==='rotation'){l.goTo(9);l.scrub(-90);}
    if(s.mode==='translation'){l.move('x',4);l.move('y',2);}
    if(s.mode==='enlargement'){l.goTo(4);l.setMode('scale');l.scrub(2);}
    if(s.mode==='reflection'){l.chooseOrientation('horizontal');l.scrub(1);}
    l.readPoints.source=true;l.readPoints.image=true;inspect(g,s);
    if(s.mode==='reflection')for(const orientation of ['vertical','slanted']){l.chooseOrientation(orientation);l.scrub(1);inspect(g,s);}
  }
});
test('point labels move out of the way of a saved handwritten stroke',()=>{
  const g=graph('9'),s=new NotebookSession(g);s.lesson.readPoints.source=true;
  const original=inspect(g,s).find(p=>p.label==='A'),b=original.box,scale=g.unit/40;
  const ink={type:'InkStroke',position:{x:g.x,y:g.y},scale:{x:1,y:1},rotation:0,strokeWidth:1,points:[{x:(b.x-4)*scale,y:(b.y+b.h/2)*scale},{x:(b.x+b.w+4)*scale,y:(b.y+b.h/2)*scale}]};
  const moved=inspect(g,s,[ink]).find(p=>p.label==='A');assert.notDeepEqual(moved.placement,original.placement);
});
test('centre coordinate pair fades completely and never remains in the finished graph',()=>{
  const {ctx,text}=canvas(),g=graph('13'),s=new NotebookSession(g);s.lesson.goTo(9);s.lesson.readPoints.centre=true;
  paintNotebookGraph(ctx,{...g,session:s,layout:new LabelLayout()},{active:true,now:9000});
  assert.ok(!text.some(t=>t.s.includes('Centre')||t.s.includes('(')));
  text.length=0;paintCoordinateGuide(ctx,{point:{x:2,y:1},label:'',mode:'read',elapsed:4800,view:{x:320,y:320,zoom:1},width:640,height:640,pointColour:'#c23246',placement:{},transientReadout:true});
  assert.ok(text.filter(t=>t.s.includes('(')||t.s==='2'||t.s==='1').every(t=>t.alpha===0));
});
test('sliding right rotates clockwise while preserving all cardinal snaps in both directions',()=>{
  for(const value of [-360,-270,-180,-90,0,90,180,270,360]){
    assert.equal(rotationToSlider(rotationFromSlider(value)),value);
    const g=graph('9'),s=new NotebookSession(g),l=s.lesson;l.goTo(9);l.scrub(new RotationSnap(0).move(rotationFromSlider(value)));
    assert.equal(l.angle,-value||0);
    if(value===90)assert.deepEqual(s.imagePoints[0],{x:2,y:-3});
  }
});

test('printed polygon names avoid a reflection line through their original label',()=>{
  for(const id of ['25','29','33','41']){
    const g=graph(id),s=new NotebookSession(g);s.chooseMode('reflection');
    const initial=inspect(g,s).find(p=>p.label===s.source.name);assert.ok(initial);
    const {view}=graphViewport(g),worldY=(view.y-initial.placement.y)/40;
    s.lesson.setHandles([{x:-6,y:worldY},{x:6,y:worldY}]);
    const moved=inspect(g,s).find(p=>p.label===s.source.name);assert.notDeepEqual(moved.placement,initial.placement);
  }
});

test('reflection highlight stays finite when input arrives before the next animation frame',()=>{
  const g=graph('5'),s=new NotebookSession(g);s.lesson.chooseOrientation('horizontal');
  const {ctx}=canvas();ctx.arc=(x,y,r)=>{assert.ok(Number.isFinite(x+y+r));assert.ok(r>=0);};
  for(const pulse of [-100,0,.5,1,100,NaN])paintReflectionLesson(ctx,{lesson:s.lesson,...graphViewport(g),bounds:g.bounds,pulse});
});
