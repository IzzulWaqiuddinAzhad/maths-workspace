import {formatPair,transformationText} from './notebook-questions.js';
import {bindLineEquationInput} from './line-equation-input.js';
import {workspaceHost as host} from './workspace-host.js';
import {NOTEBOOK_PAGES,NOTEBOOK_GRAPHS,pageAt,pageToGraph,fitPage,fitQuestion,fitGraph,graphSummaryBounds,constrainPage} from './notebook-model.js?v=5';
import {NotebookSession,migrateNotebookDocument} from './notebook-session.js?v=5';
import {paintNotebookGraph,readKey,vertexLabel} from './notebook-render.js?v=5';
import {coordinateGuideDuration} from './module-coordinate-guide.js?v=3';
import {RotationSnap,ReflectionScrub,lineFoot,objectHit,parseMirrorEquation,lineHandles} from './transform-model.js?v=29';
import {EnlargementSnap,squareCountAt} from './module-lesson.js?v=15';
import {bindDirectionPad} from './direction-pad.js?v=2';
import {LabelLayout} from './label-layout.js?v=13';
import {calculatorPanel} from './calculator-panel.js?v=13';
import {worldToScreen,screenToWorld} from './core.js?v=14';

const $=id=>document.getElementById(id),LESSONS_KEY='module-notebook:module:lessons:v1',DOCUMENT_KEY='module-notebook:module:document:v1';
const load=key=>{try{return JSON.parse(localStorage.getItem(key))??{}}catch{return {}}};
const stored=load(LESSONS_KEY),legacy=load('module-notebook:a3:lessons:v1');
try{if(!localStorage.getItem(DOCUMENT_KEY)){const old=migrateNotebookDocument(load('module-notebook:a3:document:v1'),NOTEBOOK_PAGES[3]);if(old)localStorage.setItem(DOCUMENT_KEY,JSON.stringify(old));}}catch{}
const graphs=NOTEBOOK_GRAPHS.map(g=>({...g,session:new NotebookSession(g,stored[g.id],stored[g.id]?null:legacy[g.id]),layout:new LabelLayout(),readIndex:0,started:stored[g.id]?.started===true||!!legacy[g.id]}));
const pages=NOTEBOOK_PAGES.map(p=>({...p,image:null}));
let api,active=null,animation=null,guide=null,tick=0,now=0,clean=false,full=false,padBinding=null,currentPage=1,intent=null;
let rotationSnap=null,enlargementSnap=null,reflectionScrub=null;
const fmt=n=>String(Number(n.toFixed(2))).replace('-','−');
const save=()=>{try{localStorage.setItem(LESSONS_KEY,JSON.stringify(Object.fromEntries(graphs.map(g=>[g.id,{...g.session.save(),started:g.started}]))))}catch{$('demoStatus').textContent='Storage is full. Keep this page open to retain the demonstration.';}};
function loadPage(p){
  if(p.image)return;p.image=new Image();p.image.src=new URL(`./notebook-assets/${p.asset}`,import.meta.url);
  p.image.decode().then(()=>{$('pageLoading').hidden=true;api?.requestDraw(true);}).catch(()=>{$('pageLoading').hidden=false;$('pageLoading').textContent='A module page could not load. Reload to try again.';});
}
function visible(p,view,height){return (p.y+p.height)*view.zoom+view.y>=-100&&p.y*view.zoom+view.y<=height+100;}
Object.assign(host,{
  documentKey:DOCUMENT_KEY,preferencesKey:'module-notebook:tools:v1',title:'BIJAK SPM - Transformations',theme:'light',scrollPage:true,hideExplorations:true,
  defaultOptions:{widths:{ball:1.2,pressure:1.2,pencil:.65},highWidth:10,fontSize:12,touchDraw:false},constrainView:constrainPage,
  resize:({view,old,width,height,saved})=>clean&&active?fitGraph(active,width,height,{bottom:146,top:-62}):old.width||saved?view:fitPage(width,height),
  paintBackground(ctx){
    const view=api?.view??fitPage(innerWidth,innerHeight),height=api?.size.height??innerHeight;
    ctx.save();ctx.fillStyle='#fff';
    for(const p of pages)if(visible(p,view,height)){
      loadPage(p);ctx.fillRect(p.x,p.y,p.width,p.height);
      if(p.image.complete&&p.image.naturalWidth)ctx.drawImage(p.image,p.x,p.y,p.width,p.height);
      for(const g of graphs.filter(g=>g.page===p.id-1&&g.started))paintNotebookGraph(ctx,g,{now,active:g===active,guide:guide?.graph===g?guide:null});
    }
    ctx.restore();
  },
  afterDraw({view,width,height}){
    currentPage=pageAt(screenToWorld({x:width/2,y:Math.min(height/2,220)},view).y).id-1;
    $('pagePicker').value=String(currentPage);$('previousPage').disabled=!currentPage;$('nextPage').disabled=currentPage===pages.length-1;
    $('questionSummary').hidden=!active||clean||!visible(active,view,height);
    positionSummary();document.body.dataset.tool=api.tool;
    if(active&&visible(active,view,height)&&(active.session.lesson.clockVisible||active.session.usesConstruction&&active.session.lesson.stage&&!active.session.lesson.constructionComplete))animate();
    for(const g of graphs){
      const a=worldToScreen({x:g.x,y:g.y},view),b=worldToScreen({x:g.x+g.width,y:g.y+g.height},view),image=pages[g.page].image;
      g.button.hidden=!api||!image?.naturalWidth||b.x<12||a.x>width-12||b.y<60||a.y>height-48;
      g.button.style.left=`${Math.max(12,Math.min(width-88,b.x-72))}px`;g.button.style.top=`${Math.max(55,Math.min(height-48,a.y-25))}px`;
    }
  },
  beginInteraction:beginGraphInteraction,
});
for(const p of pages){const o=document.createElement('option');o.value=p.id-1;o.textContent=`${p.id} · ${p.section}`;$('pagePicker').append(o);}
for(const g of graphs){
  const b=document.createElement('button');b.className='demo-anchor';b.hidden=true;b.textContent='▶ Demo';b.ariaLabel=`Demonstrate Question ${g.questionId}${g.id.includes('-')?' graph '+g.id.split('-')[1]:''}`;b.setAttribute('aria-pressed','false');
  b.onclick=()=>openGraph(g);g.button=b;$('demoAnchors').append(b);
}
const summary=document.createElement('section');summary.className='notebook-accessible';summary.ariaLabel='Printed module';summary.textContent='BIJAK SPM PPDMT 2026. 23 pages, 64 questions. Choose a page or scroll. Each Cartesian graph has a Demo button.';document.querySelector('main').append(summary);
const {workspace}=await import('./app.js?v=54');api=workspace;
document.querySelector('header').prepend($('tools'));
$('overlay').setAttribute('aria-label','Module pages. Write with a pen, use one finger to pan, or pinch to zoom. Select to interact with the active graph.');

function stopAnimation(){api?.cancelAction();$('mirrorInputPanel').hidden=true;padBinding?.stop();if(animation?.kind==='count'){const l=animation.graph.session.lesson;l.givenCounts[animation.axis]=animation.from;l.stage=animation.axis==='x'?2:3;l.counting=false;l.countAnimation=null;}animation=null;guide=null;intent=null;}
function animate(){if(!tick&&!document.hidden)tick=requestAnimationFrame(frame);}
function frame(time){
  tick=0;now=time;
  if(animation){
    const a=animation,l=a.graph.session.lesson,p=Math.min(1,(time-a.start)/a.duration);
    if(a.kind==='count')l.givenCounts[a.axis]=squareCountAt(a.from,a.to,time-a.start);
    else l.scrub(a.from+(a.to-a.from)*(p*p*(3-2*p)));
    if(p===1){if(a.kind==='count'){l.givenCounts[a.axis]=a.to;l.counting=false;l.countAnimation=null;}animation=null;save();sync();}
  }
  if(guide&&time-guide.start>=coordinateGuideDuration(guide.mode,guide.point)){
    const l=guide.graph.session.lesson;if(guide.mode==='plot')l.stage=Math.max(1,l.stage);l.readPoints[guide.key]=true;
    guide=null;save();sync();
  }
  api.requestDraw(true);
  const s=active?.session,l=s?.lesson;
  const inView=active&&visible(active,api.view,api.size.height);
  if(animation||guide||inView&&(l?.clockVisible||s?.usesConstruction&&l.stage&&!l.constructionComplete||time-(active.mirrorChanged||0)<900))animate();
}
function showCoordinates(mode,kind='source',index=active?.readIndex??0){
  if(!active)return;stopAnimation();const s=active.session,l=s.lesson;
  if(kind==='image'&&!s.imageReady)return;
  const centre=mode==='plot'||kind==='centre';
  guide={graph:active,mode,key:centre?'centre':readKey(kind,index),point:centre?l.question.centre:kind==='image'?s.imagePoints[index]:s.source.points[index],label:centre?'Centre':vertexLabel(s,index,kind==='image'),start:performance.now()};
  sync();animate();
}
function openGraph(g){stopAnimation();active=g;g.started=true;g.readIndex=0;api.setTool('select');$('demoPanel').hidden=false;for(const a of graphs)a.button.setAttribute('aria-pressed',String(a===g));sync();fitActive(true);animate();}
function positionSummary(){
  const root=$('questionSummary');if(!active||root.hidden)return;
  const {width,height}=api.size,b=graphSummaryBounds(active,api.view,width,height,root.offsetHeight,width>700?290:0);
  root.style.left=`${b.left}px`;root.style.width=`${b.width}px`;root.style.top=`${b.top}px`;
  root.style.visibility=b.width<100?'hidden':'visible';
}
function fitActive(closer=false){
  if(!active)return;const {width,height}=api.size,bottom=width<=700&&!clean?Math.min(height*.48,$('demoPanel').offsetHeight)+66:clean?146:0;
  // A second measurement accounts for wrapping at the graph's fitted width.
  for(let pass=0;pass<2;pass++){
    positionSummary();
    api.setView((closer||clean?fitGraph:fitQuestion)(active,width,height,{right:width>700&&!clean?290:0,bottom,top:clean?-62:$('questionSummary').hidden?0:$('questionSummary').offsetHeight+12}));
  }
  positionSummary();
}
function changed(){save();sync();api.requestDraw(true);animate();}
function syncSummary(){
  const s=active.session,root=$('questionSummary');root.hidden=clean;root.replaceChildren();
  const heading=document.createElement('div');heading.className='summary-heading';
  const title=document.createElement('strong');title.textContent=`Question ${active.questionId}`;heading.append(title);
  if(s.plans.length>1){const picker=document.createElement('select');picker.ariaLabel='Question part';s.plans.forEach((plan,i)=>{const option=document.createElement('option');option.value=i;option.textContent=plan.label;picker.append(option);});picker.value=s.planIndex;picker.onchange=()=>{stopAnimation();s.choosePlan(+picker.value);active.readIndex=0;changed();fitActive();};heading.append(picker);}
  else if(s.plan.label){const label=document.createElement('span');label.textContent=s.plan.label;heading.append(label);}
  root.append(heading);
  const button=(row,text,action,disabled=false)=>{const b=document.createElement('button');b.type='button';b.textContent=text;b.disabled=disabled;b.onclick=action;row.append(b);return b;};
  s.plan.steps.forEach((step,i)=>{
    const row=document.createElement('div');row.className='summary-row';row.setAttribute('data-active',String(i===s.stepIndex));
    if(s.plan.steps.length>1){const n=document.createElement('span');n.className='summary-order';n.textContent=i+1;row.append(n);}
    const current=i===s.stepIndex,available=!!s.sourceForStep(i)||i===s.stepIndex+1&&s.canKeepImage;
    const useStep=()=>{stopAnimation();if(!current&&!s.activateStep(i))return false;active.readIndex=0;changed();return true;};
    button(row,current?s.source.name:step.sourceName,()=>{if(useStep())showCoordinates('read','source');},!available);
    const description=transformationText(current&&step.type&&s.mode!==step.type?{describe:true}:step,s.lesson)+(step.describe&&step.targetName?` → ${step.targetName}`:'');
    const operation=button(row,`${step.symbol?step.symbol+' · ':''}${description}`,()=>{useStep();},!available);operation.className='summary-operation';
    const centre=current?(['rotation','enlargement'].includes(s.mode)?s.lesson.question.centre:null):step.centre;
    if(centre)button(row,`${step.describe?'Demo centre':'Centre'} ${formatPair(centre)}`,()=>{if(useStep())showCoordinates('plot','centre');},!available);
    if(current&&s.imageReady)button(row,`${s.lesson.answerLabel} → use image`,()=>{stopAnimation();if(s.keepImage()){active.readIndex=0;changed();}},!s.canKeepImage);
    root.append(row);
  });
  // A free continuation remains visible after all printed stages, or when a
  // teacher selects a different object to investigate.
  if(s.stepIndex>=s.plan.steps.length||!s.step){const row=document.createElement('div');row.className='summary-row';button(row,s.source.name,()=>showCoordinates('read','source'));const text=document.createElement('span');text.textContent=s.mode;row.append(text);if(['rotation','enlargement'].includes(s.mode))button(row,`Centre ${formatPair(s.lesson.question.centre)}`,()=>showCoordinates('plot','centre'));root.append(row);}
}
function sync(){
  if(!active)return;syncSummary();const s=active.session,l=s.lesson,m=s.mode,busy=!!animation||!!guide,rot=m==='rotation',enl=m==='enlargement',ref=m==='reflection';
  $('demoTitle').textContent=`${s.source.name} · ${active.questionId}`;
  $('sourceObject').replaceChildren(...s.objects.map(o=>{const option=document.createElement('option');option.value=o.id;option.textContent=o.name+(o.image?' · image':'');return option;}));if(s.canKeepImage){const option=document.createElement('option');option.value='@image';option.textContent=`${l.answerLabel} · current image`; $('sourceObject').append(option);}$('sourceObject').value=s.selected;
  $('useImage').disabled=busy||!s.canKeepImage;$('deleteImage').hidden=!s.kept.some(o=>o.id===s.selected);
  document.querySelectorAll('[data-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mode===m)));
  $('stepControls').hidden=!(s.usesConstruction||enl&&!s.polygon&&!l.ready);
  $('demoNext').disabled=busy||(rot&&l.stage>0&&(!l.armReady&&!l.constructionComplete||l.constructionComplete&&!l.constructionMatches));
  $('demoNext').textContent=!l.stage?'Plot centre':rot&&!l.constructionComplete?'Next arm':rot?'Question angle':l.stage===1?'Draw guide':l.stage===2?'Count across':'Count up / down';
  $('demoBack').disabled=busy||!l.stage;
  $('centreControls').hidden=!(rot||enl);if(rot||enl){$('centreX').value=l.question.centre.x;$('centreY').value=l.question.centre.y;}
  $('pickCentre').setAttribute('aria-pressed',String(intent==='centre'));
  $('reflectionControls').hidden=!ref;$('rotationControls').hidden=!(rot&&l.constructionComplete);
  $('enlargementControls').hidden=!(enl&&l.ready);$('scaleControls').hidden=!(enl&&l.mode==='scale');
  const pad=m==='translation'||ref||s.usesConstruction&&!l.constructionComplete||enl&&l.ready&&l.mode==='count';
  $('constructionControls').hidden=!pad;
  document.querySelectorAll('[data-nudge]').forEach(b=>b.disabled=busy||rot&&!l.stage||ref&&!l.choice);
  if(m==='translation'){$('countValue').textContent=`Horizontal ${fmt(l.vector.x)}\nVertical ${fmt(l.vector.y)}`;$('countCaption').textContent='Move the image';}
  if(rot){$('countValue').textContent=`${l.completedArms} / 4`;$('countCaption').textContent='Complete arms';$('rotationSlider').value=l.angle;$('rotationValue').textContent=`${fmt(Math.abs(l.angle))}°${l.angle<0?' clockwise':l.angle>0?' anticlockwise':''}`;document.querySelectorAll('[data-angle]').forEach(b=>{b.disabled=busy;b.setAttribute('aria-pressed',String(+b.dataset.angle===l.angle));});}
  if(ref){$('mirrorEquation').textContent=l.equation||'Choose or draw a line';$('reflectionSlider').disabled=busy||!l.choice;$('reflectionSlider').value=l.progress;$('countValue').textContent='Shift line';$('countCaption').textContent='Drag the end points to tilt';$('mirrorGuides').setAttribute('aria-pressed',String(l.guideVisible));$('drawMirror').setAttribute('aria-pressed',String(intent==='line'));document.querySelectorAll('[data-mirror]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mirror===l.choice?.kind)));}
  if(enl){$('scaleSlider').value=l.factor;$('scaleFactor').value=l.factor;$('countValue').textContent=`Horizontal ${fmt(l.imageCounts.x)}\nVertical ${fmt(l.imageCounts.y)}`;$('countCaption').textContent='Count from the centre';document.querySelectorAll('[data-enlarge]').forEach(b=>{b.hidden=s.polygon&&b.dataset.enlarge==='count';b.setAttribute('aria-pressed',String(b.dataset.enlarge===l.mode));});}
  $('rotationSlider').disabled=busy;$('scaleSlider').disabled=busy;
  $('clockToggle').hidden=!(s.usesConstruction&&l.constructionComplete);$('clockToggle').setAttribute('aria-pressed',String(l.clockVisible));
  $('showCentre').hidden=!(rot||enl);$('showImage').hidden=!s.imageReady;
  for(const id of ['showPoint','showImage','showCentre'])$(id).disabled=busy;
  $('readVertex').hidden=!s.polygon;$('readVertex').replaceChildren(...s.source.points.map((_,i)=>{const option=document.createElement('option');option.value=i;option.textContent=vertexLabel(s,i);return option;}));$('readVertex').value=active.readIndex;
  $('demoStatus').textContent=guide?(guide.point.x===0&&guide.point.y===0?'Origin.':'Follow x, then y.'):intent==='centre'?'Tap the graph to place the centre.':intent==='line'?'Drag on the graph to draw the mirror line.':rot&&!l.stage?'Plot or pick the centre.':s.usesConstruction&&!l.constructionComplete?'Move freely. Next visits the next arm or its unfinished tip.':ref?'Move the line or its handles. Use the lever to flip.':enl&&!l.ready?'Follow the counts from the centre.':'';
}
$('demoNext').onclick=()=>{
  if(!active||animation||guide)return;const s=active.session,l=s.lesson;
  if(!l.stage){showCoordinates('plot');return;}
  if(s.usesConstruction){if(!l.constructionComplete){l.advanceArm();changed();return;}if(l.constructionMatches){animation={graph:active,from:l.angle,to:l.movementDegrees,start:performance.now(),duration:1100};sync();animate();}return;}
  if(s.mode==='enlargement'){
    if(l.stage===1){l.stage=2;changed();return;}
    const axis=l.stage===2?'x':'y',to=l.offset[axis];l.stage=axis==='x'?3:4;l.counting=true;l.countAnimation={source:'given',axis,from:0,to};
    animation={kind:'count',graph:active,axis,from:0,to,start:performance.now(),duration:Math.max(1,Math.ceil(Math.abs(to))*340)};sync();animate();
  }
};
$('demoBack').onclick=()=>{stopAnimation();const s=active.session,l=s.lesson;if(s.usesConstruction){if(l.angle)l.scrub(0);else l.previousConstruction();}else if(s.mode==='enlargement')l.goTo(l.stage-1);changed();};
$('demoReset').onclick=()=>{stopAnimation();active.session.reset();changed();};
function closeDemo(){stopAnimation();$('demoPanel').hidden=true;for(const g of graphs)g.button.setAttribute('aria-pressed','false');active=null;$('questionSummary').hidden=true;save();api.requestDraw(true);}
$('demoClose').onclick=closeDemo;$('demoFit').onclick=()=>fitActive(true);
$('clockToggle').onclick=()=>{active.session.lesson.toggleClock();changed();};
$('showCentre').onclick=()=>showCoordinates('plot');$('showPoint').onclick=()=>showCoordinates('read','source');$('showImage').onclick=()=>showCoordinates('read','image');
$('readVertex').onchange=e=>{active.readIndex=+e.target.value;};
$('sourceObject').onchange=e=>{stopAnimation();if(e.target.value==='@image')active.session.keepImage();else active.session.chooseObject(e.target.value);active.readIndex=0;changed();};
$('useImage').onclick=()=>{stopAnimation();active.session.keepImage();active.readIndex=0;changed();};
$('deleteImage').onclick=()=>{stopAnimation();active.session.deleteSelected();active.readIndex=0;changed();};
document.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>{stopAnimation();active.session.chooseMode(b.dataset.mode);changed();});
const moves={up:['y',1],down:['y',-1],left:['x',-1],right:['x',1]};
function nudge(direction){
  if(!active||animation||guide)return;const s=active.session,l=s.lesson,[axis,delta]=moves[direction];
  if(s.mode==='translation')l.move(axis,delta);else if(s.usesConstruction)l.moveConstruction(axis,delta);
  else if(s.mode==='reflection'){l.shift(axis==='x'?delta:0,axis==='y'?delta:0);active.mirrorChanged=performance.now();}
  else if(s.mode==='enlargement')l.setCount(axis,l.imageCounts[axis]+delta);
  changed();
}
padBinding=bindDirectionPad(document.querySelector('.notebook-pad'),nudge,{interval:180,enabled:()=>!!active&&!clean&&!animation&&!guide&&!$('constructionControls').hidden});
$('demoPanel').addEventListener('keydown',e=>{if(['INPUT','SELECT'].includes(e.target.tagName)||e.target.closest('#mirrorInputPanel'))return;const d={ArrowUp:'up',ArrowDown:'down',ArrowLeft:'left',ArrowRight:'right'}[e.key];if(d){e.preventDefault();nudge(d);}if(e.key==='Escape')closeDemo();});
$('rotationSlider').onpointerdown=()=>{rotationSnap=new RotationSnap(active.session.lesson.angle);};
$('rotationSlider').oninput=e=>{active.session.lesson.scrub(rotationSnap?rotationSnap.move(+e.target.value):+e.target.value);changed();};
$('rotationSlider').onpointerup=$('rotationSlider').onpointercancel=()=>{rotationSnap=null;};
document.querySelectorAll('[data-angle]').forEach(b=>b.onclick=()=>{stopAnimation();active.session.lesson.scrub(+b.dataset.angle);changed();});
document.querySelectorAll('[data-mirror]').forEach(b=>b.onclick=()=>{stopAnimation();active.session.lesson.chooseOrientation(b.dataset.mirror);active.mirrorChanged=performance.now();changed();});
document.querySelectorAll('[data-slope]').forEach(b=>b.onclick=()=>{stopAnimation();active.session.lesson.chooseOrientation('slanted');active.session.lesson.setSlope(+b.dataset.slope);changed();});
const equationInput=bindLineEquationInput($('mirrorInput'),$('mirrorKeys'),applyMirror);
$('enterMirror').onclick=()=>{const open=$('mirrorInputPanel').hidden;stopAnimation();equationInput.setValue(active.session.lesson.equation||'');$('mirrorInputPanel').hidden=!open;$('mirrorError').textContent='';if(open)$('mirrorInput').focus({preventScroll:true});};
function applyMirror(){try{const line=parseMirrorEquation(equationInput.getValue()),b=active.bounds;stopAnimation();active.session.lesson.setHandles(lineHandles(line,{x:(b.xmin+b.xmax)/2,y:(b.ymin+b.ymax)/2},Math.min(3,(b.xmax-b.xmin)/4)));active.mirrorChanged=performance.now();changed();}catch{$('mirrorError').textContent='Use a straight line, such as x = 3 or y = 2x + 1.';}}
$('applyMirror').onclick=applyMirror;
$('mirrorGuides').onclick=()=>{active.session.lesson.toggleGuides();changed();};
$('drawMirror').onclick=()=>{stopAnimation();intent='line';api.setTool('select');sync();};
$('pickCentre').onclick=()=>{stopAnimation();intent='centre';api.setTool('select');sync();};
for(const id of ['centreX','centreY'])$(id).onchange=()=>{stopAnimation();active.session.setCentre({x:+$('centreX').value,y:+$('centreY').value});changed();};
$('reflectionSlider').onpointerdown=()=>{reflectionScrub=new ReflectionScrub(active.session.lesson.progress);};
$('reflectionSlider').oninput=e=>{const n=+e.target.value;active.session.lesson.scrub(reflectionScrub?reflectionScrub.move(n):n);changed();};
function finishReflection(cancel=false){if(!reflectionScrub)return;const l=active.session.lesson,to=cancel?reflectionScrub.start:reflectionScrub.target();reflectionScrub=null;animation={graph:active,from:l.progress,to,start:performance.now(),duration:320};sync();animate();}
$('reflectionSlider').onpointerup=()=>finishReflection();$('reflectionSlider').onpointercancel=()=>finishReflection(true);
document.querySelectorAll('[data-enlarge]').forEach(b=>b.onclick=()=>{stopAnimation();active.session.lesson.setMode(b.dataset.enlarge);changed();});
$('scaleSlider').onpointerdown=()=>{enlargementSnap=new EnlargementSnap(active.session.lesson.factor);};
$('scaleSlider').oninput=e=>{active.session.lesson.scrub(enlargementSnap?enlargementSnap.move(+e.target.value):+e.target.value);changed();};
$('scaleSlider').onpointerup=$('scaleSlider').onpointercancel=()=>{enlargementSnap=null;};
$('scaleFactor').onchange=e=>{active.session.lesson.scrub(+e.target.value);changed();};

// The workspace owns capture, touch cancellation and camera conversion. Demos
// supply only the geometry interaction, leaving pen/eraser/history untouched.
function beginGraphInteraction({point,view}){
  if(!active||animation||guide)return null;
  const g=active,s=g.session,l=s.lesson,p=pageToGraph(g,point),b=g.bounds;
  if(p.x<b.xmin||p.x>b.xmax||p.y<b.ymin||p.y>b.ymax)return null;
  const snap=q=>({x:Math.round(q.x),y:Math.round(q.y)}),tolerance=15/(g.unit*view.zoom),distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  let kind=intent,handle=-1;
  if(!kind&&['rotation','enlargement'].includes(s.mode)&&l.stage&&distance(p,l.question.centre)<tolerance)kind='centre';
  if(!kind&&s.mode==='reflection'&&l.line){handle=l.handles.findIndex(q=>distance(p,q)<tolerance);if(handle>=0)kind='handle';else if(distance(p,lineFoot(p,l.line))<tolerance)kind='mirror';}
  if(kind){
    const placing=intent==='centre',snapshot=s.save(),start=snap(p),handles=l.handles?.map(q=>({...q}));let moved=false;
    const update=world=>{const q=snap(pageToGraph(g,world));if(!placing&&!moved&&distance(pageToGraph(g,world),p)<tolerance/3)return;moved=true;
      if(kind==='centre')s.setCentre(q);else if(kind==='line')l.setHandles([start,q]);else if(kind==='handle')l.setHandles(handles.map((h,i)=>i===handle?q:h));else l.shift(q.x-start.x,q.y-start.y,handles);
      g.mirrorChanged=performance.now();sync();animate();
    };
    if(kind==='centre'&&intent)update(point);
    return {move:update,end(cancel){if(cancel)g.session=new NotebookSession(g,snapshot);else if(kind==='centre'&&!moved&&intent)s.setCentre(start);intent=null;changed();if(!cancel&&kind==='centre'&&!moved&&!placing)showCoordinates('read','centre');}};
  }
  // Tap an existing point to read its coordinates; polygons remain selectable.
  let hit=null;
  if(s.imageReady){const i=s.imagePoints.findIndex(q=>distance(p,q)<tolerance);if(i>=0)hit={kind:'image',index:i};}
  if(!hit){const i=s.source.points.findIndex(q=>distance(p,q)<tolerance);if(i>=0)hit={kind:'source',index:i};}
  if(hit){let moved=false;return {move(q){if(distance(pageToGraph(g,q),p)>tolerance)moved=true;},end(cancel){if(!cancel&&!moved){if(hit.kind==='image'&&s.canKeepImage){s.keepImage();changed();showCoordinates('read','source',hit.index);}else showCoordinates('read',hit.kind,hit.index);}}};}
  if(s.canKeepImage&&s.polygon&&objectHit(p,{points:s.imagePoints},tolerance)){s.keepImage();g.readIndex=0;changed();return {end(){}};}
  const object=[...s.objects].reverse().find(o=>objectHit(p,o,tolerance));
  if(object){s.chooseObject(object.id);g.readIndex=0;changed();return {end(){}};}
  return null;
}
function pageFit(index=currentPage){if(active)closeDemo();currentPage=Math.max(0,Math.min(pages.length-1,index));api.setView(fitPage(api.size.width,api.size.height,pages[currentPage]));}
$('pageFit').onclick=()=>pageFit();$('home').onclick=()=>pageFit();$('zoomvalue').onclick=()=>pageFit();
$('previousPage').onclick=()=>pageFit(currentPage-1);$('nextPage').onclick=()=>pageFit(currentPage+1);$('pagePicker').onchange=e=>pageFit(+e.target.value);
function setClean(value,{focus=false}={}){
  clean=value;$('questionSummary').hidden=clean||!active;document.body.classList.toggle('clean-view',clean);$('showTools').hidden=!clean;$('exitClean').hidden=!clean;
  if(clean){padBinding.stop();calculatorPanel().hide();$('writingDock').append($('tools'),$('historyControls'));}else {document.querySelector('header').prepend($('tools'));$('menu').before($('historyControls'));}$('writingDock').hidden=!clean;$('fullscreen').ariaLabel=full?'Exit full screen':'Full screen';
  if(active&&(focus||!clean))requestAnimationFrame(()=>requestAnimationFrame(()=>fitActive(true)));
}
$('hideTools').onclick=()=>setClean(true);$('showTools').onclick=()=>setClean(false);
async function fullscreen(){if(full){try{if(document.fullscreenElement)await document.exitFullscreen();}catch{}full=false;setClean(false);return;}full=true;try{await document.documentElement.requestFullscreen?.();}catch{}setClean(true,{focus:true});}
$('fullscreen').onclick=fullscreen;$('exitClean').onclick=()=>{if(full)fullscreen();else setClean(false);};
document.addEventListener('fullscreenchange',()=>{if(!document.fullscreenElement){full=false;setClean(false);}});
window.addEventListener('keydown',e=>{if(e.key==='Escape'&&clean&&!document.fullscreenElement){full=false;setClean(false);}});
window.addEventListener('pagehide',()=>{stopAnimation();save();});document.addEventListener('visibilitychange',()=>{if(!document.hidden)animate();else{stopAnimation();save();}});
api.requestDraw(true);animate();
