import { MODULE_QUESTIONS, QUESTION_ONE, findModuleQuestion, createModuleLesson, reflectionEquation, fitQuestion } from './module-lesson.js?v=4';
import { paintReflectionLesson } from './module-reflection-render.js?v=1';
import { createTransformationRenderer } from './transform-render.js?v=32';
import { graphToScreen, screenToGraph, GRID_UNIT, newAnnotation, eraseAnnotations, ReflectionScrub } from './transform-model.js?v=29';
import { DocumentStore, zoomAt } from './core.js?v=14';
import { installCanvasOwnership } from './interaction.js?v=13';

const $ = id => document.getElementById(id);
const requested = new URLSearchParams(location.search).get('question');
let q = findModuleQuestion(requested) || QUESTION_ONE, lesson = createModuleLesson(q);
const canvas = $('graph'), board = $('board'), drawGraph = createTransformationRenderer(canvas);
// The lesson does not write into the free exploration's saved document.
let inkStore = new DocumentStore(), unsubscribeInk;
const questionInk = new Map([[q.id, inkStore]]), pointers = new Map();
let language = 'en', dark = false, collapsed = false, tool = 'pan', view = { x: 0, y: 0, zoom: 1 };
let fitted = true, previousSize, drag = null, ink = null, erased = null, frame = 0, animation = 0, statusTimer;
try { language = JSON.parse(localStorage.getItem('maths-workspace:language')) === 'bm' ? 'bm' : 'en'; dark = (localStorage.getItem('maths-workspace:theme') ?? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')) === 'dark'; } catch {}
const tr = (en, bm) => language === 'bm' ? bm : en;
const fmt = n => String(n).replace('-', '−');
const coord = p => `(${fmt(p.x)}, ${fmt(p.y)})`;
const signed = n => n > 0 ? `+${fmt(n)}` : fmt(n);
const calculation = (given, delta, answer) => `${fmt(given)} ${delta < 0 ? '−' : '+'} ${fmt(Math.abs(delta))} = ${fmt(answer)}`;
const isReflection = () => q.type === 'reflection';
const graphBounds = () => isReflection() ? lesson.bounds : q.bounds;
const nextQuestion = () => MODULE_QUESTIONS[MODULE_QUESTIONS.indexOf(q) + 1];
let axisPulseUntil = 0, reflectionScrub = null, scrubPointer = null;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const text = (id, en, bm) => { $(id).textContent = tr(en, bm); };
const a11y = (id, en, bm) => { $(id).setAttribute('aria-label', tr(en, bm)); $(id).title = tr(en, bm); };

function renderCopy() {
  document.documentElement.lang = language === 'bm' ? 'ms' : 'en';
  document.body.classList.toggle('dark', dark);
  document.title = tr(`Question ${q.id} · BIJAK Transformations`, `Soalan ${q.id} · Transformasi BIJAK`);
  text('back', '← Workspace', '← Ruang kerja'); text('pageTitle', 'Transformations', 'Transformasi');
  const reflection = isReflection(), topic = reflection ? tr('Reflection', 'Pantulan') : tr('Translation', 'Translasi');
  document.body.classList.toggle('reflection-lesson', reflection);
  $('reflectionControls').hidden = !reflection;
  $('questionGroup').value = q.type;
  $('questionGroup').setAttribute('aria-label', tr('Module activity', 'Aktiviti modul'));
  $('questionGroup').options[0].textContent = tr('Translation · 1–4', 'Translasi · 1–4');
  $('questionGroup').options[1].textContent = tr('Reflection · 5–8', 'Pantulan · 5–8');
  $('questionBadge').textContent = tr(`Question ${q.number}`, `Soalan ${q.number}`) + ' · ' + topic;
  $('section').textContent = `${q.section} / ${topic.toUpperCase()} · ${q.number}`;
  text('questionTitle', lesson.inverse ? 'Find the original point' : 'Find the image', lesson.inverse ? 'Cari koordinat objek' : 'Cari koordinat imej'); $('prompt').textContent = q.prompt[language];
  text('answerHeading', lesson.inverse ? 'Coordinates of the object' : 'Coordinates of the image', lesson.inverse ? 'Koordinat objek' : 'Koordinat imej');
  text('sourceNote', `Module page ${reflection ? 2 : 1} · Question ${q.id}. One square = one unit.`, `Halaman modul ${reflection ? 2 : 1} · Soalan ${q.id}. Satu petak = satu unit.`);
  document.querySelector('.given-vector').hidden = reflection;
  $('givenMirror').hidden = !reflection;
  if (reflection) $('givenMirror').textContent = reflectionEquation(q.mirror);
  else { $('givenDX').textContent = fmt(q.vector.x); $('givenDY').textContent = fmt(q.vector.y); }
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
  $('progress').max = reflection ? 1 : 2;
  $('progress').setAttribute('aria-label', reflection ? tr('Control reflection', 'Kawal pantulan') : tr('Translation movement, horizontal then vertical', 'Pergerakan translasi, mengufuk kemudian menegak'));
  if (!reflection) document.querySelector('.given-vector').setAttribute('aria-label', tr(`Translation vector ${coord(q.vector)}`, `Vektor translasi ${coord(q.vector)}`));
  else $('givenMirror').setAttribute('aria-label', tr(`Question line: ${reflectionEquation(q.mirror)}`, `Garis soalan: ${reflectionEquation(q.mirror)}`));
  syncFullscreen(); sync();
}

function syncTranslation() {
  const v = lesson.movementVector;
  const horizontal = v.x < 0 ? tr('left', 'kiri') : tr('right', 'kanan');
  const vertical = v.y < 0 ? tr('down', 'bawah') : tr('up', 'atas');
  const stages = [
    [lesson.inverse ? `Where was ${q.label}?` : `Where will ${q.label} move?`, lesson.inverse ? 'The image is given. Find the original point.' : 'Read the vector before revealing the image.', lesson.inverse ? `Di manakah ${q.label} asal?` : `Ke manakah ${q.label} bergerak?`, lesson.inverse ? 'Imej diberi. Cari titik asal.' : 'Baca vektor sebelum mendedahkan imej.'],
    [`Start at ${lesson.givenLabel} ${coord(q.given)}`, lesson.inverse ? `Work backwards: use the inverse vector ${coord(v)}.` : 'Read x first, then y.', `Mula di ${lesson.givenLabel} ${coord(q.given)}`, lesson.inverse ? `Undur semula: guna vektor songsang ${coord(v)}.` : 'Baca x dahulu, kemudian y.'],
    [`${Math.abs(v.x)} units to the ${horizontal}`, `${lesson.inverse ? 'Inverse movement' : 'Horizontal component'}: ${signed(v.x)}.`, `${Math.abs(v.x)} unit ke ${horizontal}`, `${lesson.inverse ? 'Gerakan songsang' : 'Komponen mengufuk'}: ${signed(v.x)}.`],
    [`${Math.abs(v.y)} units ${vertical}`, `${lesson.inverse ? 'Inverse movement' : 'Vertical component'}: ${signed(v.y)}.`, `${Math.abs(v.y)} unit ke ${vertical}`, `${lesson.inverse ? 'Gerakan songsang' : 'Komponen menegak'}: ${signed(v.y)}.`],
    [`${lesson.answerLabel} = ${coord(lesson.answer)}`, `x: ${calculation(q.given.x, v.x, lesson.answer.x)} · y: ${calculation(q.given.y, v.y, lesson.answer.y)}`, `${lesson.answerLabel} = ${coord(lesson.answer)}`, `x: ${calculation(q.given.x, v.x, lesson.answer.x)} · y: ${calculation(q.given.y, v.y, lesson.answer.y)}`],
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
    : ['Choose the rising or falling diagonal.', 'Pilih pepenjuru menaik atau menurun.'];
  text('axisRule', ...rule);
  $('positionControls').hidden = kind === 'slanted'; $('slopeControls').hidden = kind !== 'slanted';
  $('lineDecrease').textContent = kind === 'horizontal' ? '↓' : '←'; $('lineIncrease').textContent = kind === 'horizontal' ? '↑' : '→';
  a11y('lineDecrease', kind === 'horizontal' ? 'Move line down one unit' : 'Move line left one unit', kind === 'horizontal' ? 'Alih garis ke bawah satu unit' : 'Alih garis ke kiri satu unit');
  a11y('lineIncrease', kind === 'horizontal' ? 'Move line up one unit' : 'Move line right one unit', kind === 'horizontal' ? 'Alih garis ke atas satu unit' : 'Alih garis ke kanan satu unit');
  $('lineDecrease').disabled = !choice || choice.k <= -8; $('lineIncrease').disabled = !choice || choice.k >= 8;
  $('slopePositive').setAttribute('aria-pressed', String(choice?.slope === 1)); $('slopeNegative').setAttribute('aria-pressed', String(choice?.slope === -1));
  text('guides', 'Guide', 'Panduan'); $('guides').setAttribute('aria-pressed', String(lesson.guideVisible));
  a11y('guides', lesson.guideVisible ? 'Hide perpendicular guide' : 'Show perpendicular guide', lesson.guideVisible ? 'Sembunyikan panduan serenjang' : 'Tunjukkan panduan serenjang');
  text('stepNumber', lesson.answerVisible ? 'ANSWER REVEALED' : choice ? 'TRY • DISCUSS • REFLECT' : 'PREDICT THE LINE', lesson.answerVisible ? 'JAWAPAN DIDEDAHKAN' : choice ? 'CUBA • BINCANG • PANTUL' : 'RAMALKAN GARIS');
  text('stepTitle', choice ? lesson.progress === 1 ? (lesson.answerVisible ? `${lesson.answerLabel} = ${coord(lesson.answer)}` : lesson.matchesQuestion ? 'Ready to reveal' : 'Compare the two equations') : lesson.progress > 0 ? 'Control the flip' : lesson.guideVisible ? 'Perpendicular to the mirror line' : `Try ${equation}` : 'Horizontal, vertical or slanted?',
    choice ? lesson.progress === 1 ? (lesson.answerVisible ? `${lesson.answerLabel} = ${coord(lesson.answer)}` : lesson.matchesQuestion ? 'Sedia untuk didedahkan' : 'Bandingkan kedua-dua persamaan') : lesson.progress > 0 ? 'Kawal lipatan' : lesson.guideVisible ? 'Serenjang dengan garis pantulan' : `Cuba ${equation}` : 'Mengufuk, menegak atau condong?');
  text('stepDetail', !choice ? 'Choose a suggestion from the class.' : lesson.answerVisible ? 'Equal perpendicular distances on both sides.' : `Question: ${reflectionEquation(q.mirror)} · Trying: ${equation}` + (lesson.inverse ? ' · Recover the original point.' : ''),
    !choice ? 'Pilih cadangan daripada kelas.' : lesson.answerVisible ? 'Jarak serenjang sama pada kedua-dua belah.' : `Soalan: ${reflectionEquation(q.mirror)} · Mencuba: ${equation}` + (lesson.inverse ? ' · Cari titik asal.' : ''));
  if (choice && lesson.progress > 0 && Math.hypot(lesson.trialAnswer.x - q.given.x, lesson.trialAnswer.y - q.given.y) < 1e-8) {
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

function sync() {
  if (isReflection()) syncReflection(); else syncTranslation();
  $('answer').textContent = `${lesson.answerLabel} = ${lesson.answerVisible ? coord(lesson.answer) : '(      ,      )'}`;
  $('answer').classList.toggle('object-answer', lesson.inverse);
  $('answerBox').classList.toggle('revealed', lesson.answerVisible);
  $('finalMapping').hidden = !lesson.answerVisible;
  if (lesson.answerVisible) {
    $('mappingSource').textContent = `${q.label}${coord(lesson.object)}`;
    $('mappingImage').textContent = `${q.label}′${coord(lesson.image)}`;
    const reflection = isReflection();
    $('mappingVector').hidden = reflection; $('mappingMirror').hidden = !reflection;
    if (reflection) $('mappingMirror').textContent = reflectionEquation(q.mirror);
    else { $('mappingDX').textContent = fmt(q.vector.x); $('mappingDY').textContent = fmt(q.vector.y); }
    text('mappingName', reflection ? 'Reflection in' : 'Translation', reflection ? 'Pantulan pada' : 'Translasi');
    const operation = reflection ? tr(`reflection in ${reflectionEquation(q.mirror)}`, `pantulan pada ${reflectionEquation(q.mirror)}`) : tr(`translation vector ${coord(q.vector)}`, `vektor translasi ${coord(q.vector)}`);
    $('finalMapping').setAttribute('aria-label', tr(
      `${q.label} ${coord(lesson.object)} maps to ${q.label}′ ${coord(lesson.image)} under ${operation}.`,
      `${q.label} ${coord(lesson.object)} dipetakan kepada ${q.label}′ ${coord(lesson.image)} di bawah ${operation}.`));
  }
  text('canvasCaption', lesson.stage ? `GIVEN ${lesson.givenLabel} STAYS IN PLACE` : `GIVEN DIAGRAM · QUESTION ${q.number}`, lesson.stage ? `TITIK DIBERI ${lesson.givenLabel} DIKEKALKAN` : `RAJAH DIBERI · SOALAN ${q.number}`);
  $('undo').disabled = !inkStore.past.length; $('redo').disabled = !inkStore.future.length;
  $('diagramDescription').textContent = tr(`Grid from −8 to 8 on both axes. Given point ${lesson.givenLabel} at ${coord(q.given)}.`, `Graf dari −8 hingga 8 pada kedua-dua paksi. Titik diberi ${lesson.givenLabel} pada ${coord(q.given)}.`) + (lesson.answerVisible ? ` ${lesson.answerLabel} = ${coord(lesson.answer)}.` : '');
  schedule();
}

function schedule() { if (!frame) frame = requestAnimationFrame(draw); }
function stopAnimation() { cancelAnimationFrame(animation); animation = 0; }
function animateProgress(target) {
  stopAnimation();
  const from = lesson.progress;
  if (from === target || reducedMotion.matches) { lesson.progress = target; sync(); return; }
  let start;
  const tick = time => {
    start ??= time; const t = Math.min(1, (time - start) / 650), eased = t * t * (3 - 2 * t);
    lesson.progress = from + (target - from) * eased;
    $('progress').value = lesson.progress; schedule();
    if (t < 1) animation = requestAnimationFrame(tick);
    else { animation = 0; lesson.progress = target; sync(); }
  };
  animation = requestAnimationFrame(tick); sync();
}
function goTo(stage) {
  const from = lesson.progress; lesson.goTo(stage); const target = lesson.progress;
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
  const image = lesson.pointAt(), visibleImage = lesson.progress > 0 && (!isReflection() || Math.hypot(image.x - q.given.x, image.y - q.given.y) > 1e-8);
  const reflection = isReflection(), v = reflection ? { x: 0, y: 0 } : lesson.movementVector;
  const a = graphToScreen(q.given, view), corner = graphToScreen({ x: q.given.x + v.x, y: q.given.y }, view), p = graphToScreen(image, view);
  const obstacles = [...board.querySelectorAll('button:not([hidden]),.ink-tools,.view-tools,.canvas-caption')].filter(el => el.getClientRects().length).map(el => { const r = el.getBoundingClientRect(), b = board.getBoundingClientRect(); return { x: r.left - b.left, y: r.top - b.top, w: r.width, h: r.height }; });
  if (lesson.answerVisible) obstacles.push(positionMapping([a, p], obstacles));
  if (!reflection && lesson.progress >= 1) obstacles.push({ x: (a.x + corner.x) / 2 - 23, y: a.y - 32, w: 46, h: 28 });
  if (!reflection && lesson.progress === 2) obstacles.push({ x: corner.x + 2, y: (corner.y + p.y) / 2 - 14, w: 44, h: 28 });
  const complete = lesson.progress === (reflection ? 1 : 2);
  const pulse = reducedMotion.matches ? 0 : Math.max(0, (axisPulseUntil - performance.now()) / 600);
  drawGraph({ view, originLabel: !(reflection && lesson.choice && lesson.choice.kind !== 'slanted' && lesson.choice.k === 0), gridBounds: graphBounds(), tickStride: 2, axisFontSize: 15, labelFontSize: reflection && canvas.clientWidth < 500 ? 19 : 23, pointRadius: 5,
    objects: [{ id: 'given', points: [q.given], labels: [lesson.givenLabel], image: lesson.inverse, coordinates: lesson.stage > 0 }],
    preview: visibleImage ? { id: 'moving', points: [image], labels: [complete ? reflection && !lesson.matchesQuestion ? tr('Trial', 'Cubaan') : lesson.answerLabel : ''], image: !lesson.inverse, coordinates: lesson.answerVisible } : null,
    annotations: erased ?? inkStore.document.objects, ink, overlays: obstacles,
    geometryOverlay: reflection ? ctx => paintReflectionLesson(ctx, { lesson, view, bounds: graphBounds(), dark, pulse }) : null,
  });
  if (reflection) { if (pulse > 0) schedule(); return; }
  if (!visibleImage) return;
  const ctx = canvas.getContext('2d'), colour = dark ? '#91beff' : '#2468c4';
  ctx.save(); ctx.strokeStyle = colour; ctx.fillStyle = colour; ctx.lineWidth = 2; ctx.setLineDash([5, 5]);
  ctx.beginPath(); ctx.moveTo(a.x, a.y); if (lesson.progress > 1) ctx.lineTo(corner.x, corner.y); ctx.lineTo(p.x, p.y); ctx.stroke(); ctx.setLineDash([]);
  const label = (value, x, y) => { ctx.font = '600 18px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineWidth = 6; ctx.strokeStyle = dark ? '#15181d' : '#fff'; ctx.strokeText(value, x, y); ctx.fillText(value, x, y); };
  if (lesson.progress >= 1) label(signed(v.x), (a.x + corner.x) / 2, a.y - 18);
  if (lesson.progress === 2) label(signed(v.y), corner.x + 24, (corner.y + p.y) / 2);
  ctx.restore();
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

function fit() { fitted = true; view = fitQuestion(graphBounds(), canvas.clientWidth, canvas.clientHeight); schedule(); }
function zoom(factor, point = { x: canvas.clientWidth / 2, y: canvas.clientHeight / 2 }) {
  fitted = false; const scale = Math.max(.2, Math.min(3, view.zoom * factor)); view = zoomAt(view, point, scale / view.zoom); schedule();
}
function setTool(next) {
  discard(); pointers.clear(); tool = next;
  for (const name of ['pan', 'pen', 'eraser']) $(name).setAttribute('aria-pressed', String(tool === name));
  canvas.style.cursor = tool === 'pan' ? 'grab' : 'crosshair';
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
  if (isReflection() && tool === 'pan' && lesson.choice && lesson.choice.kind !== 'slanted') {
    const line = lesson.line, b = graphBounds();
    if (Math.abs(line.a * p.x + line.b * p.y + line.c) * GRID_UNIT * view.zoom <= 14 && p.x >= b.xmin && p.x <= b.xmax && p.y >= b.ymin && p.y <= b.ymax) {
      drag = { ...drag, type: 'mirror', startGraph: p, startPosition: lesson.choice.k };
    }
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
    if (drag.type === 'mirror') {
      const axis = lesson.choice.kind === 'horizontal' ? 'y' : 'x';
      changeTrial(() => lesson.setPosition(drag.startPosition + p[axis] - drag.startGraph[axis]));
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
  if (cancelled && drag.type === 'mirror') changeTrial(() => lesson.setPosition(drag.startPosition));
  if (!cancelled && ink) { const stroke = ink; inkStore.transact(d => d.objects.push(stroke)); }
  if (!cancelled && erased) { const strokes = erased; inkStore.transact(d => { d.objects = strokes; }); }
  discard();
}
canvas.onpointerup = e => endPointer(e);
canvas.onpointercancel = canvas.onlostpointercapture = e => endPointer(e, true);
canvas.addEventListener('wheel', e => { e.preventDefault(); if (!drag) zoom(Math.exp(-e.deltaY * .001), screenPoint(e)); }, { passive: false });
canvas.onkeydown = e => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); discard(); e.shiftKey ? inkStore.redo() : inkStore.undo(); }
  else if (e.key === 'Escape') { pointers.clear(); discard(); }
  else if ((e.key === 'ArrowRight' || e.key === 'Enter') && !animation && lesson.stage < 4) { e.preventDefault(); advance(); }
  else if (e.key === 'ArrowLeft' && !animation && lesson.stage > 0) { e.preventDefault(); previousStep(); }
};

function advance() {
  if (lesson.answerVisible) { if (nextQuestion()) selectQuestion(nextQuestion().id); return; }
  if (isReflection()) {
    if (!lesson.choice) return;
    if (!lesson.progress && !lesson.guideVisible) { lesson.toggleGuides(); sync(); }
    else if (lesson.progress < 1) reflectTo(1);
    else { lesson.reveal(); sync(); }
    return;
  }
  goTo(lesson.progress < lesson.targetProgress ? lesson.stage : lesson.stage + 1);
}
function previousStep() {
  if (!isReflection()) { goTo(lesson.stage - 1); return; }
  if (lesson.answerVisible) { lesson.scrub(1); sync(); }
  else if (lesson.progress > 0) reflectTo(0);
  else if (lesson.guideVisible) { lesson.toggleGuides(); sync(); }
  else { lesson.reset(); fit(); sync(); }
}
function changeTrial(change) {
  if (!change()) return;
  stopAnimation(); reflectionScrub = null; scrubPointer = null;
  axisPulseUntil = performance.now() + 600;
  sync();
}
for (const button of document.querySelectorAll('[data-orientation]')) button.onclick = () => changeTrial(() => lesson.chooseOrientation(button.dataset.orientation));
$('lineDecrease').onclick = () => changeTrial(() => lesson.setPosition(lesson.choice.k - 1));
$('lineIncrease').onclick = () => changeTrial(() => lesson.setPosition(lesson.choice.k + 1));
$('slopePositive').onclick = () => changeTrial(() => lesson.setSlope(1));
$('slopeNegative').onclick = () => changeTrial(() => lesson.setSlope(-1));
$('guides').onclick = () => { lesson.toggleGuides(); sync(); };
$('next').onclick = advance;
$('previous').onclick = previousStep;
$('progress').onpointerdown = e => {
  if (!isReflection()) return;
  stopAnimation(); ensureTrialVisible(); reflectionScrub = new ReflectionScrub(lesson.progress); scrubPointer = e.pointerId;
  e.currentTarget.setPointerCapture(e.pointerId);
};
$('progress').oninput = e => {
  stopAnimation(); const value = Number(e.target.value);
  if (isReflection()) { ensureTrialVisible(); reflectionScrub?.move(value); }
  lesson.scrub(value); sync();
};
$('progress').onpointerup = e => {
  if (e.pointerId !== scrubPointer || !reflectionScrub) return;
  const target = reflectionScrub.target(); reflectionScrub = null; scrubPointer = null; reflectTo(target);
};
$('progress').onpointercancel = e => {
  if (e.pointerId !== scrubPointer || !reflectionScrub) return;
  const start = reflectionScrub.start; reflectionScrub = null; scrubPointer = null; stopAnimation(); lesson.scrub(start); sync();
};
$('reset').onclick = () => { stopAnimation(); pointers.clear(); discard(); lesson.reset(); reflectionScrub = null; scrubPointer = null; inkStore.transact(d => { d.objects = []; }); setTool('pan'); fit(); sync(); };
for (const name of ['pan', 'pen', 'eraser']) $(name).onclick = () => setTool(name);
$('undo').onclick = () => { discard(); inkStore.undo(); }; $('redo').onclick = () => { discard(); inkStore.redo(); };
unsubscribeInk = inkStore.subscribe(sync);
function selectQuestion(id, updateUrl = true) {
  const next = findModuleQuestion(id); if (!next) return;
  stopAnimation(); pointers.clear(); discard(); unsubscribeInk();
  q = next; lesson = createModuleLesson(q); axisPulseUntil = 0; reflectionScrub = null; scrubPointer = null;
  if (!questionInk.has(q.id)) questionInk.set(q.id, new DocumentStore());
  inkStore = questionInk.get(q.id); unsubscribeInk = inkStore.subscribe(sync);
  $('status').hidden = true;
  if (updateUrl) { const url = new URL(location.href); url.searchParams.set('question', q.id); history.pushState(null, '', url); }
  setTool('pan'); renderCopy(); fit();
}
$('questionNav').onclick = e => { const button = e.target.closest('[data-question]'); if (button && button.dataset.question !== q.id) selectQuestion(button.dataset.question); };
$('questionGroup').onchange = e => selectQuestion(e.target.value === 'reflection' ? '5' : '1');
window.addEventListener('popstate', () => selectQuestion(findModuleQuestion(new URLSearchParams(location.search).get('question'))?.id || QUESTION_ONE.id, false));
$('zoomOut').onclick = () => zoom(.8); $('zoomIn').onclick = () => zoom(1.25); $('fit').onclick = fit;
function toggleQuestion() {
  collapsed = !collapsed; $('lesson').classList.toggle('question-collapsed', collapsed);
  $('questionPanel').hidden = collapsed; $('expand').hidden = !collapsed;
  $('collapse').setAttribute('aria-expanded', String(!collapsed)); $('expand').setAttribute('aria-expanded', String(!collapsed));
  (collapsed ? $('expand') : $('collapse')).focus({ preventScroll: true });
}
$('collapse').onclick = $('expand').onclick = toggleQuestion;
$('language').onclick = () => { language = language === 'en' ? 'bm' : 'en'; try { localStorage.setItem('maths-workspace:language', JSON.stringify(language)); } catch {} renderCopy(); };
$('theme').onclick = () => { dark = !dark; try { localStorage.setItem('maths-workspace:theme', dark ? 'dark' : 'light'); } catch {} renderCopy(); };
function syncFullscreen() { text('fullscreen', document.fullscreenElement ? 'Exit full screen' : 'Full screen', document.fullscreenElement ? 'Keluar skrin penuh' : 'Skrin penuh'); }
$('fullscreen').onclick = async () => {
  try { if (document.fullscreenElement) await document.exitFullscreen(); else if (document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen(); else throw Error('unsupported'); }
  catch { $('status').hidden = false; text('status', 'Full screen is unavailable in this browser. Hide the question for more canvas space.', 'Skrin penuh tidak tersedia dalam pelayar ini. Sembunyikan soalan untuk meluaskan kanvas.'); clearTimeout(statusTimer); statusTimer = setTimeout(() => { $('status').hidden = true; }, 5000); }
};
document.addEventListener('fullscreenchange', syncFullscreen);
const resize = new ResizeObserver(() => {
  const width = canvas.clientWidth, height = canvas.clientHeight;
  if (fitted || !previousSize) view = fitQuestion(graphBounds(), width, height);
  else { view.x += (width - previousSize.width) / 2; view.y += (height - previousSize.height) / 2; }
  previousSize = { width, height }; schedule();
});
resize.observe(board);
window.addEventListener('pagehide', () => { stopAnimation(); discard(); pointers.clear(); });
renderCopy(); setTool('pan');
if (requested && !findModuleQuestion(requested)) { $('status').hidden = false; text('status', 'This module contains Questions 1–8. Showing Question 1.', 'Modul ini mengandungi Soalan 1–8. Memaparkan Soalan 1.'); }
