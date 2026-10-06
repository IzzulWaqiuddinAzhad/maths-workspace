import {notebookQuestionPlans} from './notebook-questions.js';
import {findModuleQuestion,TranslationLesson,ReflectionLesson,EnlargementLesson} from './module-lesson.js?v=15';
import {NotebookRotationLesson,saveLesson,restoreLesson} from './notebook-model.js?v=5';
import {translatePoint,rotatePoint,flipPoint,completedImage} from './transform-model.js?v=29';
import {enlargePoint} from './module-lesson.js?v=15';

export const TRANSFORMATION_TYPES=['translation','reflection','rotation','enlargement'];
const finitePoint=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&Math.abs(p.x)<=1000&&Math.abs(p.y)<=1000;
const pair=v=>finitePoint(v)?{x:v.x,y:v.y}:{x:0,y:0};
const fromPair=p=>({x:p[0],y:p[1]});
const readFlags=data=>Object.fromEntries(Object.entries(data??{}).filter(([k,v])=>/^(centre|(source|image)(-\d+)?)$/.test(k)&&v===true));
export class NotebookTranslationLesson extends TranslationLesson {
  reset(){super.reset();this.vector={x:0,y:0};this.readPoints={source:false,image:false};this.stage=1;}
  move(axis,delta){if(['x','y'].includes(axis)&&Number.isFinite(delta)){this.vector[axis]=Math.max(-100,Math.min(100,this.vector[axis]+delta));this.answerVisible=false;}}
  pointAt(){return translatePoint(this.question.given,this.vector);}
  get canReveal(){return ['x','y'].every(a=>Math.abs(this.vector[a]-this.movementVector[a])<1e-8);}
}
function createLesson(q,polygon=false){
  const l=q.type==='rotation'?new NotebookRotationLesson(q):q.type==='reflection'?new ReflectionLesson(q):q.type==='enlargement'?new EnlargementLesson(q):new NotebookTranslationLesson(q);
  l.readPoints??={source:false,image:false};
  if(q.type==='rotation'&&(polygon||Math.hypot(q.given.x-q.centre.x,q.given.y-q.centre.y)<1e-9))l.goTo(9);
  if(polygon&&q.type==='enlargement'){l.goTo(4);l.setMode('scale');}
  return l;
}
function serialise(l){
  const common={centre:l.question.centre,readPoints:{...l.readPoints}};
  if(l.question.type==='rotation')return {...saveLesson(l),...common};
  if(l.question.type==='translation')return {...common,vector:l.vector};
  if(l.question.type==='reflection')return {...common,handles:l.handles,progress:l.progress,guideVisible:l.guideVisible};
  return {...common,stage:l.stage,mode:l.mode,progress:l.progress,givenCounts:l.givenCounts,imageCounts:l.imageCounts,imageStarted:l.imageStarted};
}
function restore(q,data,polygon){
  if(finitePoint(data?.centre))q={...q,centre:pair(data.centre)};
  let l=createLesson(q,polygon);
  if(!data)return l;
  if(q.type==='rotation')l=restoreLesson(q,data);
  else if(q.type==='translation')l.vector=pair(data.vector);
  else if(q.type==='reflection'){
    if(data.handles?.length===2&&data.handles.every(finitePoint))l.setHandles(data.handles);
    l.scrub(data.progress);l.guideVisible=!!data.guideVisible;
  }else{
    l.goTo(Number.isInteger(data.stage)?data.stage:0);
    if(l.ready){l.givenCounts=pair(data.givenCounts);l.imageCounts=pair(data.imageCounts);l.imageStarted=!!data.imageStarted;
      if(data.mode==='scale'&&Number.isFinite(data.progress))l.scrub(data.progress);}
  }
  l.readPoints={source:false,image:false,...readFlags(data.readPoints)};
  return l;
}
export class NotebookSession {
  constructor(graph,saved,legacy){
    this.graph=graph;this.originalQuestion=findModuleQuestion(graph.questionId);
    this.plans=notebookQuestionPlans(graph);this.planIndex=Number.isInteger(saved?.planIndex)&&this.plans[saved.planIndex]?saved.planIndex:0;
    this.base=graph.objects.map(o=>({...o,points:o.points.map(fromPair)}));
    for(const [i,plan]of this.plans.entries())if(plan.sourceVertex!==undefined){const o=this.base[0],v=plan.sourceVertex;this.base.push({id:`${graph.id}-plan-${i}`,name:o.labels[v],labels:[o.labels[v]],points:[o.points[v]],planIndex:i,stepIndex:0});plan.sourceId=this.base.at(-1).id;}
    this.kept=Array.isArray(saved?.kept)?saved.kept.filter(o=>typeof o.id==='string'&&typeof o.name==='string'&&Array.isArray(o.points)&&o.points.length>0&&o.points.length<=100&&o.points.every(finitePoint)).slice(0,40).map(o=>({...o,labels:Array.isArray(o.labels)?o.labels.map(String):[],points:o.points.map(pair)})):[];
    this.selected=this.objects.some(o=>o.id===saved?.selected)?saved.selected:this.planSource?.id;
    const initial=this.plan.steps[0].type??graph.defaultType;
    this.mode=TRANSFORMATION_TYPES.includes(saved?.mode)?saved.mode:initial;
    this.saved=saved?.engines??{};this.engines=new Map();
    if(legacy&&this.originalQuestion?.type==='rotation')this.saved[`${this.selected}:rotation`]=legacy;
  }
  get plan(){return this.plans[this.planIndex];}
  get planSource(){return this.base.find(o=>o.id===this.plan.sourceId)??this.base[0];}
  get stepIndex(){
    if(this.source.planIndex===this.planIndex&&Number.isInteger(this.source.stepIndex))return this.source.stepIndex;
    const index=this.plan.steps.findIndex(step=>step.sourceName===this.source.name);
    return index<0?this.plan.steps.length:index;
  }
  get step(){return this.plan.steps[this.stepIndex];}
  get objects(){return [...this.base,...this.kept];}
  get source(){return this.objects.find(o=>o.id===this.selected)??this.base[0];}
  get polygon(){return this.source.points.length>1;}
  get key(){return `${this.planIndex?this.planIndex+':':''}${this.selected}:${this.mode}`;}
  get lesson(){
    if(!this.engines.has(this.key)){
      const original=this.originalQuestion,step=this.step,known=original&&original.type===this.mode&&this.source.id===this.base[0].id,planned=step&&!step.describe&&step.type===this.mode;
      const q={id:this.graph.id,type:this.mode,label:this.source.name,find:'image',given:this.source.points[0],bounds:this.graph.bounds,
        centre:{x:0,y:0},degrees:90,vector:{x:0,y:0},factor:2,mirror:{kind:'vertical',k:0},...(planned?step:{}),...(known?original:{}),
        givenLabel:this.source.name,answerLabel:known&&original.find==='object'?original.label:step?.targetName||this.source.name+'′'};
      const lesson=restore(q,this.saved[this.key],this.polygon),prefix=this.key.slice(0,this.key.lastIndexOf(':')+1);
      for(const [key,previous]of [...Object.entries(this.saved),...this.engines])if(key.startsWith(prefix))for(const [flag,value]of Object.entries(previous.readPoints??{}))if(flag.startsWith('source')&&value)lesson.readPoints[flag]=true;
      if(this.source.image)lesson.readPoints.source=true;
      this.engines.set(this.key,lesson);
    }
    return this.engines.get(this.key);
  }
  get usesConstruction(){return this.mode==='rotation'&&!this.polygon;}
  get imageReady(){
    const l=this.lesson,readImage=Object.keys(l.readPoints).some(k=>k.startsWith('image')&&l.readPoints[k]);
    if(this.mode==='translation')return !!(l.vector.x||l.vector.y||readImage);
    if(this.mode==='reflection')return !!l.choice&&(l.progress>0||readImage);
    if(this.mode==='rotation')return l.constructionComplete&&(l.angle!==0||readImage);
    return l.ready&&(l.mode==='scale'?l.factor!==1||readImage:l.imageStarted);
  }
  get imagePoints(){
    const l=this.lesson;
    return this.source.points.map(p=>{
      if(this.mode==='translation')return translatePoint(p,l.vector);
      if(this.mode==='reflection')return l.line?flipPoint(p,l.line,l.progress):p;
      if(this.mode==='rotation')return rotatePoint(p,l.question.centre,l.angle);
      if(l.mode==='scale')return enlargePoint(p,l.question.centre,l.factor);
      return translatePoint(p,{x:l.pointAt().x-l.question.given.x,y:l.pointAt().y-l.question.given.y});
    });
  }
  // Earlier transformations stay visible when their image becomes the next
  // source. Reuse the saved engines so reset, reload and editing stay coherent.
  get presentations(){
    const layers=[];
    for(const key of new Set([...Object.keys(this.saved),...this.engines.keys()])){
      if(key===this.key)continue;
      const match=key.match(/^(?:(\d+):)?(.+):(translation|reflection|rotation|enlargement)$/);
      if(!match||!this.objects.some(o=>o.id===match[2]))continue;
      const layer=Object.create(this);
      Object.assign(layer,{planIndex:+(match[1]||0),selected:match[2],mode:match[3]});
      if(!this.plans[layer.planIndex])continue;
      if(layer.imageReady||layer.usesConstruction&&layer.lesson.constructionComplete)layers.push(layer);
    }
    return layers;
  }
  get canKeepImage(){return this.imageReady&&(this.mode!=='reflection'||this.lesson.progress===1)&&this.kept.length<40;}
  choosePlan(index){if(!this.plans[index])return false;this.planIndex=index;this.selected=this.planSource.id;this.mode=this.plan.steps[0].type??this.graph.defaultType;return true;}
  sourceForStep(index){const step=this.plan.steps[index];return [...this.kept].reverse().find(o=>o.planIndex===this.planIndex&&o.stepIndex===index)??this.kept.find(o=>o.planIndex===undefined&&o.name===step?.sourceName)??this.base.find(o=>o.id===this.plan.sourceId&&index===0)??this.base.find(o=>o.name===step?.sourceName);}
  activateStep(index){
    if(!this.plan.steps[index])return false;
    let source=this.sourceForStep(index);
    if(!source&&index===this.stepIndex+1&&this.canKeepImage){this.keepImage();source=this.source;}
    if(!source)return false;this.selected=source.id;this.mode=this.plan.steps[index].type??this.mode;return true;
  }
  chooseMode(mode){if(TRANSFORMATION_TYPES.includes(mode))this.mode=mode;}
  chooseObject(id){if(this.objects.some(o=>o.id===id))this.selected=id;}
  setCentre(p){
    if(!finitePoint(p)||!['rotation','enlargement'].includes(this.mode))return;
    const l=this.lesson;l.question={...l.question,centre:pair(p)};l.reset();l.readPoints={source:false,image:false};
    if(this.polygon){if(this.mode==='rotation')l.goTo(9);else{l.goTo(4);l.setMode('scale');}}
    else if(this.mode==='rotation'&&Math.hypot(l.question.given.x-p.x,l.question.given.y-p.y)<1e-9)l.goTo(9);
    else l.stage=1;
  }
  keepImage(){
    if(!this.canKeepImage)return false;
    const source=this.source,points=this.imagePoints,name=this.lesson.answerLabel,nextStep=this.stepIndex+1;
    let object=this.kept.find(o=>o.parentId===source.id&&o.planIndex===this.planIndex&&o.name===name&&JSON.stringify(o.points)===JSON.stringify(points));
    if(!object){object={...completedImage(source,points,this.objects),name,parentId:source.id,presentationKey:this.key,planIndex:this.planIndex,stepIndex:nextStep};this.kept.push(object);}
    this.selected=object.id;if(this.plan.steps[nextStep]?.type)this.mode=this.plan.steps[nextStep].type;
    this.lesson.readPoints.source=true;return true;
  }
  deleteSelected(){
    if(!this.kept.some(o=>o.id===this.selected))return false;
    const object=this.source;
    const originKeys=new Set(this.presentations.filter(layer=>layer.source.id===object.parentId&&layer.lesson.answerLabel===object.name&&JSON.stringify(layer.imagePoints)===JSON.stringify(object.points)).map(layer=>layer.key));
    if(object.presentationKey)originKeys.add(object.presentationKey);
    for(const key of new Set([...Object.keys(this.saved),...this.engines.keys()]))if(originKeys.has(key)||key.includes(`${object.id}:`)){this.engines.delete(key);delete this.saved[key];}
    this.kept=this.kept.filter(o=>o.id!==this.selected);this.selected=this.base[0].id;return true;
  }
  reset(){this.engines.delete(this.key);delete this.saved[this.key];}
  save(){return {planIndex:this.planIndex,selected:this.selected,mode:this.mode,kept:this.kept,engines:{...this.saved,...Object.fromEntries([...this.engines].map(([k,l])=>[k,serialise(l)]))}};}
}
// One-time migration keeps earlier A3 writing in its exact position on that page.
export function migrateNotebookDocument(saved,page){
  if(!Array.isArray(saved?.document?.objects)||!saved?.view||!Number.isFinite(saved.view.x)||!Number.isFinite(saved.view.y)||!Number.isFinite(saved.view.zoom)||saved.view.zoom<=0||!saved.document.objects.every(o=>Number.isFinite(o.position?.x)&&Number.isFinite(o.position?.y)))return null;
  const next=structuredClone(saved);
  for(const o of next.document.objects){o.position.x+=page.x;o.position.y+=page.y;}
  next.view.x-=page.x*next.view.zoom;next.view.y-=page.y*next.view.zoom;return next;
}
