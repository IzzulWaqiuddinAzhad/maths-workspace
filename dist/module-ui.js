import { createSequenceOverview } from './module-sequence-view.js?v=1';
import { coordinateGuideFrame, paintCoordinateGuide, coordinateGuideDuration } from './module-coordinate-guide.js?v=4';
import { bindRepeatingButton } from './direction-pad.js?v=1';
import { MODULE_QUESTIONS, QUESTION_ONE, findModuleQuestion, createModuleLesson, reflectionEquation, fitQuestion, EnlargementSnap, squareCountAt } from './module-lesson.js?v=15';
import { paintEnlargementLesson } from './module-enlargement-render.js?v=4';
import { paintRotationLesson } from './module-rotation-render.js?v=6';
import { paintReflectionLesson } from './module-reflection-render.js?v=8';
import { createTransformationRenderer } from './transform-render.js?v=36';
import { graphToScreen, screenToGraph, GRID_UNIT, newAnnotation, eraseAnnotations, ReflectionScrub, RotationSnap } from './transform-model.js?v=29';
import { DocumentStore, zoomAt } from './core.js?v=14';
import { installCanvasOwnership } from './interaction.js?v=13';

const $ = id => document.getElementById(id);
const requested = new URLSearchParams(location.search).get('question');
let q = findModuleQuestion(requested) || QUESTION_ONE, rootLesson = createModuleLesson(q);
let sequence = q.type === 'combined' ? rootLesson : null, lesson = sequence?.current || rootLesson;
const activity = () => lesson.question;
const canvas = $('graph'), board = $('board'), drawGraph = createTransformationRenderer(canvas);
// The lesson does not write into the free exploration's saved document.
let inkStore = new DocumentStore(), unsubscribeInk;
const questionInk = new Map([[q.id, inkStore]]), pointers = new Map();
let language = 'en', dark = false, collapsed = false, tool = 'pan', view = { x: 0, y: 0, zoom: 1 };
const countRepeats=[];
const readPoints=new Set();
let coordinateGuide=null;
const countWords=(n,horizontal)=>{
  const direction=n<0?(horizontal?tr('left','kiri'):tr('down','bawah')):(horizontal?tr('right','kanan'):tr('up','atas'));
  return `${fmt(Math.abs(n))} ${tr(Math.abs(n)===1?'unit':'units','unit')}`+(n===0?'':` ${tr('','ke ')}${direction}`);
};
const visibleBounds=()=>{const a=screenToGraph({x:50,y:65},view),b=screenToGraph({x:Math.max(100,canvas.clientWidth-90),y:Math.max(120,canvas.clientHeight-70)},view);return {xmin:a.x,xmax:b.x,ymin:b.y,ymax:a.y};};
const stopCountPad=()=>countRepeats.forEach(control=>control.stop());
const overview=createSequenceOverview($('combinedOverview'),{onBusyChange:()=>sync(),onCoordinateReveal:focusSequenceOverview});
const busy=()=>!!animation||overview.busy||!!coordinateGuide;
let fitted = true, previousSize, drag = null, ink = null, erased = null, frame = 0, animation = 0, statusTimer;
try { language = JSON.parse(localStorage.getItem('maths-workspace:language')) === 'bm' ? 'bm' : 'en'; dark = (localStorage.getItem('maths-workspace:theme') ?? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')) === 'dark'; } catch {}
const tr = (en, bm) => language === 'bm' ? bm : en;
const fmt = n => String(n).replace('-', '−');
const coord = p => `(${fmt(p.x)}, ${fmt(p.y)})`;
const signed = n => n > 0 ? `+${fmt(n)}` : fmt(n);
const calculation = (given, delta, answer) => `${fmt(given)} ${delta < 0 ? '−' : '+'} ${fmt(Math.abs(delta))} = ${fmt(answer)}`;
const isReflection = () => activity().type === 'reflection';
const isRotation = () => activity().type === 'rotation';
const isEnlargement = () => activity().type === 'enlargement';
const enlargementDescription = () => `${tr('Scale factor','Faktor skala')} ${fmt(activity().factor)} · ${tr('centre','pusat')} ${coord(activity().centre)}`;
const factorLabel = () => `${lesson.inverse ? tr('From image × ', 'Dari imej × ') : 'k = '}${fmt(Number(lesson.factor.toFixed(2)))}`;
const graphBounds = () => lesson.bounds || q.bounds;
const cameraBounds = () => sequence?.started ? sequence.focusBounds : graphBounds();
const rotationDescription = () => `${Math.abs(activity().degrees)}° ${activity().degrees === 180 ? tr('half-turn', 'separuh pusingan') : activity().degrees < 0 ? tr('clockwise', 'ikut arah jam') : tr('anticlockwise', 'lawan arah jam')}`;
const angleWords = angle => `${Math.round(Math.abs(angle))}°${angle === 0 ? '' : ' ' + (angle < 0 ? tr('clockwise', 'ikut arah jam') : tr('anticlockwise', 'lawan arah jam'))}`;
const rotationProgressLabel = () => angleWords(lesson.angle);
let clockStarted = 0;
const nextQuestion = () => MODULE_QUESTIONS[MODULE_QUESTIONS.indexOf(q) + 1];
let axisPulseUntil = 0, reflectionScrub = null, freeScrub = null, scrubPointer = null;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const text = (id, en, bm) => { $(id).textContent = tr(en, bm); };
const a11y = (id, en, bm) => { $(id).setAttribute('aria-label', tr(en, bm)); $(id).title = tr(en, bm); };

function renderCopy() {
  document.documentElement.lang = language === 'bm' ? 'ms' : 'en';
  document.body.classList.toggle('dark', dark);
  document.title = tr(`Question ${q.id} · BIJAK Transformations`, `Soalan ${q.id} · Transformasi BIJAK`);
  text('back', '← Workspace', '← Ruang kerja'); text('pageTitle', 'Transformations', 'Transformasi');
  const reflection = isReflection(), rotation = isRotation(), enlargement = isEnlargement(), topic = sequence ? tr('Combined transformations','Gabungan transformasi') : enlargement ? tr('Enlargement','Pembesaran') : rotation ? tr('Rotation', 'Putaran') : reflection ? tr('Reflection', 'Pantulan') : tr('Translation', 'Translasi');
  document.body.classList.toggle('combined-lesson', !!sequence);
  document.body.classList.toggle('rotation-lesson', rotation);
  document.body.classList.toggle('enlargement-lesson', enlargement);
  $('enlargementControls').hidden = !enlargement;
  $('countControls').hidden = !enlargement;
  $('enlargementShortcuts').hidden = !enlargement;
  $('rotationControls').hidden = !rotation;
  $('rotationShortcuts').hidden = !rotation;
  document.body.classList.toggle('reflection-lesson', reflection);
  $('reflectionControls').hidden = !reflection;
  $('questionGroup').value = q.type;
  $('questionGroup').setAttribute('aria-label', tr('Module activity', 'Aktiviti modul'));
  $('questionGroup').options[0].textContent = tr('Translation · 1–4', 'Translasi · 1–4');
  $('questionGroup').options[1].textContent = tr('Reflection · 5–8', 'Pantulan · 5–8');
  $('questionGroup').options[2].textContent = tr('Rotation · 9–16', 'Putaran · 9–16');
  $('questionGroup').options[3].textContent = tr('Enlargement · 17–20', 'Pembesaran · 17–20');
  $('questionGroup').options[4].textContent = tr('Combined · 21–24', 'Gabungan · 21–24');
  $('questionBadge').textContent = tr(`Question ${q.number}`, `Soalan ${q.number}`) + ' · ' + topic;
  $('section').textContent = `${q.section} / ${topic.toUpperCase()} · ${q.number}`;
  text('questionTitle', lesson.inverse ? 'Find the original point' : 'Find the image', lesson.inverse ? 'Cari koordinat objek' : 'Cari koordinat imej'); $('prompt').textContent = q.prompt[language];
  text('answerHeading', lesson.inverse ? 'Coordinates of the object' : 'Coordinates of the image', lesson.inverse ? 'Koordinat objek' : 'Koordinat imej');
  text('sourceNote', `Module page ${sequence ? 6 : enlargement ? 5 : rotation ? Number(q.id) < 13 ? 3 : 4 : reflection ? 2 : 1} · Question ${q.id}. One square = one unit.`, `Halaman modul ${sequence ? 6 : enlargement ? 5 : rotation ? Number(q.id) < 13 ? 3 : 4 : reflection ? 2 : 1} · Soalan ${q.id}. Satu petak = satu unit.`);
  document.querySelector('.given-vector').hidden = !!sequence || reflection || rotation || enlargement;
  $('givenEnlargement').hidden = !!sequence || !enlargement;
  if (enlargement) $('givenEnlargement').textContent = enlargementDescription();
  $('givenRotation').hidden = !!sequence || !rotation;
  if (rotation) $('givenRotation').textContent = `${rotationDescription()} · ${tr('Centre', 'Pusat')} ${coord(activity().centre)}`;
  $('givenMirror').hidden = !!sequence || !reflection;
  if (reflection) $('givenMirror').textContent = reflectionEquation(activity().mirror);
  else if (!rotation && !enlargement) { $('givenDX').textContent = fmt(activity().vector.x); $('givenDY').textContent = fmt(activity().vector.y); }
  $('questionNav').innerHTML = MODULE_QUESTIONS.filter(question => question.type === q.type).map(question => `<button type="button" data-question="${question.id}">${question.number}</button>`).join('');
  $('questionNav').setAttribute('aria-label', tr('Module questions', 'Soalan modul'));
  for (const button of $('questionNav').querySelectorAll('button')) {
    button.setAttribute('aria-label', tr(`Question ${button.dataset.question}`, `Soalan ${button.dataset.question}`));
    if (button.dataset.question === q.id) button.setAttribute('aria-current', 'page'); else button.removeAttribute('aria-current');
  }
  text('teachingLabel', 'TEACH TOGETHER', 'TEROKA BERSAMA');
  text('teacherNote', 'Start with the given point. Reveal each step when your class is ready.', 'Mulakan dengan titik yang diberi. Dedahkan setiap langkah apabila kelas bersedia.');
  text('expand', 'Question ›', 'Soalan ›'); text('panText', 'Move', 'Alih'); text('penText', 'Pen', 'Pen'); text('eraserText', 'Eraser', 'Pemadam');
  text('fit', 'Fit graph', 'Muat graf'); text('reset', 'Reset', 'Mula semula'); text('scrubLabel', 'Control the movement', 'Kawal pergerakan');
  $('language').textContent = language === 'en' ? 'BM' : 'EN';
  a11y('language', 'Switch to Bahasa Melayu', 'Tukar ke Bahasa Inggeris');
  a11y('theme', dark ? 'Use light theme' : 'Use dark theme', dark ? 'Guna tema cerah' : 'Guna tema gelap');
  a11y('collapse', 'Hide question', 'Sembunyikan soalan');
  a11y('pan', 'Move graph', 'Alih graf'); a11y('pen', 'Pen', 'Pen'); a11y('eraser', 'Erase ink', 'Padam dakwat');
  a11y('undo', 'Undo ink', 'Undur dakwat'); a11y('redo', 'Redo ink', 'Buat semula dakwat');
  a11y('zoomOut', 'Zoom out', 'Zum keluar'); a11y('zoomIn', 'Zoom in', 'Zum masuk'); a11y('previous', 'Previous step', 'Langkah sebelumnya');
  $('graph').setAttribute('aria-label', tr(`Question ${q.id}, interactive Cartesian graph`, `Soalan ${q.id}, graf Cartes interaktif`));
  canvas.textContent = tr(`Cartesian diagram for Question ${q.id}.`, `Rajah Cartes untuk Soalan ${q.id}.`);
  $('progress').min = enlargement ? -3 : rotation ? -360 : 0;
  $('progress').max = enlargement ? 3 : rotation ? 360 : reflection ? 1 : 2;
  $('progress').step = rotation ? 1 : .01;
  $('progress').setAttribute('aria-label', enlargement ? tr('Control scale factor', 'Kawal faktor skala') : rotation ? tr('Rotation angle: left clockwise, right anticlockwise', 'Sudut putaran: kiri ikut arah jam, kanan lawan arah jam') : reflection ? tr('Control reflection', 'Kawal pantulan') : tr('Translation movement, horizontal then vertical', 'Pergerakan translasi, mengufuk kemudian menegak'));
  if (!reflection && !rotation && !enlargement) document.querySelector('.given-vector').setAttribute('aria-label', tr(`Translation vector ${coord(activity().vector)}`, `Vektor translasi ${coord(activity().vector)}`));
  else if (reflection) $('givenMirror').setAttribute('aria-label', tr(`Question line: ${reflectionEquation(activity().mirror)}`, `Garis soalan: ${reflectionEquation(activity().mirror)}`));
  renderSequenceCopy();
  syncFullscreen(); sync();
}

const pointKey=(point,label)=>`${label}:${point.x},${point.y}`;
function decorateCentreSources() {
  const point=activity().centre;if(!point)return;
  for(const root of [$('prompt'),$('givenRotation'),$('givenEnlargement'),$('givenCombined'),$('rotationCentre'),$('enlargementCentre')]) {
    const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT),nodes=[];
    while(walker.nextNode())nodes.push(walker.currentNode);
    for(const node of nodes){
      if(node.parentElement.closest('.coordinate-source'))continue;
      const value=node.textContent,match=[coord(point),`(${point.x}, ${point.y})`].find(v=>value.includes(v));
      if(!match)continue;
      const start=value.indexOf(match),span=document.createElement('span');span.className='coordinate-source';
      span.append('(');
      for(const axis of ['x','y']){const digit=document.createElement('b');digit.dataset.coordinateAxis=axis;digit.textContent=fmt(point[axis]);span.append(digit,axis==='x'?', ':')');}
      node.replaceWith(document.createTextNode(value.slice(0,start)),span,document.createTextNode(value.slice(start+match.length)));
    }
  }
}
function cancelCoordinateGuide() {
  if(!coordinateGuide)return;
  coordinateGuide.flights?.remove();
  for(const source of coordinateGuide.sources||[])source?.classList.remove('coordinate-value-active');
  coordinateGuide.source?.classList.remove('coordinate-source-active');coordinateGuide=null;
}
function startCoordinateGuide(point,label,{mode='read',complete=()=>{}}={}) {
  if(busy())return;
  stopCountPad();pointers.clear();discard();
  // Include the axes when a teacher has panned away, using the existing camera.
  const ps=[point,{x:point.x,y:0},{x:0,y:point.y}].map(p=>graphToScreen(p,view));
  if(ps.some(p=>p.x<45||p.x>canvas.clientWidth-70||p.y<50||p.y>canvas.clientHeight-75))fit();
  if(matchMedia('(max-width:760px)').matches)board.scrollIntoView({block:'center'});
  const currentLesson=lesson;
  const finish=()=>{if(lesson!==currentLesson)return;readPoints.add(pointKey(point,label));complete();sync();};
  if(reducedMotion.matches){finish();return;}
  let source=[...document.querySelectorAll('.coordinate-source')].find(el=>{const r=el.getBoundingClientRect();return r.width&&r.top>=0&&r.bottom<=innerHeight;});
  const flights=document.createElement('div');flights.className='coordinate-flights';flights.setAttribute('aria-hidden','true');
  if(mode==='plot')for(const axis of ['x','y']){const token=document.createElement('span');token.dataset.axis=axis;token.textContent=fmt(point[axis]);flights.append(token);}
  let originChip;
  if(mode==='plot'&&!source){
    originChip=document.createElement('div');originChip.className='coordinate-origin';originChip.append(tr('Centre ','Pusat '));
    source=document.createElement('span');source.className='coordinate-source';source.append('(');
    for(const axis of ['x','y']){const digit=document.createElement('b');digit.dataset.coordinateAxis=axis;digit.textContent=fmt(point[axis]);source.append(digit,axis==='x'?', ':')');}
    originChip.append(source);flights.append(originChip);
  }
  document.body.append(flights);
  const sources=mode==='plot'&&source?['x','y'].map(axis=>source.querySelector(`[data-coordinate-axis="${axis}"]`)):[];
  coordinateGuide={point:{...point},label,mode,start:performance.now(),finish,source:mode==='plot'?source:null,sources,flights,originChip};
  coordinateGuide.source?.classList.add('coordinate-source-active');sync();schedule();
}
function drawCoordinateGuide() {
  if(!coordinateGuide)return;
  const guide=coordinateGuide,elapsed=performance.now()-guide.start;
  const image=guide.label===lesson.answerLabel&&!lesson.inverse||guide.label===lesson.givenLabel&&lesson.inverse;
  const intermediate=sequence&&(sequence.index===0&&guide.label===lesson.answerLabel||sequence.index===1&&guide.label===lesson.givenLabel);
  const pointColour=intermediate?(dark?'#ffc47f':'#a95c14'):image?(dark?'#91beff':'#2468c4'):(dark?'#edf0f5':'#20242c');
  if(elapsed>=coordinateGuideDuration(guide.mode)){const finish=guide.finish;cancelCoordinateGuide();finish();return;}
  const frame=paintCoordinateGuide(canvas.getContext('2d'),{...guide,elapsed,view,dark,pointColour,width:canvas.clientWidth,height:canvas.clientHeight});
  if(guide.mode==='plot'){
    const boardRect=canvas.getBoundingClientRect();
    if(guide.originChip){guide.originChip.style.left=`${boardRect.x+12}px`;guide.originChip.style.top=`${Math.max(12,boardRect.y+12)}px`;}
    for(const [i,axis] of ['x','y'].entries()){
      const token=guide.flights.children[i],source=guide.sources[i],r=source?.getBoundingClientRect();
      const target=graphToScreen(frame[axis+'Axis'],view),t=frame[axis+'Flight'];
      const from=r?.width?{x:r.x+r.width/2,y:r.y+r.height/2}:{x:boardRect.x+65+i*70,y:boardRect.y+30};
      token.style.left=`${from.x+(boardRect.x+target.x-from.x)*t}px`;
      token.style.top=`${from.y+(boardRect.y+target.y-from.y)*t}px`;
      token.hidden=t<=0||t>=1;source?.classList.toggle('coordinate-value-active',frame[axis+'Emphasis']);
    }
  }
  if(guide.phase!==frame.phase){guide.phase=frame.phase;syncCoordinateGuide();}
  schedule();
}
function syncCoordinateGuide() {
  const available=!sequence||sequence.teachingReady;
  if(available&&!lesson.answerVisible&&!readPoints.has(pointKey(activity().given,lesson.givenLabel))){
    text('next',`Read ${lesson.givenLabel} coordinates →`,`Baca koordinat ${lesson.givenLabel} →`);
    text('stepDetail','Tap the point or use Next to read x, then y.','Ketik titik atau guna Seterusnya untuk membaca x, kemudian y.');
    $('next').disabled=busy();
  }
  for(const id of ['reflectionControls','rotationControls','enlargementControls','countControls','scrubber'])$(id).inert=!!coordinateGuide;
  if(!coordinateGuide)return;
  const {phase}=coordinateGuideFrame(coordinateGuide.point,coordinateGuide.mode,performance.now()-coordinateGuide.start);
  const plot=coordinateGuide.mode==='plot';
  text('stepTitle',plot?'Locate the centre':'Read the coordinates',plot?'Tentukan pusat':'Baca koordinat');
  text('stepDetail',phase==='point'?(plot?'Start with the centre stated in the question.':'Watch the highlighted point.'):phase==='x'?'Read x on the horizontal axis.':phase==='y'?'Read y on the vertical axis.':'The two guides meet at the point.',phase==='point'?(plot?'Mulakan dengan pusat yang diberi dalam soalan.':'Perhatikan titik yang ditandakan.'):phase==='x'?'Baca x pada paksi mengufuk.':phase==='y'?'Baca y pada paksi menegak.':'Dua garis panduan bertemu pada titik.');
  $('next').disabled=true;$('previous').disabled=true;
}
function revealWithCoordinates() {
  startCoordinateGuide(lesson.answer,lesson.answerLabel,{complete:()=>{
    if(isReflection()||isRotation()||isEnlargement())lesson.reveal();else lesson.goTo(4);
  }});
}
function replayPointAt(position) {
  if(tool!=='pan'||busy()||sequence&&!sequence.teachingReady)return;
  const candidates=[{point:activity().given,label:lesson.givenLabel}];
  if(sequence?.index===1)candidates.push({point:q.given,label:q.label});
  if(activity().centre&&lesson.stage)candidates.push({point:activity().centre,label:tr('Centre','Pusat')});
  if(lesson.answerVisible)candidates.push({point:lesson.answer,label:lesson.answerLabel});
  else if(lesson.canReveal||(!isReflection()&&!isRotation()&&!isEnlargement()&&lesson.progress===2))candidates.push({point:lesson.answer,label:lesson.answerLabel,reveal:true});
  const hit=candidates.map(p=>({...p,distance:Math.hypot(graphToScreen(p.point,view).x-position.x,graphToScreen(p.point,view).y-position.y)})).filter(p=>p.distance<=20).sort((a,b)=>a.distance-b.distance)[0];
  if(hit)hit.reveal?revealWithCoordinates():startCoordinateGuide(hit.point,hit.label);
}

function syncTranslation() {
  const v = lesson.movementVector;
  const horizontal = v.x < 0 ? tr('left', 'kiri') : tr('right', 'kanan');
  const vertical = v.y < 0 ? tr('down', 'bawah') : tr('up', 'atas');
  const stages = [
    [lesson.inverse ? `Where was ${activity().label}?` : `Where will ${activity().label} move?`, lesson.inverse ? 'The image is given. Find the original point.' : 'Read the vector before revealing the image.', lesson.inverse ? `Di manakah ${activity().label} asal?` : `Ke manakah ${activity().label} bergerak?`, lesson.inverse ? 'Imej diberi. Cari titik asal.' : 'Baca vektor sebelum mendedahkan imej.'],
    [`Start at ${lesson.givenLabel} ${coord(activity().given)}`, lesson.inverse ? `Work backwards: use the inverse vector ${coord(v)}.` : 'Read x first, then y.', `Mula di ${lesson.givenLabel} ${coord(activity().given)}`, lesson.inverse ? `Undur semula: guna vektor songsang ${coord(v)}.` : 'Baca x dahulu, kemudian y.'],
    [`${Math.abs(v.x)} units to the ${horizontal}`, `${lesson.inverse ? 'Inverse movement' : 'Horizontal component'}: ${signed(v.x)}.`, `${Math.abs(v.x)} unit ke ${horizontal}`, `${lesson.inverse ? 'Gerakan songsang' : 'Komponen mengufuk'}: ${signed(v.x)}.`],
    [`${Math.abs(v.y)} units ${vertical}`, `${lesson.inverse ? 'Inverse movement' : 'Vertical component'}: ${signed(v.y)}.`, `${Math.abs(v.y)} unit ke ${vertical}`, `${lesson.inverse ? 'Gerakan songsang' : 'Komponen menegak'}: ${signed(v.y)}.`],
    [`${lesson.answerLabel} = ${coord(lesson.answer)}`, `x: ${calculation(activity().given.x, v.x, lesson.answer.x)} · y: ${calculation(activity().given.y, v.y, lesson.answer.y)}`, `${lesson.answerLabel} = ${coord(lesson.answer)}`, `x: ${calculation(activity().given.x, v.x, lesson.answer.x)} · y: ${calculation(activity().given.y, v.y, lesson.answer.y)}`],
  ];
  const s = stages[lesson.stage];
  text('stepTitle', s[0], s[2]); text('stepDetail', s[1], s[3]);
  text('stepNumber', lesson.stage ? `STEP ${Math.min(lesson.stage, 4)} / 4` : `QUESTION ${q.number}`, lesson.stage ? `LANGKAH ${Math.min(lesson.stage, 4)} / 4` : `SOALAN ${q.number}`);
  const actions = [['Start teaching →', 'Mula mengajar →'], [`Move ${horizontal} ${v.x < 0 ? '←' : '→'}`, `Gerak ke ${horizontal} ${v.x < 0 ? '←' : '→'}`], [`Move ${vertical} ${v.y < 0 ? '↓' : '↑'}`, `Gerak ke ${vertical} ${v.y < 0 ? '↓' : '↑'}`], ['Reveal answer', 'Dedahkan jawapan'], [nextQuestion() ? 'Next question →' : 'Answer revealed', nextQuestion() ? 'Soalan seterusnya →' : 'Jawapan didedahkan']];
  text('next', ...actions[lesson.stage]); $('next').disabled = (lesson.stage === 4 && !nextQuestion()) || !!animation;
  if (lesson.progress < lesson.targetProgress) text('next', 'Finish movement →', 'Lengkapkan gerakan →');
  $('previous').disabled = lesson.stage === 0 || !!animation;
  $('progress').value = lesson.progress; $('scrubber').hidden = lesson.stage === 0;
  $('progress').setAttribute('aria-valuetext', tr(`${Math.round(Math.min(1, lesson.progress) * 100)}% horizontal, ${Math.round(Math.max(0, lesson.progress - 1) * 100)}% vertical`, `${Math.round(Math.min(1, lesson.progress) * 100)}% mengufuk, ${Math.round(Math.max(0, lesson.progress - 1) * 100)}% menegak`));
  $('startLabel').textContent = lesson.givenLabel; $('horizontalStep').textContent = signed(v.x); $('verticalStep').textContent = signed(v.y);
}

function syncReflection() {
  const choice = lesson.choice, kind = choice?.kind, equation = lesson.equation;
  text('predictionPrompt', 'What kind of reflection line is it?', 'Apakah jenis garis pantulan ini?');
  text('horizontal', 'Horizontal', 'Mengufuk'); text('vertical', 'Vertical', 'Menegak'); text('slanted', 'Slanted', 'Condong');
  document.querySelector('.orientation-buttons').setAttribute('aria-label', tr('Line orientation', 'Arah garis'));
  $('reflectionControls').setAttribute('aria-label', tr('Try a reflection line', 'Cuba garis pantulan'));
  for (const button of document.querySelectorAll('[data-orientation]')) button.setAttribute('aria-pressed', String(button.dataset.orientation === kind));
  $('trialControls').hidden = !choice; $('reflectionControls').classList.toggle('has-trial', !!choice);
  text('trialHeading', 'Trying', 'Mencuba'); $('trialEquation').textContent = equation;
  const rule = kind === 'horizontal' ? [`Horizontal: y = k. Every point has y = ${fmt(choice.k)}.`, `Mengufuk: y = k. Setiap titik mempunyai y = ${fmt(choice.k)}.`]
    : kind === 'vertical' ? [`Vertical: x = k. Every point has x = ${fmt(choice.k)}.`, `Menegak: x = k. Setiap titik mempunyai x = ${fmt(choice.k)}.`]
    : ['Move with the pad. Drag either handle to change steepness.', 'Alih dengan pad. Seret pemegang untuk mengubah kecerunan.'];
  text('axisRule', ...rule);
  $('slopeControls').hidden = kind !== 'slanted';
  $('slopePositive').setAttribute('aria-pressed', String(choice?.slope === 1 && !choice.intercept)); $('slopeNegative').setAttribute('aria-pressed', String(choice?.slope === -1 && !choice.intercept));
  text('guides', 'Guide', 'Panduan'); $('guides').setAttribute('aria-pressed', String(lesson.guideVisible));
  a11y('guides', lesson.guideVisible ? 'Hide perpendicular guide' : 'Show perpendicular guide', lesson.guideVisible ? 'Sembunyikan panduan serenjang' : 'Tunjukkan panduan serenjang');
  text('stepNumber', lesson.answerVisible ? 'ANSWER REVEALED' : choice ? 'TRY • DISCUSS • REFLECT' : 'PREDICT THE LINE', lesson.answerVisible ? 'JAWAPAN DIDEDAHKAN' : choice ? 'CUBA • BINCANG • PANTUL' : 'RAMALKAN GARIS');
  text('stepTitle', choice ? lesson.progress === 1 ? (lesson.answerVisible ? `${lesson.answerLabel} = ${coord(lesson.answer)}` : lesson.matchesQuestion ? 'Ready to reveal' : 'Compare the two equations') : lesson.progress > 0 ? 'Control the flip' : lesson.guideVisible ? 'Perpendicular to the mirror line' : `Try ${equation}` : 'Horizontal, vertical or slanted?',
    choice ? lesson.progress === 1 ? (lesson.answerVisible ? `${lesson.answerLabel} = ${coord(lesson.answer)}` : lesson.matchesQuestion ? 'Sedia untuk didedahkan' : 'Bandingkan kedua-dua persamaan') : lesson.progress > 0 ? 'Kawal lipatan' : lesson.guideVisible ? 'Serenjang dengan garis pantulan' : `Cuba ${equation}` : 'Mengufuk, menegak atau condong?');
  text('stepDetail', !choice ? 'Choose a suggestion from the class.' : lesson.answerVisible ? 'Equal perpendicular distances on both sides.' : `Question: ${reflectionEquation(activity().mirror)} · Trying: ${equation}` + (lesson.inverse ? ' · Recover the original point.' : ''),
    !choice ? 'Pilih cadangan daripada kelas.' : lesson.answerVisible ? 'Jarak serenjang sama pada kedua-dua belah.' : `Soalan: ${reflectionEquation(activity().mirror)} · Mencuba: ${equation}` + (lesson.inverse ? ' · Cari titik asal.' : ''));
  if (choice && lesson.progress > 0 && Math.hypot(lesson.trialAnswer.x - activity().given.x, lesson.trialAnswer.y - activity().given.y) < 1e-8) {
    text('stepTitle', 'A point on the mirror stays in place', 'Titik pada garis pantulan kekal di tempatnya');
  }
  const action = !choice ? ['Choose a line', 'Pilih garis'] : lesson.answerVisible ? (nextQuestion() ? ['Next question →', 'Soalan seterusnya →'] : ['Answer revealed', 'Jawapan didedahkan']) : lesson.progress === 1 ? (lesson.matchesQuestion ? ['Reveal answer', 'Dedahkan jawapan'] : ['Match the question line', 'Padankan garis soalan']) : !lesson.progress && !lesson.guideVisible ? ['Show guide', 'Tunjuk panduan'] : [lesson.progress ? 'Finish reflection →' : 'Reflect →', lesson.progress ? 'Lengkapkan pantulan →' : 'Pantulkan →'];
  text('next', ...action);
  $('next').disabled = !!animation || !choice || (lesson.answerVisible && !nextQuestion()) || (lesson.progress === 1 && !lesson.matchesQuestion);
  $('previous').disabled = !choice || !!animation;
  $('scrubber').hidden = !choice; $('progress').value = lesson.progress;
  text('scrubLabel', 'Control reflection', 'Kawal pantulan');
  $('progress').setAttribute('aria-valuetext', tr(`${Math.round(lesson.progress * 100)}% reflected`, `${Math.round(lesson.progress * 100)}% dipantulkan`));
  $('startLabel').textContent = lesson.givenLabel; text('horizontalStep', 'On line', 'Pada garis');
  $('verticalStep').textContent = lesson.matchesQuestion ? lesson.answerLabel : tr('Trial', 'Cubaan');
}

function syncRotation() {
  const stage=lesson.stage;
  const info=lesson.segmentInfo(Math.min(7,lesson.buildIndex));
  const count=lesson.displayedBuildCount();
  const canKeep=count!==0||info.target===0;
  text('stepTitle',!stage?'Where is the centre?':`${info.part?'Bent end':'Straight arm'} ${info.arm+1}: ${countWords(count,info.axis==='x')}`,
    !stage?'Di manakah pusat putaran?':`${info.part?'Hujung bengkok':'Lengan lurus'} ${info.arm+1}: ${countWords(count,info.axis==='x')}`);
  text('stepDetail',!stage?'Measure from the rotation centre, not necessarily the origin.':lesson.counting?'Count one square at a time…':`Use the pad freely. Next keeps this ${info.part?'end':'arm'} and changes direction. Auto counts ${countWords(info.target,info.axis==='x')}.`,
    !stage?'Ukur dari pusat putaran, tidak semestinya asalan.':lesson.counting?'Kira satu petak demi satu…':`Guna pad dengan bebas. Seterusnya menyimpan ${info.part?'hujung':'lengan'} ini dan menukar arah. Auto mengira ${countWords(info.target,info.axis==='x')}.`);
  text('stepNumber',!stage?`QUESTION ${q.number}`:lesson.constructionComplete?'ROTATE & DISCUSS':`ARM ${info.arm+1} / 4 · ${info.part?'BENT END':'STRAIGHT LINE'}`,!stage?`SOALAN ${q.number}`:lesson.constructionComplete?'PUTAR & BINCANG':`LENGAN ${info.arm+1} / 4 · ${info.part?'HUJUNG BENGKOK':'GARIS LURUS'}`);
  text('next',!stage?'Mark the centre →':canKeep?(lesson.buildIndex===7?'Complete construction →':info.part?'Keep & next arm →':'Keep & add bend →'):'Count this segment →',!stage?'Tandakan pusat →':canKeep?(lesson.buildIndex===7?'Lengkapkan binaan →':info.part?'Simpan & lengan seterusnya →':'Simpan & tambah bengkok →'):'Kira bahagian ini →');
  if(lesson.constructionComplete)text('next',lesson.answerVisible?'Next question →':lesson.canReveal?'Read image coordinates →':'Show question’s turn →',lesson.answerVisible?'Soalan seterusnya →':lesson.canReveal?'Baca koordinat imej →':'Tunjuk putaran soalan →');
  if(lesson.answerVisible){text('stepTitle',`${lesson.answerLabel} = ${coord(lesson.answer)}`,`${lesson.answerLabel} = ${coord(lesson.answer)}`);text('stepDetail','Both counting orders give the same rotated point.','Kedua-dua urutan kiraan memberikan titik putaran yang sama.');}
  $('next').disabled=!!animation||lesson.constructionComplete&&!lesson.constructionMatches;$('previous').disabled=!stage || !!animation;
  document.querySelector('.rotation-order').setAttribute('aria-label',tr('Counting order','Urutan kiraan'));
  text('orderX','Horizontal first','Mengufuk dahulu');text('orderY','Vertical first','Menegak dahulu');
  for(const axis of ['x','y']) {const button=$('order'+axis.toUpperCase());button.setAttribute('aria-pressed',String(lesson.firstAxis===axis));button.disabled=!!animation;button.title=tr('Changing order restarts the construction.','Mengubah urutan memulakan semula binaan.');}
  $('scrubber').hidden = !lesson.constructionComplete; $('progress').value = lesson.progress;
  text('scrubLabel','Control rotation','Kawal putaran');
  $('progress').setAttribute('aria-valuetext',rotationProgressLabel());
  $('startLabel').textContent='↻ 360°'; $('horizontalStep').textContent='0°'; $('verticalStep').textContent='360° ↺';
  a11y('rotationCW','Clockwise','Ikut arah jam'); a11y('rotationCCW','Anticlockwise','Lawan arah jam');
  $('rotationCW').setAttribute('aria-pressed',String(lesson.direction === -1)); $('rotationCCW').setAttribute('aria-pressed',String(lesson.direction === 1));
  for (const button of document.querySelectorAll('[data-rotation-angle]')) {
    const degrees = Number(button.dataset.rotationAngle);
    button.setAttribute('aria-pressed',String(Math.abs(lesson.angle) === degrees));
    button.setAttribute('aria-label',angleWords(degrees * lesson.direction));
  }
  if (lesson.constructionComplete && !lesson.answerVisible) {
    text('stepTitle',rotationProgressLabel(),rotationProgressLabel());
    text('stepDetail', lesson.atStart ? (lesson.angle ? 'One full turn: back at the original position.' : 'Slide either way, or choose a direction and an angle.') : `Same position as ${angleWords(lesson.equivalentAngle)}.`,
      lesson.atStart ? (lesson.angle ? 'Satu pusingan penuh: kembali ke kedudukan asal.' : 'Seret ke mana-mana arah, atau pilih arah dan sudut.') : `Kedudukan sama seperti ${angleWords(lesson.equivalentAngle)}.`);
  }
  if(lesson.constructionComplete&&!lesson.constructionMatches){
    text('stepTitle','Check the construction lengths','Semak panjang binaan');
    text('stepDetail','Use Previous to correct the trial lengths. Each arm and bent end must match the original distances before revealing the image.','Guna Sebelumnya untuk membetulkan panjang cubaan. Setiap lengan dan hujung mesti sepadan dengan jarak asal sebelum imej didedahkan.');
  }
  $('rotationControls').setAttribute('aria-label',tr('Rotation guide','Panduan putaran'));
  if(!coordinateGuide)text('rotationCentre',`Centre ${coord(activity().centre)} · Question: ${rotationDescription()}`,`Pusat ${coord(activity().centre)} · Soalan: ${rotationDescription()}`);
  text('clockGuide','Clock guide','Panduan jam'); $('clockGuide').disabled = !lesson.constructionComplete;
  $('clockGuide').setAttribute('aria-pressed', String(lesson.clockVisible));
  a11y('clockGuide',lesson.clockVisible ? 'Hide clock guide':'Show clock guide',lesson.clockVisible ? 'Sembunyikan panduan jam':'Tunjukkan panduan jam');
  text('clockHint', lesson.clockVisible ? (reducedMotion.matches ? 'Clockwise: 12 → 3 → 6 → 9. Opposite: anticlockwise. Motion reduced.' : 'The clock moves clockwise. The opposite direction is anticlockwise.') : lesson.constructionComplete ? 'Clock guide is optional.' : 'Clock guide becomes available after the construction.',
    lesson.clockVisible ? (reducedMotion.matches ? 'Ikut arah jam: 12 → 3 → 6 → 9. Arah bertentangan: lawan arah jam. Gerakan dikurangkan.' : 'Jam bergerak ikut arah jam. Arah bertentangan ialah lawan arah jam.') : lesson.constructionComplete ? 'Panduan jam ialah pilihan.' : 'Panduan jam tersedia setelah binaan lengkap.');
}

function syncEnlargement() {
  const stage=lesson.stage, counting=lesson.mode==='count';
  const imageName=lesson.inverse?tr('Object','Objek'):tr('Image','Imej');
  $('enlargementControls').setAttribute('aria-label',tr('Enlargement guide','Panduan pembesaran'));
  if(!coordinateGuide)text('enlargementCentre',`Centre ${coord(activity().centre)} · Question: k = ${fmt(activity().factor)}`,`Pusat ${coord(activity().centre)} · Soalan: k = ${fmt(activity().factor)}`);
  text('enlargementHint','Orange: given distances · Blue: your construction. Start both paths at the centre.','Jingga: jarak diberi · Biru: binaan anda. Mulakan kedua-dua laluan di pusat.');
  if(lesson.inverse) text('enlargementHint',`Work back from ${lesson.givenLabel}: divide both distances by ${fmt(activity().factor)}.`,`Undur dari ${lesson.givenLabel}: bahagi kedua-dua jarak dengan ${fmt(activity().factor)}.`);
  $('enlargementMode').hidden=!lesson.ready;
  text('enlargementMode',counting?'Explore scale factor':'Back to counting',counting?'Teroka faktor skala':'Kembali mengira');
  $('countControls').hidden=!lesson.ready || !counting;
  $('countControls').setAttribute('aria-label',tr('Count squares','Kira petak'));
  const axis=lesson.countAxis, horizontal=axis==='x';
  const titles=[tr('Where is the centre?','Di manakah pusat pembesaran?'),`${tr('Centre','Pusat')} ${coord(activity().centre)}`,tr('Centre → given point','Pusat → titik diberi'),
    `${lesson.givenLabel}: ${countWords(lesson.displayedCount('given','x'),true)}`,`${lesson.givenLabel}: ${countWords(lesson.displayedCount('given','y'),false)}`,
    `${imageName}: ${countWords(lesson.displayedCount('image','x'),true)}`,`${imageName}: ${countWords(lesson.displayedCount('image','y'),false)}`,`${lesson.answerLabel} = ${coord(lesson.answer)}`];
  $('stepTitle').textContent= counting ? titles[stage] : factorLabel();
  let detail=stage<2?tr('Start at the stated centre, not the origin.','Mulakan di pusat yang diberi, bukan asalan.') : stage===2?tr('The centre, object and image lie on the same straight line.','Pusat, objek dan imej terletak pada garis lurus yang sama.') : stage===3?tr('First count horizontally. Keep the vertical count for the next step.','Kira mengufuk dahulu. Kiraan menegak pada langkah seterusnya.') : tr('Use Next for an automatic count, or adjust either direction yourself.','Guna Seterusnya untuk kiraan automatik, atau laraskan sendiri setiap arah.');
  if(counting && lesson.imageStarted) detail=lesson.counting?tr('Count one square at a time…','Kira satu petak demi satu…') : lesson.canReveal?tr('Both distances match. The point meets the guide at the correct scale.','Kedua-dua jarak betul. Titik bertemu garis panduan pada skala yang betul.') : lesson.onGuide?tr('On the guide. Now check that both distances use the question’s scale.','Pada garis panduan. Semak kedua-dua jarak menggunakan skala soalan.') : tr('Adjust the horizontal and vertical counts until both distances match the scale.','Laraskan kiraan mengufuk dan menegak sehingga kedua-dua jarak mengikut skala.');
  if(!counting) detail=tr('Change the factor freely. Return to counting to continue your construction.','Ubah faktor dengan bebas. Kembali mengira untuk menyambung binaan anda.');
  if(lesson.answerVisible) { const d=lesson.requiredCounts; detail=`x: ${calculation(activity().centre.x,d.x,lesson.answer.x)} · y: ${calculation(activity().centre.y,d.y,lesson.answer.y)}`; }
  $('stepDetail').textContent=detail;
  text('stepNumber',stage?`STEP ${stage} / 7`:`QUESTION ${q.number}`,stage?`LANGKAH ${stage} / 7`:`SOALAN ${q.number}`);
  const actions=[['Mark the centre →','Tandakan pusat →'],['Draw guide →','Lukis garis panduan →'],['Count horizontal →','Kira mengufuk →'],['Count vertical →','Kira menegak →'],['Count image horizontal →','Kira imej mengufuk →'],['Count image vertical →','Kira imej menegak →']];
  let action=lesson.answerVisible?['Answer revealed','Jawapan didedahkan']:lesson.canReveal?['Reveal answer','Dedahkan jawapan']:stage<6?actions[stage]:[horizontal?'Auto horizontal →':'Auto vertical →',horizontal?'Auto mengufuk →':'Auto menegak →'];
  if(lesson.inverse && stage===4) action=['Count object horizontal →','Kira objek mengufuk →'];
  if(lesson.inverse && stage===5) action=['Count object vertical →','Kira objek menegak →'];
  if(counting && stage>=4 && !lesson.canReveal && !lesson.answerVisible) action=lesson.nextCountAxis==='x'?['Count horizontal →','Kira mengufuk →']:['Count vertical →','Kira menegak →'];
  if(!counting && !lesson.canReveal) action=['Show question’s scale →','Tunjuk skala soalan →'];
  text('next',...action);$('next').disabled=!!animation || lesson.answerVisible;$('previous').disabled=!stage || !!animation;
  for(const a of ['x','y']) {
    const h=a==='x';
    text(`countAxis${a}`,h?'Horizontal ↔':'Vertical ↕',h?'Mengufuk ↔':'Menegak ↕');
    $(`countAxis${a}`).setAttribute('aria-pressed',String(axis===a));
    $(`countValue${a}`).textContent=countWords(lesson.displayedCount('image',a),h);
  }
  text('countAuto',horizontal?'Auto horizontal':'Auto vertical',horizontal?'Auto mengufuk':'Auto menegak');
  a11y('countClear','Clear blue path','Padam laluan biru');
  $('countPad').setAttribute('aria-label',tr('Move blue counting path. Tap or hold an arrow.','Alih laluan kiraan biru. Ketik atau tahan anak panah.'));
  for(const [direction,en,bm] of [['Up','up','atas'],['Down','down','bawah'],['Left','left','kiri'],['Right','right','kanan']]) a11y(`count${direction}`,`One unit ${en}; hold to repeat`,`Satu unit ke ${bm}; tahan untuk mengulang`);
  for(const button of $('countControls').querySelectorAll('button')) button.disabled=!!animation;
  $('enlargementMode').disabled=!!animation;
  $('scrubber').hidden=!lesson.ready || counting;$('progress').value=lesson.factor;
  text('scrubLabel',`Scale factor · ${factorLabel()}`,`Faktor skala · ${factorLabel()}`);
  $('progress').setAttribute('aria-valuetext',factorLabel());
  $('startLabel').textContent='−3';$('horizontalStep').textContent='0';$('verticalStep').textContent='3';
  for(const button of document.querySelectorAll('[data-scale-factor]')) {
    const k=Number(button.dataset.scaleFactor);button.setAttribute('aria-pressed',String(Math.abs(lesson.factor-k)<1e-9));
    button.setAttribute('aria-label',tr(`Scale factor ${k}`,`Faktor skala ${k}`));
  }
}

function syncCountingPad() {
  const reflection=isReflection(),rotation=isRotation();
  const show=reflection?!!lesson.choice:rotation?lesson.stage>0&&!lesson.constructionComplete: isEnlargement()&&lesson.ready&&lesson.mode==='count';
  $('mirrorHint').hidden=!reflection||!lesson.choice;
  text('mirrorHint','Drag the line to move it. Drag either circle to turn it.','Seret garis untuk mengalihnya. Seret bulatan untuk memutarnya.');
  $('countControls').hidden=!show;$('countReadouts').hidden=reflection;
  if(!show)return;
  $('countControls').setAttribute('aria-label',tr(reflection?'Move mirror':'Count squares',reflection?'Alih garis pantulan':'Kira petak'));
  $('countPad').setAttribute('aria-label',tr(reflection?'Move reflection line. Tap or hold an arrow.':'Count the current segment. Tap or hold an arrow.',reflection?'Alih garis pantulan. Ketik atau tahan anak panah.':'Kira bahagian semasa. Ketik atau tahan anak panah.'));
  for(const [direction,axis,en,bm] of [['Up','y','up','atas'],['Down','y','down','bawah'],['Left','x','left','kiri'],['Right','x','right','kanan']]) {
    a11y(`count${direction}`,`One unit ${en}; hold to repeat`,`Satu unit ke ${bm}; tahan untuk mengulang`);
    const initial=rotation&&lesson.buildIndex===0&&lesson.buildCounts.every(n=>n===0);
    const allowed=reflection?(lesson.choice.kind==='slanted'||(lesson.choice.kind==='horizontal'?axis==='y':axis==='x')):!rotation||initial||axis===lesson.segmentInfo().axis;
    $(`count${direction}`).disabled=!!animation||!allowed;
  }
  a11y('countClear',reflection?'Reset mirror position':rotation?'Clear current segment':'Clear blue path',reflection?'Tetapkan semula garis':rotation?'Padam bahagian semasa':'Padam laluan biru');
  $('countClear').disabled=!!animation;
  if(rotation) {
    const info=lesson.segmentInfo(),path=lesson.constructionPaths[info.arm];
    for(const axis of ['x','y']) {
      text(`countAxis${axis}`,axis==='x'?'Horizontal ↔':'Vertical ↕',axis==='x'?'Mengufuk ↔':'Menegak ↕');
      $(`countAxis${axis}`).setAttribute('aria-pressed',String(info.axis===axis));
      $(`countAxis${axis}`).disabled=true;
      const value=axis===info.axis?lesson.displayedBuildCount():path.end[axis]-activity().centre[axis];
      $(`countValue${axis}`).textContent=countWords(value,axis==='x');
    }
    text('countAuto','Auto current segment','Auto bahagian semasa');$('countAuto').disabled=!!animation;
  }
}

// Operation descriptions and mappings share the same question model as the engines.
function operationName(operation) {
  return operation.type==='translation'?tr('Translation','Translasi'):operation.type==='reflection'?tr('Reflection','Pantulan'):tr('Rotation','Putaran');
}
function operationDetail(operation) {
  if(operation.type==='translation')return tr(`vector ${coord(operation.vector)}`,`vektor ${coord(operation.vector)}`);
  if(operation.type==='reflection')return reflectionEquation(operation.mirror);
  return `${angleWords(operation.degrees)} · ${tr('centre','pusat')} ${coord(operation.centre)}`;
}
function operationHTML(operation) {
  const detail=operation.type==='translation'
    ? `<span class="mapping-vector"><span>${fmt(operation.vector.x)}</span><span>${fmt(operation.vector.y)}</span></span>`
    : `<span>${operationDetail(operation)}</span>`;
  return `<span class="sequence-operation"><b>${operation.symbol}</b><span>${operationName(operation)}</span>${detail}</span>`;
}
function renderSequenceCopy() {
  $('givenCombined').hidden=!sequence;
  if(!sequence)return;
  $('givenCombined').innerHTML=q.definitions.map(i=>`<div>${operationHTML(q.steps[i])}</div>`).join('');
  $('combinedControls').setAttribute('aria-label',tr('Order of transformations','Urutan transformasi'));
  text('sequenceFirst','First','Pertama');text('sequenceSecond','Then','Kemudian');
  const [first,second]=q.steps;
  $('sequenceFirstName').textContent=`${first.symbol} · ${operationName(first)}`;
  $('sequenceSecondName').textContent=`${second.symbol} · ${operationName(second)}`;
  $('sequenceOrder').textContent=q.composition==='K²'?'K² = K K':q.composition;
  text('sequenceRule',q.composition==='K²'?'Apply K twice.':'Apply the right-hand transformation first.',q.composition==='K²'?'Lakukan K dua kali.':'Lakukan transformasi di sebelah kanan dahulu.');
}
function syncSequence() {
  $('combinedControls').hidden=!sequence?.started;
  overview.update({sequence,language,reducedMotion:reducedMotion.matches,describe:op=>`${operationName(op)} · ${operationDetail(op)}`});
  document.body.classList.toggle('combined-intro',!!sequence?.started&&!sequence.teachingReady);
  $('finalMapping').classList.toggle('intermediate-mapping',!!sequence&&sequence.index===0);
  if(!sequence)return;
  $('finalMapping').hidden=true;
  const {index,started}=sequence,firstDone=sequence.lessons[0].answerVisible;
  $('sequenceStep0').setAttribute('aria-pressed',String(index===0));
  $('sequenceStep1').setAttribute('aria-pressed',String(index===1));
  $('sequenceStep0').disabled=busy()||!sequence.teachingReady;$('sequenceStep1').disabled=busy()||!sequence.teachingReady||!firstDone;
  $('sequencePoint0').textContent=firstDone?`${q.label}′ ${coord(sequence.intermediate)}`:tr('Intermediate image','Imej perantaraan');
  $('sequencePoint1').textContent=sequence.answerVisible?`${sequence.answerLabel} ${coord(sequence.answer)}`:tr('Final image','Imej akhir');
  text('answerHeading','Final image','Imej akhir');
  $('answer').textContent=`${sequence.answerLabel} = ${sequence.answerVisible?coord(sequence.answer):'(      ,      )'}`;
  $('answerBox').classList.toggle('revealed',sequence.answerVisible);
  if(!sequence.teachingReady) {
    for(const id of ['reflectionControls','rotationControls','enlargementControls','countControls','scrubber','mirrorHint'])$(id).hidden=true;
    text('stepNumber',`QUESTION ${q.number}`,`SOALAN ${q.number}`);
    const intro=[
      ['Which transformation comes first?','Transformasi manakah dilakukan dahulu?','First see the complete journey.','Lihat keseluruhan perjalanan dahulu.','Draw the two arrows →','Lukis dua anak panah →'],
      ['Two transformations, one journey','Dua transformasi, satu perjalanan','The middle and final coordinates stay blank until we find them.', 'Koordinat perantaraan dan akhir kekal kosong sehingga kita menentukannya.','Place the letters →','Letakkan huruf →'],
      [`${q.steps[0].symbol} first, then ${q.steps[1].symbol}`,`${q.steps[0].symbol} dahulu, kemudian ${q.steps[1].symbol}`,q.composition==='K²'?'Apply K twice, one step at a time.':'Read from the right: the right-hand letter belongs on the first arrow.',q.composition==='K²'?'Lakukan K dua kali, satu langkah pada satu masa.':'Baca dari kanan: huruf sebelah kanan berada pada anak panah pertama.',`Begin ${q.steps[0].symbol} →`,`Mulakan ${q.steps[0].symbol} →`],
    ][sequence.introStage];
    text('stepTitle',intro[0],intro[1]);text('stepDetail',intro[2],intro[3]);text('next',intro[4],intro[5]);
    $('next').disabled=busy();$('previous').disabled=!started||busy();
  } else {
    if(!lesson.stage)$('previous').disabled=busy();
    if(lesson.answerVisible) {
      text('stepNumber',index===0?'FIRST TRANSFORMATION COMPLETE':'FINAL ANSWER',index===0?'TRANSFORMASI PERTAMA SELESAI':'JAWAPAN AKHIR');
      if(index===0){text('next',`Apply ${q.steps[1].symbol} next →`,`Lakukan ${q.steps[1].symbol} pula →`);$('next').disabled=busy();}
    } else if(lesson.canReveal || (!isReflection()&&!isRotation()&&lesson.stage===3&&lesson.progress===2)) {
      text('next',index===0?'Reveal intermediate point':'Reveal final answer',index===0?'Dedahkan titik perantaraan':'Dedahkan jawapan akhir');
    }
    text('canvasCaption',index===0?`ORIGINAL ${q.label} STAYS IN PLACE`:`${q.label} → ${q.label}′ → ${sequence.answerLabel} · USE ${q.label}′ AS THE NEW OBJECT`,index===0?`TITIK ASAL ${q.label} DIKEKALKAN`:`${q.label} → ${q.label}′ → ${sequence.answerLabel} · GUNA ${q.label}′ SEBAGAI OBJEK BAHARU`);
    if(index===1)$('diagramDescription').textContent+=tr(` Original ${q.label} ${coord(q.given)} is preserved. First transformation ${q.steps[0].symbol} produced ${q.label}′ ${coord(sequence.intermediate)}.`,` Titik asal ${q.label} ${coord(q.given)} dikekalkan. Transformasi pertama ${q.steps[0].symbol} menghasilkan ${q.label}′ ${coord(sequence.intermediate)}.`);
  }
  if(busy()){$('next').disabled=true;$('previous').disabled=true;}
}
function selectSequenceStep(index) {
  if(!sequence || busy() || !sequence.select(index))return;
  stopCountPad();stopAnimation();pointers.clear();discard();clearScrub();
  lesson=sequence.current;axisPulseUntil=0;setTool('pan');renderCopy();fit();focusSequenceOverview();
}
$('sequenceStep0').onclick=()=>selectSequenceStep(0);
$('sequenceStep1').onclick=()=>selectSequenceStep(1);

function sync() {
  sequence?.reconcile();
  if (isEnlargement()) syncEnlargement(); else if (isRotation()) syncRotation(); else if (isReflection()) syncReflection(); else syncTranslation();
  syncCountingPad();
  $('answer').textContent = `${lesson.answerLabel} = ${lesson.answerVisible ? coord(lesson.answer) : '(      ,      )'}`;
  $('answer').classList.toggle('object-answer', lesson.inverse);
  $('answerBox').classList.toggle('revealed', lesson.answerVisible);
  $('finalMapping').hidden = !lesson.answerVisible||!!coordinateGuide;
  if (lesson.answerVisible) {
    $('mappingSource').textContent = `${activity().label}${coord(lesson.object)}`;
    $('mappingImage').textContent = `${sequence?lesson.answerLabel:activity().label+'′'}${coord(lesson.image)}`;
    const reflection = isReflection(), rotation = isRotation(), enlargement = isEnlargement();
    $('mappingVector').hidden = reflection || rotation || enlargement; $('mappingEnlargement').hidden = !enlargement;
    if (enlargement) $('mappingEnlargement').textContent = enlargementDescription();
    $('mappingMirror').hidden = !reflection; $('mappingRotation').hidden = !rotation;
    if (rotation) $('mappingRotation').textContent = `${rotationDescription()} · ${tr('centre', 'pusat')} ${coord(activity().centre)}`;
    if (reflection) $('mappingMirror').textContent = reflectionEquation(activity().mirror);
    else if (!rotation && !enlargement) { $('mappingDX').textContent = fmt(activity().vector.x); $('mappingDY').textContent = fmt(activity().vector.y); }
    text('mappingName', enlargement ? 'Enlargement' : rotation ? 'Rotation' : reflection ? 'Reflection in' : 'Translation', enlargement ? 'Pembesaran' : rotation ? 'Putaran' : reflection ? 'Pantulan pada' : 'Translasi');
    const operation = enlargement ? enlargementDescription() : rotation ? `${rotationDescription()} ${tr('about', 'berpusat di')} ${coord(activity().centre)}` : reflection ? tr(`reflection in ${reflectionEquation(activity().mirror)}`, `pantulan pada ${reflectionEquation(activity().mirror)}`) : tr(`translation vector ${coord(activity().vector)}`, `vektor translasi ${coord(activity().vector)}`);
    $('finalMapping').setAttribute('aria-label', tr(
      `${activity().label} ${coord(lesson.object)} maps to ${activity().label}′ ${coord(lesson.image)} under ${operation}.`,
      `${activity().label} ${coord(lesson.object)} dipetakan kepada ${activity().label}′ ${coord(lesson.image)} di bawah ${operation}.`));
  }
  text('canvasCaption', lesson.stage ? `GIVEN ${lesson.givenLabel} STAYS IN PLACE` : `GIVEN DIAGRAM · QUESTION ${q.number}`, lesson.stage ? `TITIK DIBERI ${lesson.givenLabel} DIKEKALKAN` : `RAJAH DIBERI · SOALAN ${q.number}`);
  $('undo').disabled = !inkStore.past.length; $('redo').disabled = !inkStore.future.length;
  const b=graphBounds();
  $('diagramDescription').textContent = tr(`Grid: x from ${fmt(b.xmin)} to ${fmt(b.xmax)}, y from ${fmt(b.ymin)} to ${fmt(b.ymax)}. Given point ${lesson.givenLabel} at ${coord(activity().given)}.`, `Graf: x dari ${fmt(b.xmin)} hingga ${fmt(b.xmax)}, y dari ${fmt(b.ymin)} hingga ${fmt(b.ymax)}. Titik diberi ${lesson.givenLabel} pada ${coord(activity().given)}.`) + (lesson.answerVisible ? ` ${lesson.answerLabel} = ${coord(lesson.answer)}.` : '');
  syncSequence();
  if(!coordinateGuide)decorateCentreSources();
  syncCoordinateGuide();
  schedule();
}

function schedule() { if (!frame) frame = requestAnimationFrame(draw); }
function stopAnimation() { cancelCoordinateGuide(); cancelAnimationFrame(animation); animation = 0; if (isEnlargement() || isRotation()) {lesson.counting=false;lesson.countAnimation=null;} }
function animateProgress(target) {
  stopAnimation();
  const from = lesson.progress;
  if (from === target || reducedMotion.matches) { lesson.progress = target; sync(); return; }
  let start;
  const tick = time => {
    start ??= time; const t = Math.min(1, (time - start) / 650), eased = t * t * (3 - 2 * t);
    lesson.progress = from + (target - from) * eased;
    $('progress').value = lesson.progress;
    if (isEnlargement()) syncEnlargement();
    if (isRotation() && lesson.stage === 10) {
      const value = rotationProgressLabel();
      $('stepTitle').textContent = value; $('progress').setAttribute('aria-valuetext',value);
    }
    schedule();
    if (t < 1) animation = requestAnimationFrame(tick);
    else { animation = 0; lesson.progress = target; sync(); }
  };
  animation = requestAnimationFrame(tick); sync();
}
// Animate exactly one component. The original path stays in place while the
// teacher builds the image independently from the same centre.
function animateSquareCount(from,target,update,details={}) {
  stopAnimation();const duration=Math.ceil(Math.abs(target-from))*340;
  if(!duration || reducedMotion.matches){update(target);sync();return;}
  lesson.counting=true;lesson.countAnimation={...details,from,to:target};let start;
  const tick=time=>{
    start??=time;update(squareCountAt(from,target,time-start));
    if(time-start<duration){animation=requestAnimationFrame(tick);sync();}
    else {update(target);lesson.counting=false;lesson.countAnimation=null;animation=0;sync();}
  };
  animation=requestAnimationFrame(tick);sync();
}
function animateCount(source,axis,target) {
  const counts=source==='given'?lesson.givenCounts:lesson.imageCounts;
  animateSquareCount(counts[axis],target,value=>{counts[axis]=value;},{source,axis});
}
function countRotation() {
  if(!isRotation()||!lesson.stage||lesson.constructionComplete||animation)return;
  const i=lesson.buildIndex,{target}=lesson.segmentInfo();lesson.stage=Math.min(8,i+2);
  animateSquareCount(lesson.buildCounts[i],target,value=>{lesson.buildCounts[i]=value;});
}

function countImage(axis,target,{manual=false}={}) {
  if (!isEnlargement() || !lesson.ready || animation) return;
  const from=lesson.imageCounts[axis];lesson.setCount(axis,target);
  const destination=lesson.imageCounts[axis];lesson.imageCounts[axis]=from;
  // Keep the camera steady unless the teacher's own count goes off-screen.
  const end=graphToScreen({...activity().centre,[axis]:activity().centre[axis]+destination},view);
  if(end.x<35||end.x>canvas.clientWidth-35||end.y<35||end.y>canvas.clientHeight-70) {
    lesson.imageCounts[axis]=destination;fit();lesson.imageCounts[axis]=from;
  }
  if(manual){lesson.imageCounts[axis]=destination;sync();}
  else animateCount('image',axis,destination);
}
function goTo(stage) {
  if(isEnlargement()) {
    stopAnimation();lesson.goTo(stage);
    const axis=stage===3?'x':stage===4?'y':null;
    if(axis) {const target=lesson.givenCounts[axis];lesson.givenCounts[axis]=0;animateCount('given',axis,target);}
    else sync();
    return;
  }
  const from = lesson.progress; lesson.goTo(stage); const target = lesson.progress;
  if ((isRotation() || isEnlargement()) && fitted) fit();
  lesson.progress = from; animateProgress(target);
}
function reflectTo(target) {
  if (!lesson.choice) return;
  const from = lesson.progress; lesson.scrub(target); lesson.progress = from;
  ensureTrialVisible(); animateProgress(target);
}
function ensureTrialVisible() {
  if (!lesson.trialAnswer) return;
  const point = graphToScreen(lesson.trialAnswer, view);
  if (point.x < 40 || point.x > canvas.clientWidth - 80 || point.y < 50 || point.y > canvas.clientHeight - 65) fit();
}

function draw() {
  frame = 0;
  const image = lesson.pointAt(), visibleImage = (isEnlargement() ? lesson.ready && (lesson.mode==='count' ? lesson.canReveal : lesson.factor !== 1) : isRotation() ? lesson.angle !== 0 : lesson.progress > 0) && (!(isReflection() || isRotation() || isEnlargement()) || Math.hypot(image.x - activity().given.x, image.y - activity().given.y) > 1e-8);
  const reflection = isReflection(), rotation = isRotation(), enlargement = isEnlargement(), v = reflection || rotation || enlargement ? { x: 0, y: 0 } : lesson.movementVector;
  const a = graphToScreen(activity().given, view), corner = graphToScreen({ x: activity().given.x + v.x, y: activity().given.y }, view), p = graphToScreen(image, view);
  const obstacles = [...board.querySelectorAll('button:not([hidden]),.ink-tools,.view-tools,.canvas-caption,.mirror-hint')].filter(el => el.getClientRects().length).map(el => { const r = el.getBoundingClientRect(), b = board.getBoundingClientRect(); return { x: r.left - b.left, y: r.top - b.top, w: r.width, h: r.height }; });
  if(coordinateGuide){
    const point=coordinateGuide.point,c=graphToScreen(point,view),x=graphToScreen({x:point.x,y:0},view),y=graphToScreen({x:0,y:point.y},view);
    const ctx=canvas.getContext('2d');ctx.save();ctx.font='700 22px system-ui';
    const w=ctx.measureText(`${coordinateGuide.label} (${fmt(point.x)}, ${fmt(point.y)})`).width+18;ctx.restore();
    obstacles.push({x:c.x-w/2,y:c.y-50,w,h:34},{x:x.x-35,y:x.y,w:70,h:36},{x:y.x-52,y:y.y-18,w:62,h:36});
  }
  if(sequence?.index===1){const original=graphToScreen(q.given,view);obstacles.push({x:original.x-10,y:original.y-10,w:20,h:20});}
  if (lesson.answerVisible&&!sequence&&!coordinateGuide) obstacles.push(positionMapping([a,p], obstacles));
  if (!reflection && !rotation && !enlargement && lesson.progress >= 1) obstacles.push({ x: (a.x + corner.x) / 2 - 23, y: a.y - 32, w: 46, h: 28 });
  if (!reflection && !rotation && !enlargement && lesson.progress === 2) obstacles.push({ x: corner.x + 2, y: (corner.y + p.y) / 2 - 14, w: 44, h: 28 });
  const tracing=(point,label)=>coordinateGuide&&pointKey(coordinateGuide.point,coordinateGuide.label)===pointKey(point,label);
  const complete = rotation || enlargement ? true : lesson.progress === (reflection ? 1 : 2);
  const pulse = reducedMotion.matches ? 0 : Math.max(0, (axisPulseUntil - performance.now()) / 600);
  drawGraph({ view, labelOverlapPenalty: (sequence || enlargement) ? 2000 : undefined, pointLabelSpread: (sequence || enlargement) ? Math.PI/2 : undefined, pointLabelRings: (sequence || enlargement) ? 12 : undefined, originLabel: !(reflection && lesson.choice && lesson.choice.k === 0), gridBounds: graphBounds(), tickStride: enlargement && GRID_UNIT*view.zoom<14 ? 5 : 2, axisFontSize: 15, labelFontSize: (reflection || rotation || enlargement) && canvas.clientWidth < 500 ? 19 : 23, pointRadius: 5,
    objects: [...(sequence?.index===1 ? [{id:'original',points:[q.given],labels:[tracing(q.given,q.label)?'':q.label],coordinates:!tracing(q.given,q.label)}] : []),
      { id: 'given', points: [activity().given], labels: [tracing(activity().given,lesson.givenLabel)?'':lesson.givenLabel], image: lesson.inverse, role:sequence?.index===1?'intermediate':undefined, coordinates: !tracing(activity().given,lesson.givenLabel) && (lesson.stage > 0 || sequence?.index===1 || readPoints.has(pointKey(activity().given,lesson.givenLabel))), labelPlacement: enlargement && lesson.inverse ? 'below' : undefined }],
    preview: visibleImage ? { id: 'moving', points: [image], labels: [tracing(image,lesson.answerLabel)?'':complete ? (reflection || rotation || enlargement) && !lesson.matchesQuestion ? tr('Trial', 'Cubaan') : lesson.answerLabel : ''], image: !lesson.inverse, role:sequence?.index===0?'intermediate':undefined, coordinates: lesson.answerVisible && !tracing(image,lesson.answerLabel), labelPlacement: enlargement ? 'below' : undefined } : null,
    annotations: erased ?? inkStore.document.objects, ink, overlays: obstacles,
    geometryOverlay: enlargement ? (ctx,base) => paintEnlargementLesson(ctx, {lesson,view,dark,width:canvas.clientWidth,height:canvas.clientHeight,overlays:[...obstacles,...base.obstacles],centreLabel:activity().label==='C'?tr('Centre','Pusat'):'C'}) : rotation ? (ctx,base) => paintRotationLesson(ctx, { lesson, view, dark, width:canvas.clientWidth,height:canvas.clientHeight,overlays:[...obstacles,...base.obstacles],clockTime: reducedMotion.matches ? 750 : performance.now() - clockStarted }) : reflection ? ctx => paintReflectionLesson(ctx, { lesson, view, bounds: {xmin:screenToGraph({x:0,y:0},view).x,xmax:screenToGraph({x:canvas.clientWidth,y:0},view).x,ymin:screenToGraph({x:0,y:canvas.clientHeight},view).y,ymax:screenToGraph({x:0,y:0},view).y}, dark, pulse,handlesActive:tool==='pan' }) : null,
  });
  if(enlargement||reflection||rotation||!visibleImage){
    drawCoordinateGuide();
    if(reflection&&pulse>0||rotation&&lesson.clockVisible&&!reducedMotion.matches&&!document.hidden)schedule();
    return;
  }
  const ctx = canvas.getContext('2d'), colour = dark ? '#91beff' : '#2468c4';
  ctx.save(); ctx.strokeStyle = colour; ctx.fillStyle = colour; ctx.lineWidth = 2; ctx.setLineDash([5, 5]);
  ctx.beginPath(); ctx.moveTo(a.x, a.y); if (lesson.progress > 1) ctx.lineTo(corner.x, corner.y); ctx.lineTo(p.x, p.y); ctx.stroke(); ctx.setLineDash([]);
  const label = (value, x, y) => { ctx.font = '600 18px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineWidth = 6; ctx.strokeStyle = dark ? '#15181d' : '#fff'; ctx.strokeText(value, x, y); ctx.fillText(value, x, y); };
  if (!coordinateGuide && lesson.progress >= 1) label(signed(v.x), (a.x + corner.x) / 2, a.y - 18);
  if (!coordinateGuide && lesson.progress === 2) label(signed(v.y), corner.x + 24, (corner.y + p.y) / 2);
  ctx.restore();drawCoordinateGuide();
}

function positionMapping(points, controls) {
  const el = $('finalMapping'), w = el.offsetWidth, h = el.offsetHeight;
  const width = canvas.clientWidth, height = canvas.clientHeight;
  const origin = graphToScreen({ x: 0, y: 0 }, view);
  const midX = (points[0].x + points[1].x) / 2;
  // Prefer the empty area below the construction and horizontal axis. If the
  // camera moves, choose a visible alternative clear of point labels and tools.
  const preferred = { x: midX - w / 2, y: Math.max(origin.y, ...points.map(p => p.y)) + 58 };
  const clamp = p => ({ x: Math.max(12, Math.min(width - w - 12, p.x)), y: Math.max(12, Math.min(height - h - 76, p.y)), w, h });
  const options = [preferred,
    { x: width / 2 - w / 2, y: height - h - 82 },
    { x: Math.max(...points.map(p => p.x)) + 80, y: (points[0].y + points[1].y) / 2 - h / 2 },
    { x: Math.min(...points.map(p => p.x)) - w - 80, y: (points[0].y + points[1].y) / 2 - h / 2 },
    { x: midX - w / 2, y: Math.min(...points.map(p => p.y)) - h - 80 },
  ].map(clamp);
  // Search additional open rows on narrow canvases; the mirror itself is part
  // of the proof and must not disappear behind a full-width mapping card.
  for (let y = 64; y <= height - h - 76; y += 20) options.push(clamp({ x: midX - w / 2, y }));
  const avoid = controls.concat(points.map(p => ({ x: p.x - 88, y: p.y - 40, w: 176, h: 70 })));
  if ((isRotation() || isEnlargement()) && lesson.stage) {
    const c = graphToScreen(activity().centre, view);
    avoid.push({ x: c.x - 48, y: c.y - 48, w: 96, h: 96 });
    if (isEnlargement()) avoid.push({x:c.x-100,y:c.y+12,w:100,h:28});
    for (const arm of (isRotation() ? lesson.arms : [{corner:{x:activity().given.x,y:activity().centre.y},end:activity().given},{corner:{x:lesson.pointAt().x,y:activity().centre.y},end:lesson.pointAt()}])) {
      const b = graphToScreen(arm.corner, view), e = graphToScreen(arm.end, view);
      for (const [a,z] of [[c,b],[b,e]]) avoid.push({x:Math.min(a.x,z.x)-6,y:Math.min(a.y,z.y)-6,w:Math.abs(a.x-z.x)+12,h:Math.abs(a.y-z.y)+12});
    }
  }
  if (isReflection() && lesson.choice) {
    const f = graphToScreen(lesson.foot, view);
    avoid.push({ x: f.x - 20, y: f.y - 20, w: 40, h: 40 });
    if (lesson.choice.kind === 'horizontal') {
      const b = graphBounds(), left = graphToScreen({x:b.xmin,y:lesson.choice.k},view), right = graphToScreen({x:b.xmax,y:lesson.choice.k},view);
      avoid.push({ x: left.x, y: left.y - 12, w: right.x - left.x, h: 24 });
    }
  }
  const score = p => avoid.reduce((sum, o) => sum + Math.max(0, Math.min(p.x + w, o.x + o.w) - Math.max(p.x, o.x)) * Math.max(0, Math.min(p.y + h, o.y + o.h) - Math.max(p.y, o.y)) * 20, 0) + Math.hypot(p.x - preferred.x, p.y - preferred.y);
  const best = options.reduce((a, b) => score(a) <= score(b) ? a : b);
  el.style.left = `${best.x}px`; el.style.top = `${best.y}px`;
  return best;
}

function fittedView(width=canvas.clientWidth,height=canvas.clientHeight) {
  return fitQuestion(cameraBounds(),Math.max(180,width),Math.max(180,height));
}
function fit() { fitted = true; view = fittedView(); schedule(); }
function zoom(factor, point = { x: canvas.clientWidth / 2, y: canvas.clientHeight / 2 }) {
  fitted = false; const scale = Math.max(.2, Math.min(3, view.zoom * factor)); view = zoomAt(view, point, scale / view.zoom); schedule();
}
function setTool(next) {
  const guideWasActive=!!coordinateGuide;cancelCoordinateGuide();
  discard(); pointers.clear(); tool = next;
  for (const name of ['pan', 'pen', 'eraser']) $(name).setAttribute('aria-pressed', String(tool === name));
  canvas.style.cursor = tool === 'pan' ? 'grab' : 'crosshair';
  if(guideWasActive)sync();
}
function discard() { drag = null; ink = null; erased = null; schedule(); }
const ownership = installCanvasOwnership(canvas, () => { pointers.clear(); discard(); });
const screenPoint = e => { const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
const graphPoint = e => screenToGraph(screenPoint(e), view);
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
canvas.onpointerdown = e => {
  if (e.button !== 0 || !ownership.allowed()) return;
  e.preventDefault(); canvas.focus({ preventScroll: true }); canvas.setPointerCapture(e.pointerId); pointers.set(e.pointerId, screenPoint(e));
  if (pointers.size === 2) {
    discard(); const entries = [...pointers.entries()], [a, b] = entries.map(v => v[1]);
    drag = { type: 'pinch', ids: entries.map(v => v[0]), view: { ...view }, midpoint: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, distance: Math.max(1, distance(a, b)) }; return;
  }
  if (pointers.size > 2 || drag) return;
  const p = graphPoint(e); drag = { type: tool, pointer: e.pointerId, start: screenPoint(e), view: { ...view }, previous: p };
  if (!coordinateGuide && isReflection() && tool === 'pan' && lesson.choice) {
    const line=lesson.line,handle=lesson.handles.findIndex(h=>distance(graphToScreen(h,view),screenPoint(e))<=19);
    const nearLine=Math.abs(line.a*p.x+line.b*p.y+line.c)/Math.hypot(line.a,line.b)*GRID_UNIT*view.zoom<=14;
    if(handle>=0 || nearLine)drag={...drag,type:handle>=0?'mirror-handle':'mirror',handle,startGraph:p,startHandles:structuredClone(lesson.handles),startChoice:structuredClone(lesson.choice)};
  }
  if (tool === 'pen') ink = newAnnotation([p], '#d04d40', 2.6 / (GRID_UNIT * view.zoom));
  if (tool === 'eraser') erased = eraseAnnotations(inkStore.document.objects, p, p, 13 / (GRID_UNIT * view.zoom));
  schedule();
};
canvas.onpointermove = e => {
  if (!pointers.has(e.pointerId) || !drag) return;
  pointers.set(e.pointerId, screenPoint(e));
  if (drag.type === 'pinch') {
    const [a, b] = drag.ids.map(id => pointers.get(id)); if (!a || !b) return;
    fitted = false; const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, scale = Math.max(.2, Math.min(3, drag.view.zoom * distance(a, b) / drag.distance));
    const next = zoomAt(drag.view, drag.midpoint, scale / drag.view.zoom);
    view = { ...next, x: next.x + mid.x - drag.midpoint.x, y: next.y + mid.y - drag.midpoint.y };
  } else if (drag.pointer === e.pointerId) {
    const p = graphPoint(e), s = screenPoint(e);
    if(distance(s,drag.start)>8)drag.moved=true;
    if (drag.type === 'mirror') {
      changeTrial(()=>lesson.shift(Math.round(p.x-drag.startGraph.x),Math.round(p.y-drag.startGraph.y),drag.startHandles));
    } else if(drag.type==='mirror-handle') {
      const handles=structuredClone(drag.startHandles);handles[drag.handle]={x:Math.round(p.x),y:Math.round(p.y)};
      changeTrial(()=>lesson.setHandles(handles));
    }
    else if (drag.type === 'pan') { fitted = false; view = { ...drag.view, x: drag.view.x + s.x - drag.start.x, y: drag.view.y + s.y - drag.start.y }; }
    else if (drag.type === 'pen') { const samples = e.getCoalescedEvents?.(); for (const sample of samples?.length ? samples : [e]) { const v = graphPoint(sample); if (ink.points.length < 10000 && distance(v, ink.points.at(-1)) * GRID_UNIT * view.zoom > .8) ink.points.push(v); } }
    else if (drag.type === 'eraser') { erased = eraseAnnotations(erased, drag.previous, p, 13 / (GRID_UNIT * view.zoom)); drag.previous = p; }
  }
  schedule();
};
function endPointer(e, cancelled = false) {
  if (!pointers.has(e.pointerId)) return;
  pointers.delete(e.pointerId);
  if (!drag) return;
  if (drag.type === 'pinch') { if (drag.ids.includes(e.pointerId)) { pointers.clear(); discard(); } return; }
  if (drag.pointer !== e.pointerId) return;
  if (cancelled && drag.type.startsWith('mirror')) changeTrial(()=>lesson.changeLine(drag.startChoice));
  if (!cancelled && ink) { const stroke = ink; inkStore.transact(d => d.objects.push(stroke)); }
  if (!cancelled && erased) { const strokes = erased; inkStore.transact(d => { d.objects = strokes; }); }
  const tapped=!cancelled&&(drag.type==='pan'||drag.type.startsWith('mirror'))&&!drag.moved&&distance(drag.start,screenPoint(e))<8;
  discard();
  if(tapped)replayPointAt(screenPoint(e));
}
canvas.onpointerup = e => endPointer(e);
canvas.onpointercancel = canvas.onlostpointercapture = e => endPointer(e, true);
canvas.addEventListener('wheel', e => { e.preventDefault(); if (!drag) zoom(Math.exp(-e.deltaY * .001), screenPoint(e)); }, { passive: false });
canvas.onkeydown = e => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); discard(); e.shiftKey ? inkStore.redo() : inkStore.undo(); }
  else if (e.key === 'Escape') { cancelCoordinateGuide();pointers.clear(); discard();sync(); }
  else if ((e.key === 'ArrowRight' || e.key === 'Enter') && !animation && (sequence || lesson.stage < (isRotation() ? 11 : isEnlargement() ? 5 : 4))) { e.preventDefault(); advance(); }
  else if (e.key === 'ArrowLeft' && !animation && (lesson.stage > 0 || sequence?.started)) { e.preventDefault(); previousStep(); }
};

function focusSequenceOverview() {
  // On a narrow screen Next can be below the graph. Bring the introduction
  // into view before its animation rather than leaving it above the viewport.
  if(sequence?.started&&matchMedia('(max-width:760px)').matches)$('combinedControls').scrollIntoView({block:'start'});
}
function advance() {
  if(busy()) return;
  stopCountPad();
  if(sequence&&!sequence.teachingReady){sequence.advanceIntro();renderCopy();fit();focusSequenceOverview();return;}
  if(!lesson.answerVisible&&!readPoints.has(pointKey(activity().given,lesson.givenLabel))){startCoordinateGuide(activity().given,lesson.givenLabel);return;}
  if(!lesson.stage&&(isRotation()||isEnlargement())) {
    startCoordinateGuide(activity().centre,tr('Centre','Pusat'),{mode:'plot',complete:()=>{lesson.goTo(1);if(fitted)fit();}});return;
  }
  if (lesson.answerVisible) {
    if(sequence&&sequence.index===0){selectSequenceStep(1);return;}
    if (nextQuestion()) selectQuestion(nextQuestion().id); return;
  }
  if (isEnlargement()) {
    if (!lesson.ready) goTo(lesson.stage+1);
    else if (lesson.canReveal) revealWithCoordinates();
    else if(lesson.mode==='scale') { lesson.scrub(1);animateProgress(lesson.requiredFactor); }
    else {
      const axis=lesson.nextCountAxis;
      countImage(axis,lesson.requiredCounts[axis]);
    }
    return;
  }
  if (isRotation()) {
    if (!lesson.constructionComplete) {
      if(lesson.buildCounts[lesson.buildIndex]===0&&lesson.segmentInfo().target!==0)countRotation();
      else {lesson.advanceConstruction();sync();}
    }
    else if (lesson.canReveal) revealWithCoordinates();
    else if(lesson.constructionMatches) { lesson.scrub(0); lesson.stage = 10; lesson.direction = Math.sign(lesson.movementDegrees); animateProgress(lesson.movementDegrees); }
    return;
  }
  if (isReflection()) {
    if (!lesson.choice) return;
    if (!lesson.progress && !lesson.guideVisible) { lesson.toggleGuides(); sync(); }
    else if (lesson.progress < 1) reflectTo(1);
    else if(lesson.canReveal)revealWithCoordinates();
    return;
  }
  const nextStage=lesson.progress < lesson.targetProgress ? lesson.stage : lesson.stage + 1;
  if(nextStage===4)revealWithCoordinates();else goTo(nextStage);
}
function previousStep() {
  if(busy()) return;
  stopCountPad();
  if(sequence&&!sequence.teachingReady){sequence.previousIntro();renderCopy();fit();focusSequenceOverview();return;}
  if(sequence&&lesson.stage===0){
    if(sequence.index===1)selectSequenceStep(0);
    else {sequence.previousIntro();renderCopy();fit();focusSequenceOverview();}
    return;
  }
  if (isEnlargement()) {
    if (lesson.answerVisible) { lesson.answerVisible=false;lesson.stage=6;sync(); }
    else if(lesson.mode==='scale') { lesson.setMode('count');if(fitted)fit();sync(); }
    else if(lesson.stage===6) {lesson.imageCounts.y=0;lesson.stage=5;lesson.countAxis='y';sync();}
    else if(lesson.stage===5) {lesson.imageCounts={x:0,y:0};lesson.imageStarted=false;lesson.stage=4;lesson.countAxis='x';sync();}
    else goTo(lesson.stage-1);
    return;
  }
  if (isRotation()) {
    if (lesson.answerVisible) { lesson.scrub(lesson.angle); sync(); }
    else if (lesson.angle !== 0) { lesson.answerVisible = false; lesson.stage = 9; animateProgress(0); }
    else {lesson.previousConstruction();sync();}
    return;
  }
  if (!isReflection()) { goTo(lesson.stage - 1); return; }
  if (lesson.answerVisible) { lesson.scrub(1); sync(); }
  else if (lesson.progress > 0) reflectTo(0);
  else if (lesson.guideVisible) { lesson.toggleGuides(); sync(); }
  else { lesson.reset(); fit(); sync(); }
}
function changeTrial(change) {
  if (!change()) return;
  stopAnimation(); clearScrub();
  axisPulseUntil = performance.now() + 600;
  sync();
}
for (const button of document.querySelectorAll('[data-orientation]')) button.onclick = () => {stopCountPad();changeTrial(() => lesson.chooseOrientation(button.dataset.orientation,visibleBounds()));};
$('slopePositive').onclick = () => changeTrial(() => lesson.setSlope(1));
$('slopeNegative').onclick = () => changeTrial(() => lesson.setSlope(-1));
$('clockGuide').onclick = () => { if (lesson.toggleClock()) { clockStarted = performance.now(); sync(); } };
$('guides').onclick = () => { lesson.toggleGuides(); sync(); };
$('enlargementMode').onclick=()=>{stopCountPad();lesson.setMode(lesson.mode==='count'?'scale':'count');if(fitted)fit();sync();};
for(const axis of ['x','y']) {
  $(`countAxis${axis}`).onclick=()=>{if(isEnlargement()){lesson.selectCountAxis(axis);sync();}};
  $('order'+axis.toUpperCase()).onclick=()=>{stopCountPad();stopAnimation();lesson.selectFirstAxis(axis);sync();};
}
function nudgeCount(axis,delta) {
  if(busy())return;
  if(isReflection()) {
    if(!lesson.choice || (lesson.choice.kind==='horizontal'&&axis==='x') || (lesson.choice.kind==='vertical'&&axis==='y'))return;
    changeTrial(()=>lesson.shift(axis==='x'?delta:0,axis==='y'?delta:0));
  } else if(isRotation()) {
    if(lesson.nudgeConstruction(axis,delta)){const info=lesson.segmentInfo(),path=lesson.constructionPaths[info.arm],p=graphToScreen(info.part?path.end:path.corner,view);if(p.x<25||p.x>canvas.clientWidth-25||p.y<30||p.y>canvas.clientHeight-65)fit();sync();}
  } else if(isEnlargement())countImage(axis,lesson.imageCounts[axis]+delta,{manual:true});
}
for(const [direction,axis,delta] of [['Left','x',-1],['Right','x',1],['Up','y',1],['Down','y',-1]]) {
  countRepeats.push(bindRepeatingButton($(`count${direction}`),()=>nudgeCount(axis,delta),{
    delay:260,interval:160,enabled:()=>!$('countControls').hidden && !busy(),
  }));
}
$('countPad').onkeydown=e=>{
  const direction={ArrowLeft:['x',-1],ArrowRight:['x',1],ArrowUp:['y',1],ArrowDown:['y',-1]}[e.key];
  if(direction){e.preventDefault();nudgeCount(...direction);}
};
$('countAuto').onclick=()=>isRotation()?countRotation():countImage(lesson.countAxis,lesson.requiredCounts[lesson.countAxis]);
$('countClear').onclick=()=>{
  stopCountPad();
  if(isRotation()){lesson.clearConstructionSegment();sync();}
  else if(isReflection())changeTrial(()=>lesson.resetLine(visibleBounds()));
  else {lesson.goTo(4);sync();}
};
$('next').onclick = advance;
$('previous').onclick = previousStep;
function clearScrub() { reflectionScrub = null; freeScrub = null; scrubPointer = null; }
function changeFreeTransform(change) { stopAnimation(); clearScrub(); change(); sync(); }
$('rotationCW').onclick = () => changeFreeTransform(() => lesson.setDirection(-1));
$('rotationCCW').onclick = () => changeFreeTransform(() => lesson.setDirection(1));
for (const button of document.querySelectorAll('[data-rotation-angle]')) button.onclick = () => changeFreeTransform(() => lesson.scrub(Number(button.dataset.rotationAngle)*lesson.direction));
for (const button of document.querySelectorAll('[data-scale-factor]')) button.onclick = () => changeFreeTransform(() => lesson.scrub(Number(button.dataset.scaleFactor)));
const moveFreeScrub = e => {
  if (!freeScrub || e.pointerId !== scrubPointer) return;
  const r = $('progress').getBoundingClientRect(), inset = 10;
  const min=Number($('progress').min),max=Number($('progress').max),step=Number($('progress').step);
  const raw = min + ((e.clientX - r.left - inset) / Math.max(1,r.width - 2*inset)) * (max-min);
  lesson.scrub(freeScrub.snap.move(Math.round(raw/step)*step)); sync();
};
$('progress').onpointerdown = e => {
  if (e.button !== 0 || scrubPointer !== null) return;
  if (isRotation() || isEnlargement()) {
    e.preventDefault(); stopAnimation(); e.currentTarget.focus({preventScroll:true});
    freeScrub = { start:lesson.progress, snap:isRotation()?new RotationSnap(lesson.angle):new EnlargementSnap(lesson.factor) }; scrubPointer = e.pointerId;
    e.currentTarget.setPointerCapture(e.pointerId); moveFreeScrub(e); return;
  }
  if (!isReflection()) return;
  stopAnimation(); ensureTrialVisible(); reflectionScrub = new ReflectionScrub(lesson.progress); scrubPointer = e.pointerId;
  e.currentTarget.setPointerCapture(e.pointerId);
};
$('progress').onpointermove = moveFreeScrub;
$('progress').oninput = e => {
  if (freeScrub) return;
  stopAnimation(); const value = Number(e.target.value);
  if (isReflection()) { ensureTrialVisible(); reflectionScrub?.move(value); }
  lesson.scrub(value); sync();
};
$('progress').onpointerup = e => {
  if (e.pointerId !== scrubPointer) return;
  if (freeScrub) { moveFreeScrub(e); clearScrub(); return; }
  if (!reflectionScrub) return;
  const target = reflectionScrub.target(); clearScrub(); reflectTo(target);
};
$('progress').onpointercancel = $('progress').onlostpointercapture = e => {
  if (e.pointerId !== scrubPointer) return;
  const start = freeScrub?.start ?? reflectionScrub?.start;
  clearScrub(); if (start !== undefined) { stopAnimation(); lesson.scrub(start); sync(); }
};
$('progress').onkeydown = e => {
  if (isEnlargement()) {
    const k=lesson.factor,values={ArrowRight:k+.01,ArrowUp:k+.01,ArrowLeft:k-.01,ArrowDown:k-.01,PageUp:k+.5,PageDown:k-.5,Home:1,End:3};
    if(Object.hasOwn(values,e.key)){e.preventDefault();changeFreeTransform(()=>lesson.scrub(values[e.key]));}
    return;
  }
  if (!isRotation()) return;
  const values = {ArrowRight:lesson.angle+1,ArrowUp:lesson.angle+1,ArrowLeft:lesson.angle-1,ArrowDown:lesson.angle-1,PageUp:lesson.angle+90,PageDown:lesson.angle-90,Home:0,End:360*lesson.direction};
  if (Object.hasOwn(values,e.key)) { e.preventDefault(); changeFreeTransform(() => lesson.scrub(values[e.key])); }
};
$('reset').onclick = () => { overview.cancel();stopCountPad();stopAnimation();readPoints.clear(); pointers.clear(); discard(); if(sequence){sequence.reset();lesson=sequence.current;}else lesson.reset(); clearScrub(); inkStore.transact(d => { d.objects = []; }); setTool('pan'); renderCopy(); fit(); };
for (const name of ['pan', 'pen', 'eraser']) $(name).onclick = () => setTool(name);
$('undo').onclick = () => { discard(); inkStore.undo(); }; $('redo').onclick = () => { discard(); inkStore.redo(); };
unsubscribeInk = inkStore.subscribe(sync);
function selectQuestion(id, updateUrl = true) {
  const next = findModuleQuestion(id); if (!next) return;
  overview.cancel();stopCountPad();stopAnimation();readPoints.clear(); pointers.clear(); discard(); unsubscribeInk();
  q = next; rootLesson = createModuleLesson(q);sequence=q.type==='combined'?rootLesson:null;lesson=sequence?.current||rootLesson; axisPulseUntil = 0; clearScrub();
  if (!questionInk.has(q.id)) questionInk.set(q.id, new DocumentStore());
  inkStore = questionInk.get(q.id); unsubscribeInk = inkStore.subscribe(sync);
  $('status').hidden = true;
  if (updateUrl) { const url = new URL(location.href); url.searchParams.set('question', q.id); history.pushState(null, '', url); }
  setTool('pan'); renderCopy(); fit();
}
$('questionNav').onclick = e => { const button = e.target.closest('[data-question]'); if (button && button.dataset.question !== q.id) selectQuestion(button.dataset.question); };
$('questionGroup').onchange = e => selectQuestion(({translation:'1',reflection:'5',rotation:'9',enlargement:'17',combined:'21'})[e.target.value]);
window.addEventListener('popstate', () => selectQuestion(findModuleQuestion(new URLSearchParams(location.search).get('question'))?.id || QUESTION_ONE.id, false));
$('zoomOut').onclick = () => zoom(.8); $('zoomIn').onclick = () => zoom(1.25); $('fit').onclick = fit;
function toggleQuestion() {
  collapsed = !collapsed; $('lesson').classList.toggle('question-collapsed', collapsed);
  $('questionPanel').hidden = collapsed; $('expand').hidden = !collapsed;
  $('collapse').setAttribute('aria-expanded', String(!collapsed)); $('expand').setAttribute('aria-expanded', String(!collapsed));
  (collapsed ? $('expand') : $('collapse')).focus({ preventScroll: true });
}
$('collapse').onclick = $('expand').onclick = toggleQuestion;
$('language').onclick = () => { cancelCoordinateGuide(); language = language === 'en' ? 'bm' : 'en'; try { localStorage.setItem('maths-workspace:language', JSON.stringify(language)); } catch {} renderCopy(); };
$('theme').onclick = () => { cancelCoordinateGuide(); dark = !dark; try { localStorage.setItem('maths-workspace:theme', dark ? 'dark' : 'light'); } catch {} renderCopy(); };
function syncFullscreen() { text('fullscreen', document.fullscreenElement ? 'Exit full screen' : 'Full screen', document.fullscreenElement ? 'Keluar skrin penuh' : 'Skrin penuh'); }
$('fullscreen').onclick = async () => {
  try { if (document.fullscreenElement) await document.exitFullscreen(); else if (document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen(); else throw Error('unsupported'); }
  catch { $('status').hidden = false; text('status', 'Full screen is unavailable in this browser. Hide the question for more canvas space.', 'Skrin penuh tidak tersedia dalam pelayar ini. Sembunyikan soalan untuk meluaskan kanvas.'); clearTimeout(statusTimer); statusTimer = setTimeout(() => { $('status').hidden = true; }, 5000); }
};
document.addEventListener('fullscreenchange', syncFullscreen);
const resize = new ResizeObserver(() => {
  const width = canvas.clientWidth, height = canvas.clientHeight;
  if (fitted || !previousSize) view = fittedView(width,height);
  else { view.x += (width - previousSize.width) / 2; view.y += (height - previousSize.height) / 2; }
  previousSize = { width, height }; schedule();
});
resize.observe(board);
window.addEventListener('pagehide', () => { overview.cancel();clearScrub(); stopAnimation(); pointers.clear(); drag = ink = erased = null; cancelAnimationFrame(frame); frame = 0; });
document.addEventListener('visibilitychange', () => { if(document.hidden){overview.cancel();stopCountPad();stopAnimation();}else sync(); });
window.addEventListener('pageshow',e=>{if(e.persisted)sync();});
reducedMotion.addEventListener('change', sync);
renderCopy(); setTool('pan');
if (requested && !findModuleQuestion(requested)) { $('status').hidden = false; text('status', 'This module contains Questions 1–24. Showing Question 1.', 'Modul ini mengandungi Soalan 1–24. Memaparkan Soalan 1.'); }
