import {test} from 'node:test';
import assert from 'node:assert/strict';
import {bindRepeatingButton} from '../dist/direction-pad.js';
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function setup(action,options={}) {
 const win=new EventTarget(),doc=new EventTarget(),button=new EventTarget();doc.defaultView=win;doc.hidden=false;
 Object.assign(button,{ownerDocument:doc,disabled:false,focus(){},setPointerCapture(id){this.captured=id;}});
 const send=(type,props={},target=button)=>target.dispatchEvent(Object.assign(new Event(type,{cancelable:true}),props));
 const binding=bindRepeatingButton(button,action,{delay:4,interval:4,...options});
 return {button,doc,win,send,...binding};
}
test('gamepad taps once, ignores the following pointer click and supports keyboard activation',t=>{
 let count=0;const pad=setup(()=>count++);t.after(pad.dispose);
 pad.send('pointerdown',{button:0,pointerId:7});assert.equal(count,1);assert.equal(pad.button.captured,7);
 pad.send('pointerdown',{button:0,pointerId:8});assert.equal(count,1);
 pad.send('pointerup',{pointerId:7});pad.send('click',{detail:1});assert.equal(count,1);
 pad.send('click',{detail:0});assert.equal(count,2);
 pad.button.disabled=true;pad.send('click',{detail:0});assert.equal(count,2);
});
test('gamepad repeats while held and stops on matching pointer release',async t=>{
 let count=0;const pad=setup(()=>count++);t.after(pad.dispose);
 pad.send('pointerdown',{button:0,pointerId:1});pad.send('pointerup',{pointerId:2});
 await wait(25);assert.ok(count>1);
 pad.send('pointerup',{pointerId:1});const stopped=count;await wait(20);assert.equal(count,stopped);
});
test('cancel, lost capture, hidden page, focus loss and disposal stop held arrows',async t=>{
 for(const type of ['pointercancel','lostpointercapture','visibilitychange','blur','pagehide','dispose']) {
  let count=0;const pad=setup(()=>count++);t.after(pad.dispose);
  pad.send('pointerdown',{button:0,pointerId:1});
  if(type==='dispose')pad.dispose();
  else if(type==='visibilitychange'){pad.doc.hidden=true;pad.send(type,{},pad.doc);}
  else if(['blur','pagehide'].includes(type))pad.send(type,{},pad.win);
  else pad.send(type,{pointerId:1});
  await wait(15);assert.equal(count,1,type);
 }
});
test('a disabled lesson stops repeats without changing another lesson',async t=>{
 let allowed=true,count=0;const pad=setup(()=>count++,{enabled:()=>allowed});t.after(pad.dispose);
 pad.send('pointerdown',{button:0,pointerId:1});allowed=false;await wait(25);assert.equal(count,1);
 allowed=true;await wait(15);assert.equal(count,1);
 pad.dispose();pad.send('pointerdown',{button:0,pointerId:2});assert.equal(count,1);
});
