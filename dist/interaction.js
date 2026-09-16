// UI-only state: never enters document history or saved geometry.
export class ToolContinuity {
 last=null; temporary=false;
 choose(tool){this.temporary=false;this.last=['shapes','smart'].includes(tool)?tool:null;}
 created(tool){if(['shapes','smart','pen'].includes(tool)){this.last=tool;this.temporary=true;}}
 resume(){if(!this.temporary)return null;this.temporary=false;return this.last;}
}
export function installCanvasOwnership(canvas,onMixed){
 const touches=new Map();let blocked=false;
 const down=e=>{if(e.pointerType!=='touch')return;touches.set(e.pointerId,canvas===e.target);if(touches.size>1&&[...touches.values()].some(Boolean)&&![...touches.values()].every(Boolean)){blocked=true;onMixed();}};
 const up=e=>{touches.delete(e.pointerId);if(!touches.size)blocked=false;};
 const prevent=e=>{if(e.touches.length>1&&[...touches.values()].some(Boolean)&&e.cancelable)e.preventDefault();};
 document.addEventListener('pointerdown',down,true);document.addEventListener('pointerup',up,true);document.addEventListener('pointercancel',up,true);
 document.addEventListener('touchmove',prevent,{passive:false});
 canvas.addEventListener('dragstart',e=>e.preventDefault());canvas.addEventListener('selectstart',e=>e.preventDefault());
 return {allowed:()=>!blocked,dispose(){document.removeEventListener('pointerdown',down,true);document.removeEventListener('pointerup',up,true);document.removeEventListener('pointercancel',up,true);document.removeEventListener('touchmove',prevent);}};
}
