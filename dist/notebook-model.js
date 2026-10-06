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
  reset(){super.reset();this.readPoints={source:false,image:false};}
  get completedArms(){return Math.floor(this.buildIndex/2);}
  get constructionCursor(){return this.constructionComplete?null:this.constructionPaths[this.completedArms].end;}
  moveConstruction(axis,delta){
    if(!this.stage||this.constructionComplete||!['x','y'].includes(axis)||!Number.isInteger(delta))return false;
    if(!this.buildIndex&&this.buildCounts.every(n=>n===0))this.selectFirstAxis(axis);
    const start=this.completedArms*2,index=start+(this.segmentInfo(start).axis===axis?0:1);
    this.buildCounts[index]=Math.max(-100,Math.min(100,this.buildCounts[index]+delta));
    this.buildIndex=start;this.stage=Math.min(8,start+2);this.answerVisible=false;
    return true;
  }
  get armReady(){return this.stage>0&&!this.constructionComplete&&this.buildCounts.slice(this.completedArms*2,this.completedArms*2+2).some(n=>n!==0);}
  advanceArm(){
    if(!this.stage||this.constructionComplete)return false;
    const start=this.completedArms*2;
    if(!this.armReady)return false;
    // Next keeps this complete L and returns the cursor to the centre.
    this.buildIndex=start+2;this.stage=this.constructionComplete?9:Math.min(8,this.buildIndex+2);return true;
  }
  previousConstruction(){
    const start=this.constructionComplete?6:this.completedArms*2;
    const hasCurrent=!this.constructionComplete&&this.buildCounts.slice(start,start+2).some(n=>n!==0);
    this.buildIndex=hasCurrent?start:Math.max(0,start-(this.constructionComplete?0:2));
    this.buildCounts.fill(0,this.buildIndex);this.stage=this.buildIndex?Math.min(8,this.buildIndex+2):1;
    this.progress=0;this.answerVisible=false;this.clockVisible=false;this.readPoints.image=false;
  }
}
export function saveLesson(lesson){
  return {stage:lesson.stage,buildIndex:lesson.buildIndex,buildCounts:[...lesson.buildCounts],
    firstAxis:lesson.firstAxis,progress:lesson.progress,answerVisible:lesson.answerVisible,clockVisible:lesson.clockVisible,
    readPoints:{...lesson.readPoints},constructionVersion:2};
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
  // Ignore inconsistent future segments and never restore an unearned answer.
  if(!l.stage){const source=l.readPoints.source;l.reset();l.readPoints.source=source;return l;}
  if(!l.constructionComplete){
    if(data.constructionVersion!==2)l.buildCounts.fill(0,l.buildIndex+1);
    l.buildIndex=Math.floor(l.buildIndex/2)*2;l.buildCounts.fill(0,l.buildIndex+2);l.stage=Math.min(8,l.buildIndex+2);l.readPoints.image=false;
  }
  else {l.scrub(data.progress);l.clockVisible=!!data.clockVisible;if(data.answerVisible)l.reveal();}
  return l;
}
