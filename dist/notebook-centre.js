import {rotatePoint} from './transform-model.js?v=29';

const copy=p=>({x:p.x,y:p.y});
const add=(p,q)=>({x:p.x+q.x,y:p.y+q.y});
const minus=(p,q)=>({x:p.x-q.x,y:p.y-q.y});
export const pointDistance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const near=(a,b)=>pointDistance(a,b)<1e-7;
const valid=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&Math.abs(p.x)<=100&&Math.abs(p.y)<=100;
const samePath=path=>Array.isArray(path)&&path.length>0&&path.length<=1601&&path.every(valid)&&path.every((p,i)=>!i||(p.x===path[i-1].x)!==(p.y===path[i-1].y));

// Candidate geometry uses the selected pair only. No answer key is consulted.
export function rotationCandidates(a,b){
  const m={x:(a.x+b.x)/2,y:(a.y+b.y)/2},h=minus(a,m);
  return [{id:'midpoint',name:'M',point:m},{id:'first',name:'C₁',point:add(m,{x:-h.y,y:h.x})},{id:'second',name:'C₂',point:add(m,{x:h.y,y:-h.x})}];
}
export function rotationError(source,target,centre,degrees){
  if(!source.length||source.length!==target.length)return Infinity;
  return Math.max(...source.map((p,i)=>pointDistance(rotatePoint(p,centre,degrees),target[i])));
}
// Locate printed corresponding shapes, including rotation stages inside mixed
// questions. Matching every vertex excludes reflections and enlargements.
export function givenRotationPair(objects,plans){
  for(const plan of plans)for(const step of plan.steps){
    const a=objects.find(o=>o.name===step.sourceName),b=objects.find(o=>o.name===step.targetName);
    if(!a||!b||a===b||a.points.length<2||a.points.length!==b.points.length)continue;
    const i=a.points.findIndex((p,i)=>!near(p,b.points[i]));if(i<0)continue;
    if(rotationCandidates(a.points[i],b.points[i]).some(c=>[-90,90,180].some(d=>rotationError(a.points,b.points,c.point,d)<1e-7)))return [a,b];
  }
  return null;
}
export class CentreFinding {
  constructor(objects,saved){
    this.objects=objects.slice(0,2);this.reset();
    if(!saved||!this.selectPair(saved.index,saved.side))return;
    this.step=saved.step===.5?.5:1;
    if(samePath(saved.path)&&near(saved.path[0],this.a))this.path=saved.path.map(copy);
    if(this.met&&['arms','check'].includes(saved.phase)){
      this.phase='arms';
      if(samePath(saved.otherPath)&&near(saved.otherPath[0],this.midpoint))this.otherPath=saved.otherPath.map(copy);
      if(saved.phase==='check'&&this.armsReady)this.phase='check';
    }
    if(this.phase==='check'&&this.chooseCandidate(saved.candidate)){
      if(Number.isInteger(saved.compareIndex)&&this.source[saved.compareIndex])this.compareIndex=saved.compareIndex;
      this.distancesVisible=saved.distancesVisible===true;this.distanceStage=this.distancesVisible?([1,2,3].includes(saved.distanceStage)?saved.distanceStage:3):0;this.distanceProgress=1;
      if([-90,90,180].includes(saved.testDegrees)){this.testDegrees=saved.testDegrees;this.testProgress=1;}
    }
  }
  reset(){this.index=null;this.side=0;this.phase='pair';this.path=[];this.otherPath=[];this.step=1;this.candidate=null;this.compareIndex=0;this.distancesVisible=false;this.distanceStage=0;this.distanceProgress=1;this.testDegrees=null;this.testProgress=0;}
  get source(){return this.objects[0].points;}
  get target(){return this.objects[1].points;}
  get a(){return this.objects[this.side].points[this.index];}
  get b(){return this.objects[1-this.side].points[this.index];}
  get candidates(){return this.index===null?[]:rotationCandidates(this.a,this.b);}
  get midpoint(){return this.candidates[0]?.point;}
  get cursor(){return (this.phase==='meet'?this.path:this.otherPath).at(-1);}
  get pairedCursor(){return this.cursor?minus(add(this.a,this.b),this.cursor):null;}
  get met(){return this.path.length>0&&near(this.path.at(-1),this.midpoint);}
  get armsReady(){return this.otherPath.length>1&&this.candidates.slice(1).some(c=>near(c.point,this.otherPath.at(-1)));}
  get canNext(){return this.phase==='meet'?this.met:this.phase==='arms'?this.armsReady:false;}
  get chosen(){return this.candidates.find(c=>c.id===this.candidate);}
  selectPair(index,side=0){
    if(!Number.isInteger(index)||![0,1].includes(side)||!this.objects[side]?.points[index]||!this.objects[1-side]?.points[index])return false;
    if(near(this.objects[0].points[index],this.objects[1].points[index]))return false;
    this.reset();this.index=index;this.side=side;this.phase='meet';this.path=[copy(this.a)];return true;
  }
  move(axis,direction){
    if(!['meet','arms'].includes(this.phase)||!['x','y'].includes(axis)||![-1,1].includes(direction))return false;
    const path=this.phase==='meet'?this.path:this.otherPath,p=copy(path.at(-1));p[axis]+=direction*this.step;
    if(!valid(p)||!valid(minus(add(this.a,this.b),p)))return false;
    if(path.length>1&&near(p,path.at(-2)))path.pop();else if(path.length<1601)path.push(p);else return false;
    this.clearCheck();return true;
  }
  next(){
    if(!this.canNext)return false;
    if(this.phase==='meet'){this.phase='arms';this.otherPath=[copy(this.midpoint)];}
    else this.phase='check';return true;
  }
  undo(){
    if(this.phase==='check'){this.phase='arms';this.clearCheck();return;}
    const path=this.phase==='meet'?this.path:this.otherPath;
    if(path.length>1)path.pop();else if(this.phase==='arms'){this.phase='meet';this.otherPath=[];}
  }
  clearCheck(){this.candidate=null;this.distancesVisible=false;this.distanceStage=0;this.distanceProgress=1;this.testDegrees=null;this.testProgress=0;}
  chooseCandidate(id){
    if(this.phase!=='check'||!this.candidates.some(c=>c.id===id))return false;
    this.clearCheck();this.candidate=id;
    const c=this.chosen.point,others=this.source.map((p,i)=>({i,error:Math.abs(pointDistance(p,c)-pointDistance(this.target[i],c))})).filter(p=>p.i!==this.index);
    this.compareIndex=others.sort((a,b)=>b.error-a.error)[0]?.i??this.index;return true;
  }
  compare(index){if(!this.chosen||!Number.isInteger(index)||!this.source[index])return false;this.compareIndex=index;this.distancesVisible=true;this.distanceStage=1;this.distanceProgress=1;this.testDegrees=null;this.testProgress=0;return true;}
  nextDistance(){if(!this.chosen||!this.distancesVisible||this.distanceProgress<1)return false;if(this.distanceStage>=3){this.compare(this.compareIndex);return false;}this.distanceStage++;this.distanceProgress=0;return true;}
  get distanceFractions(){return !this.distancesVisible?[0,0]:[this.distanceStage>2?1:this.distanceStage===2?this.distanceProgress:0,this.distanceStage===3?this.distanceProgress:0];}
  get distances(){if(!this.chosen)return null;const c=this.chosen.point;return [pointDistance(this.source[this.compareIndex],c),pointDistance(this.target[this.compareIndex],c)];}
  get equalDistances(){const d=this.distances;return !!d&&Math.abs(d[0]-d[1])<1e-7;}
  startTest(degrees){if(!this.chosen||![-90,90,180].includes(degrees))return false;this.testDegrees=degrees;this.testProgress=0;return true;}
  get testMatches(){return !!this.chosen&&this.testDegrees!==null&&rotationError(this.source,this.target,this.chosen.point,this.testDegrees)<1e-7;}
  get trialPoints(){return this.testDegrees===null?[]:this.source.map(p=>rotatePoint(p,this.chosen.point,this.testDegrees*this.testProgress));}
  get paths(){
    if(this.index===null)return [];
    const opposite=path=>path.map(p=>minus(add(this.a,this.b),p));
    return [this.path,opposite(this.path),this.otherPath,opposite(this.otherPath)].filter(p=>p.length);
  }
  save(){return {index:this.index,side:this.side,phase:this.phase,path:this.path,otherPath:this.otherPath,step:this.step,candidate:this.candidate,compareIndex:this.compareIndex,distancesVisible:this.distancesVisible,distanceStage:this.distanceStage,testDegrees:this.testProgress===1?this.testDegrees:null};}
}
