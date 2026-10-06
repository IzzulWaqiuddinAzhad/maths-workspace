import {workspaceHost as host} from './workspace-host.js';
import {MODULE_PAGE,PAGE_GRAPHS,graphToPage,fitPage,fitQuestion,fitGraph,constrainPage,saveLesson,restoreLesson} from './notebook-model.js';
import {paintRotationLesson} from './module-rotation-render.js?v=7';
import {paintCoordinateGuide,COORDINATE_GUIDE_DURATION} from './module-coordinate-guide.js?v=1';
import {LabelLayout} from './label-layout.js?v=13';
import {calculatorPanel} from './calculator-panel.js?v=13';
import {worldToScreen} from './core.js?v=14';

const $=id=>document.getElementById(id),LESSONS_KEY='module-notebook:a3:lessons:v1';
let stored={};try{stored=JSON.parse(localStorage.getItem(LESSONS_KEY))??{}}catch{}
const graphs=PAGE_GRAPHS.map(g=>({...g,lesson:restoreLesson(g.question,stored[g.id]),layout:new LabelLayout()}));
const page=new Image();page.src=new URL('./notebook-assets/rotation-a3.svg',import.meta.url);
let api,active=null,animation=null,guide=null,tick=0,now=0,clean=false,full=false;
const fmt=n=>String(Number(n.toFixed(2))).replace('-','−');
const coordinates=p=>`(${fmt(p.x)}, ${fmt(p.y)})`;
const save=()=>{try{localStorage.setItem(LESSONS_KEY,JSON.stringify(Object.fromEntries(graphs.map(g=>[g.id,saveLesson(g.lesson)]))))}catch{$('demoStatus').textContent='Storage is full. Keep this page open to retain the demonstration.';}};

Object.assign(host,{
  documentKey:'module-notebook:a3:document:v1',preferencesKey:'module-notebook:tools:v1',
  title:'BIJAK SPM - Putaran 90',theme:'light',scrollPage:true,hideExplorations:true,
  defaultOptions:{widths:{ball:1.2,pressure:1.2,pencil:.65},highWidth:10,fontSize:12,touchDraw:false},
  constrainView:constrainPage,
  resize:({view,old,width,height,saved})=>old.width||saved?view:fitPage(width,height),
  paintBackground(ctx){
    ctx.save();ctx.fillStyle='#fff';ctx.shadowColor='#17243d24';ctx.shadowBlur=10;
    ctx.fillRect(0,0,MODULE_PAGE.width,MODULE_PAGE.height);ctx.shadowBlur=0;
    if(page.complete&&page.naturalWidth)ctx.drawImage(page,0,0,MODULE_PAGE.width,MODULE_PAGE.height);
    // Demos are painted below annotations and never become erasable objects.
    for(const g of graphs)paintGraph(ctx,g);
    ctx.restore();
  },
  afterDraw({view,width,height}){
    for(const g of graphs){
      const p=worldToScreen({x:g.x+g.size,y:g.y-25},view);
      g.button.hidden=!api||!page.complete||!page.naturalWidth||p.x<0||p.x>width+50||p.y<55||p.y>height-48;
      g.button.style.left=`${p.x-72}px`;g.button.style.top=`${p.y}px`;
    }
  },
});

function paintGraph(ctx,g){
  const l=g.lesson,scale=g.unit/40,view={x:320,y:320,zoom:1};
  ctx.save();ctx.beginPath();ctx.rect(g.x-18,g.y-16,g.size+38,g.size+37);ctx.clip();
  ctx.translate(g.x,g.y);ctx.scale(scale,scale);
  paintRotationLesson(ctx,{lesson:l,view,dark:false,width:640,height:724,clockTime:now,countLabels:g.layout});
  const point=(p,label,colour)=>{
    const x=320+p.x*40,y=320-p.y*40;
    ctx.beginPath();ctx.arc(x,y,5.5,0,Math.PI*2);ctx.fillStyle=colour;ctx.fill();
    ctx.font='600 22px Georgia';ctx.textAlign='left';ctx.textBaseline='middle';
    const textWidth=ctx.measureText(label).width,tx=Math.max(2,Math.min(638-textWidth,x+13)),ty=y>585?y-26:y+28;
    ctx.strokeStyle='#fff';ctx.lineWidth=5;ctx.strokeText(label,tx,ty);ctx.fillText(label,tx,ty);
  };
  if(l.stage)point(g.question.centre,'', '#c23246');
  if(l.constructionComplete&&l.angle!==0){
    const p=l.pointAt(),label=g.question.label+'′'+(l.answerVisible?' '+coordinates(p):'');
    point(p,label,'#2468c4');
  }
  if(guide?.graph===g)paintCoordinateGuide(ctx,{...guide,elapsed:now-guide.start,view,dark:false,width:640,height:724,pointColour:guide.mode==='plot'?'#c23246':'#2468c4'});
  ctx.restore();
}

const summary=document.createElement('section');summary.className='notebook-accessible';summary.ariaLabel='Printed module questions';summary.textContent=graphs.map(g=>`Question ${g.id}. ${g.question.label} ${coordinates(g.question.given)}. ${g.question.prompt.en}`).join(' ');document.querySelector('main').append(summary);
for(const g of graphs){
  const b=document.createElement('button');b.className='demo-anchor';b.hidden=true;b.textContent='▶ Demo';b.ariaLabel=`Demonstrate Question ${g.id}`;b.setAttribute('aria-pressed','false');
  b.onclick=()=>openGraph(g);g.button=b;$('demoAnchors').append(b);
}
// Keep the same tools and dialogs; only their placement changes in the host.
const {workspace}=await import('./app.js?v=52');api=workspace;
document.querySelector('header').prepend($('tools'));
$('overlay').setAttribute('aria-label','Module page. Write with a pen, use one finger to pan, or pinch to zoom.');

page.decode().then(()=>{$('pageLoading').hidden=true;api.requestDraw(true);}).catch(()=>{$('pageLoading').textContent='The module could not load. Reload this page to try again.';});

function stopAnimation(){
  if(animation?.kind==='count'){
    const l=animation.graph.lesson;l.buildCounts[animation.index]=Math.round(l.buildCounts[animation.index]);l.counting=false;l.countAnimation=null;
  }
  if(animation?.kind==='rotate')animation.graph.lesson.scrub(animation.graph.lesson.progress);
  animation=null;guide=null;
}
function animate(){
  if(tick)return;tick=requestAnimationFrame(frame);
}
function frame(time){
  tick=0;now=time;
  if(animation){
    const a=animation,l=a.graph.lesson,p=Math.min(1,(time-a.start)/a.duration);
    if(a.kind==='count')l.buildCounts[a.index]=a.from+(a.to-a.from)*p;
    else l.progress=a.from+(a.to-a.from)*(p*p*(3-2*p));
    if(p===1){
      if(a.kind==='count'){l.buildCounts[a.index]=a.to;l.counting=false;l.countAnimation=null;}
      else l.scrub(a.to);
      animation=null;save();sync();
    }
  }
  if(guide&&time-guide.start>=COORDINATE_GUIDE_DURATION){if(guide.mode==='plot')guide.graph.lesson.stage=Math.max(1,guide.graph.lesson.stage);guide=null;save();sync();}
  api.requestDraw(true);
  if(animation||guide||graphs.some(g=>g.lesson.clockVisible&&!document.hidden))animate();
}
function showCoordinates(mode){
  if(!active)return;stopAnimation();const l=active.lesson;
  guide={graph:active,mode,point:mode==='plot'?active.question.centre:(l.constructionComplete&&l.angle?l.pointAt():active.question.given),label:mode==='plot'?'O':active.question.label+(l.constructionComplete&&l.angle?'′':''),start:performance.now()};
  sync();animate();
}
function openGraph(g){
  stopAnimation();active=g;$('demoPanel').hidden=false;
  for(const a of graphs)a.button.setAttribute('aria-pressed',String(a===g));
  fitActive();sync();animate();
}
function fitActive(closer=false){
  if(!active)return;const {width,height}=api.size;
  const bottom=width<=700&&!clean?Math.min(height*.48,$('demoPanel').offsetHeight)+66:0;
  api.setView((closer||clean?fitGraph:fitQuestion)(active,width,height,{right:width>700&&!clean?290:0,bottom}));
}
function changed(){save();sync();api.requestDraw(true);}
function sync(){
  if(!active)return;const l=active.lesson,busy=!!animation||!!guide;
  $('demoTitle').textContent=`${active.question.label} · ${active.id}`;
  $('demoBack').disabled=busy||!l.stage;
  $('demoNext').disabled=busy||l.answerVisible;
  $('demoNext').textContent=!l.stage?'Plot centre':!l.constructionComplete?'Next':l.canReveal?'Reveal':l.matchesQuestion?'Next':'Rotate';
  $('constructionControls').hidden=l.constructionComplete;
  $('rotationControls').hidden=!l.constructionComplete;
  $('clockToggle').hidden=!l.constructionComplete;
  $('clockToggle').setAttribute('aria-pressed',String(l.clockVisible));
  for(const [id,axis]of[['firstX','x'],['firstY','y']]){$(id).setAttribute('aria-pressed',String(l.firstAxis===axis));$(id).disabled=busy;}
  $('rotationSlider').disabled=busy;$('rotationSlider').value=String(l.angle);
  $('rotationValue').textContent=`${fmt(Math.abs(l.angle))}°${l.angle<0?' clockwise':l.angle>0?' anticlockwise':''}`;
  document.querySelectorAll('[data-angle]').forEach(b=>{b.disabled=busy;b.setAttribute('aria-pressed',String(+b.dataset.angle===l.angle));});
  const info=l.segmentInfo();
  document.querySelectorAll('[data-nudge]').forEach(b=>{const axis=['up','down'].includes(b.dataset.nudge)?'y':'x';b.disabled=busy||!l.stage||l.constructionComplete||(l.buildIndex>0||l.buildCounts[0]!==0)&&axis!==info.axis;});
  $('countValue').textContent=fmt(l.buildCounts[l.buildIndex]||0);
  $('demoAuto').disabled=busy||!l.stage||l.constructionComplete;
  $('demoStatus').textContent=guide?'Follow the coordinates to the point.':animation?'':!l.stage?'Tap Next to locate the centre.':!l.constructionComplete?`Arm ${info.arm+1} · ${info.part?'bend':'straight segment'}. Move with the pad, then Next.`:!l.constructionMatches?'Compare the lengths with the original point. Back lets you adjust them.':l.answerVisible?`${active.question.label}′ ${coordinates(l.answer)}`:'Turn either way. Next uses the question’s angle.';
}
function countAutomatically(){
  if(!active||animation||guide)return;const l=active.lesson;if(!l.stage||l.constructionComplete)return;
  const index=l.buildIndex,from=l.buildCounts[index],to=l.segmentInfo().target;
  if(from===to){l.advanceConstruction();changed();return;}
  l.counting=true;l.countAnimation={from,to};
  animation={kind:'count',graph:active,index,from,to,start:performance.now(),duration:Math.max(300,Math.min(2400,Math.abs(to-from)*230))};sync();animate();
}
$('demoNext').onclick=()=>{
  if(!active||animation||guide)return;const l=active.lesson;
  if(!l.stage){showCoordinates('plot');return;}
  if(!l.constructionComplete){
    if(l.buildCounts[l.buildIndex]===0&&l.segmentInfo().target!==0){countAutomatically();return;}
    l.advanceConstruction();changed();return;
  }
  if(l.canReveal){l.reveal();changed();return;}
  if(!l.constructionMatches){$('demoStatus').textContent='Use Back to adjust the construction, or Reset demo to begin again.';return;}
  animation={kind:'rotate',graph:active,from:l.angle,to:l.movementDegrees,start:performance.now(),duration:1100};l.answerVisible=false;sync();animate();
};
$('demoAuto').onclick=countAutomatically;
$('demoBack').onclick=()=>{stopAnimation();const l=active.lesson;if(l.answerVisible){l.answerVisible=false;l.stage=10;}else if(l.angle){l.scrub(0);}else l.previousConstruction();changed();};
$('demoReset').onclick=()=>{stopAnimation();active.lesson.reset();changed();};
$('demoClose').onclick=()=>{stopAnimation();$('demoPanel').hidden=true;for(const g of graphs)g.button.setAttribute('aria-pressed','false');active=null;save();api.requestDraw(true);};
$('demoFit').onclick=()=>fitActive(true);
$('firstX').onclick=()=>{active.lesson.selectFirstAxis('x');changed();};
$('firstY').onclick=()=>{active.lesson.selectFirstAxis('y');changed();};
$('clockToggle').onclick=()=>{active.lesson.toggleClock();changed();animate();};
$('showCentre').onclick=()=>showCoordinates('plot');$('showPoint').onclick=()=>showCoordinates('read');
const moves={up:['y',1],down:['y',-1],left:['x',-1],right:['x',1]};
function nudge(direction){if(!active||animation||guide)return;active.lesson.nudgeConstruction(...moves[direction]);changed();}
document.querySelectorAll('[data-nudge]').forEach(b=>b.onclick=()=>nudge(b.dataset.nudge));
$('demoPanel').addEventListener('keydown',e=>{
  // Range inputs retain their native hardware-keyboard semantics.
  if(e.target.tagName==='INPUT')return;
  const direction={ArrowUp:'up',ArrowDown:'down',ArrowLeft:'left',ArrowRight:'right'}[e.key];
  if(direction){e.preventDefault();nudge(direction);}
  if(e.key==='Escape')$('demoClose').click();
});
function rotateTo(n){if(!active||animation||guide)return;active.lesson.scrub(n);changed();}
$('rotationSlider').oninput=e=>rotateTo(+e.target.value);
document.querySelectorAll('[data-angle]').forEach(b=>b.onclick=()=>rotateTo(+b.dataset.angle));

function pageFit(){api.setView(fitPage(api.size.width,api.size.height));}
$('pageFit').onclick=pageFit;$('home').onclick=pageFit;$('zoomvalue').onclick=pageFit;
function setClean(value,{focus=false}={}){
  clean=value;document.body.classList.toggle('clean-view',clean);$('showTools').hidden=!clean;$('exitClean').hidden=!clean;
  if(clean)calculatorPanel().hide();
  $('fullscreen').ariaLabel=full?'Exit full screen':'Full screen';
  if(focus&&active)requestAnimationFrame(()=>requestAnimationFrame(()=>fitActive(true)));
}
$('hideTools').onclick=()=>setClean(true);$('showTools').onclick=()=>setClean(false);
async function fullscreen(){
  if(full){try{if(document.fullscreenElement)await document.exitFullscreen();}catch{}full=false;setClean(false);return;}
  full=true;try{await document.documentElement.requestFullscreen?.();}catch{/* Safari still gets the clean viewport layout. */}
  setClean(true,{focus:true});
}
$('fullscreen').onclick=fullscreen;$('exitClean').onclick=()=>{if(full)fullscreen();else setClean(false);};
document.addEventListener('fullscreenchange',()=>{if(!document.fullscreenElement){full=false;setClean(false);}});
window.addEventListener('keydown',e=>{if(e.key==='Escape'&&clean&&!document.fullscreenElement){full=false;setClean(false);}});
window.addEventListener('pagehide',()=>{stopAnimation();save();});
document.addEventListener('visibilitychange',()=>{if(!document.hidden)animate();else{stopAnimation();save();}});
api.requestDraw(true);animate();
