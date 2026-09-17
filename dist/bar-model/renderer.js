import { LabelLayout } from "../label-layout.js?v=18";
const NS = "http://www.w3.org/2000/svg";
export const escape = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export function sceneLabels(scene, show = true) {
  if (!show) return [];
  const layout = new LabelLayout(),
    segments = scene.segments.filter((s) => s.opacity > 0.25),
    edges = segments.flatMap((s) => [
      [
        { x: s.x, y: s.y },
        { x: s.x + s.w, y: s.y },
      ],
      [
        { x: s.x, y: s.y + s.h },
        { x: s.x + s.w, y: s.y + s.h },
      ],
    ]);
  layout.begin({
    bounds: { x: 10, y: 10, w: scene.width - 20, h: scene.height - 20 },
    segments: edges,
  });
  const out = [];
  for (const s of segments) {
    if (!s.label) continue;
    const w = String(s.label).length * 9.2,
      centre = { x: s.x + s.w / 2, y: s.y + s.h / 2 },
      candidates =
        s.w > w + 8
          ? [centre]
          : [
              { x: centre.x, y: s.y - 12 },
              { x: centre.x, y: s.y + s.h + 13 },
              ...[-22, 22, -40, 40].map((dx) => ({
                x: centre.x + dx,
                y: s.y - 25,
              })),
            ];
    const p = layout.place({
      id: s.id,
      text: s.label,
      width: w,
      height: 20,
      candidates,
    });
    out.push({
      ...p,
      quantityId: s.quantityId,
      leader: s.w < w + 8 ? centre : null,
    });
  }
  for (const l of [
    ...scene.labels,
    ...scene.braces
      .filter((b) => b.opacity > 0.1)
      .map((b) => ({
        id: b.id + "-text",
        x: b.x + b.w / 2,
        y: b.y + 19,
        text: b.text,
        quantityId: b.quantityId,
      })),
  ]) {
    const text = String(l.text),
      parts = text.length > 65 ? [text.slice(0, 65), text.slice(65)] : [text];
    parts.forEach((text, i) =>
      out.push({
        ...layout.place({
          id: l.id + "-" + i,
          text,
          width: text.length * 8.8,
          height: 20,
          candidates: [
            { x: l.x, y: l.y + i * 16 },
            { x: l.x, y: l.y - 16 + i * 16 },
            { x: l.x, y: l.y + 16 + i * 16 },
          ],
        }),
        quantityId: l.quantityId,
      }),
    );
  }
  return out;
}
export function createSceneRenderer(svg) {
  svg.setAttribute("viewBox", "0 0 800 400");
  svg.setAttribute("role", "img");
  const world = document.createElementNS(NS, "g");
  svg.append(world);
  const nodes = new Map();
  const node = (id, tag) => {
    if (nodes.has(id)) return nodes.get(id);
    const n = document.createElementNS(NS, tag);
    nodes.set(id, n);
    world.append(n);
    return n;
  };
  return (
    scene,
    {
      view = { x: 0, y: 0, zoom: 1 },
      labels = true,
      highlight = null,
      selected = null,
    } = {},
  ) => {
    world.setAttribute(
      "transform",
      `translate(${view.x} ${view.y}) scale(${view.zoom})`,
    );
    const live = new Set(),
      set = (id, tag, attrs, text) => {
        live.add(id);
        const n = node(id, tag);
        for (const [k, v] of Object.entries(attrs))
          n.setAttribute(k, String(v));
        if (text !== undefined) n.textContent = text;
        return n;
      };
    for (const s of scene.segments) {
      set(s.id, "rect", {
        x: s.x,
        y: s.y,
        width: s.w,
        height: s.h,
        rx: 2,
        fill: s.fill || "#d9e9fd",
        stroke:
          selected === s.id
            ? "#2362c3"
            : highlight === s.quantityId
              ? "#a95500"
              : "#26364b",
        "stroke-width":
          selected === s.id || highlight === s.quantityId ? 3 : 1.3,
        opacity:
          highlight && highlight !== s.quantityId ? 0.25 : (s.opacity ?? 1),
        "data-segment": s.id,
        tabindex: 0,
        "aria-label": s.label || s.quantityId,
      });
      if (selected === s.id)
        set(s.id + "-handle", "circle", {
          cx: s.x + s.w,
          cy: s.y + s.h / 2,
          r: 7,
          fill: "#367adc",
          "data-resize": s.id,
        });
    }
    for (const b of scene.braces)
      set("brace-" + b.id, "path", {
        d: `M ${b.x} ${b.y - 6} v 6 h ${b.w / 2 - 5} l 5 5 l 5 -5 h ${b.w / 2 - 5} v -6`,
        fill: "none",
        stroke: "#26364b",
        "stroke-width": 1.3,
        opacity: b.opacity ?? 1,
      });
    for (const l of sceneLabels(scene, labels)) {
      if (l.leader)
        set("leader-" + l.id, "line", {
          x1: l.leader.x,
          y1: l.leader.y,
          x2: l.x,
          y2: l.y,
          stroke: "#738093",
          "stroke-width": 0.7,
        });
      set(
        "label-" + l.id,
        "text",
        {
          x: l.x,
          y: l.y,
          fill: "#172033",
          "font-size": 18,
          "font-family": "sans-serif",
          "text-anchor": "middle",
          "dominant-baseline": "middle",
          "pointer-events": "none",
        },
        l.text,
      );
    }
    for (const [i, a] of (scene.annotations || []).entries())
      set("ink-" + i, "path", {
        d: a.points.map((p, i) => (i ? "L" : "M") + p.x + " " + p.y).join(" "),
        fill: "none",
        stroke: a.colour || "#af3151",
        "stroke-width": 2,
        "pointer-events": "none",
      });
    for (const [id, n] of nodes)
      if (!live.has(id)) {
        n.remove();
        nodes.delete(id);
      }
  };
}
// Print in physical units, with measured text and cropped scene bounds. Screen
// font metrics cannot be reused at a different print scale.
export function drawVectorScene(
  pdf,
  scene,
  x,
  y,
  w,
  h,
  { labels = true } = {},
) {
  const segments = scene.segments.filter((s) => s.opacity >= 0.25);
  const braces = scene.braces.filter((b) => b.opacity >= 0.25);
  const captions = [
    ...scene.labels,
    ...braces.map((b) => ({
      id: b.id,
      x: b.x + b.w / 2,
      y: b.y + 9,
      text: b.text,
    })),
  ];
  if (!segments.length) return;
  const minX = Math.min(
    ...segments.map((s) => s.x),
    ...captions.map((l) => l.x - 45),
  );
  const maxX = Math.max(
    ...segments.map((s) => s.x + s.w),
    ...captions.map((l) => l.x + 45),
  );
  const minY = Math.min(
    ...segments.map((s) => s.y - 12),
    ...captions.map((l) => l.y - 10),
  );
  const maxY = Math.max(
    ...segments.map((s) => s.y + s.h + 12),
    ...captions.map((l) => l.y + 10),
  );
  const k = (w - 12) / (maxX - minX),
    ky = (h - 8) / (maxY - minY);
  const ox = x + 6 - minX * k,
    oy = y + 4 - minY * ky;
  pdf.setFont("Worksheet", "normal");
  pdf.setFontSize(8.5);
  pdf.setTextColor(25);
  pdf.setDrawColor(40);
  pdf.setLineWidth(0.25);
  const placed = [];
  const label = (text, cx, cy, inside = null) => {
    if (!labels || !text) return;
    text = String(text);
    const tw = pdf.getTextWidth(text),
      th = 3.3;
    let candidates = [cy, cy - 4, cy + 4, cy - 8, cy + 8, cy - 12, cy + 12];
    if (inside && tw + 1 < inside.w) candidates = [cy];
    else if (inside)
      candidates = [
        inside.y - 2.5,
        inside.y + inside.h + 2.5,
        inside.y - 6.5,
        inside.y + inside.h + 6.5,
      ];
    const lx = Math.max(x + tw / 2, Math.min(x + w - tw / 2, cx));
    const ly =
      candidates.find(
        (v) =>
          v - th / 2 >= y &&
          v + th / 2 <= y + h &&
          !placed.some(
            (b) =>
              Math.abs(b.x - lx) < (b.w + tw) / 2 + 1 &&
              Math.abs(b.y - v) < th + 0.5,
          ),
      ) ?? Math.max(y + 2, Math.min(y + h - 2, cy));
    placed.push({ x: lx, y: ly, w: tw });
    if (inside && Math.abs(ly - cy) > 1) {
      pdf.setDrawColor(130);
      pdf.line(cx, cy, lx, ly);
      pdf.setDrawColor(40);
    }
    pdf.text(text, lx, ly, { align: "center", baseline: "middle" });
  };
  for (const s of segments) {
    pdf.setFillColor(243);
    pdf.rect(ox + s.x * k, oy + s.y * ky, s.w * k, s.h * ky, "FD");
  }
  for (const b of braces) {
    const bx = ox + b.x * k,
      by = oy + b.y * ky,
      bw = b.w * k;
    pdf.line(bx, by - 1, bx, by);
    pdf.line(bx, by, bx + bw, by);
    pdf.line(bx + bw, by, bx + bw, by - 1);
  }
  // Equal cells share a value. Label one cell when repeating it would collide.
  const labelledGroups = new Set();
  for (const s of segments) {
    const tw = pdf.getTextWidth(String(s.label));
    const group = s.equalUnitGroupId && `${s.y}:${s.label}`;
    if (group && s.w * k < tw + 2) {
      if (labelledGroups.has(group)) continue;
      labelledGroups.add(group);
    }
    label(s.label, ox + (s.x + s.w / 2) * k, oy + (s.y + s.h / 2) * ky, {
      x: ox + s.x * k,
      y: oy + s.y * ky,
      w: s.w * k,
      h: s.h * ky,
    });
  }
  for (const l of captions) label(l.text, ox + l.x * k, oy + l.y * ky);
}
