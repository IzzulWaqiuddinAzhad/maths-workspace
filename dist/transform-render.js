import { graphToScreen, screenToGraph, GRID_UNIT, formatNumber, lineHandles, lineFoot, mirrorGrip } from './transform-model.js?v=29';
import { LabelLayout, polarCandidates, paintLabel } from './label-layout.js?v=12';

export function createTransformationRenderer(canvas) {
  const ctx = canvas.getContext('2d'), labels = new LabelLayout();
  return function draw(state) {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) { canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
    const { view, objects, selected, preview, annotations, transform, centre, mirror, guides, coordinates, vertex = 0 } = state;
    const dark = document.body.classList.contains('dark'), ink = dark ? '#edf0f5' : '#20242c', paper = dark ? '#15181d' : '#fff', blue = dark ? '#83b6ff' : '#2367c8';
    const screen = p => graphToScreen(p, view), requests = [], segments = [], dots = [], obstacles = [];
    const stroke = (ps, colour, width = 1.7, dash = []) => { ctx.beginPath(); ps.forEach((p, i) => { const q = screen(p); i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y); }); ctx.strokeStyle = colour; ctx.lineWidth = width; ctx.setLineDash(dash); ctx.stroke(); ctx.setLineDash([]); };
    const arrow = (a, b, colour = ink, width = 1.5) => { stroke([a, b], colour, width); const A = screen(a), B = screen(b), angle = Math.atan2(B.y - A.y, B.x - A.x); ctx.fillStyle = colour; ctx.beginPath(); ctx.moveTo(B.x, B.y); ctx.lineTo(B.x - 9 * Math.cos(angle - .42), B.y - 9 * Math.sin(angle - .42)); ctx.lineTo(B.x - 9 * Math.cos(angle + .42), B.y - 9 * Math.sin(angle + .42)); ctx.closePath(); ctx.fill(); };
    const text = (value, x, y, colour = ink) => { ctx.fillStyle = colour; ctx.fillText(value, x, y); obstacles.push({ x: x - ctx.measureText(value).width / 2 - 3, y: y - 8, w: ctx.measureText(value).width + 6, h: 16 }); };
    ctx.fillStyle = paper; ctx.fillRect(0, 0, w, h);
    const low = screenToGraph({ x: 32, y: h - 32 }, view), high = screenToGraph({ x: w - 32, y: 32 }, view);
    const xmin = Math.ceil(low.x), xmax = Math.floor(high.x), ymin = Math.ceil(low.y), ymax = Math.floor(high.y);
    const spacing = GRID_UNIT * view.zoom;
    for (let x = xmin; x <= xmax; x++) stroke([{ x, y: ymin }, { x, y: ymax }], dark ? '#3d424b' : '#d9dde2', .8);
    for (let y = ymin; y <= ymax; y++) stroke([{ x: xmin, y }, { x: xmax, y }], dark ? '#3d424b' : '#d9dde2', .8);
    ctx.font = '12px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const stride = spacing < 32 ? 2 : 1, xvisible = ymin <= 0 && ymax >= 0, yvisible = xmin <= 0 && xmax >= 0;
    if (xvisible) {
      arrow({ x: xmin, y: 0 }, { x: xmax, y: 0 }, ink, 2); segments.push([screen({ x: xmin, y: 0 }), screen({ x: xmax, y: 0 })]);
      for (let x = xmin; x < xmax; x++) if (x && x % stride === 0) { const p = screen({ x, y: 0 }); ctx.fillStyle = ink; ctx.fillRect(p.x - .6, p.y - 3, 1.2, 6); text(String(x), p.x, p.y + 16); }
      const p = screen({ x: xmax, y: 0 }); text('x', p.x + 15, p.y);
    }
    if (yvisible) {
      arrow({ x: 0, y: ymin }, { x: 0, y: ymax }, ink, 2); segments.push([screen({ x: 0, y: ymin }), screen({ x: 0, y: ymax })]);
      for (let y = ymin; y < ymax; y++) if (y && y % stride === 0) { const p = screen({ x: 0, y }); ctx.fillStyle = ink; ctx.fillRect(p.x - 3, p.y - .6, 6, 1.2); text(String(y), p.x - 16, p.y); }
      const p = screen({ x: 0, y: ymax }); text('y', p.x, p.y - 16);
    }
    if (xvisible && yvisible) { const p = screen({ x: 0, y: 0 }); text('0', p.x - 13, p.y + 15); }
    function object(o, isImage = false) {
      const ps = o.points.map(screen), active = o.id === selected, colour = isImage || o.image ? blue : ink;
      if (ps.length > 1) {
        ctx.beginPath(); ps.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y));
        if (ps.length > 2) { ctx.closePath(); ctx.fillStyle = isImage ? (dark ? '#699feb26' : '#4e92f226') : active ? (dark ? '#edf0f509' : '#24304705') : 'transparent'; ctx.fill(); }
        ctx.lineWidth = active || isImage ? 2.4 : 1.9; ctx.strokeStyle = colour; ctx.stroke();
        ps.forEach((p, i) => { if (i || ps.length > 2) segments.push([ps[(i + ps.length - 1) % ps.length], p]); });
      }
      const mid = ps.reduce((p, q) => ({ x: p.x + q.x / ps.length, y: p.y + q.y / ps.length }), { x: 0, y: 0 });
      ps.forEach((p, i) => {
        ctx.beginPath(); ctx.arc(p.x, p.y, active && !isImage ? 5 : 3.5, 0, Math.PI * 2); ctx.fillStyle = active && !isImage ? paper : colour; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = colour; ctx.stroke(); dots.push(p);
        const label = o.labels[i] + (coordinates ? ` (${formatNumber(o.points[i].x)}, ${formatNumber(o.points[i].y)})` : '');
        if (state.labels !== false) requests.push({ id: `${isImage ? 'image' : o.id}:${i}`, text: label, colour, candidates: polarCandidates(p, ps.length === 1 ? -Math.PI / 4 : Math.atan2(p.y - mid.y, p.x - mid.x), 21, { spread: .5, rings: 5 }) });
      });
    }
    if (guides && preview) {
      const original = objects.find(o => o.id === selected), index = Math.min(vertex, original.points.length - 1), a = original.points[index], b = preview.points[index];
      if (transform === 'translation') {
        const corner = { x: b.x, y: a.y }; stroke([a, corner, b], blue, 1.3, [5, 5]); arrow(a, b, blue, 1.2);
      }
      if (transform === 'reflection' && mirror) for (let i = 0; i < original.points.length; i++) {
        const p = original.points[i], q = preview.points[i], f = lineFoot(p, mirror.line); stroke([p, q], blue, 1, [4, 4]);
        for (const end of [p, q]) { const mid = screen({ x: (end.x + f.x) / 2, y: (end.y + f.y) / 2 }), A = screen(p), B = screen(q), length = Math.hypot(B.x - A.x, B.y - A.y) || 1; ctx.beginPath(); ctx.moveTo(mid.x - (B.y - A.y) * 4 / length, mid.y + (B.x - A.x) * 4 / length); ctx.lineTo(mid.x + (B.y - A.y) * 4 / length, mid.y - (B.x - A.x) * 4 / length); ctx.strokeStyle = blue; ctx.stroke(); }
      }
    }
    if (transform === 'rotation' && centre && state.rotationWedge && state.rotationGuide) {
      const guide = state.rotationGuide, c = screen(centre), A = screen(guide.source), start = -guide.start, sweep = -guide.sweep, end = start + sweep;
      const radius = Math.min(72, Math.hypot(A.x - c.x, A.y - c.y) * .42);
      if (radius > 4 && Math.abs(sweep) > 1e-9) {
        ctx.beginPath(); ctx.moveTo(c.x, c.y); ctx.arc(c.x, c.y, radius, start, end, sweep < 0); ctx.closePath();
        ctx.fillStyle = dark ? '#6da6f240' : '#4387df26'; ctx.fill();
        ctx.beginPath(); ctx.arc(c.x, c.y, radius, start, end, sweep < 0); ctx.strokeStyle = blue; ctx.lineWidth = 2; ctx.stroke();
        const tangent = end + (sweep < 0 ? -Math.PI / 2 : Math.PI / 2), x = c.x + Math.cos(end) * radius, y = c.y + Math.sin(end) * radius;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 9 * Math.cos(tangent - .4), y - 9 * Math.sin(tangent - .4)); ctx.lineTo(x - 9 * Math.cos(tangent + .4), y - 9 * Math.sin(tangent + .4)); ctx.closePath(); ctx.fillStyle = blue; ctx.fill();
      }
      stroke([centre, guide.source], blue, 1.4, [6, 4]);
      if (state.angle) stroke([centre, guide.image], blue, 1.7);
      segments.push([c, screen(guide.source)], [c, screen(guide.image)]);
      requests.push({ id: 'rotation-angle', text: state.rotationLabel, colour: blue, candidates: polarCandidates(c, start + sweep / 2, radius + 24, { spread: .35, rings: 6 }) });
    }
    objects.forEach(o => object(o));
    if (preview) object(preview, true);
    if (mirror && transform === 'reflection') {
      const ps = lineHandles(mirror.line, screenToGraph({ x: w / 2, y: h / 2 }, view), Math.hypot(w, h) / spacing);
      stroke(ps, dark ? '#e5af64' : '#9b6018', 2, [9, 5]);
      for (const p of mirror.handles) { const s = screen(p); ctx.fillStyle = paper; ctx.strokeStyle = dark ? '#e5af64' : '#9b6018'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(s.x, s.y, 7, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); dots.push(s); }
      const grip = screen(mirrorGrip(mirror.handles));
      ctx.save(); ctx.translate(grip.x, grip.y); ctx.rotate(Math.PI / 4); ctx.fillStyle = dark ? '#b58543' : '#a3681e'; ctx.strokeStyle = paper; ctx.lineWidth = 2; ctx.fillRect(-9, -9, 18, 18); ctx.strokeRect(-9, -9, 18, 18); ctx.restore();
      ctx.font = 'bold 17px system-ui'; ctx.fillStyle = '#fff'; ctx.fillText('✥', grip.x, grip.y); dots.push(grip);
    }
    if (centre && transform === 'rotation') {
      const p = screen(centre); ctx.strokeStyle = dark ? '#e5af64' : '#9b6018'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(p.x, p.y, 7, 0, Math.PI * 2); ctx.moveTo(p.x - 11, p.y); ctx.lineTo(p.x + 11, p.y); ctx.moveTo(p.x, p.y - 11); ctx.lineTo(p.x, p.y + 11); ctx.stroke();
      requests.push({ id: 'centre', text: `${state.centreLabel || 'Centre'} (${formatNumber(centre.x)}, ${formatNumber(centre.y)})`, colour: dark ? '#e5af64' : '#9b6018', candidates: polarCandidates(p, -Math.PI / 4, 27, { spread: .6, rings: 6 }) });
    }
    if (state.draft?.length) { stroke(state.draft, blue, 2, [5, 4]); state.draft.forEach(p => { const s = screen(p); ctx.beginPath(); ctx.arc(s.x, s.y, 5, 0, Math.PI * 2); ctx.fillStyle = blue; ctx.fill(); }); }
    if (state.drawLine) stroke(state.drawLine, '#b58032', 2, [6, 4]);
    labels.begin({ bounds: { x: 8, y: 8, w: w - 16, h: h - 60 }, segments, points: dots });
    // Keep vertex labels clear of axis numerals and the graph's edge controls.
    labels.placed.push(...obstacles, ...(state.overlays || []), { x: 5, y: h / 2 - 20, w: 40, h: 40 }, { x: w - 45, y: h / 2 - 20, w: 40, h: 40 }, { x: w / 2 - 20, y: 5, w: 40, h: 40 }, { x: w / 2 - 20, y: h - 92, w: 40, h: 40 });
    ctx.font = 'italic 15px Georgia, serif';
    for (const request of requests) { const placed = labels.place({ ...request, width: ctx.measureText(request.text).width, height: 17 }); paintLabel(ctx, placed, { ink: request.colour, background: paper }); }
    labels.end();
    for (const s of [...annotations, ...(state.ink ? [state.ink] : [])]) {
      ctx.lineCap = 'round'; ctx.lineJoin = 'round'; const colour = dark && s.strokeColour === '#20242c' ? '#edf0f5' : s.strokeColour;
      if (s.points.length === 1) { const p = screen(s.points[0]); ctx.beginPath(); ctx.arc(p.x, p.y, s.strokeWidth * spacing / 2, 0, Math.PI * 2); ctx.fillStyle = colour; ctx.fill(); }
      else stroke(s.points, colour, s.strokeWidth * spacing);
    }
    ctx.lineCap = 'butt';
    return { xmin, xmax, ymin, ymax };
  };
}
