import { ROTATION_QUESTIONS, RotationLesson } from './module-lesson.js?v=15';

// Calibration from the original A3 page SVG (PDF points, not screen pixels).
export const MODULE_PAGE = Object.freeze({width:595.2756,height:841.8898});
export const PAGE_GRAPHS = Object.freeze(ROTATION_QUESTIONS.slice(0,4).map((question,i)=>Object.freeze({
  id:question.id, question, x:i%2?333:59, y:i<2?218:551,
  size:200, unit:12.5,
  questionBox:{x:i%2?308:32,y:i<2?106:439,w:258,h:340},
})));
export function graphToPage(graph,p){return {x:graph.x+graph.size/2+p.x*graph.unit,y:graph.y+graph.size/2-p.y*graph.unit};}
export function fitPage(width,height){
  const zoom=Math.max(.1,Math.min(3,(width-32)/MODULE_PAGE.width));
  return {zoom,x:(width-MODULE_PAGE.width*zoom)/2,y:70};
}
export function fitQuestion(graph,width,height,reserved={right:0,bottom:0}){
  const b=graph.questionBox,w=Math.max(180,width-(reserved.right??0)),h=Math.max(180,height-(reserved.bottom??0));
  const zoom=Math.max(.1,Math.min(8,(w-32)/b.w,(h-92)/b.h));
  return {zoom,x:(w-b.w*zoom)/2-b.x*zoom,y:76+(h-92-b.h*zoom)/2-b.y*zoom};
}
export function fitGraph(graph,width,height,reserved={}){
  return fitQuestion({...graph,questionBox:{x:graph.x-18,y:graph.y-18,w:236,h:244}},width,height,reserved);
}
export function constrainPage(view,width,height){
  const paperWidth=MODULE_PAGE.width*view.zoom,paperHeight=MODULE_PAGE.height*view.zoom;
  const side=Math.min(160,width/3);
  // Allow room beside a focused graph, but never lose the paper off screen.
  return {...view,x:Math.max(side-paperWidth,Math.min(width-side,view.x)),
    y:Math.max(Math.min(70,height-paperHeight-40),Math.min(70,view.y))};
}
export function saveLesson(lesson){
  return {stage:lesson.stage,buildIndex:lesson.buildIndex,buildCounts:[...lesson.buildCounts],
    firstAxis:lesson.firstAxis,progress:lesson.progress,answerVisible:lesson.answerVisible,clockVisible:lesson.clockVisible};
}
export function restoreLesson(question,data){
  const l=new RotationLesson(question);
  if(!data||!Number.isInteger(data.stage)||data.stage<0||data.stage>11||
    !Number.isInteger(data.buildIndex)||data.buildIndex<0||data.buildIndex>8||
    !['x','y'].includes(data.firstAxis)||!Array.isArray(data.buildCounts)||data.buildCounts.length!==8||
    !data.buildCounts.every(n=>Number.isInteger(n)&&Math.abs(n)<=100)||
    !Number.isFinite(data.progress)||Math.abs(data.progress)>360)return l;
  Object.assign(l,{stage:data.stage,buildIndex:data.buildIndex,buildCounts:[...data.buildCounts],firstAxis:data.firstAxis});
  // Ignore inconsistent future segments and never restore an unearned answer.
  if(!l.stage){l.reset();return l;}
  if(!l.constructionComplete){l.buildCounts.fill(0,l.buildIndex+1);l.stage=Math.min(8,l.buildIndex+2);}
  else {l.scrub(data.progress);l.clockVisible=!!data.clockVisible;if(data.answerVisible)l.reveal();}
  return l;
}
