// Printed pairs only: verify a uniform scale without using an answer-key centre.
export function givenEnlargementPair(objects,plans){
  for(const plan of plans)for(const step of plan.steps){
    if(!step.describe||step.type&&step.type!=='enlargement')continue;
    const a=objects.find(o=>o.name===step.sourceName),b=objects.find(o=>o.name===step.targetName);
    if(!a||!b||a===b||a.points.length<3||a.points.length!==b.points.length)continue;
    const p=a.points[0],q=b.points[0],j=a.points.findIndex(v=>Math.hypot(v.x-p.x,v.y-p.y)>1e-8);if(j<0)continue;
    const u={x:a.points[j].x-p.x,y:a.points[j].y-p.y},v={x:b.points[j].x-q.x,y:b.points[j].y-q.y},k=(u.x*v.x+u.y*v.y)/(u.x*u.x+u.y*u.y);
    // Congruent half-turns belong to rotation; collapsed images cannot supply
    // distinct corresponding vertices for this construction.
    if(Math.abs(k)<1e-8||Math.abs(Math.abs(k)-1)<1e-8)continue;
    if(a.points.every((r,i)=>Math.hypot(q.x+k*(r.x-p.x)-b.points[i].x,q.y+k*(r.y-p.y)-b.points[i].y)<1e-7))return [a,b];
  }
  return null;
}
export class EnlargementFinding {
  constructor(objects,saved){
    this.objects=objects;this.reset();
    if(!saved)return;
    if(Number.isInteger(saved.index)&&this.source[saved.index])this.index=saved.index;
    if(Array.isArray(saved.lines))this.lines=[...new Set(saved.lines.filter(i=>this.distinctPair(i)))];
  }
  get source(){return this.objects[0].points;}
  get target(){return this.objects[1].points;}
  reset(){this.index=null;this.lines=[];this.drawingIndex=null;this.progress=1;}
  distinctPair(i){return Number.isInteger(i)&&!!this.source[i]&&Math.hypot(this.source[i].x-this.target[i].x,this.source[i].y-this.target[i].y)>1e-8;}
  selectPair(i){if(!Number.isInteger(i)||!this.source[i])return false;this.finishLine();this.index=i;return true;}
  get canAddLine(){return this.distinctPair(this.index)&&!this.lines.includes(this.index)&&this.drawingIndex===null;}
  addLine(){if(!this.canAddLine)return false;this.lines.push(this.index);this.drawingIndex=this.index;this.progress=0;return true;}
  finishLine(){this.drawingIndex=null;this.progress=1;}
  undoLine(){this.finishLine();return this.lines.pop();}
  save(){return {index:this.index,lines:[...this.lines]};}
}
