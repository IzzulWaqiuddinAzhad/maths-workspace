import {findModuleQuestion} from './module-lesson.js?v=15';

// Summaries contain the question's givens, never the answer scheme's hidden
// centres/vectors. Describe-the-transformation questions retain that prompt.
export function notebookQuestionPlans(graph) {
  const q=findModuleQuestion(graph.questionId), names=graph.objects.map(o=>o.name);
  const plan=(label,steps,extra={})=>({label,steps,...extra});
  if(q){
    const steps=q.type==='combined'?q.steps:[q];
    return [plan(q.composition||'',steps.map((s,i)=>({...s,sourceName:i?q.label+'′'.repeat(i):names[0],targetName:q.type==='combined'?q.label+'′'.repeat(i+1):q.find==='object'?q.label:q.label+'′'})))];
  }
  const describe=(symbols=[],types=[])=>Array.from({length:Math.max(1,names.length-1)},(_,i)=>({describe:true,type:types[i]||null,symbol:symbols[i]||'',sourceName:names[i],targetName:names[i+1]}));
  const t=(x,y,symbol='T')=>({type:'translation',vector:{x,y},symbol});
  const r=(x,y,degrees,symbol='R')=>({type:'rotation',centre:{x,y},degrees,symbol});
  const f=(mirror,symbol='P')=>({type:'reflection',mirror,symbol});
  const chain=(label,steps,name=names[0],extra={})=>plan(label,steps.map((s,i)=>({...s,sourceName:name+'′'.repeat(i),targetName:name+'′'.repeat(i+1)})),extra);
  if(graph.id==='61-1')return [chain('(i) TP',[f({kind:'horizontal',k:2}),t(-3,2)]),chain('(ii) PR',[r(-1,1,180),f({kind:'horizontal',k:2})])];
  if(graph.id==='63-1')return [chain('(i) K²',[t(-3,-2,'K'),t(-3,-2,'K')]),chain('(ii) KL',[r(2,5,-90,'L'),t(-3,-2,'K')])];
  if(graph.id==='64-1')return [chain('(i) T',[t(4,-3)]),chain('(ii) R',[f({kind:'vertical',k:7},'R')])];
  if(graph.id==='62-1')return [chain('(a) TP',[f({kind:'slanted',slope:-1}),t(-2,3)],'A',{sourceVertex:0}),plan('(b) ZY',describe(['Y','Z']))];
  if(graph.id==='61-2')return [plan('HG',describe(['G','H']))];
  if(graph.id==='64-2')return [plan('',describe([],['rotation','enlargement']))];
  if(graph.id==='63-2')return [plan('V',describe(['V'],['enlargement']))];
  if(['B6','B7','B8'].includes(graph.section))return [plan('JK',describe(['K','J']))];
  if(graph.section==='C4')return [plan('WV',describe(['V','W']))];
  const type=graph.section.startsWith('C')?'enlargement':graph.defaultType;
  return [plan('',describe([],[type]).map(s=>({...s,heading:graph.section==='B3'?'90° rotation':graph.section==='B4'?'90° / 180° rotation':null})))];
}
export const formatNumber=n=>String(Number(n.toFixed(2))).replace('-','−');
export const formatPair=p=>`(${formatNumber(p.x)}, ${formatNumber(p.y)})`;
export function transformationText(step,lesson) {
  const s=step.describe?{type:lesson.question.type,vector:lesson.vector,degrees:lesson.angle,factor:lesson.factor}:step;
  if(step.describe)return step.heading||`Describe ${s.type||'transformation'}`;
  if(s.type==='translation')return `Translation ${formatPair(s.vector)}`;
  if(s.type==='rotation')return `Rotation ${Math.abs(s.degrees)}°${s.degrees<0?' clockwise':s.degrees>0&&Math.abs(s.degrees)!==180?' anticlockwise':''}`;
  if(s.type==='enlargement')return `Enlargement × ${formatNumber(s.factor)}`;
  const m=s.mirror;
  return `Reflection ${m.kind==='vertical'?'x = '+formatNumber(m.k):m.kind==='horizontal'?'y = '+formatNumber(m.k):m.slope===-1?'y = −x':'y = x'}`;
}
