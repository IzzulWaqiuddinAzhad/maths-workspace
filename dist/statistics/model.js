import {transformRepresentation,observations,REPRESENTATIONS} from './representations.js?v=8';
import {rat,quantity,add,sub,div,mul,eq,num,total,selectionSortSteps,locatorCheck,quartileHalves,parseData} from './math.js?v=8';
export const clone=x=>structuredClone(x);
const newPiece=(m,value,owner,parent)=>({id:'p'+m.serial++,value:quantity(value),owner,parent});
export function meanState(data) {
 const m={phase:'original',serial:0,pieces:[],count:data.length,total:total(data),layers:0};
 data.forEach((value,i)=>{let rest=quantity(value);for(const unit of [10,1]){while(num(rest)>=unit-1e-9){m.pieces.push(newPiece(m,unit,'c'+i));rest=sub(rest,unit);}}if(num(rest)>0)m.pieces.push(newPiece(m,rest,'c'+i));});return m;
}
export const ownerTotal=(m,owner)=>total(m.pieces.filter(p=>p.owner===owner).map(p=>p.value));
export const meanValues=m=>Array.from({length:m.count},(_,i)=>ownerTotal(m,'c'+i));
function take(m,amount,owner){let remaining=quantity(amount);const moved=[];
 for(const piece of [...m.pieces.filter(p=>p.owner==='pool')].sort((a,b)=>num(a.value)-num(b.value))) {
  if(!num(remaining))break;
  if(num(piece.value)<=num(remaining)+1e-10){piece.owner=owner;remaining=sub(remaining,piece.value);moved.push(piece);}
  else {piece.value=sub(piece.value,remaining);const cut=newPiece(m,remaining,owner,piece.id);m.pieces.push(cut);moved.push(cut);remaining=rat(0);}
 }
 if(num(remaining)>1e-9)throw Error('Insufficient pool');return moved;
}
export function nextMean(source) {
 const m=clone(source),pool=ownerTotal(m,'pool');
 if(['original','manual'].includes(m.phase)){m.pieces.forEach(p=>p.owner='pool');m.layers=0;m.phase='pooled';}
 else if(['pooled','distributing'].includes(m.phase)){
  if(num(pool)>=m.count){for(let i=0;i<m.count;i++)take(m,1,'c'+i);m.layers++;m.phase=num(ownerTotal(m,'pool'))===0?'complete':'distributing';}
  else m.phase=num(pool)?'remainder':'complete';
 }else if(m.phase==='remainder'){const pieces=m.pieces.filter(p=>p.owner==='pool');m.pieces=m.pieces.filter(p=>p.owner!=='pool');m.pieces.push(newPiece(m,pool,'pool',pieces[0]?.id));m.phase='combined';}
 else if(m.phase==='combined'){const parent=m.pieces.find(p=>p.owner==='pool')?.id;m.pieces=m.pieces.filter(p=>p.owner!=='pool');for(let i=0;i<m.count;i++)m.pieces.push({...newPiece(m,div(pool,m.count),'pool',parent),destination:i});m.phase='split';}
 else if(m.phase==='split'){m.pieces.filter(p=>p.owner==='pool').forEach(p=>p.owner='c'+p.destination);m.phase='complete';}
 else if(m.phase==='complete')m.phase='formalised';
 assertMean(m);return m;
}
export function assertMean(m){if(!eq(total(m.pieces.map(p=>p.value)),m.total)||m.pieces.some(p=>num(p.value)<=0))throw Error('Quantity must be conserved');if(new Set(m.pieces.map(p=>p.id)).size!==m.pieces.length)throw Error('Duplicate piece identity');}
export function transferPiece(source,id,owner){const m=clone(source),p=m.pieces.find(p=>p.id===id);if(!p||!(owner==='pool'||/^c\d+$/.test(owner)&&+owner.slice(1)<m.count))return source;if(p.owner===owner)return source;p.owner=owner;m.phase='manual';assertMean(m);return m;}
export function splitPiece(source,id){const m=clone(source),p=m.pieces.find(p=>p.id===id);if(!p||![100,10,1,.1].includes(num(p.value)))return source;const v=div(p.value,10);m.pieces=m.pieces.filter(p=>p.id!==id);for(let i=0;i<10;i++)m.pieces.push(newPiece(m,v,p.owner,id));assertMean(m);return m;}
export function regroupPieces(source,id){const m=clone(source),p=m.pieces.find(p=>p.id===id);if(!p)return source;const same=m.pieces.filter(x=>x.owner===p.owner&&eq(x.value,p.value)).slice(0,10);if(same.length<10||![.01,.1,1,10].includes(num(p.value)))return source;const ids=new Set(same.map(p=>p.id));m.pieces=m.pieces.filter(p=>!ids.has(p.id));m.pieces.push(newPiece(m,mul(p.value,10),p.owner,id));assertMean(m);return m;}
function medianState(data){return {phase:'sorting',steps:selectionSortSteps(data),step:-1,order:data.map((_,i)=>'o'+i),prefix:0,scan:-1,min:-1,target:'q2',locator:0,check:null,markers:{},sharing:null};}
export function conceptState(data,concept){return concept==='mean'?meanState(data):concept==='mode'?{phase:'raw',grouped:[],pulse:null,reveal:false}:medianState(data);}
export class StatisticsWorkspace {
 constructor(question){this.load(question);}
 load(question){parseData(question.data.join(','));this.question=clone(question);this.originalData=Object.freeze([...question.data]);this.sortedData=Object.freeze([...question.data].sort((a,b)=>a-b));this.observations=Object.freeze(observations(this.originalData).map(Object.freeze));this.startRepresentation=question.startRepresentation||'raw-data';this.reconstructed=this.startRepresentation==='raw-data';this.concept=this.startRepresentation==='raw-data'?'mean':'representations';this.state=conceptState(this.originalData,this.concept);if(this.concept==='representations')this.state={representation:this.startRepresentation,route:[]};this.history=[];}
 snapshot(){return {concept:this.concept,state:clone(this.state),reconstructed:this.reconstructed};}
 save(){this.history.push(this.snapshot());if(this.history.length>150)this.history.shift();}
 undo(){const last=this.history.pop();if(last){this.concept=last.concept;this.state=last.state;this.reconstructed=last.reconstructed;}return !!last;}
 reset(){this.save();this.state=this.concept==='representations'?{representation:this.startRepresentation,route:[]}:conceptState(this.originalData,this.concept);}
 setConcept(concept){if(!['mean','median','mode','quartiles','representations'].includes(concept)||concept===this.concept||!this.reconstructed&&concept!=='representations')return;this.save();this.concept=concept;this.state=concept==='representations'?{representation:'raw-data',route:[]}:conceptState(this.originalData,concept);}
 restoreOriginal(){this.save();this.reconstructed=this.startRepresentation==='raw-data';this.concept=this.reconstructed?'mean':'representations';this.state=this.reconstructed?meanState(this.originalData):{representation:this.startRepresentation,route:[]};}
 get workingData(){return this.concept==='mean'?meanValues(this.state):this.state.order?.map(id=>this.originalData[+id.slice(1)])||[...this.originalData];}
 get indices(){const m=this.state;if(m.target==='q1')return quartileHalves(this.originalData.length).lower;if(m.target==='q3')return quartileHalves(this.originalData.length).upper;return this.originalData.map((_,i)=>i);}
 get canNext(){const s=this.state;return this.concept==='representations'?!!s.route.length:this.concept==='mean'?s.phase!=='formalised':this.concept==='mode'?s.phase!=='table'||!s.reveal:s.phase!=='locating'&&!(s.phase==='result'&&s.target==='q3');}
 moveLocator(delta){const s=this.state;if(!['locating','result','counted'].includes(s.phase))return;this.save();s.locator=Math.max(this.indices[0]*2,Math.min(this.indices.at(-1)*2,s.locator+delta));s.phase='locating';s.check=null;}
 check(){const s=this.state;if(s.phase!=='locating'&&s.phase!=='counted')return;this.save();const r=locatorCheck(s.order,this.indices,s.locator,this.originalData);s.check={...r,sequence:r.left.map(i=>({i,side:'left'})).concat(r.right.map(i=>({i,side:'right'}))),step:0,leftCount:0,rightCount:0,pulse:null};s.phase='counting';}
 next(){if(!this.canNext)return;this.save();const s=this.state;
 if(this.concept==='representations'){s.representation=s.route.shift();if(s.representation==='raw-data')this.reconstructed=true;return;}
 if(this.concept==='mean'){this.state=nextMean(s);return;}
 if(this.concept==='mode'){
   if(s.phase==='raw')s.phase='stacking';
   if(s.phase==='stacking'){const ordered=this.originalData.map((v,i)=>({v,id:'o'+i})).sort((a,b)=>a.v-b.v);const next=ordered[s.grouped.length];if(next){s.grouped.push(next.id);s.pulse=next.id;}if(s.grouped.length===ordered.length)s.phase='grouped';}
   else if(s.phase==='grouped'){s.phase='dots';s.pulse=null;}
   else if(s.phase==='dots')s.phase='table';else s.reveal=true;return;
 }
 if(s.phase==='sorting'){const step=s.steps[++s.step];Object.assign(s,step);if(step.kind==='complete'){s.phase='locating';s.locator=0;}return;}
 if(s.phase==='counting'){const c=s.check,action=c.sequence[c.step++];if(action){c[action.side+'Count']++;c.pulse=action.i;}
  else {c.pulse=null;if(!c.correct)s.phase='counted';else if(c.middleIndices.length===2){s.phase='sharing';s.sharing=meanState(c.middleIndices.map(i=>this.originalData[+s.order[i].slice(1)]));}else this.finishMedian();}return;}
 if(s.phase==='sharing'){if(s.sharing.phase==='complete')this.finishMedian();else s.sharing=nextMean(s.sharing);return;}
 if(s.phase==='result'){s.target=s.target==='q2'?'q1':'q3';s.locator=this.indices[0]*2;s.phase='locating';s.check=null;s.sharing=null;return;}
 if(s.phase==='counted'){s.phase='locating';s.check=null;}
 }
 finishMedian(){const s=this.state;s.markers[s.target]={value:s.check.value,locator:s.locator};s.phase='result';}
 transform(to){const from=this.concept==='representations'?this.state.representation:this.concept==='mode'?({dots:'dot-plot',table:'frequency-table',grouped:'grouped-values'})[this.state.phase]||'raw-data':'raw-data';const result=transformRepresentation({from,to,observations:this.observations});if(!result.ok)return result;this.save();this.concept='representations';this.state={representation:from,route:result.steps};return result;}
 manipulate(kind,id,owner){if(this.concept!=='mean')return;const changed=({move:transferPiece,split:splitPiece,regroup:regroupPieces})[kind]?.(this.state,id,owner);if(changed&&changed!==this.state){this.save();this.state=changed;}}
}
