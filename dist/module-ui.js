import { TRANSLATION_QUESTIONS, QUESTION_ONE, findModuleQuestion, TranslationLesson, fitQuestion } from './module-lesson.js?v=3';
import { createTransformationRenderer } from './transform-render.js?v=31';
import { graphToScreen, screenToGraph, GRID_UNIT, newAnnotation, eraseAnnotations } from './transform-model.js?v=29';
import { DocumentStore, zoomAt } from './core.js?v=14';
import { installCanvasOwnership } from './interaction.js?v=13';

const $ = id => document.getElementById(id);
const requested = new URLSearchParams(location.search).get('question');
let q = findModuleQuestion(requested) || QUESTION_ONE, lesson = new TranslationLesson(q);
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
const nextQuestion = () => TRANSLATION_QUESTIONS[TRANSLATION_QUESTIONS.indexOf(q) + 1];
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const text = (id, en, bm) => { $(id).textContent = tr(en, bm); };
const a11y = (id, en, bm) => { $(id).setAttribute('aria-label', tr(en, bm)); $(id).title = tr(en, bm); };

function renderCopy() {
  document.documentElement.lang = language === 'bm' ? 'ms' : 'en';
  document.body.classList.toggle('dark', dark);
  document.title = tr(`Question ${q.id} · BIJAK Transformations`, `Soalan ${q.id} · Transformasi BIJAK`);
  text('back', '← Workspace', '← Ruang kerja'); text('pageTitle', 'Transformations', 'Transformasi');
  text('questionBadge', `Question ${q.number} · Translation`, `Soalan ${q.number} · Translasi`);
  text('section', `A1 / TRANSLATION · ${q.number}`, `A1 / TRANSLASI · ${q.number}`);
  text('questionTitle', lesson.inverse ? 'Find the original point' : 'Find the image', lesson.inverse ? 'Cari koordinat objek' : 'Cari koordinat imej'); $('prompt').textContent = q.prompt[language];
  text('answerHeading', lesson.inverse ? 'Coordinates of the object' : 'Coordinates of the image', lesson.inverse ? 'Koordinat objek' : 'Koordinat imej');
  text('sourceNote', `Module page 1 · Question ${q.id}. One square = one unit.`, `Halaman modul 1 · Soalan ${q.id}. Satu petak = satu unit.`);
  $('givenDX').textContent = fmt(q.vector.x); $('givenDY').textContent = fmt(q.vector.y);
  $('questionNav').setAttribute('aria-label', tr('Translation module questions', 'Soalan modul translasi'));
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
  $('progress').setAttribute('aria-label', tr('Translation movement, horizontal then vertical', 'Pergerakan translasi, mengufuk kemudian menegak'));
  document.querySelector('.given-vector').setAttribute('aria-label', tr(`Translation vector ${coord(q.vector)}`, `Vektor translasi ${coord(q.vector)}`));
  syncFullscreen(); sync();
}

function sync() {
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
  $('answer').textContent = `${lesson.answerLabel} = ${lesson.answerVisible ? coord(lesson.answer) : '(      ,      )'}`;
  $('answer').classList.toggle('object-answer', lesson.inverse);
  $('answerBox').classList.toggle('revealed', lesson.answerVisible);
  $('finalMapping').hidden = !lesson.answerVisible;
  if (lesson.answerVisible) {
    $('mappingSource').textContent = `${q.label}${coord(lesson.object)}`;
    $('mappingImage').textContent = `${q.label}′${coord(lesson.image)}`;
    $('mappingDX').textContent = fmt(q.vector.x); $('mappingDY').textContent = fmt(q.vector.y);
    text('mappingName', 'Translation', 'Translasi');
    $('finalMapping').setAttribute('aria-label', tr(
      `${q.label} ${coord(lesson.object)} maps to ${q.label}′ ${coord(lesson.image)} under translation vector ${coord(q.vector)}.`,
      `${q.label} ${coord(lesson.object)} dipetakan kepada ${q.label}′ ${coord(lesson.image)} di bawah vektor translasi ${coord(q.vector)}.`));
  }
  text('canvasCaption', lesson.stage ? `GIVEN ${lesson.givenLabel} STAYS IN PLACE` : `GIVEN DIAGRAM · QUESTION ${q.number}`, lesson.stage ? `TITIK DIBERI ${lesson.givenLabel} DIKEKALKAN` : `RAJAH DIBERI · SOALAN ${q.number}`);
  $('undo').disabled = !inkStore.past.length; $('redo').disabled = !inkStore.future.length;
  $('diagramDescription').textContent = tr(`Grid from −8 to 8 on both axes. Given point ${lesson.givenLabel} at ${coord(q.given)}.`, `Graf dari −8 hingga 8 pada kedua-dua paksi. Titik diberi ${lesson.givenLabel} pada ${coord(q.given)}.`) + (lesson.answerVisible ? ` ${lesson.answerLabel} = ${coord(lesson.answer)}.` : '');
  schedule();
}

function schedule() { if (!frame) frame = requestAnimationFrame(draw); }
function stopAnimation() { cancelAnimationFrame(animation); animation = 0; }
function goTo(stage) {
  stopAnimation();
  const from = lesson.progress; lesson.goTo(stage); const target = lesson.progress;
  if (from === target || lesson.stage < 2 || reducedMotion.matches) { sync(); return; }
  lesson.progress = from; let start;
  const tick = time => {
    start ??= time; const t = Math.min(1, (time - start) / 800), eased = t * t * (3 - 2 * t);
    lesson.progress = from + (target - from) * eased;
    $('progress').value = lesson.progress; schedule();
    if (t < 1) animation = requestAnimationFrame(tick);
    else { animation = 0; lesson.progress = target; sync(); }
  };
  animation = requestAnimationFrame(tick); sync();
}

function draw() {
  frame = 0;
  const image = lesson.pointAt(), visibleImage = lesson.progress > 0;
  const v = lesson.movementVector;
  const a = graphToScreen(q.given, view), corner = graphToScreen({ x: q.given.x + v.x, y: q.given.y }, view), p = graphToScreen(image, view);
  const obstacles = [...board.querySelectorAll('button:not([hidden]),.ink-tools,.view-tools,.canvas-caption')].filter(el => el.getClientRects().length).map(el => { const r = el.getBoundingClientRect(), b = board.getBoundingClientRect(); return { x: r.left - b.left, y: r.top - b.top, w: r.width, h: r.height }; });
  if (lesson.answerVisible) obstacles.push(positionMapping([a, p], obstacles));
  if (lesson.progress >= 1) obstacles.push({ x: (a.x + corner.x) / 2 - 23, y: a.y - 32, w: 46, h: 28 });
  if (lesson.progress === 2) obstacles.push({ x: corner.x + 2, y: (corner.y + p.y) / 2 - 14, w: 44, h: 28 });
  drawGraph({ view, gridBounds: q.bounds, tickStride: 2, axisFontSize: 15, labelFontSize: 23, pointRadius: 5,
    objects: [{ id: 'given', points: [q.given], labels: [lesson.givenLabel], image: lesson.inverse, coordinates: lesson.stage > 0 }],
    preview: visibleImage ? { id: 'moving', points: [image], labels: [lesson.progress === 2 ? lesson.answerLabel : ''], image: !lesson.inverse, coordinates: lesson.answerVisible } : null,
    annotations: erased ?? inkStore.document.objects, ink, overlays: obstacles,
  });
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
  const avoid = controls.concat(points.map(p => ({ x: p.x - 88, y: p.y - 50, w: 176, h: 100 })));
  const score = p => avoid.reduce((sum, o) => sum + Math.max(0, Math.min(p.x + w, o.x + o.w) - Math.max(p.x, o.x)) * Math.max(0, Math.min(p.y + h, o.y + o.h) - Math.max(p.y, o.y)) * 20, 0) + Math.hypot(p.x - preferred.x, p.y - preferred.y);
  const best = options.reduce((a, b) => score(a) <= score(b) ? a : b);
  el.style.left = `${best.x}px`; el.style.top = `${best.y}px`;
  return best;
}

function fit() { fitted = true; view = fitQuestion(q.bounds, canvas.clientWidth, canvas.clientHeight); schedule(); }
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
    if (drag.type === 'pan') { fitted = false; view = { ...drag.view, x: drag.view.x + s.x - drag.start.x, y: drag.view.y + s.y - drag.start.y }; }
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
  else if (e.key === 'ArrowLeft' && !animation && lesson.stage > 0) { e.preventDefault(); goTo(lesson.stage - 1); }
};

function advance() {
  if (lesson.stage === 4) { if (nextQuestion()) selectQuestion(nextQuestion().id); return; }
  goTo(lesson.progress < lesson.targetProgress ? lesson.stage : lesson.stage + 1);
}
$('next').onclick = advance;
$('previous').onclick = () => goTo(lesson.stage - 1);
$('progress').oninput = e => { stopAnimation(); lesson.scrub(Number(e.target.value)); sync(); };
$('reset').onclick = () => { stopAnimation(); pointers.clear(); discard(); lesson.reset(); inkStore.transact(d => { d.objects = []; }); setTool('pan'); fit(); sync(); };
for (const name of ['pan', 'pen', 'eraser']) $(name).onclick = () => setTool(name);
$('undo').onclick = () => { discard(); inkStore.undo(); }; $('redo').onclick = () => { discard(); inkStore.redo(); };
unsubscribeInk = inkStore.subscribe(sync);
function selectQuestion(id, updateUrl = true) {
  const next = findModuleQuestion(id); if (!next) return;
  stopAnimation(); pointers.clear(); discard(); unsubscribeInk();
  q = next; lesson = new TranslationLesson(q);
  if (!questionInk.has(q.id)) questionInk.set(q.id, new DocumentStore());
  inkStore = questionInk.get(q.id); unsubscribeInk = inkStore.subscribe(sync);
  $('status').hidden = true;
  if (updateUrl) { const url = new URL(location.href); url.searchParams.set('question', q.id); history.pushState(null, '', url); }
  setTool('pan'); renderCopy(); fit();
}
for (const button of $('questionNav').querySelectorAll('button')) button.onclick = () => { if (button.dataset.question !== q.id) selectQuestion(button.dataset.question); };
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
  if (fitted || !previousSize) view = fitQuestion(q.bounds, width, height);
  else { view.x += (width - previousSize.width) / 2; view.y += (height - previousSize.height) / 2; }
  previousSize = { width, height }; schedule();
});
resize.observe(board);
window.addEventListener('pagehide', () => { stopAnimation(); discard(); pointers.clear(); });
renderCopy(); setTool('pan');
if (requested && !findModuleQuestion(requested)) { $('status').hidden = false; text('status', 'This module contains Questions 1–4. Showing Question 1.', 'Modul ini mengandungi Soalan 1–4. Memaparkan Soalan 1.'); }
