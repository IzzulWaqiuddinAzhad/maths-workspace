import {transformationText} from './notebook-questions.js';
import {bindLineEquationInput} from './line-equation-input.js';
import {workspaceHost as host} from './workspace-host.js';
import {NOTEBOOK_PAGES,NOTEBOOK_GRAPHS,pageAt,pageToGraph,fitPage,fitQuestion,fitGraph,graphSummaryBounds,rotationFromSlider,rotationToSlider,constrainPage} from './notebook-model.js?v=6';
import {NotebookSession,migrateNotebookDocument} from './notebook-session.js?v=10';
import {paintNotebookGraph,readKey,vertexLabel} from './notebook-render.js?v=12';
import {coordinateGuideDuration} from './module-coordinate-guide.js?v=4';
import {RotationSnap,ReflectionScrub,lineFoot,objectHit,parseMirrorEquation,lineHandles} from './transform-model.js?v=29';
import {EnlargementSnap,squareCountAt} from './module-lesson.js?v=15';
import {bindDirectionPad} from './direction-pad.js?v=2';
import {LabelLayout} from './label-layout.js?v=14';
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
const lengthText=n=>(Math.abs(n-Math.round(n))>1e-8?'≈ ':'')+fmt(n);
const save=()=>{try{localStorage.setItem(LESSONS_KEY,JSON.stringify(Object.fromEntries(graphs.map(g=>[g.id,{...g.session.save(),started:g.started}]))))}catch{$('demoStatus').textContent='Storage is full. Keep this page open to retain the demonstration.';}};
function loadPage(p){
  if(p.image)return;p.image=new Image();p.image.src=new URL(`./notebook-assets/${p.asset}`,import.meta.url);
  p.image.decode().then(()=>{$('pageLoading').hidden=true;api?.requestDraw(true);}).catch(()=>{$('pageLoading').hidden=false;$('pageLoading').textContent='A module page could not load. Reload to try again.';});
}
function visible(p,view,height){return (p.y+p.height)*view.zoom+view.y>=-100&&p.y*view.zoom+view.y<=height+100;}
Object.assign(host,{
  documentKey:DOCUMENT_KEY,preferencesKey:'module-notebook:tools:v1',title:'BIJAK SPM - Transformations',theme:'light',scrollPage:true,hideExplorations:true,
  startupOptions:{shape:'line'},
  defaultOptions:{widths:{ball:1.2,pressure:1.2,pencil:.65},highWidth:10,fontSize:12,touchDraw:false},constrainView:constrainPage,
  resize:({view,old,width,height,saved})=>clean&&active?fitGraph(active,width,height,{bottom:146,top:-50+($('questionSummary')?.offsetHeight??0)}):old.width||saved?view:fitPage(width,height),
  paintBackground(ctx){
    const view=api?.view??fitPage(innerWidth,innerHeight),height=api?.size.height??innerHeight;
    ctx.save();ctx.fillStyle='#fff';
    for(const p of pages)if(visible(p,view,height)){
      loadPage(p);ctx.fillRect(p.x,p.y,p.width,p.height);
      if(p.image.complete&&p.image.naturalWidth)ctx.drawImage(p.image,p.x,p.y,p.width,p.height);
      for(const g of graphs.filter(g=>g.page===p.id-1&&g.started))paintNotebookGraph(ctx,g,{now,active:g===active,guide:guide?.graph===g?guide:null,annotations:api?.store.document.objects??[]});
    }
    ctx.restore();
  },
  afterDraw({view,width,height}){
    currentPage=pageAt(screenToWorld({x:width/2,y:Math.min(height/2,220)},view).y).id-1;
    $('pagePicker').value=String(currentPage);$('previousPage').disabled=!currentPage;$('nextPage').disabled=currentPage===pages.length-1;
    $('questionSummary').hidden=!active;
    positionSummary();document.body.dataset.tool=api.tool;
    if(active&&visible(active,view,height)&&(active.session.findingCentre||active.session.findingEnlargement&&active.session.enlargementFinding.index!==null||active.session.lesson.clockVisible||active.session.lesson.readPoints.centre||active.session.usesConstruction&&active.session.lesson.stage&&!active.session.lesson.constructionComplete))animate();
    for(const g of graphs){
      const a=worldToScreen({x:g.x,y:g.y},view),b=worldToScreen({x:g.x+g.width,y:g.y+g.height},view),image=pages[g.page].image;
      g.button.hidden=!api||!image?.naturalWidth||b.x<12||a.x>width-12||b.y<60||a.y>height-48;
      g.button.style.left=`${Math.max(12,Math.min(width-88,b.x-72))}px`;g.button.style.top=`${Math.max(55,Math.min(height-48,a.y-25))}px`;
    }
  },
  hasInteractionIntent:()=>!!intent,
  toolChanged:()=>{intent=null;if(active)sync();},
  beginInteraction:beginGraphInteraction,
});
for(const p of pages){const o=document.createElement('option');o.value=p.id-1;o.textContent=`${p.id} · ${p.section}`;$('pagePicker').append(o);}
for(const g of graphs){
  const b=document.createElement('button');b.className='demo-anchor';b.hidden=true;b.textContent='▶ Demo';b.ariaLabel=`Demonstrate Question ${g.questionId}${g.id.includes('-')?' graph '+g.id.split('-')[1]:''}`;b.setAttribute('aria-pressed','false');
  b.onclick=()=>openGraph(g);g.button=b;$('demoAnchors').append(b);
}
const summary=document.createElement('section');summary.className='notebook-accessible';summary.ariaLabel='Printed module';summary.textContent='BIJAK SPM PPDMT 2026. 23 pages, 64 questions. Choose a page or scroll. Each Cartesian graph has a Demo button.';document.querySelector('main').append(summary);
const {workspace}=await import('./app.js?v=55');api=workspace;
document.querySelector('header').prepend($('tools'));
$('overlay').setAttribute('aria-label','Module pages. Write with a pen, use one finger to pan, or pinch to zoom. Select to interact with the active graph.');

function stopAnimation(){api?.cancelAction();if(animation?.kind==='pair-line')animation.graph.session.enlargementFinding.finishLine();if(animation?.kind==='centre-distance')animation.graph.session.centreFinding.distanceProgress=1;if(animation?.kind==='centre-test'){animation.graph.session.centreFinding.testDegrees=null;animation.graph.session.centreFinding.testProgress=0;}$('mirrorInputPanel').hidden=true;padBinding?.stop();if(animation?.kind==='count'){const l=animation.graph.session.lesson;l.givenCounts[animation.axis]=animation.from;l.stage=animation.axis==='x'?2:3;l.counting=false;l.countAnimation=null;}animation=null;guide=null;intent=null;}
function animate(){if(!tick&&!document.hidden)tick=requestAnimationFrame(frame);}
function frame(time){
  tick=0;now=time;
  if(animation){
    const a=animation,l=a.graph.session.lesson,p=Math.min(1,(time-a.start)/a.duration);
    if(a.kind==='pair-line')a.graph.session.enlargementFinding.progress=p*p*(3-2*p);
    else if(a.kind==='centre-distance')a.graph.session.centreFinding.distanceProgress=p*p*(3-2*p);
    else if(a.kind==='centre-test')a.graph.session.centreFinding.testProgress=p*p*(3-2*p);
    else if(a.kind==='count')l.givenCounts[a.axis]=squareCountAt(a.from,a.to,time-a.start);
    else l.scrub(a.from+(a.to-a.from)*(p*p*(3-2*p)));
    if(p===1){if(a.kind==='pair-line')a.graph.session.enlargementFinding.finishLine();if(a.kind==='count'){l.givenCounts[a.axis]=a.to;l.counting=false;l.countAnimation=null;}animation=null;if(a.kind==='centre-test')intent='compare-pair';save();sync();}
  }
  if(guide&&time-guide.start>=coordinateGuideDuration(guide.mode,guide.point)){
    const l=guide.graph.session.lesson;if(guide.mode==='plot')l.stage=Math.max(1,l.stage);l.readPoints[guide.key]=true;
    guide=null;save();sync();
  }
  api.requestDraw(true);
  const s=active?.session,l=s?.lesson;
  const inView=active&&visible(active,api.view,api.size.height);
  if(animation||guide||inView&&(s?.findingCentre||s?.findingEnlargement&&s.enlargementFinding.index!==null||l?.clockVisible||l?.readPoints.centre||s?.usesConstruction&&l.stage&&!l.constructionComplete||time-(active.mirrorChanged||0)<900))animate();
}
function showCoordinates(mode,kind='source',index=active?.readIndex??0){
  if(!active)return;stopAnimation();const s=active.session,l=s.lesson;
  if(kind==='image'&&!s.imageReady)return;
  const centre=mode==='plot'||kind==='centre';
  guide={graph:active,mode,key:centre?'centre':readKey(kind,index),point:centre?l.question.centre:kind==='image'?s.imagePoints[index]:s.source.points[index],label:centre?'Centre':vertexLabel(s,index,kind==='image'),start:performance.now()};
  sync();animate();
}
function centrePairIntent(f){return f.chosen?'compare-pair':f.phase==='pair'||f.phase==='meet'&&f.path.length===1?'find-pair':null;}
function openGraph(g){stopAnimation();active=g;if(g.session.findingEnlargement)intent='enlargement-pair';else if(g.session.findingCentre)intent=centrePairIntent(g.session.centreFinding);g.started=true;g.readIndex=0;$('demoPanel').hidden=false;for(const a of graphs)a.button.setAttribute('aria-pressed',String(a===g));sync();fitActive(true);animate();}
function positionSummary(){
  const root=$('questionSummary');if(!active||root.hidden)return;
  const {width,height}=api.size,b=graphSummaryBounds(active,api.view,width,height,root.offsetHeight);
  root.style.left=`${b.left}px`;root.style.width=`${b.width}px`;root.style.top=`${b.top}px`;
  root.style.visibility='visible';
}
function fitActive(closer=false){
  if(!active)return;const {width,height}=api.size,bottom=width<=700&&!clean?Math.min(height*.48,$('demoPanel').offsetHeight)+66:clean?146:0;
  // A second measurement accounts for wrapping at the graph's fitted width.
  for(let pass=0;pass<2;pass++){
    positionSummary();
    api.setView((closer||clean?fitGraph:fitQuestion)(active,width,height,{right:width>700&&!clean?290:0,bottom,top:(clean?-62:0)+($('questionSummary').hidden?0:$('questionSummary').offsetHeight+12)}));
  }
  positionSummary();
}
function changed(){save();sync();api.requestDraw(true);animate();}
function syncSummary(){
  const s=active.session,root=$('questionSummary');root.hidden=false;root.replaceChildren();
  const heading=document.createElement('div');heading.className='summary-heading';
  const title=document.createElement('strong');title.textContent=`Question ${active.questionId}`;heading.append(title);
  if(s.plans.length>1){const picker=document.createElement('select');picker.ariaLabel='Question part';s.plans.forEach((plan,i)=>{const option=document.createElement('option');option.value=i;option.textContent=plan.label;picker.append(option);});picker.value=s.planIndex;picker.onchange=()=>{stopAnimation();s.choosePlan(+picker.value);if(s.findingEnlargement)intent='enlargement-pair';active.readIndex=0;changed();fitActive();};heading.append(picker);}
  else if(s.plan.label){const label=document.createElement('span');label.textContent=s.plan.label;heading.append(label);}
  root.append(heading);
  const button=(row,text,action,disabled=false)=>{const b=document.createElement('button');b.type='button';b.textContent=text;b.disabled=disabled;b.onclick=action;row.append(b);return b;};
  if(s.findingEnlargement){
    const f=s.enlargementFinding,row=document.createElement('div');row.className='summary-row';
    button(row,`${f.objects[0].name} → ${f.objects[1].name}`,selectEnlargementPair);
    const title=document.createElement('span');title.textContent='Find centre';row.append(title);button(row,'Add line',addPairLine,!!animation||!f.canAddLine);button(row,f.centreVisible?'Hide centre':'Reveal centre',revealEnlargementCentre,!!animation||!f.canRevealCentre);root.append(row);
    const instruction=document.createElement('p');instruction.className='summary-construction';instruction.textContent=enlargementInstruction(f);root.append(instruction);return;
  }
  if(s.findingCentre){
    const row=document.createElement('div');row.className='summary-row';
    button(row,`${s.centreFinding.objects[0].name} → ${s.centreFinding.objects[1].name}`,()=>selectCentrePair());
    const title=document.createElement('span');title.textContent='Find centre';row.append(title);if(s.centreFinding.chosen)button(row,distanceButtonText(s.centreFinding),advanceDistance,!!animation);root.append(row);
    const instruction=document.createElement('p');instruction.className='summary-construction';instruction.textContent=distanceText(s.centreFinding)||centreInstruction(s.centreFinding);root.append(instruction);return;
  }
  s.plan.steps.forEach((step,i)=>{
    const row=document.createElement('div');row.className='summary-row';row.setAttribute('data-active',String(i===s.stepIndex));
    if(s.plan.steps.length>1){const n=document.createElement('span');n.className='summary-order';n.textContent=i+1;row.append(n);}
    const current=i===s.stepIndex,available=!!s.sourceForStep(i)||i===s.stepIndex+1&&s.canKeepImage;
    const useStep=()=>{stopAnimation();if(!current&&!s.activateStep(i))return false;active.readIndex=0;changed();return true;};
    button(row,current?s.source.name:step.sourceName,()=>{if(useStep())showCoordinates('read','source');},!available);
    const description=transformationText(current&&step.type&&s.mode!==step.type?{describe:true}:step,s.lesson)+(step.describe&&step.targetName?` → ${step.targetName}`:'');
    const operation=button(row,`${step.symbol?step.symbol+' · ':''}${description}`,()=>{useStep();},!available);operation.className='summary-operation';
    const centre=current?(['rotation','enlargement'].includes(s.mode)?s.lesson.question.centre:null):step.centre;
    if(centre&&(!s.centreFinding||s.trialVisible))button(row,'Centre',()=>{if(useStep())showCoordinates('plot','centre');},!available);
    if(current&&s.imageReady&&(!s.centreFinding||s.trialVisible))button(row,`${s.lesson.answerLabel} → use image`,()=>{stopAnimation();if(s.keepImage()){active.readIndex=0;changed();}},!s.canKeepImage);
    root.append(row);
  });
  // A free continuation remains visible after all printed stages, or when a
  // teacher selects a different object to investigate.
  if(s.stepIndex>=s.plan.steps.length||!s.step){const row=document.createElement('div');row.className='summary-row';button(row,s.source.name,()=>showCoordinates('read','source'));const text=document.createElement('span');text.textContent=s.mode;row.append(text);if(['rotation','enlargement'].includes(s.mode))button(row,'Centre',()=>showCoordinates('plot','centre'));root.append(row);}
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
  if(rot){$('countValue').textContent=`${l.completedArms} / 4`;$('countCaption').textContent='Complete arms';$('rotationSlider').value=rotationToSlider(l.angle);$('rotationValue').textContent=`${fmt(Math.abs(l.angle))}°${l.angle<0?' clockwise':l.angle>0?' anticlockwise':''}`;$('rotationSlider').setAttribute('aria-valuetext',$('rotationValue').textContent);document.querySelectorAll('[data-angle]').forEach(b=>{b.disabled=busy;b.setAttribute('aria-pressed',String(+b.dataset.angle===l.angle));});}
  if(ref){$('mirrorEquation').textContent=l.equation||'Choose or draw a line';$('reflectionSlider').disabled=busy||!l.choice;$('reflectionSlider').value=l.progress;$('countValue').textContent='Shift line';$('countCaption').textContent='Drag the end points to tilt';$('mirrorGuides').setAttribute('aria-pressed',String(l.guideVisible));$('drawMirror').setAttribute('aria-pressed',String(intent==='line'));document.querySelectorAll('[data-mirror]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mirror===l.choice?.kind)));}
  if(enl){$('scaleSlider').value=l.factor;$('scaleFactor').value=l.factor;$('countValue').textContent=`Horizontal ${fmt(l.imageCounts.x)}\nVertical ${fmt(l.imageCounts.y)}`;$('countCaption').textContent='Count from the centre';document.querySelectorAll('[data-enlarge]').forEach(b=>{b.hidden=s.polygon&&b.dataset.enlarge==='count';b.setAttribute('aria-pressed',String(b.dataset.enlarge===l.mode));});}
  $('rotationSlider').disabled=busy;$('scaleSlider').disabled=busy;
  $('clockToggle').hidden=!(s.usesConstruction&&l.constructionComplete);$('clockToggle').setAttribute('aria-pressed',String(l.clockVisible));
  $('showPoint').hidden=false;$('showCentre').hidden=!(rot||enl);$('showImage').hidden=!s.imageReady;
  for(const id of ['showPoint','showImage','showCentre'])$(id).disabled=busy;
  $('readVertex').hidden=!s.polygon;$('readVertex').replaceChildren(...s.source.points.map((_,i)=>{const option=document.createElement('option');option.value=i;option.textContent=vertexLabel(s,i);return option;}));$('readVertex').value=active.readIndex;
  $('demoStatus').textContent=guide?(guide.point.x===0&&guide.point.y===0?'Origin.':'Follow x, then y.'):intent==='centre'?'Tap the graph to place the centre.':intent==='line'?'Drag on the graph to draw the mirror line.':rot&&!l.stage?'Plot or pick the centre.':s.usesConstruction&&!l.constructionComplete?'Move freely. Next visits the next arm or its unfinished tip.':ref?'Move the line or its handles. Use the lever to flip.':enl&&!l.ready?'Follow the counts from the centre.':'';
  syncCentreFinding(busy);syncEnlargementFinding(busy);
}
function enlargementInstruction(f){
  if(f.centreVisible&&f.centre)return `Centre (${fmt(f.centre.x)}, ${fmt(f.centre.y)}). The added lines meet here.`;
  if(f.index===null)return 'Tap a vertex. Its matching vertex will pulse too.';
  if(!f.distinctPair(f.index))return 'These vertices coincide. Choose another pair to draw a line.';
  if(f.drawingIndex!==null)return 'Drawing through the matching vertices…';
  if(f.lines.includes(f.index))return f.canRevealCentre?'The lines intersect. Press Reveal centre when ready.':f.lines.length<2?'Line added. Tap another vertex, then Add line.':'These lines do not give a unique intersection. Add a line through another pair.';
  return 'Matching pair selected. Press Add line to join and extend through them.';
}
function syncEnlargementFinding(busy){
  const s=active.session,f=s.enlargementFinding,finding=s.findingEnlargement;
  $('enlargementStudy').hidden=!f||s.mode!=='enlargement';$('enlargementFindingControls').hidden=!finding;
  $('freeEnlargement').setAttribute('aria-pressed',String(!finding));$('findEnlargement').setAttribute('aria-pressed',String(finding));
  if(!finding)return;
  $('demoTitle').textContent=`${f.objects[0].name} → ${f.objects[1].name} · ${active.questionId}`;
  for(const id of ['objectControls','stepControls','centreControls','reflectionControls','rotationControls','enlargementControls','constructionControls','readVertex','showCentre','showPoint','showImage','clockToggle'])$(id).hidden=true;
  document.querySelector('.transformation-types').hidden=false;
  $('chooseEnlargementPair').disabled=busy;$('chooseEnlargementPair').setAttribute('aria-pressed',String(intent==='enlargement-pair'));
  $('revealEnlargementCentre').disabled=busy||!f.canRevealCentre;$('revealEnlargementCentre').textContent=f.centreVisible?'Hide centre':'Reveal centre';
  $('addPairLine').disabled=busy||!f.canAddLine;$('undoPairLine').disabled=busy||!f.lines.length;
  $('demoStatus').textContent=enlargementInstruction(f);
}
function revealEnlargementCentre(){const f=active.session.enlargementFinding;if(animation||!f.canRevealCentre)return;if(f.centreVisible)f.centreVisible=false;else f.revealCentre();changed();}
$('revealEnlargementCentre').onclick=revealEnlargementCentre;
function selectEnlargementPair(){stopAnimation();intent='enlargement-pair';sync();animate();}
function addPairLine(){
  const f=active.session.enlargementFinding;if(animation||!f?.canAddLine)return;
  stopAnimation();if(!f.addLine())return;intent='enlargement-pair';animation={kind:'pair-line',graph:active,start:performance.now(),duration:1100};changed();
}
$('chooseEnlargementPair').onclick=selectEnlargementPair;$('addPairLine').onclick=addPairLine;
$('findEnlargement').onclick=()=>{stopAnimation();const s=active.session;s.enlargementStudyEnabled=true;intent='enlargement-pair';changed();fitActive(true);};
$('freeEnlargement').onclick=()=>{stopAnimation();active.session.enlargementStudyEnabled=false;changed();};
$('undoPairLine').onclick=()=>{stopAnimation();active.session.enlargementFinding.undoLine();intent='enlargement-pair';changed();};
function distanceText(f){
  const [a,b]=f.distanceFractions;if(a<1)return '';
  const first=`${f.objects[0].labels?.[f.compareIndex]||f.objects[0].name+(f.compareIndex+1)}: ${lengthText(f.distances[0])} units`;
  return b<1?first:`${first} · ${f.objects[1].labels?.[f.compareIndex]||f.objects[1].name+(f.compareIndex+1)}: ${lengthText(f.distances[1])} units\n${f.equalDistances?'Equal distances. Check the whole polygon too.':'Unequal distances: this centre cannot work.'}`;
}
function distanceButtonText(f){return !f.distancesVisible?'Read pair':f.distanceStage===1?'Next: first distance':f.distanceStage===2?'Next: matching distance':'Replay pair';}
function centreInstruction(f){
  if(f.phase==='pair')return 'Tap a vertex on either polygon. Its matching vertex will pulse too.';
  if(intent==='find-pair')return 'Tap another vertex, or start moving with the game pad.';
  if(f.phase==='meet')return f.met?'The tips meet at M. Next: complete the other two arms.':'Move the pulsing tips towards each other with the game pad.';
  if(f.phase==='arms')return f.armsReady?'Four arms complete. Next: check the possible centres.':'From M, repeat the lengths turned through 90°. The two tips move oppositely.';
  if(!f.chosen)return 'Choose M for 180°, or C₁ / C₂ for 90°. Then check another vertex pair.';
  return f.distancesVisible?(f.distanceStage===1?'The matching pair is pulsing. Next: draw the first distance.':f.distanceStage===2?'Next: draw the distance to the matching vertex.':'Tap another vertex to compare a new pair.'):`Tap a vertex to compare its two distances from ${f.chosen.name}.`;
}
function syncCentreFinding(busy){
  const s=active.session,f=s.centreFinding,finding=!!f&&s.findingCentre;
  $('centreStudy').hidden=!f||s.mode!=='rotation';$('findingControls').hidden=!finding;
  $('freeRotation').setAttribute('aria-pressed',String(!finding));$('findCentre').setAttribute('aria-pressed',String(finding));
  $('hideTrial').hidden=finding;$('hideTrial').textContent=s.trialVisible?'Hide trial':'Show trial';
  $('objectControls').hidden=finding;document.querySelector('.transformation-types').hidden=finding;
  if(!finding){document.querySelectorAll('[data-nudge]').forEach(b=>b.ariaLabel=`Move one square ${b.dataset.nudge}`);return;}
  for(const id of ['stepControls','centreControls','reflectionControls','rotationControls','enlargementControls','readVertex','showCentre','showPoint','showImage','clockToggle'])$(id).hidden=true;
  $('candidateControls').hidden=f.phase!=='check';$('candidateCheck').hidden=!f.chosen;
  $('centreStepControls').hidden=!['meet','arms'].includes(f.phase);
  $('centreNext').disabled=busy||!f.canNext;$('centreNext').textContent=f.phase==='meet'?'Next arms':'Check centres';
  $('centreUndo').disabled=busy||f.phase==='pair'||f.phase==='meet'&&f.path.length<=1;
  $('choosePair').disabled=busy;$('choosePair').setAttribute('aria-pressed',String(['find-pair','compare-pair'].includes(intent)));
  $('constructionControls').hidden=!['meet','arms'].includes(f.phase);
  document.querySelectorAll('[data-nudge]').forEach(b=>{b.disabled=busy;b.ariaLabel=`Move ${f.step===.5?'half a square':'one square'} ${b.dataset.nudge}`;});
  document.querySelectorAll('[data-centre-step]').forEach(b=>{b.disabled=busy;b.setAttribute('aria-pressed',String(+b.dataset.centreStep===f.step));});
  document.querySelectorAll('[data-candidate]').forEach(b=>{b.disabled=busy;b.setAttribute('aria-pressed',String(b.dataset.candidate===f.candidate));const c=f.candidates.find(c=>c.id===b.dataset.candidate),p=c?.point,bounds=active.bounds;const outside=p&&(p.x<bounds.xmin||p.x>bounds.xmax||p.y<bounds.ymin||p.y>bounds.ymax);b.textContent=`${c?.name??b.dataset.candidate} · ${b.dataset.candidate==='midpoint'?'180°':'90°'}${outside?' · beyond grid':''}`;});
  const c=f.cursor,start=f.phase==='meet'?f.a:f.midpoint;
  $('countValue').textContent=c&&start?`Horizontal ${fmt(c.x-start.x)}\nVertical ${fmt(c.y-start.y)}`:'';
  const h=f.index===null?null:{x:Math.abs(f.a.x-f.midpoint.x),y:Math.abs(f.a.y-f.midpoint.y)};
  $('countCaption').textContent=f.phase==='arms'?`Turn the first lengths: ${fmt(h.x)} and ${fmt(h.y)}`:'Move both tips';
  $('comparePair').replaceChildren(...f.source.map((_,i)=>{const o=document.createElement('option');o.value=i;o.textContent=`${f.objects[0].labels?.[i]||f.objects[0].name+(i+1)} ↔ ${f.objects[1].labels?.[i]||f.objects[1].name+(i+1)}${i===f.index?' · first pair':''}`;return o;}));
  $('comparePair').value=f.compareIndex;$('comparePair').disabled=busy;$('compareDistances').disabled=busy;
  $('compareDistances').textContent=distanceButtonText(f);
  document.querySelectorAll('[data-centre-test]').forEach(b=>{b.disabled=busy;b.hidden=f.candidate==='midpoint'?+b.dataset.centreTest!==180:+b.dataset.centreTest===180;b.setAttribute('aria-pressed',String(+b.dataset.centreTest===f.testDegrees));});
  $('distanceResult').textContent=distanceText(f);
  $('centreTestResult').textContent=f.testDegrees===null?'':busy?'Rotating…':f.testMatches?'Every corresponding vertex matches.':'The whole polygon does not match. Try another centre or direction.';
  $('hideCentreTest').hidden=f.testDegrees===null;$('hideCentreTest').disabled=busy;
  $('demoStatus').textContent=centreInstruction(f);
}
function selectCentrePair(){stopAnimation();intent=active.session.centreFinding.chosen?'compare-pair':'find-pair';sync();animate();}
$('findCentre').onclick=()=>{stopAnimation();active.session.findingCentre=true;const f=active.session.centreFinding;active.session.chooseObject(f.objects[0].id);intent=centrePairIntent(f);changed();fitActive(true);};
$('freeRotation').onclick=()=>{stopAnimation();active.session.findingCentre=false;active.session.trialVisible=true;changed();fitActive(true);};
$('hideTrial').onclick=()=>{stopAnimation();active.session.trialVisible=!active.session.trialVisible;changed();};
$('choosePair').onclick=selectCentrePair;
$('centreNext').onclick=()=>{stopAnimation();active.session.centreFinding.next();changed();};
$('centreUndo').onclick=()=>{stopAnimation();active.session.centreFinding.undo();changed();};
document.querySelectorAll('[data-centre-step]').forEach(b=>b.onclick=()=>{padBinding.stop();intent=null;active.session.centreFinding.step=+b.dataset.centreStep;changed();});
document.querySelectorAll('[data-candidate]').forEach(b=>b.onclick=()=>{stopAnimation();active.session.centreFinding.chooseCandidate(b.dataset.candidate);intent='compare-pair';changed();});
function readDistancePair(index){stopAnimation();active.session.centreFinding.compare(index);intent='compare-pair';changed();}
$('comparePair').onchange=e=>readDistancePair(+e.target.value);
function advanceDistance(){const f=active.session.centreFinding;stopAnimation();intent='compare-pair';if(!f.distancesVisible)f.compare(+$('comparePair').value);else if(f.nextDistance())animation={kind:'centre-distance',graph:active,start:performance.now(),duration:850};changed();}
$('compareDistances').onclick=advanceDistance;
document.querySelectorAll('[data-centre-test]').forEach(b=>b.onclick=()=>{stopAnimation();if(!active.session.centreFinding.startTest(+b.dataset.centreTest))return;animation={kind:'centre-test',graph:active,start:performance.now(),duration:1600};sync();animate();});
$('hideCentreTest').onclick=()=>{stopAnimation();active.session.centreFinding.testDegrees=null;intent='compare-pair';changed();};

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
$('demoReset').onclick=()=>{stopAnimation();if(active.session.findingEnlargement){active.session.enlargementFinding.reset();intent='enlargement-pair';}else if(active.session.findingCentre){active.session.centreFinding.reset();intent='find-pair';}else active.session.reset();changed();};
function closeDemo(){stopAnimation();$('demoPanel').hidden=true;for(const g of graphs)g.button.setAttribute('aria-pressed','false');active=null;$('questionSummary').hidden=true;save();api.requestDraw(true);}
$('demoClose').onclick=closeDemo;$('demoFit').onclick=()=>fitActive(true);
$('clockToggle').onclick=()=>{active.session.lesson.toggleClock();changed();};
$('showCentre').onclick=()=>showCoordinates('plot');$('showPoint').onclick=()=>showCoordinates('read','source');$('showImage').onclick=()=>showCoordinates('read','image');
$('readVertex').onchange=e=>{active.readIndex=+e.target.value;};
$('sourceObject').onchange=e=>{stopAnimation();if(e.target.value==='@image')active.session.keepImage();else active.session.chooseObject(e.target.value);active.readIndex=0;changed();};
$('useImage').onclick=()=>{stopAnimation();active.session.keepImage();active.readIndex=0;changed();};
$('deleteImage').onclick=()=>{stopAnimation();active.session.deleteSelected();active.readIndex=0;changed();};
document.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>{stopAnimation();active.session.chooseMode(b.dataset.mode);if(active.session.findingEnlargement)intent='enlargement-pair';changed();});
const moves={up:['y',1],down:['y',-1],left:['x',-1],right:['x',1]};
function nudge(direction){
  if(!active||animation||guide)return;const s=active.session,l=s.lesson,[axis,delta]=moves[direction];
  if(s.findingCentre){intent=null;s.centreFinding.move(axis,delta);}else if(s.mode==='translation')l.move(axis,delta);else if(s.usesConstruction)l.moveConstruction(axis,delta);
  else if(s.mode==='reflection'){l.shift(axis==='x'?delta:0,axis==='y'?delta:0);active.mirrorChanged=performance.now();}
  else if(s.mode==='enlargement')l.setCount(axis,l.imageCounts[axis]+delta);
  changed();
}
padBinding=bindDirectionPad(document.querySelector('.notebook-pad'),nudge,{interval:180,enabled:()=>!!active&&!clean&&!animation&&!guide&&!$('constructionControls').hidden});
$('demoPanel').addEventListener('keydown',e=>{if(['INPUT','SELECT'].includes(e.target.tagName)||e.target.closest('#mirrorInputPanel'))return;const d={ArrowUp:'up',ArrowDown:'down',ArrowLeft:'left',ArrowRight:'right'}[e.key];if(d){e.preventDefault();nudge(d);}if(e.key==='Escape')closeDemo();});
$('rotationSlider').onpointerdown=()=>{rotationSnap=new RotationSnap(active.session.lesson.angle);};
$('rotationSlider').oninput=e=>{active.session.lesson.scrub(rotationSnap?rotationSnap.move(rotationFromSlider(e.target.value)):rotationFromSlider(e.target.value));changed();};
$('rotationSlider').onpointerup=$('rotationSlider').onpointercancel=()=>{rotationSnap=null;};
document.querySelectorAll('[data-angle]').forEach(b=>b.onclick=()=>{stopAnimation();active.session.lesson.scrub(+b.dataset.angle);changed();});
document.querySelectorAll('[data-mirror]').forEach(b=>b.onclick=()=>{stopAnimation();active.session.lesson.chooseOrientation(b.dataset.mirror);active.mirrorChanged=performance.now();changed();});
document.querySelectorAll('[data-slope]').forEach(b=>b.onclick=()=>{stopAnimation();active.session.lesson.chooseOrientation('slanted');active.session.lesson.setSlope(+b.dataset.slope);changed();});
const equationInput=bindLineEquationInput($('mirrorInput'),$('mirrorKeys'),applyMirror);
$('enterMirror').onclick=()=>{const open=$('mirrorInputPanel').hidden;stopAnimation();equationInput.setValue(active.session.lesson.equation||'');$('mirrorInputPanel').hidden=!open;$('mirrorError').textContent='';if(open)$('mirrorInput').focus({preventScroll:true});};
function applyMirror(){try{const line=parseMirrorEquation(equationInput.getValue()),b=active.bounds;stopAnimation();active.session.lesson.setHandles(lineHandles(line,{x:(b.xmin+b.xmax)/2,y:(b.ymin+b.ymax)/2},Math.min(3,(b.xmax-b.xmin)/4)));active.mirrorChanged=performance.now();changed();}catch{$('mirrorError').textContent='Use a straight line, such as x = 3 or y = 2x + 1.';}}
$('applyMirror').onclick=applyMirror;
$('mirrorGuides').onclick=()=>{active.session.lesson.toggleGuides();changed();};
$('drawMirror').onclick=()=>{stopAnimation();intent='line';sync();};
$('pickCentre').onclick=()=>{stopAnimation();intent='centre';sync();};
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
  if(!active||animation&&!['centre-distance','pair-line'].includes(animation.kind)||guide)return null;
  const g=active,s=g.session,l=s.lesson,p=pageToGraph(g,point),b=g.bounds;
  if(p.x<b.xmin||p.x>b.xmax||p.y<b.ymin||p.y>b.ymax)return intent?{end(){}}:null;
  const snap=q=>({x:Math.round(q.x),y:Math.round(q.y)}),tolerance=15/(g.unit*view.zoom),distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  if(s.findingEnlargement){
    const f=s.enlargementFinding;
    if(intent==='enlargement-pair'||api.tool==='select')for(const o of f.objects){
      const index=o.points.findIndex(q=>distance(p,q)<tolerance);if(index<0)continue;
      let moved=false;return {move(q){if(distance(pageToGraph(g,q),p)>tolerance)moved=true;},end(cancel){if(cancel||moved)return;stopAnimation();f.selectPair(index);intent='enlargement-pair';changed();}};
    }
    return intent?{end(){}}:null;
  }
  if(s.findingCentre){
    const f=s.centreFinding;
    let pairHit=null,candidateHit=null;
    if(['find-pair','compare-pair'].includes(intent)||api.tool==='select'&&(f.phase==='pair'||f.chosen))for(let side=0;side<2;side++){
      const index=f.objects[side].points.findIndex(q=>distance(p,q)<tolerance);if(index>=0){pairHit={side,index};break;}
    }
    if(!intent&&f.phase==='check'&&api.tool==='select')candidateHit=f.candidates.find(c=>distance(p,c.point)<tolerance);
    if(pairHit||candidateHit){let moved=false;return {move(q){if(distance(pageToGraph(g,q),p)>tolerance)moved=true;},end(cancel){if(cancel||moved)return;
      if(pairHit){if(f.chosen&&intent!=='find-pair'){readDistancePair(pairHit.index);return;}if(!f.selectPair(pairHit.index,pairHit.side)){$('demoStatus').textContent='That vertex stays fixed. Choose another pair.';return;}intent='find-pair';}
      else {f.chooseCandidate(candidateHit.id);intent='compare-pair';}changed();
    }};}
    return intent?{end(){}}:null;
  }
  if(s.centreFinding&&s.mode==='rotation'&&!s.trialVisible)return null;
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
  clean=value;$('questionSummary').hidden=!active;document.body.classList.toggle('clean-view',clean);$('showTools').hidden=!clean;$('exitClean').hidden=!clean;
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
