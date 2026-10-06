import { ROTATION_QUESTIONS, RotationLesson } from './module-lesson.js?v=15';
import {MODULE_PAGES,MODULE_GRAPHS} from './notebook-assets/module-pages.js';

// Calibration from the original A3 page SVG (PDF points, not screen pixels).
export const MODULE_PAGE = Object.freeze({width:595.2756,height:841.8898});
let pageY=0;
export const NOTEBOOK_PAGES=MODULE_PAGES.map(p=>{const page={...p,x:(841.8898-p.width)/2,y:pageY};pageY+=p.height+30;return Object.freeze(page);});
export const NOTEBOOK_SIZE=Object.freeze({width:841.8898,height:pageY-30});
export const NOTEBOOK_GRAPHS=MODULE_GRAPHS.map(g=>{const page=NOTEBOOK_PAGES[g.page];return Object.freeze({...g,x:g.x+page.x,y:g.y+page.y,size:g.width,questionBox:{x:g.x+page.x-22,y:g.y+page.y-32,w:g.width+44,h:g.height+68}});});
export const pageAt=y=>NOTEBOOK_PAGES.find(p=>y<p.y+p.height+15)??NOTEBOOK_PAGES.at(-1);
export function pageToGraph(graph,p){const b=graph.bounds;return {x:b.xmin+(p.x-graph.x)/graph.unit,y:b.ymax-(p.y-graph.y)/graph.unit};}
export const PAGE_GRAPHS = Object.freeze(ROTATION_QUESTIONS.slice(0,4).map((question,i)=>Object.freeze({
  id:question.id, question, x:i%2?333:59, y:i<2?218:551,
  size:200, unit:12.5,
  questionBox:{x:i%2?308:32,y:i<2?106:439,w:258,h:340},
})));
export function graphToPage(graph,p){return graph.bounds?{x:graph.x+(p.x-graph.bounds.xmin)*graph.unit,y:graph.y+(graph.bounds.ymax-p.y)*graph.unit}:{x:graph.x+graph.size/2+p.x*graph.unit,y:graph.y+graph.size/2-p.y*graph.unit};}
export function fitPage(width,height,page=NOTEBOOK_PAGES[1]){
  const zoom=Math.max(.1,Math.min(3,(width-32)/page.width));
  return {zoom,x:(width-page.width*zoom)/2-page.x*zoom,y:70-page.y*zoom};
}
export function fitQuestion(graph,width,height,reserved={right:0,bottom:0}){
  const top=76+(reserved.top??0),b=graph.questionBox,w=Math.max(180,width-(reserved.right??0)),h=Math.max(180,height-(reserved.bottom??0));
  const zoom=Math.max(.1,Math.min(8,(w-32)/b.w,(h-top-16)/b.h));
  return {zoom,x:(w-b.w*zoom)/2-b.x*zoom,y:top+(h-top-16-b.h*zoom)/2-b.y*zoom};
}
export function fitGraph(graph,width,height,reserved={}){
  return fitQuestion({...graph,questionBox:{x:graph.x-18,y:graph.y-18,w:(graph.width??200)+36,h:(graph.height??200)+44}},width,height,reserved);
}
export function graphSummaryBounds(graph,view,width,height,summaryHeight=80,right=0){
  const left=Math.max(12,graph.x*view.zoom+view.x);
  const edge=Math.min(width-right-12,(graph.x+graph.width)*view.zoom+view.x);
  return {left,width:Math.max(0,edge-left),top:Math.max(58,Math.min(height-summaryHeight-12,graph.y*view.zoom+view.y-summaryHeight-10))};
}
export function constrainPage(view,width,height){
  const paperWidth=NOTEBOOK_SIZE.width*view.zoom,paperHeight=NOTEBOOK_SIZE.height*view.zoom;
  const side=Math.min(160,width/3);
  // Allow room beside a focused graph, but never lose the paper off screen.
  return {...view,x:Math.max(side-paperWidth,Math.min(width-side,view.x)),
    y:Math.max(Math.min(70,height-paperHeight-40),Math.min(70,view.y))};
}
// Notebook teachers can annotate the reasoning themselves. Both coordinates of
// the current arm remain editable; the guided module keeps its segment workflow.
export class NotebookRotationLesson extends RotationLesson {
  reset(){super.reset();this.readPoints={source:false,image:false};this.visitedArms=0;}
  get activeArm(){return Math.min(3,Math.floor(this.buildIndex/2));}
  armComplete(arm){return [arm*2,arm*2+1].every(i=>this.buildCounts[i]!==0||this.segmentInfo(i).target===0);}
  get completedArms(){return this.constructionComplete?4:[0,1,2,3].filter(i=>(this.visitedArms&(1<<i))&&this.armComplete(i)).length;}
  get constructionCursor(){return this.constructionComplete?null:this.constructionPaths[this.activeArm].end;}
  moveConstruction(axis,delta){
    if(!this.stage||this.constructionComplete||!['x','y'].includes(axis)||!Number.isInteger(delta))return false;
    if(!this.visitedArms&&this.buildCounts.every(n=>n===0))this.selectFirstAxis(axis);
    const start=this.activeArm*2,index=start+(this.segmentInfo(start).axis===axis?0:1);
    this.buildCounts[index]=Math.max(-100,Math.min(100,this.buildCounts[index]+delta));
    this.buildIndex=start;this.stage=Math.min(8,start+2);this.answerVisible=false;
    return true;
  }
  get armReady(){return this.stage>0&&!this.constructionComplete&&this.buildCounts.slice(this.activeArm*2,this.activeArm*2+2).some(n=>n!==0);}
  advanceArm(){
    if(!this.armReady)return false;
    const arm=this.activeArm;this.visitedArms|=1<<arm;
    const order=[1,2,3,4].map(n=>(arm+n)%4);
    // Visit untouched arms first, then return to the saved tip of any arm
    // missing a bend. Both cross-first and complete-L-first use this path.
    const next=order.find(i=>!(this.visitedArms&(1<<i)))??order.find(i=>!this.armComplete(i));
    this.buildIndex=next===undefined?8:next*2;
    this.stage=this.constructionComplete?9:Math.min(8,this.buildIndex+2);return true;
  }
  previousConstruction(){
    if(this.constructionComplete)this.visitedArms=15;
    const arm=this.constructionComplete?3:this.activeArm;
    const hasCurrent=this.buildCounts.slice(arm*2,arm*2+2).some(n=>n!==0);
    const previous=hasCurrent?arm:Math.max(0,arm-1);
    this.buildIndex=previous*2;this.buildCounts.fill(0,this.buildIndex,this.buildIndex+2);
    this.visitedArms&=~(1<<previous);this.stage=this.buildIndex?Math.min(8,this.buildIndex+2):1;
    this.progress=0;this.answerVisible=false;this.clockVisible=false;this.readPoints.image=false;
  }

}
export function saveLesson(lesson){
  return {stage:lesson.stage,buildIndex:lesson.buildIndex,buildCounts:[...lesson.buildCounts],
    firstAxis:lesson.firstAxis,progress:lesson.progress,answerVisible:lesson.answerVisible,clockVisible:lesson.clockVisible,
    readPoints:{...lesson.readPoints},visitedArms:lesson.constructionComplete?15:lesson.visitedArms,constructionVersion:3};
}
export function restoreLesson(question,data){
  const l=new NotebookRotationLesson(question);
  if(!data||!Number.isInteger(data.stage)||data.stage<0||data.stage>11||
    !Number.isInteger(data.buildIndex)||data.buildIndex<0||data.buildIndex>8||
    !['x','y'].includes(data.firstAxis)||!Array.isArray(data.buildCounts)||data.buildCounts.length!==8||
    !data.buildCounts.every(n=>Number.isInteger(n)&&Math.abs(n)<=100)||
    !Number.isFinite(data.progress)||Math.abs(data.progress)>360)return l;
  Object.assign(l,{stage:data.stage,buildIndex:data.buildIndex,buildCounts:[...data.buildCounts],firstAxis:data.firstAxis});
  l.readPoints={source:data.readPoints?.source===true,image:data.readPoints?.image===true};
  if(!l.stage){const source=l.readPoints.source;l.reset();l.readPoints.source=source;return l;}
  const currentVersion=data.constructionVersion===3;
  l.visitedArms=currentVersion&&Number.isInteger(data.visitedArms)?data.visitedArms&15:(1<<Math.floor(l.buildIndex/2))-1;
  if(!currentVersion&&!l.constructionComplete){
    if(data.constructionVersion!==2)l.buildCounts.fill(0,l.buildIndex+1);
    l.buildIndex=Math.floor(l.buildIndex/2)*2;l.buildCounts.fill(0,l.buildIndex+2);
  }
  if(l.constructionComplete){
    const unfinished=[0,1,2,3].find(i=>!l.armComplete(i));
    if(unfinished!==undefined)l.buildIndex=unfinished*2;
  }
  if(!l.constructionComplete){l.buildIndex=Math.floor(l.buildIndex/2)*2;l.stage=Math.min(8,l.buildIndex+2);l.readPoints.image=false;}
  else {l.scrub(data.progress);l.clockVisible=!!data.clockVisible;if(data.answerVisible)l.reveal();}

  return l;
}
