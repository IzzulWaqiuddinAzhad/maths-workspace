import test from 'node:test';
import assert from 'node:assert/strict';
import {graphImageFrame,createNotebookGraphPNG,writePNGClipboard} from '../dist/notebook-image.js';
import {NOTEBOOK_GRAPHS} from '../dist/notebook-model.js';
import {NotebookSession} from '../dist/notebook-session.js';

test('graph export includes its entire graph and axis margin at a bounded resolution',()=>{
  for(const g of NOTEBOOK_GRAPHS){
    const f=graphImageFrame(g);assert.ok(f.width<=2048&&f.height<=2048);
    assert.ok(f.x<g.x&&f.y<g.y&&f.x+f.w>g.x+g.width&&f.y+f.h>g.y+g.height);
    assert.ok(Math.abs(f.width/f.height-f.w/f.h)<.002);
    assert.deepEqual(graphImageFrame({...g,view:{zoom:8,x:900,y:700}}),f);
  }
});
test('PNG clipboard write happens synchronously during the tap, before encoding resolves',async()=>{
  let resolvePNG,written=false;
  const png=new Promise(resolve=>{resolvePNG=resolve;});
  class Item{constructor(data){this.data=data;}}
  const writing=writePNGClipboard(png,{write(items){written=true;assert.equal(items.length,1);assert.equal(items[0].data['image/png'],png);return items[0].data['image/png'].then(blob=>{assert.equal(blob.type,'image/png');});}},Item);
  assert.ok(written);resolvePNG(new Blob(['png'],{type:'image/png'}));await writing;
});
test('clipboard unavailability and denial reject for the save-image fallback',async()=>{
  const png=Promise.resolve(new Blob(['png'],{type:'image/png'}));
  await assert.rejects(writePNGClipboard(png,{},class{}),/unavailable/);
  await assert.rejects(writePNGClipboard(png,{write(){throw Error('Denied');}},class{}),/Denied/);
});
test('an unresponsive clipboard times out instead of leaving Copying stuck',async()=>{
  await assert.rejects(writePNGClipboard(Promise.resolve(new Blob()),{write:()=>new Promise(()=>{})},class{},5),/did not finish/);
});
test('export paints the selected lesson before waiting and includes ink without changing state',async()=>{
  const g=NOTEBOOK_GRAPHS.find(g=>g.id==='41'),session=new NotebookSession(g),f=session.enlargementFinding;
  for(const i of [3,0]){f.selectPair(i);f.addLine();f.finishLine();}f.revealCentre();
  void session.lesson; // The on-screen lesson has already initialised its engine.
  const before=JSON.stringify(session.save()),calls=[];
  const ctx=new Proxy({measureText:t=>({width:String(t).length*12})},{get:(o,k)=>o[k]??((...args)=>calls.push([k,...args])),set:(o,k,v)=>(o[k]=v,true)});
  const png=new Blob(['png'],{type:'image/png'}),canvas={getContext:()=>ctx,toBlob:fn=>fn(png)},old=globalThis.document;
  globalThis.document={createElement:tag=>{assert.equal(tag,'canvas');return canvas;}};
  try{
    const ink=[{id:'ink',type:'InkStroke',position:{x:g.x,y:g.y},rotation:0,scale:{x:1,y:1},strokeWidth:2,strokeColour:'#e00000',points:[{x:20,y:30},{x:60,y:50}],penMode:'ball'}];
    const result=createNotebookGraphPNG({...g,session},{image:{complete:true,naturalWidth:600},x:0,y:0,width:600,height:800},ink);
    assert.ok(calls.some(c=>c[0]==='fillText'&&String(c[1]).includes('C')),'revealed centre rendered before asynchronous work');
    ink[0].points[1].x=900;assert.equal(await result,png);
    assert.ok(calls.some(c=>c[0]==='lineTo'&&c[1]===60&&c[2]===50),'ink snapshot is retained');
    assert.equal(JSON.stringify(session.save()),before);assert.equal(canvas.width,graphImageFrame(g).width);
  }finally{globalThis.document=old;}
});
test('export reports a missing module page instead of copying a blank graph',async()=>{
  await assert.rejects(createNotebookGraphPNG(NOTEBOOK_GRAPHS[0],{},[]),/Wait for the module page/);
});
