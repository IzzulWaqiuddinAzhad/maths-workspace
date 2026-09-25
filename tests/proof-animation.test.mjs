import test from 'node:test';
import assert from 'node:assert/strict';
import {PolygonProof,regularPolygon,interior,nextDiagonal,faceAngles,anglePieces,carryAngleLabel} from '../dist/polygon-proof.js';
import {proofResultGrid,proofResultGeometry} from '../dist/proof-layout.js';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);

test('each diagonal immediately partitions its endpoint angles, including unfinished and concave faces',()=>{
 const polygons=[...Array.from({length:18},(_,i)=>regularPolygon(i+3)),[{x:0,y:0},{x:100,y:0},{x:50,y:35},{x:100,y:100},{x:0,y:100}]];
 for(const shape of polygons)for(const points of [shape,[...shape].reverse()]){
  const model=new PolygonProof();model.points=points;
  do{
   const sectors=model.state.faces.flatMap(face=>faceAngles(points,face));
   assert.equal(sectors.length,points.length+2*model.cuts.length);
   assert.equal(new Set(sectors.map(s=>s.id)).size,sectors.length);
   for(let i=0;i<points.length;i++)near(sectors.filter(s=>s.vertex===i).reduce((sum,s)=>sum+s.degrees,0),interior(points,i).degrees);
   const cut=nextDiagonal(points,model.cuts);if(!cut)break;assert.ok(model.add(...cut));
  }while(true);
 }
 const square=new PolygonProof(4);square.add(0,2);
 for(const vertex of [0,2])assert.deepEqual(square.state.faces.flatMap(f=>faceAngles(square.points,f)).filter(a=>a.vertex===vertex).map(a=>Math.round(a.degrees)),[45,45]);
 square.cuts.pop();assert.equal(square.state.faces.flatMap(f=>faceAngles(square.points,f)).length,4);
});

test('labels stay with their own wedge throughout extraction, rotation, return and resize',()=>{
 const points=[{x:40,y:30},{x:260,y:180},{x:30,y:200}];
 for(const face of [[0,1,2],[2,1,0]])for(const target of [{x:700,y:200},{x:320,y:500}]){
  const start=faceAngles(points,face),end=anglePieces(points,face,1,target);
  const labels=start.map(a=>({id:a.id,text:a.degrees.toFixed(1)+'°',x:a.p.x+Math.cos(a.start+a.sweep/2)*40,y:a.p.y+Math.sin(a.start+a.sweep/2)*40}));
  const targets=end.map(a=>({x:a.p.x+Math.cos(a.start+a.sweep/2)*95,y:a.p.y+Math.sin(a.start+a.sweep/2)*95}));
  const samples=new Map();
  for(let step=0;step<=100;step++){
   const progress=step/100,pieces=anglePieces(points,face,progress,target);
   samples.set(step,pieces.map((a,i)=>{
    const label=carryAngleLabel(a,labels[i],targets[i]);
    assert.equal(label.id,a.id);assert.equal(label.text,labels[i].text);
    const radius=40+(95-40)*a.travel;
    near(label.x,a.p.x+Math.cos(a.start+a.sweep/2)*radius);
    near(label.y,a.p.y+Math.sin(a.start+a.sweep/2)*radius);
    if(step===0){near(label.x,labels[i].x);near(label.y,labels[i].y)}
    if(step===100){near(label.x,targets[i].x);near(label.y,targets[i].y)}
    return label;
   }));
  }
  for(let step=100;step>=0;step--)assert.deepEqual(anglePieces(points,face,step/100,target).map((a,i)=>carryAngleLabel(a,labels[i],targets[i])),samples.get(step));
 }
});

test('result layout enlarges sparse proofs and preserves readable cards at high counts',()=>{
 for(const [width,height] of [[500,340],[420,250],[300,200],[240,130]])for(let count=1;count<=18;count++){
  const grid=proofResultGrid(count,width,height),w=(width-grid.gap*(grid.columns-1))/grid.columns;
  assert.ok(grid.columns>=1&&grid.columns<=count);assert.ok(grid.rows*grid.columns>=count);
  const {radius,fontSize,target,bounds}=proofResultGeometry({x:20,y:30,w,h:grid.rowHeight});
  assert.ok(radius>=40);assert.ok(fontSize>=12);
  assert.ok(target.x-radius-8>=20);assert.ok(target.x+radius+8<=20+w);
  assert.ok(target.y-radius>=bounds.y);assert.ok(target.y<30+grid.rowHeight-25);
 }
 const single=proofResultGrid(1,500,340),dense=proofResultGrid(18,500,340);
 const large=proofResultGeometry({x:0,y:0,w:500,h:single.rowHeight});
 const small=proofResultGeometry({x:0,y:0,w:(500-dense.gap*(dense.columns-1))/dense.columns,h:dense.rowHeight});
 assert.ok(large.radius>small.radius*3);assert.ok(dense.columns>1);
 assert.ok(dense.rows*dense.rowHeight>340,'dense diagrams scroll instead of losing readable labels');
});
