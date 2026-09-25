import { zoomAt } from './core.js?v=14';
import { installCanvasOwnership } from './interaction.js?v=13';
import {
  openTransformations, screenToGraph, GRID_UNIT, snapPoint, translatePoint,
  rotatePoint, flipPoint, lineFromPoints, lineEquation, parseMirrorEquation,
  lineHandles, lineFoot, objectHit, polygonValid, nextLabels, imageLabels, formatNumber,
  leverAngle, snapRotation, RotationSnap, rotationGuide, mirrorGrip, moveMirror, completedImage, ReflectionScrub, newAnnotation, eraseAnnotations,
} from './transform-model.js?v=29';
import { createTransformationRenderer } from './transform-render.js?v=29';

export function mountTransformations(host, { language = () => 'en', back }) {
  const tr = (en, bm) => language() === 'bm' ? bm : en;
  const { store, isSaved, dispose: disposeStore } = openTransformations();
  const get = id => host.querySelector('#' + id);
  const data = () => store.document.transformation;
  let selected = null, tool = 'select', transform = null, vector = { x: 0, y: 0 }, centre = null, angle = 0;
  let mirror = null, reflected = false, flip = 0, animation = 0, disposed = false, frame = 0;
  let snap = true, guides = false, coordinates = false, showLabels = true, vertex = 0, polygon = [];
  let drag = null, ink = null, workingAnnotations = null, drawLine = null, view = { x: 0, y: 0, zoom: 1 };
  let reflectionDrag = null, rotationWedge = true, padPosition = null, padDrag = null;
  let penColour = '#d04d40', penWidth = .065, previousSize = null, equation = '', cursor = 0, pickingCentre = false, equationOpen = false;
  const pointers = new Map(), cleanups = [];
  const selectedObject = () => { const o = data().objects.find(o => o.id === selected); return o && drag?.id === selected && drag.points ? { ...o, points: drag.points } : o; };
  const button = (id, en, bm, extra = '') => `<button type="button" id="${id}" ${extra}>${tr(en, bm)}</button>`;
  const numeric = (id, name, value = 0, min = -1000, max = 1000) => `<input id="${id}" type="number" data-math-mode="decimal" aria-label="${name}" min="${min}" max="${max}" step="any" value="${value}">`;
  host.classList.add('transform-mode');
  host.insertAdjacentHTML('beforeend', `
    <div class="tf-head">${button('tfBack', '← Library', '← Pustaka')}<div><span class="explorer-kicker">${tr('Exploration', 'Penerokaan')}</span><h2>${tr('Transformations', 'Transformasi')}</h2></div><div class="tf-history">${button('tfUndo', '↶', '↶', `aria-label="${tr('Undo', 'Undur')}"`)}${button('tfRedo', '↷', '↷', `aria-label="${tr('Redo', 'Buat semula')}"`)}</div></div>
    <nav class="tf-toolbar" aria-label="${tr('Graph tools', 'Alatan graf')}">
      ${button('tfSelect', '↖ Select', '↖ Pilih')}${button('tfPan', '✥ Pan', '✥ Alih')}
      <span class="tf-divider"></span>${button('tfPoint', '+ Point', '+ Titik')}
      <select id="tfShape" aria-label="${tr('Add shape', 'Tambah bentuk')}"><option value="">${tr('+ Shape', '+ Bentuk')}</option><option value="line">${tr('Line', 'Garis')}</option><option value="triangle">${tr('Triangle', 'Segi tiga')}</option><option value="rectangle">${tr('Rectangle', 'Segi empat tepat')}</option><option value="square">${tr('Square', 'Segi empat sama')}</option><option value="polygon">${tr('Custom polygon', 'Poligon tersuai')}</option></select>
      <span class="tf-divider"></span>${button('tfPen', '✎ Pen', '✎ Pen')}${button('tfEraser', '⌫ Eraser', '⌫ Pemadam')}
      <label class="tf-snap"><input id="tfSnap" type="checkbox" checked>${tr('Snap to grid', 'Lekat pada grid')}</label>
      <div id="tfInkOptions" class="tf-ink-options" hidden><select id="tfPenColour" aria-label="${tr('Pen colour', 'Warna pen')}"><option value="#d04d40">${tr('Red', 'Merah')}</option><option value="#2367c8">${tr('Blue', 'Biru')}</option><option value="#268064">${tr('Green', 'Hijau')}</option><option value="#20242c">${tr('Black', 'Hitam')}</option></select><select id="tfPenWidth" aria-label="${tr('Pen width', 'Ketebalan pen')}"><option value=".065">${tr('Fine', 'Halus')}</option><option value=".12">${tr('Medium', 'Sederhana')}</option><option value=".2">${tr('Thick', 'Tebal')}</option></select></div>
    </nav>
    <div class="tf-layout">
      <section class="tf-board" aria-label="${tr('Transformation graph', 'Graf transformasi')}">
        <canvas id="tfCanvas" tabindex="0" aria-label="${tr('Cartesian graph. Add or select an object to transform.', 'Graf Cartes. Tambah atau pilih objek untuk ditransformasi.')}"></canvas>
        <div class="tf-pan-arrows">${button('tfViewUp', '↑', '↑', `aria-label="${tr('Move graph up', 'Alih graf ke atas')}"`)}${button('tfViewLeft', '←', '←', `aria-label="${tr('Move graph left', 'Alih graf ke kiri')}"`)}${button('tfViewRight', '→', '→', `aria-label="${tr('Move graph right', 'Alih graf ke kanan')}"`)}${button('tfViewDown', '↓', '↓', `aria-label="${tr('Move graph down', 'Alih graf ke bawah')}"`)}</div>
        <div id="tfNudges" class="tf-dpad" hidden aria-label="${tr('Translation gamepad', 'Pad arah translasi')}">
          ${button('tfPadGrip', '⠿ Translation', '⠿ Translasi', `class="tf-pad-grip" aria-label="${tr('Move translation pad', 'Alih pad translasi')}" title="${tr('Drag to move the pad', 'Seret untuk mengalih pad')}"`)}
          <div class="tf-pad-cross">${button('tfNudgeUp', '▲', '▲', `aria-label="${tr('Translate up one unit', 'Translasi satu unit ke atas')}"`)}${button('tfNudgeLeft', '◀', '◀', `aria-label="${tr('Translate left one unit', 'Translasi satu unit ke kiri')}"`)}${button('tfPadReset', '0', '0', `aria-label="${tr('Reset translation vector', 'Tetap semula vektor translasi')}" title="${tr('Reset vector', 'Tetap semula vektor')}"`)}${button('tfNudgeRight', '▶', '▶', `aria-label="${tr('Translate right one unit', 'Translasi satu unit ke kanan')}"`)}${button('tfNudgeDown', '▼', '▼', `aria-label="${tr('Translate down one unit', 'Translasi satu unit ke bawah')}"`)}</div>
        </div>
        <div id="tfHint" class="tf-canvas-hint"><strong id="tfHintTitle"></strong><span id="tfHintBody"></span></div>
        <div class="tf-view-tools"><span>${tr('1 square = 1 unit', '1 petak = 1 unit')}</span>${button('tfZoomOut', '−', '−', `aria-label="${tr('Zoom out', 'Zum keluar')}"`)}<output id="tfZoom">100%</output>${button('tfZoomIn', '+', '+', `aria-label="${tr('Zoom in', 'Zum masuk')}"`)}${button('tfFit', 'Fit', 'Muat')}</div>
        <div id="tfEmpty" class="tf-empty"><strong>${tr('Start with a point or shape', 'Mulakan dengan titik atau bentuk')}</strong><span>${tr('Place it on the graph, then choose a transformation.', 'Letakkannya pada graf, kemudian pilih transformasi.')}</span>${button('tfExample', 'Try a triangle', 'Cuba segi tiga')}</div>
        <div id="tfPolygonActions" class="tf-polygon-actions" hidden>${button('tfFinishPolygon', 'Finish polygon', 'Siapkan poligon')}${button('tfCancelPolygon', 'Cancel', 'Batal')}</div>
      </section>
      <aside class="tf-side">
        <div class="tf-object-select"><label for="tfObjects">${tr('Selected object', 'Objek dipilih')}</label><div class="tf-selection-row"><select id="tfObjects"></select>${button('tfDelete', 'Delete', 'Padam', 'hidden')}</div></div>
        <div class="tf-transforms" aria-label="${tr('Transform selected object', 'Transformasi objek dipilih')}">${button('tfTranslation', '↔ Translation', '↔ Translasi')}${button('tfReflection', '◧ Reflection', '◧ Pantulan')}${button('tfRotation', '↻ Rotation', '↻ Putaran')}${button('tfEnlargement', '⤢ Enlargement', '⤢ Pembesaran', 'disabled')}<span class="tf-coming">${tr('Enlargement · coming next', 'Pembesaran · akan datang')}</span></div>
        <div id="tfWelcome" class="tf-welcome">${tr('Select a point or shape, then choose how to transform it.', 'Pilih titik atau bentuk, kemudian pilih transformasinya.')}</div>
        <section id="tfTranslationPanel" class="tf-control-panel" hidden><h3>${tr('Translation vector', 'Vektor translasi')}</h3><div class="tf-vector"><span>T =</span><div class="tf-column-vector">${numeric('tfDX', tr('Horizontal translation', 'Translasi mengufuk'))}${numeric('tfDY', tr('Vertical translation', 'Translasi menegak'))}</div><div class="tf-vector-labels"><span>${tr('Horizontal', 'Mengufuk')}</span><span>${tr('Vertical', 'Menegak')}</span></div></div><p>${tr('Use the gamepad, drag the image, or enter a vector.', 'Gunakan pad arah, seret imej, atau masukkan vektor.')}</p><p id="tfVectorWords" class="tf-summary"></p>${button('tfVectorReset', 'Reset vector', 'Tetap semula vektor')}</section>
        <section id="tfReflectionPanel" class="tf-control-panel" hidden><h3>${tr('Set the mirror line', 'Tetapkan garis pantulan')}</h3><div class="tf-pair">${button('tfDrawMirror', 'Draw line', 'Lukis garis')}${button('tfEnterMirror', 'Enter equation', 'Masukkan persamaan')}</div><output id="tfMirrorValue" class="tf-readout"></output>
          <div id="tfEquationPanel" hidden><div id="tfEquation" class="tf-equation" role="textbox" aria-readonly="true" tabindex="0" aria-label="${tr('Mirror line equation', 'Persamaan garis pantulan')}"></div><div id="tfEquationKeys" class="tf-equation-keys"></div>${button('tfApplyEquation', 'Set line', 'Tetapkan garis')}<p>${tr('Examples: x = 3, y = −2, y = 2x + 1', 'Contoh: x = 3, y = −2, y = 2x + 1')}</p></div>
          <div class="tf-reflection-control"><span>${tr('Reflected image', 'Imej pantulan')} ↑</span><div id="tfReflectionLever" class="tf-lever tf-reflection-lever" role="slider" tabindex="0" aria-label="${tr('Reflection flip progress', 'Kemajuan pantulan')}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" aria-orientation="vertical"><div class="tf-lever-track"></div><span id="tfReflectionGrip" class="tf-grip">☰</span></div><span>↓ ${tr('Original position', 'Kedudukan asal')}</span></div><output id="tfFlipWords" class="tf-readout"></output><p>${tr('Hold to control the flip. Release to finish in that direction.', 'Tahan untuk mengawal pantulan. Lepas untuk melengkapkan arah itu.')}</p>
        </section>
        <section id="tfRotationPanel" class="tf-control-panel" hidden><h3>${tr('Centre of rotation', 'Pusat putaran')}</h3><div class="tf-coordinate">(<span>${numeric('tfCX', tr('Centre x coordinate', 'Koordinat x pusat'))}</span>,<span>${numeric('tfCY', tr('Centre y coordinate', 'Koordinat y pusat'))}</span>)</div>${button('tfPickCentre', 'Choose on graph', 'Pilih pada graf')}<p id="tfCentreHelp"></p><div class="tf-rotation-control"><div class="tf-lever-labels"><span>360°</span><span>270°</span><span>180°</span><span>90°</span><strong>0°</strong><span>90°</span><span>180°</span><span>270°</span><span>360°</span></div><div id="tfLever" class="tf-lever" role="slider" tabindex="0" aria-label="${tr('Rotation angle. Up anticlockwise, down clockwise.', 'Sudut putaran. Atas lawan arah jam, bawah ikut arah jam.')}" aria-valuemin="-360" aria-valuemax="360" aria-valuenow="0" aria-orientation="vertical"><div class="tf-lever-track"></div><span id="tfGrip" class="tf-grip">☰</span></div><div class="tf-rotation-value"><span>↶ ${tr('Anticlockwise', 'Lawan arah jam')}</span><div class="tf-exact-angle">${numeric('tfAngle', tr('Rotation angle', 'Sudut putaran'), 0, 0, 360)}<span>°</span></div><select id="tfDirection" aria-label="${tr('Rotation direction', 'Arah putaran')}"><option value="1">${tr('Anticlockwise', 'Lawan arah jam')}</option><option value="-1">${tr('Clockwise', 'Ikut arah jam')}</option></select>${button('tfRotationReset', 'Reset to 0°', 'Tetap semula 0°')}<span>↷ ${tr('Clockwise', 'Ikut arah jam')}</span></div></div><output id="tfAngleWords" class="tf-readout"></output><label class="tf-check"><input id="tfWedge" type="checkbox" checked>${tr('Show rotation angle', 'Tunjuk sudut putaran')}</label></section>
        <div id="tfShared" hidden><label id="tfGuidesControl" class="tf-check"><input id="tfGuides" type="checkbox">${tr('Show guide lines', 'Tunjuk garis panduan')}</label>${button('tfKeep', 'Keep image', 'Kekalkan imej', 'class="tf-primary tf-keep"')}<p class="tf-small">${tr('Tap the image, or Keep image, to select it for the next transformation.', 'Ketik imej, atau Kekalkan imej, untuk memilihnya bagi transformasi seterusnya.')}</p></div>
        <details id="tfProperties"><summary>${tr('Object & vertex', 'Objek & bucu')}</summary><label>${tr('Name', 'Nama')}<input id="tfObjectName" type="text" maxlength="40"></label><label>${tr('Vertex', 'Bucu')}<select id="tfVertex"></select></label><div class="tf-coordinate">(${numeric('tfVX', tr('Vertex x coordinate', 'Koordinat x bucu'))}, ${numeric('tfVY', tr('Vertex y coordinate', 'Koordinat y bucu'))})</div><label>${tr('Label', 'Label')}<input id="tfVertexLabel" type="text" maxlength="12"></label></details>
        <div class="tf-display-options"><label class="tf-check"><input id="tfLabels" type="checkbox" checked>${tr('Vertex labels', 'Label bucu')}</label><label class="tf-check"><input id="tfCoordinates" type="checkbox">${tr('Coordinates', 'Koordinat')}</label></div>
      </aside>
    </div><div class="tf-footer"><span id="tfStatus" role="status"></span><span id="tfSaved"></span></div>`);
  const canvas = get('tfCanvas'), board = host.querySelector('.tf-board'), renderGraph = createTransformationRenderer(canvas);
  const leverDock = document.createElement('aside'); leverDock.className = 'tf-lever-dock'; leverDock.id = 'tfLeverDock';
  const reflectionDock = document.createElement('div'); reflectionDock.id = 'tfReflectionDock'; reflectionDock.append(host.querySelector('.tf-reflection-control'));
  const rotationDock = document.createElement('div'); rotationDock.id = 'tfRotationDock';
  const rotationControl = host.querySelector('.tf-rotation-control'), rotationValues = host.querySelector('.tf-rotation-value');
  rotationControl.after(rotationValues); rotationDock.append(rotationControl);
  leverDock.append(reflectionDock, rotationDock); board.after(leverDock);
  const fields = ['tfDX', 'tfDY', 'tfCX', 'tfCY', 'tfAngle', 'tfVX', 'tfVY'];
  // Mark readonly immediately, before the global input enhancer's next observer pass.
  fields.forEach(id => { get(id).readOnly = true; get(id).inputMode = 'none'; });
  function say(en, bm) { get('tfStatus').textContent = tr(en, bm); }
  function stopAnimation() { cancelAnimationFrame(animation); animation = 0; }
  function resetPreview() { stopAnimation(); vector = { x: 0, y: 0 }; angle = 0; reflected = false; flip = 0; }
  function imagePoints() {
    const o = selectedObject(); if (!o) return null;
    if (transform === 'translation' && (vector.x || vector.y)) return o.points.map(p => translatePoint(p, vector));
    if (transform === 'rotation' && centre && angle) return o.points.map(p => rotatePoint(p, centre, angle));
    if (transform === 'reflection' && mirror && (flip > 0 || animation)) return o.points.map(p => flipPoint(p, mirror.line, flip));
    return null;
  }
  function previewObject() { const points = imagePoints(), o = selectedObject(); return points ? { id: 'preview', points, labels: imageLabels(o.labels, data().objects) } : null; }
  function schedule() { if (!frame && !disposed) frame = requestAnimationFrame(() => { frame = 0; draw(); }); }
  function draw() {
    const preview = previewObject(), o = selectedObject(), nudge = get('tfNudges');
    get('tfEmpty').hidden = data().objects.length > 0 || tool !== 'select';
    nudge.hidden = transform !== 'translation' || !o || tool !== 'select';
    if (!nudge.hidden) placePad();
    const rect = board.getBoundingClientRect(), overlays = [...board.querySelectorAll('.tf-canvas-hint,.tf-dpad,.tf-polygon-actions')].filter(el => !el.hidden).map(el => { const r = el.getBoundingClientRect(); return { x: r.left - rect.left, y: r.top - rect.top, w: r.width, h: r.height }; });
    renderGraph({ view, objects: data().objects.map(o => drag?.id === o.id && drag.points ? { ...o, points: drag.points } : o), selected, preview, annotations: workingAnnotations ?? data().annotations, transform, centre, centreLabel: tr('Centre', 'Pusat'), mirror, guides: transform === 'reflection' ? guides && flip === 1 : guides, coordinates, labels: showLabels, vertex, angle, rotationWedge, rotationLabel: rotationWords(), rotationGuide: o ? rotationGuide(o.points, centre, angle) : null, overlays, draft: polygon, ink, drawLine });
    get('tfZoom').textContent = Math.round(view.zoom * 100) + '%';
  }
  function rotationWords() { return angle === 0 ? '0°' : `${formatNumber(Math.abs(angle))}° ${angle > 0 ? tr('anticlockwise', 'lawan arah jam') : tr('clockwise', 'ikut arah jam')}`; }
  function updateHint() {
    let title, body;
    if (tool === 'mirror') { title = tr('Draw the reflection line', 'Lukis garis pantulan'); body = tr('Drag between two points on the graph.', 'Seret antara dua titik pada graf.'); }
    else if (pickingCentre) { title = tr('Choose the rotation centre', 'Pilih pusat putaran'); body = tr('Tap the graph, or enter the centre coordinates.', 'Ketik graf, atau masukkan koordinat pusat.'); }
    else if (tool === 'polygon') { title = tr('Place each vertex', 'Letakkan setiap bucu'); body = tr('Tap the first point or Finish polygon to close.', 'Ketik titik pertama atau Siapkan poligon untuk menutup.'); }
    else if (tool === 'point') { title = tr('Add a point', 'Tambah titik'); body = tr('Tap a grid intersection.', 'Ketik persilangan grid.'); }
    else if (['line', 'triangle', 'rectangle', 'square'].includes(tool)) { title = tr('Draw your shape', 'Lukis bentuk anda'); body = tr('Press and drag on the graph.', 'Tekan dan seret pada graf.'); }
    else if (tool === 'pen' || tool === 'eraser') { title = tool === 'pen' ? tr('Write on the graph', 'Tulis pada graf') : tr('Erase annotations', 'Padam anotasi'); body = tool === 'pen' ? tr('Ink moves with the graph as you pan and zoom.', 'Dakwat mengikuti graf apabila dialih dan dizum.') : tr('Touch a pen stroke to erase it. Undo can restore it.', 'Sentuh coretan untuk memadamnya. Undur untuk memulihkan.'); }
    else if (tool === 'pan') { title = tr('Move the graph', 'Alih graf'); body = tr('Drag empty space. Pinch or use + / − to zoom.', 'Seret ruang kosong. Cubit atau guna + / − untuk zum.'); }
    else if (transform === 'reflection' && reflected) { title = tr('Reflection complete', 'Pantulan selesai'); body = tr('Tap the image for the next transformation. Move the mirror line to start a new reflection.', 'Ketik imej untuk transformasi seterusnya. Alih garis pantulan untuk memulakan pantulan baharu.'); }
    else if (transform === 'reflection') {
      title = !mirror ? tr('Set a reflection line', 'Tetapkan garis pantulan') : tr('Move or turn the mirror line', 'Alih atau putar garis pantulan');
      body = !mirror ? tr('Choose Draw line or Enter equation.', 'Pilih Lukis garis atau Masukkan persamaan.') : tr('Drag the line or centre grip to slide it; drag an endpoint to turn it. Pull the lever to reflect.', 'Seret garis atau pemegang tengah untuk mengalih; seret hujung untuk memutar. Tarik tuil untuk pantulan.');
    }
    else if (transform === 'rotation') { title = tr('Rotate about the centre', 'Putar mengelilingi pusat'); body = tr('Lever up: anticlockwise. Down: clockwise. Tap the image for the next transformation.', 'Tuil ke atas: lawan arah jam. Ke bawah: ikut arah jam. Ketik imej untuk transformasi seterusnya.'); }
    else if (transform === 'translation') { title = tr('Move the image', 'Alih imej'); body = tr('Use the gamepad or drag the image. Tap the image to transform it again.', 'Guna pad arah atau seret imej. Ketik imej untuk transformasi seterusnya.'); }
    else { title = tr('Select an object', 'Pilih objek'); body = tr('Choose a transformation. Delete removes only the selected item.', 'Pilih transformasi. Padam membuang item yang dipilih sahaja.'); }
    get('tfHintTitle').textContent = title; get('tfHintBody').textContent = body;
    get('tfHint').hidden = !data().objects.length && tool === 'select';
    board.classList.toggle('tf-building-polygon', tool === 'polygon');
  }
  function placePad() {
    const pad = get('tfNudges'), maxX = Math.max(8, board.clientWidth - pad.offsetWidth - 12), maxY = Math.max(8, board.clientHeight - pad.offsetHeight - 54);
    const position = padPosition || { x: maxX, y: maxY };
    const x = Math.max(8, Math.min(maxX, position.x)), y = Math.max(8, Math.min(maxY, position.y));
    pad.style.left = `${x}px`; pad.style.top = `${y}px`;
    return { x, y };
  }
  function canKeepImage() { return !!imagePoints() && !animation && !reflectionDrag && (transform !== 'reflection' || reflected); }
  function sync() {
    const o = selectedObject();
    get('tfSaved').textContent = isSaved() ? tr('Saved on this device', 'Disimpan pada peranti ini') : tr('Device storage unavailable · keep this session open', 'Storan peranti tidak tersedia · kekalkan sesi ini');
    get('tfDX').value = vector.x; get('tfDY').value = vector.y;
    get('tfCX').value = centre?.x ?? 0; get('tfCY').value = centre?.y ?? 0;
    get('tfAngle').value = formatNumber(Math.abs(angle)); get('tfAngle').disabled = !centre; get('tfDirection').disabled = !centre;
    if (angle) get('tfDirection').value = angle < 0 ? '-1' : '1';
    const words = rotationWords();
    get('tfLever').classList.toggle('tf-snapped', !!centre && angle % 90 === 0);
    get('tfAngleWords').textContent = words; get('tfLever').setAttribute('aria-valuenow', String(angle)); get('tfLever').setAttribute('aria-valuetext', words); get('tfLever').setAttribute('aria-disabled', String(!centre));
    get('tfGrip').style.top = `${(360 - angle) / 720 * 100}%`;
    get('tfVectorWords').textContent = `${formatNumber(Math.abs(vector.x))} ${vector.x < 0 ? tr('left', 'ke kiri') : tr('right', 'ke kanan')} · ${formatNumber(Math.abs(vector.y))} ${vector.y < 0 ? tr('down', 'ke bawah') : tr('up', 'ke atas')}`;
    get('tfMirrorValue').textContent = mirror ? lineEquation(mirror.line) : tr('No mirror line yet', 'Belum ada garis pantulan');
    get('tfReflectionLever').setAttribute('aria-disabled', String(!mirror || !o));
    get('tfReflectionLever').setAttribute('aria-valuenow', String(Math.round(flip * 100)));
    get('tfReflectionLever').setAttribute('aria-valuetext', flip === 0 ? tr('Original position', 'Kedudukan asal') : flip === 1 ? tr('Reflected image', 'Imej pantulan') : `${Math.round(flip * 100)}%`);
    get('tfReflectionGrip').style.top = `${(1 - flip) * 100}%`;
    get('tfFlipWords').textContent = flip === 0 ? tr('Original position', 'Kedudukan asal') : flip === 1 ? tr('Reflected image', 'Imej pantulan') : `${Math.round(flip * 100)}%`;
    get('tfKeep').disabled = !canKeepImage();
    get('tfUndo').disabled = !store.past.length; get('tfRedo').disabled = !store.future.length;
    get('tfCentreHelp').textContent = centre ? tr('Drag the centre to reposition it. Rotation resets to 0°.', 'Seret pusat untuk mengalihkannya. Putaran kembali ke 0°.') : tr('Tap the graph or enter the centre coordinates.', 'Ketik graf atau masukkan koordinat pusat.');
    get('tfPickCentre').setAttribute('aria-pressed', String(pickingCentre));
    get('tfEquationPanel').hidden = !equationOpen;
    get('tfWelcome').hidden = !!transform;
    const leverVisible = transform === 'reflection' || transform === 'rotation';
    host.classList.toggle('tf-has-lever', leverVisible); leverDock.hidden = !leverVisible;
    reflectionDock.hidden = transform !== 'reflection'; rotationDock.hidden = transform !== 'rotation';
    get('tfShared').hidden = !o || !transform;
    get('tfGuidesControl').hidden = transform === 'rotation';
    for (const type of ['translation', 'reflection', 'rotation']) get(`tf${type[0].toUpperCase() + type.slice(1)}Panel`).hidden = transform !== type;
    for (const type of ['Translation', 'Reflection', 'Rotation']) { get('tf' + type).disabled = !o; get('tf' + type).setAttribute('aria-pressed', String(transform === type.toLowerCase())); }
    get('tfProperties').hidden = !o; get('tfDelete').hidden = !o;
    updateHint();
    get('tfPolygonActions').hidden = tool !== 'polygon'; get('tfFinishPolygon').disabled = polygon.length < 3;
    for (const [id, value] of [['tfSelect', 'select'], ['tfPan', 'pan'], ['tfPoint', 'point'], ['tfPen', 'pen'], ['tfEraser', 'eraser']]) get(id).setAttribute('aria-pressed', String(tool === value));
    get('tfInkOptions').hidden = tool !== 'pen';
    canvas.style.cursor = tool === 'pan' ? 'grab' : tool === 'select' ? 'default' : 'crosshair';
    schedule();
  }
  function updateObjectControls() {
    const select = get('tfObjects'); select.replaceChildren();
    const empty = document.createElement('option'); empty.value = ''; empty.textContent = tr('Select an object', 'Pilih objek'); select.append(empty);
    for (const o of data().objects) { const option = document.createElement('option'); option.value = o.id; option.textContent = o.name; select.append(option); }
    select.value = selected || ''; updateVertexControls(); sync();
  }
  function updateVertexControls() {
    const o = selectedObject(); if (!o) return;
    vertex = Math.min(vertex, o.points.length - 1); get('tfObjectName').value = o.name;
    const s = get('tfVertex'); s.replaceChildren(); o.labels.forEach((l, i) => { const option = document.createElement('option'); option.value = i; option.textContent = l; s.append(option); }); s.value = vertex;
    get('tfVX').value = o.points[vertex].x; get('tfVY').value = o.points[vertex].y; get('tfVertexLabel').value = o.labels[vertex];
  }
  function choose(id) {
    selected = id || null; vertex = 0; transform = null; centre = null; mirror = null; pickingCentre = false; equationOpen = false; polygon = []; resetPreview(); tool = 'select'; updateObjectControls();
    say('Choose a transformation, or drag a vertex to edit the object.', 'Pilih transformasi, atau seret bucu untuk menyunting objek.');
  }
  function setTool(next) {
    if (drag) return;
    tool = next; if (next !== 'polygon') polygon = [];
    pickingCentre = false; equationOpen = false;
    const hints = { select: ['Select an object or drag its vertices.', 'Pilih objek atau seret bucunya.'], pan: ['Drag the graph to move the view.', 'Seret graf untuk mengalih paparan.'], point: ['Tap a grid intersection to add a point.', 'Ketik persilangan grid untuk menambah titik.'], polygon: ['Tap each vertex. Tap the first point or Finish polygon to close.', 'Ketik setiap bucu. Ketik titik pertama atau Siapkan poligon.'], pen: ['Write on the graph. Annotations follow pan and zoom.', 'Tulis pada graf. Anotasi mengikuti alihan dan zum.'], eraser: ['Erase pen strokes. Geometry stays in place.', 'Padam coretan pen. Geometri kekal di tempatnya.'], mirror: ['Drag to draw a straight mirror line, then pull the lever.', 'Seret untuk melukis garis pantulan lurus, kemudian tarik tuil.'] };
    say(...(hints[next] || ['Drag on the graph to draw the shape.', 'Seret pada graf untuk melukis bentuk.'])); sync();
  }
  function activate(type) {
    if (!selectedObject()) return;
    resetPreview(); transform = type; tool = 'select'; polygon = []; pickingCentre = type === 'rotation' && !centre; equationOpen = false;
    say(type === 'rotation' ? 'Choose the rotation centre on the graph or enter its coordinates.' : type === 'reflection' ? 'Draw a mirror line or enter its equation.' : 'Use the gamepad or edit the column vector.', type === 'rotation' ? 'Pilih pusat putaran pada graf atau masukkan koordinatnya.' : type === 'reflection' ? 'Lukis garis pantulan atau masukkan persamaannya.' : 'Gunakan pad arah atau sunting vektor lajur.'); sync();
  }
  function addObject(points, name) {
    if (data().objects.length >= 100) { say('Maximum 100 objects in this exploration.', 'Maksimum 100 objek dalam penerokaan ini.'); return; }
    const id = crypto.randomUUID(), labels = nextLabels(data().objects, points.length);
    store.transact(d => d.transformation.objects.push({ id, name: name + ' ' + labels[0], points, labels })); choose(id);
  }
  function finishPolygon() {
    if (!polygonValid(polygon)) { say('Use at least three distinct vertices with no crossing edges.', 'Gunakan sekurang-kurangnya tiga bucu berbeza tanpa sisi bersilang.'); return; }
    addObject(polygon, tr('Polygon', 'Poligon')); polygon = []; sync();
  }
  function resetForEdit() { stopAnimation(); angle = 0; reflected = false; flip = 0; }
  function setCentre(p) { resetForEdit(); centre = p; pickingCentre = false; sync(); }
  function setMirror(handles) { try { const line = lineFromPoints(...handles); stopAnimation(); mirror = { line, handles }; reflected = false; flip = 0; return true; } catch { return false; } }
  function setAngle(value, snapping = false) { if (!centre) return; angle = snapRotation(value, snapping); sync(); }
  function settleReflection(target) {
    stopAnimation(); const from = flip; let start;
    const tick = now => {
      if (disposed) return;
      start ??= now; const t = Math.min(1, (now - start) / 190);
      flip = from + (target - from) * (1 - (1 - t) ** 3);
      if (t < 1) animation = requestAnimationFrame(tick); else { flip = target; reflected = target === 1; animation = 0; }
      sync();
    };
    animation = requestAnimationFrame(tick); sync();
  }
  function keepImage() {
    const source = selectedObject(), points = imagePoints(); if (!source || !canKeepImage()) return;
    if (data().objects.length >= 100) { say('Maximum 100 objects.', 'Maksimum 100 objek.'); return; }
    const image = completedImage(source, points, data().objects);
    store.transact(d => d.transformation.objects.push(image));
    choose(image.id); say('Image kept. Choose another transformation to continue.', 'Imej dikekalkan. Pilih transformasi lain untuk meneruskan.');
  }
  function zoom(factor, point = { x: canvas.clientWidth / 2, y: canvas.clientHeight / 2 }) { const next = Math.max(.5, Math.min(2.5, view.zoom * factor)); view = zoomAt(view, point, next / view.zoom); schedule(); }
  function fit() {
    const ps = data().objects.flatMap(o => o.points).concat(imagePoints() || []), w = canvas.clientWidth, h = canvas.clientHeight;
    if (!ps.length) view = { x: w / 2, y: h / 2, zoom: 1 };
    else { const xs = ps.map(p => p.x).concat(0), ys = ps.map(p => p.y).concat(0), xmin = Math.min(...xs) - 2, xmax = Math.max(...xs) + 2, ymin = Math.min(...ys) - 2, ymax = Math.max(...ys) + 2; const z = Math.max(.5, Math.min(1.6, (w - 72) / ((xmax - xmin) * GRID_UNIT), (h - 90) / ((ymax - ymin) * GRID_UNIT))); view = { x: w / 2 - (xmin + xmax) / 2 * GRID_UNIT * z, y: h / 2 + (ymin + ymax) / 2 * GRID_UNIT * z, zoom: z }; }
    schedule();
  }
  function repeat(button, action) {
    let delay, timer, pointer = null;
    const stop = () => { clearTimeout(delay); clearInterval(timer); pointer = null; };
    button.onpointerdown = e => { if (e.button !== 0) return; e.preventDefault(); pointer = e.pointerId; button.setPointerCapture(e.pointerId); action(); delay = setTimeout(() => { timer = setInterval(action, 110); }, 420); };
    button.onpointerup = button.onpointercancel = button.onlostpointercapture = stop;
    button.onclick = e => { if (e.detail === 0 && pointer === null) action(); };
    cleanups.push(stop);
  }
  for (const [dir, x, y] of [['Left', -1, 0], ['Right', 1, 0], ['Up', 0, 1], ['Down', 0, -1]]) {
    repeat(get('tfNudge' + dir), () => { if (selectedObject()) { vector = { x: Math.max(-1000, Math.min(1000, vector.x + x)), y: Math.max(-1000, Math.min(1000, vector.y + y)) }; sync(); } });
    repeat(get('tfView' + dir), () => { view.x += x * GRID_UNIT * view.zoom; view.y -= y * GRID_UNIT * view.zoom; schedule(); });
  }
  const padGrip = get('tfPadGrip');
  padGrip.onpointerdown = e => {
    if (e.button !== 0) return;
    e.preventDefault(); padGrip.focus({ preventScroll: true }); padGrip.setPointerCapture(e.pointerId);
    padDrag = { pointer: e.pointerId, x: e.clientX, y: e.clientY, position: placePad(), before: padPosition };
  };
  padGrip.onpointermove = e => {
    if (padDrag?.pointer !== e.pointerId) return;
    padPosition = { x: padDrag.position.x + e.clientX - padDrag.x, y: padDrag.position.y + e.clientY - padDrag.y }; placePad(); schedule();
  };
  padGrip.onpointerup = e => { if (padDrag?.pointer === e.pointerId) { padPosition = placePad(); padDrag = null; } };
  padGrip.onpointercancel = padGrip.onlostpointercapture = e => { if (padDrag?.pointer === e.pointerId) { padPosition = padDrag.before; padDrag = null; placePad(); schedule(); } };
  padGrip.onkeydown = e => {
    const steps = { ArrowLeft: [-10, 0], ArrowRight: [10, 0], ArrowUp: [0, -10], ArrowDown: [0, 10] };
    if (steps[e.key] || e.key === 'Home') {
      e.preventDefault(); e.stopPropagation(); const p = placePad(), d = steps[e.key];
      padPosition = d ? { x: p.x + d[0], y: p.y + d[1] } : null; placePad(); schedule();
    }
  };
  get('tfBack').onclick = back;
  for (const [id, next] of [['tfSelect', 'select'], ['tfPan', 'pan'], ['tfPoint', 'point'], ['tfPen', 'pen'], ['tfEraser', 'eraser']]) get(id).onclick = () => setTool(next);
  get('tfShape').onchange = e => { if (e.target.value) setTool(e.target.value); e.target.value = ''; };
  for (const type of ['Translation', 'Reflection', 'Rotation']) get('tf' + type).onclick = () => activate(type.toLowerCase());
  get('tfSnap').onchange = e => { snap = e.target.checked; };
  get('tfPenColour').onchange = e => { penColour = e.target.value; }; get('tfPenWidth').onchange = e => { penWidth = +e.target.value; };
  get('tfObjects').onchange = e => choose(e.target.value);
  get('tfDX').onchange = () => { vector.x = +get('tfDX').value; sync(); }; get('tfDY').onchange = () => { vector.y = +get('tfDY').value; sync(); };
  get('tfPadReset').onclick = get('tfVectorReset').onclick = () => { vector = { x: 0, y: 0 }; sync(); };
  get('tfDrawMirror').onclick = () => setTool('mirror');
  get('tfEnterMirror').onclick = () => { tool = 'select'; equationOpen = !equationOpen; equation = mirror ? lineEquation(mirror.line) : ''; cursor = equation.length; paintEquation(); sync(); if (equationOpen) get('tfEquation').focus({ preventScroll: true }); };
  get('tfPickCentre').onclick = () => { tool = 'select'; pickingCentre = true; sync(); say('Tap the graph to place the centre.', 'Ketik graf untuk meletakkan pusat.'); };
  get('tfCX').onchange = get('tfCY').onchange = () => setCentre({ x: +get('tfCX').value, y: +get('tfCY').value });
  get('tfAngle').onchange = () => { if (!centre) setCentre({ x: +get('tfCX').value, y: +get('tfCY').value }); setAngle(+get('tfAngle').value * +get('tfDirection').value); };
  get('tfDirection').onchange = () => setAngle(Math.abs(angle) * +get('tfDirection').value);
  get('tfRotationReset').onclick = () => setAngle(0);
  get('tfWedge').onchange = e => { rotationWedge = e.target.checked; schedule(); };
  get('tfGuides').onchange = e => { guides = e.target.checked; schedule(); };
  get('tfCoordinates').onchange = e => { coordinates = e.target.checked; schedule(); };
  get('tfLabels').onchange = e => { showLabels = e.target.checked; schedule(); };
  get('tfKeep').onclick = keepImage;
  get('tfExample').onclick = () => { addObject([{ x: -4, y: 1 }, { x: -1, y: 1 }, { x: -3, y: 4 }], tr('Triangle', 'Segi tiga')); fit(); };
  get('tfFinishPolygon').onclick = finishPolygon; get('tfCancelPolygon').onclick = () => setTool('select');
  get('tfZoomIn').onclick = () => zoom(1.2); get('tfZoomOut').onclick = () => zoom(1 / 1.2); get('tfFit').onclick = fit;
  const history = direction => { if (drag) return; resetPreview(); polygon = []; store[direction](); if (!selectedObject()) choose(null); else updateObjectControls(); };
  get('tfUndo').onclick = () => history('undo'); get('tfRedo').onclick = () => history('redo');
  function deleteSelected() { if (!selected || drag) return; store.transact(d => { d.transformation.objects = d.transformation.objects.filter(o => o.id !== selected); }); choose(null); say('Item deleted. Undo restores it.', 'Item dipadam. Undur untuk memulihkannya.'); }
  get('tfDelete').onclick = deleteSelected;
  get('tfVertex').onchange = e => { vertex = +e.target.value; updateVertexControls(); schedule(); };
  get('tfObjectName').onchange = e => { if (!selected) return; const value = e.target.value.trim(); if (value) store.transact(d => { d.transformation.objects.find(o => o.id === selected).name = value; }); updateObjectControls(); };
  get('tfVertexLabel').onchange = e => { if (!selected) return; const value = e.target.value.trim(); if (value) store.transact(d => { d.transformation.objects.find(o => o.id === selected).labels[vertex] = value; }); updateObjectControls(); };
  get('tfVX').onchange = get('tfVY').onchange = () => {
    const o = selectedObject(); if (!o) return;
    const ps = structuredClone(o.points); ps[vertex] = { x: +get('tfVX').value, y: +get('tfVY').value };
    if (ps.length > 2 && !polygonValid(ps)) { say('This edit would cross or flatten the polygon.', 'Suntingan ini akan menyilangkan atau meratakan poligon.'); updateVertexControls(); return; }
    resetForEdit(); store.transact(d => { d.transformation.objects.find(o => o.id === selected).points = ps; }); updateObjectControls();
  };
  function paintEquation() {
    const element = get('tfEquation'), caret = document.createElement('span'); caret.textContent = '│'; caret.className = 'tf-caret';
    element.replaceChildren(document.createTextNode(equation.slice(0, cursor)), caret, document.createTextNode(equation.slice(cursor))); element.setAttribute('aria-valuetext', equation);
  }
  function equationKey(key) {
    if (key === 'Enter') { applyEquation(); return; }
    if (key === 'C') { equation = ''; cursor = 0; }
    else if (key === 'Backspace') { if (cursor) { equation = equation.slice(0, cursor - 1) + equation.slice(cursor); cursor--; } }
    else if (key === 'Delete') equation = equation.slice(0, cursor) + equation.slice(cursor + 1);
    else if (key === 'ArrowLeft') cursor = Math.max(0, cursor - 1);
    else if (key === 'ArrowRight') cursor = Math.min(equation.length, cursor + 1);
    else if (equation.length < 120) { equation = equation.slice(0, cursor) + key + equation.slice(cursor); cursor += key.length; }
    paintEquation(); get('tfEquation').focus({ preventScroll: true });
  }
  function applyEquation() {
    try {
      const line = parseMirrorEquation(equation); stopAnimation(); mirror = { line, handles: lineHandles(line, screenToGraph({ x: canvas.clientWidth / 2, y: canvas.clientHeight / 2 }, view)) }; reflected = false; flip = 0; equationOpen = false; tool = 'select';
      say('Mirror line ready. Pull the lever up to reflect.', 'Garis pantulan sedia. Tarik tuil ke atas untuk pantulan.'); sync();
    } catch { say('Enter a straight-line equation, for example x = 3 or y = 2x + 1.', 'Masukkan persamaan garis lurus, contohnya x = 3 atau y = 2x + 1.'); }
  }
  for (const key of ['x', 'y', '=', '(', ')', '7', '8', '9', '+', '−', '4', '5', '6', '×', '÷', '1', '2', '3', '←', '→', 'C', '0', '.', '⌫']) {
    const b = document.createElement('button'); b.type = 'button'; b.textContent = key; b.onpointerdown = e => e.preventDefault(); b.onclick = () => equationKey(({ '⌫': 'Backspace', '←': 'ArrowLeft', '→': 'ArrowRight' })[key] || key); get('tfEquationKeys').append(b);
  }
  get('tfEquation').onkeydown = e => { if (e.ctrlKey || e.metaKey || e.altKey) return; if (/^[0-9xy=()+*/.\-]$/.test(e.key) || ['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Enter'].includes(e.key)) { e.preventDefault(); e.stopPropagation(); equationKey(e.key); } };
  get('tfApplyEquation').onclick = applyEquation;
  const reflectionLever = get('tfReflectionLever');
  function moveReflection(e) {
    if (reflectionDrag?.pointer !== e.pointerId) return;
    const r = reflectionLever.getBoundingClientRect();
    flip = reflectionDrag.scrub.move(1 - (e.clientY - r.top) / r.height); reflected = false; sync();
  }
  reflectionLever.onpointerdown = e => {
    if (!mirror || !selectedObject() || e.button !== 0) return;
    e.preventDefault(); reflectionLever.focus({ preventScroll: true }); stopAnimation();
    reflectionDrag = { pointer: e.pointerId, scrub: new ReflectionScrub(flip) };
    reflectionLever.setPointerCapture(e.pointerId); moveReflection(e);
  };
  reflectionLever.onpointermove = moveReflection;
  function endReflection(e, cancel = false) {
    if (reflectionDrag?.pointer !== e.pointerId) return;
    const scrub = reflectionDrag.scrub; reflectionDrag = null;
    settleReflection(cancel ? (scrub.start >= .5 ? 1 : 0) : scrub.target());
  }
  reflectionLever.onpointerup = e => endReflection(e);
  reflectionLever.onpointercancel = reflectionLever.onlostpointercapture = e => endReflection(e, true);
  reflectionLever.onkeydown = e => {
    if (!mirror || !selectedObject()) return;
    if (['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key)) {
      e.preventDefault(); e.stopPropagation();
      settleReflection(e.key === 'ArrowUp' || e.key === 'End' ? 1 : 0);
    }
  };
  const lever = get('tfLever'); let leverPointer = null, rotationSnap = new RotationSnap();
  const moveLever = e => { if (e.pointerId !== leverPointer) return; const r = lever.getBoundingClientRect(); setAngle(rotationSnap.move(leverAngle(e.clientY, r.top, r.height, false))); };
  lever.onpointerdown = e => { if (!centre || e.button !== 0) return; e.preventDefault(); lever.focus({ preventScroll: true }); leverPointer = e.pointerId; rotationSnap = new RotationSnap(angle); lever.setPointerCapture(e.pointerId); moveLever(e); };
  lever.onpointermove = moveLever; lever.onpointerup = lever.onpointercancel = lever.onlostpointercapture = () => { leverPointer = null; };
  lever.onkeydown = e => { const keys = { ArrowUp: angle + 1, ArrowDown: angle - 1, PageUp: angle + 90, PageDown: angle - 90, Home: 0, End: 360 }; if (Object.hasOwn(keys, e.key)) { e.preventDefault(); e.stopPropagation(); setAngle(keys[e.key]); } };

  const screenPoint = e => { const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  const point = e => screenToGraph(screenPoint(e), view);
  const snapped = e => snapPoint(point(e), snap);
  const distance = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  function discardDrag() { drag = null; ink = null; workingAnnotations = null; drawLine = null; schedule(); }
  const ownership = installCanvasOwnership(canvas, () => { discardDrag(); pointers.clear(); });
  function onDown(e) {
    if (e.button !== 0 || !ownership.allowed()) return;
    e.preventDefault(); canvas.focus({ preventScroll: true }); canvas.setPointerCapture(e.pointerId); pointers.set(e.pointerId, screenPoint(e));
    if (pointers.size === 2) { discardDrag(); const entries = [...pointers.entries()], [a, b] = entries.map(p => p[1]); drag = { type: 'pinch', ids: entries.map(p => p[0]), view: { ...view }, midpoint: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, distance: Math.max(1, distance(a, b)) }; return; }
    if (pointers.size > 2 || drag) return;
    const p = point(e), q = snapped(e), tolerance = 13 / (GRID_UNIT * view.zoom);
    if (tool === 'pen') { if (data().annotations.length >= 1000) return; ink = newAnnotation([p], penColour, penWidth); drag = { type: 'pen', pointer: e.pointerId }; schedule(); return; }
    if (tool === 'eraser') { workingAnnotations = eraseAnnotations(data().annotations, p, p, tolerance); drag = { type: 'eraser', pointer: e.pointerId, previous: p }; schedule(); return; }
    if (tool === 'pan') { drag = { type: 'pan', pointer: e.pointerId, start: screenPoint(e), view: { ...view } }; return; }
    if (tool === 'mirror') { drawLine = [q, q]; drag = { type: 'mirror', pointer: e.pointerId, start: q }; return; }
    if (tool === 'point') { drag = { type: 'point', pointer: e.pointerId, start: q }; return; }
    if (tool === 'polygon') { drag = { type: 'polygon', pointer: e.pointerId, start: q }; return; }
    if (['line', 'triangle', 'rectangle', 'square'].includes(tool)) { drag = { type: 'shape', kind: tool, pointer: e.pointerId, start: q, end: q }; polygon = shapePoints(tool, q, q); return; }
    if (pickingCentre && transform === 'rotation') { setCentre(q); return; }
    if (transform === 'rotation' && centre && distance(p, centre) < tolerance) { resetForEdit(); drag = { type: 'centre', pointer: e.pointerId, before: { ...centre } }; sync(); return; }
    if (transform === 'reflection' && mirror) {
      const index = mirror.handles.findIndex(h => distance(p, h) < tolerance);
      if (index >= 0) { drag = { type: 'mirrorHandle', pointer: e.pointerId, index, handles: structuredClone(mirror.handles) }; stopAnimation(); reflected = false; flip = 0; sync(); return; }
      if (distance(p, mirrorGrip(mirror.handles)) < tolerance * 1.5 || distance(p, lineFoot(p, mirror.line)) < tolerance * .7) { drag = { type: 'mirrorMove', pointer: e.pointerId, start: p, handles: structuredClone(mirror.handles) }; stopAnimation(); reflected = false; flip = 0; sync(); return; }
    }
    const preview = previewObject();
    if (preview && canKeepImage() && objectHit(p, preview, tolerance)) { drag = { type: 'image', pointer: e.pointerId, start: p, screenStart: screenPoint(e), moved: false, vector: { ...vector } }; return; }
    const o = selectedObject();
    if (o) { const index = o.points.findIndex(v => distance(p, v) < tolerance); if (index >= 0) { vertex = index; resetForEdit(); drag = { type: 'vertex', pointer: e.pointerId, index, id: o.id, before: structuredClone(o.points), points: structuredClone(o.points) }; updateVertexControls(); sync(); return; } }
    const hit = [...data().objects].reverse().find(o => objectHit(p, o, tolerance));
    if (hit) { if (selected !== hit.id) choose(hit.id); resetForEdit(); drag = { type: 'object', pointer: e.pointerId, start: p, id: hit.id, before: structuredClone(hit.points), points: structuredClone(hit.points) }; return; }
    drag = { type: 'pan', pointer: e.pointerId, start: screenPoint(e), view: { ...view } };
  }
  function shapePoints(kind, a, b) {
    let end = b;
    if (kind === 'square') { const d = Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y)); end = { x: a.x + (Math.sign(b.x - a.x) || 1) * d, y: a.y + (Math.sign(b.y - a.y) || -1) * d }; }
    if (kind === 'line') return [a, end];
    if (kind === 'triangle') return [a, { x: end.x, y: a.y }, { x: snap ? Math.round((a.x + end.x) / 2) : (a.x + end.x) / 2, y: end.y }];
    return [a, { x: end.x, y: a.y }, end, { x: a.x, y: end.y }];
  }
  function onMove(e) {
    if (!pointers.has(e.pointerId) || !drag) return;
    pointers.set(e.pointerId, screenPoint(e));
    if (drag.type === 'pinch') {
      const [a, b] = drag.ids.map(id => pointers.get(id)); if (!a || !b) return;
      const midpoint = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, z = Math.max(.5, Math.min(2.5, drag.view.zoom * distance(a, b) / drag.distance));
      const next = zoomAt(drag.view, drag.midpoint, z / drag.view.zoom); view = { ...next, x: next.x + midpoint.x - drag.midpoint.x, y: next.y + midpoint.y - drag.midpoint.y }; schedule(); return;
    }
    if (drag.pointer !== e.pointerId) return;
    const p = point(e), q = snapped(e);
    if (drag.type === 'pan') { const s = screenPoint(e); view = { ...drag.view, x: drag.view.x + s.x - drag.start.x, y: drag.view.y + s.y - drag.start.y }; }
    else if (drag.type === 'pen') { const samples = e.getCoalescedEvents?.(); for (const sample of samples?.length ? samples : [e]) { const v = point(sample); if (ink.points.length < 10000 && distance(v, ink.points.at(-1)) * GRID_UNIT * view.zoom > .8) ink.points.push(v); } }
    else if (drag.type === 'eraser') { workingAnnotations = eraseAnnotations(workingAnnotations, drag.previous, p, 13 / (GRID_UNIT * view.zoom)); drag.previous = p; }
    else if (drag.type === 'centre') { centre = q; sync(); }
    else if (drag.type === 'mirror') drawLine = [drag.start, q];
    else if (drag.type === 'mirrorHandle') { const handles = structuredClone(drag.handles); handles[drag.index] = q; setMirror(handles); sync(); }
    else if (drag.type === 'mirrorMove') { const delta = snapPoint({ x: p.x - drag.start.x, y: p.y - drag.start.y }, snap); setMirror(moveMirror(drag.handles, delta)); sync(); }
    else if (drag.type === 'image') {
      drag.moved ||= distance(screenPoint(e), drag.screenStart) > 6;
      if (drag.moved && transform === 'translation') { const delta = snapPoint({ x: p.x - drag.start.x, y: p.y - drag.start.y }, snap); vector = translatePoint(drag.vector, delta); sync(); }
    }
    else if (drag.type === 'shape') { drag.end = q; polygon = shapePoints(drag.kind, drag.start, q); }
    else if (drag.type === 'vertex') { drag.points = structuredClone(drag.before); drag.points[drag.index] = q; }
    else if (drag.type === 'object') { const delta = snapPoint({ x: p.x - drag.start.x, y: p.y - drag.start.y }, snap); drag.points = drag.before.map(v => translatePoint(v, delta)); }
    schedule();
  }
  function onEnd(e, cancelled = false) {
    if (!pointers.has(e.pointerId)) return;
    pointers.delete(e.pointerId); const action = drag;
    if (!action) return;
    if (action.type === 'pinch') { if (action.ids.includes(e.pointerId)) { pointers.clear(); discardDrag(); } return; }
    if (action.pointer !== e.pointerId) return;
    if (cancelled) { if (action.type === 'centre') centre = action.before; if (action.type === 'mirrorHandle' || action.type === 'mirrorMove') setMirror(action.handles); if (action.type === 'image') vector = action.vector; if (action.type === 'shape') polygon = []; discardDrag(); sync(); return; }
    // Keep the transaction separate from pointer preview: one gesture is one undo step.
    drag = null;
    if (action.type === 'image' && !action.moved && distance(screenPoint(e), action.screenStart) <= 6) keepImage();
    else if (action.type === 'pen' && ink) { const stroke = ink; ink = null; store.transact(d => d.transformation.annotations.push(stroke)); }
    else if (action.type === 'eraser') { const annotations = workingAnnotations; workingAnnotations = null; store.transact(d => { d.transformation.annotations = annotations; }); }
    else if (action.type === 'point') addObject([snapped(e)], tr('Point', 'Titik'));
    else if (action.type === 'polygon') { const p = snapped(e); if (polygon.length >= 3 && distance(p, polygon[0]) < 13 / (GRID_UNIT * view.zoom)) finishPolygon(); else if (polygon.length < 30 && !polygon.some(v => distance(v, p) < 1e-8)) polygon.push(p); }
    else if (action.type === 'shape') { const ps = shapePoints(action.kind, action.start, snapped(e)); polygon = []; if ((ps.length === 2 && distance(...ps) > .05) || (ps.length > 2 && polygonValid(ps))) addObject(ps, ({ triangle: tr('Triangle', 'Segi tiga'), rectangle: tr('Rectangle', 'Segi empat tepat'), square: tr('Square', 'Segi empat sama'), line: tr('Line', 'Garis') })[action.kind]); }
    else if (action.type === 'mirror') { if (setMirror([action.start, snapped(e)])) tool = 'select'; else say('Draw between two different points.', 'Lukis antara dua titik berbeza.'); drawLine = null; }
    else if (action.type === 'vertex' || action.type === 'object') {
      if (action.points.length <= 2 || polygonValid(action.points)) store.transact(d => { const o = d.transformation.objects.find(o => o.id === action.id); if (o) o.points = action.points; });
      else say('This edit would cross or flatten the polygon.', 'Suntingan ini akan menyilangkan atau meratakan poligon.');
      updateVertexControls();
    }
    sync();
  }
  canvas.onpointerdown = onDown;
  canvas.onpointermove = onMove;
  canvas.onpointerup = e => onEnd(e); canvas.onpointercancel = e => onEnd(e, true); canvas.onlostpointercapture = e => onEnd(e, true);
  canvas.onwheel = e => { e.preventDefault(); zoom(Math.exp(-e.deltaY * .001), screenPoint(e)); };
  canvas.onkeydown = e => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); e.stopPropagation(); history(e.shiftKey ? 'redo' : 'undo'); }
    else if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); e.stopPropagation(); deleteSelected(); }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); pointers.clear(); discardDrag(); polygon = []; pickingCentre = false; setTool('select'); }
    else if (e.key === 'Enter' && tool === 'polygon') { e.preventDefault(); finishPolygon(); }
  };
  const unsubscribe = store.subscribe(() => updateObjectControls());
  const resize = new ResizeObserver(() => {
    const width = canvas.clientWidth, height = canvas.clientHeight;
    if (!previousSize) view = { x: width / 2, y: height / 2, zoom: width < 500 ? .75 : 1 };
    else { view.x += (width - previousSize.width) / 2; view.y += (height - previousSize.height) / 2; }
    previousSize = { width, height }; schedule();
  }); resize.observe(board);
  updateObjectControls(); say('Add a point or shape to begin.', 'Tambah titik atau bentuk untuk bermula.');
  return () => { disposed = true; stopAnimation(); cancelAnimationFrame(frame); cleanups.forEach(fn => fn()); resize.disconnect(); ownership.dispose(); unsubscribe(); disposeStore(); host.classList.remove('transform-mode', 'tf-has-lever'); };
}
