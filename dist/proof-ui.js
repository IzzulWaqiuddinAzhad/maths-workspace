import {
  PolygonProof,
  interior,
  nextDiagonal,
  anglePieces,
  faceAngles,
  carryAngleLabel,
  inside,
} from "./polygon-proof.js?v=21";
import { proofResultGrid, proofResultGeometry } from "./proof-layout.js?v=21";
import { angleMark } from "./angle-renderer.js?v=11";
import { displayValues } from "./angle-model.js?v=18";
import { screenToWorld, worldToScreen } from "./core.js?v=14";
import { installCanvasOwnership } from "./interaction.js?v=13";
import {
  LabelLayout,
  polarCandidates,
  edgeCandidates,
  paintLabel,
} from "./label-layout.js?v=12";
export function mountVisualProof(host, { language = () => "en", back }) {
  const tr = (a, b) => (language() === "bm" ? b : a),
    model = new PolygonProof(),
    labelLayout = new LabelLayout();
  let proof = false,
    cutMode = false,
    chosen = null,
    hint = null,
    drag = null,
    labels = true,
    diagonals = true,
    sides = false,
    relationship = false,
    formula = false,
    addition = false,
    highlight = null,
    view = { x: 0, y: 0, zoom: 1 },
    frame = 0;
  host.classList.add("proof-mode");
  host.insertAdjacentHTML(
    "beforeend",
    `<div class="proof-head"><button id="proofBack">${tr("← Library", "← Pustaka")}</button><h2>${tr("Visual Proof", "Bukti Visual")}</h2><span class="explorer-kicker">${tr("Interior angles", "Sudut pedalaman")}</span></div><div class="proof-controls"><label>${tr("Sides", "Sisi")} <input id="proofSides" type="number" min="3" max="20" value="3" data-math-mode="integer" aria-label="${tr("Number of sides", "Bilangan sisi")}"></label><button id="proofStart">${tr("Visual Proof", "Bukti Visual")}</button><button id="proofReset">${tr("Reset", "Tetap semula")}</button></div><p id="proofGuide" role="status"></p><div class="proof-actions" hidden><button id="proofCut">${tr("Draw diagonals", "Lukis pepenjuru")}</button><button id="proofMove">${tr("Move vertices", "Gerakkan bucu")}</button><button id="proofUndo">${tr("Undo cut", "Undur potongan")}</button><button id="proofClear">${tr("Clear cuts", "Kosongkan potongan")}</button><button id="proofHint">${tr("Hint", "Petunjuk")}</button><button id="proofAuto">${tr("Auto-complete (teacher)", "Lengkapkan (guru)")}</button></div><div class="proof-shell"><div class="proof-board"><canvas id="proofCanvas" tabindex="0" aria-label="${tr("Drag polygon vertices. Tap a triangle to highlight its proof.", "Seret bucu poligon. Ketik segi tiga untuk menyerlahkan buktinya.")}"></canvas><section class="proof-results" aria-label="${tr("Proof results", "Hasil bukti")}"><h3>${tr("Proof results", "Hasil bukti")}</h3><div id="proofCards" class="proof-result-grid"></div><div id="proofSummary" class="proof-summary"></div></section></div><aside class="proof-lever-box"><span>${tr("Start", "Mula")}</span><div id="proofLever" class="proof-lever" tabindex="0" role="slider" aria-label="${tr("Visual Proof progress", "Kemajuan Bukti Visual")}" aria-valuemin="0" aria-valuemax="100" aria-orientation="vertical"><span class="proof-grip">☰</span></div><span>${tr("Pull down", "Tarik turun")}</span><button id="proofReplay" title="${tr("Replay proof", "Ulang bukti")}">↺</button></aside></div><div class="proof-footer"><div class="proof-toggles"></div><div class="proof-vertex-controls"><label>${tr("Vertex", "Bucu")} <select id="proofVertex"></select></label><div class="proof-nudge" aria-label="${tr("Move selected vertex", "Gerakkan bucu dipilih")}"></div></div></div>`,
  );
  const get = (id) => host.querySelector("#" + id),
    canvas = get("proofCanvas"),
    ctx = canvas.getContext("2d"),
    lever = get("proofLever"),
    board = host.querySelector(".proof-board"),
    cards = get("proofCards");
  get("proofBack").onclick = back;
  const colours = [
    "#df7049",
    "#3898bb",
    "#9769cc",
    "#c29722",
    "#319675",
    "#cc6097",
  ];
  const letter = (i) => String.fromCharCode(65 + i);
  const messages = {
    simple: tr(
      "Simple polygons only: move a vertex to uncross the edges.",
      "Poligon ringkas sahaja: gerakkan bucu supaya sisi tidak bersilang.",
    ),
    degenerate: tr(
      "Separate the vertices and avoid a flat corner.",
      "Pisahkan bucu dan elakkan sudut rata.",
    ),
    diagonal: tr(
      "Choose two non-neighbouring vertices with a cut inside the polygon.",
      "Pilih dua bucu bukan bersebelahan dengan potongan di dalam poligon.",
    ),
    crossing: tr(
      "Cuts must not cross. Try another pair of vertices.",
      "Potongan tidak boleh bersilang. Cuba pasangan bucu lain.",
    ),
    reset: tr(
      "This shape needs new cuts. The previous cuts have been cleared.",
      "Bentuk ini memerlukan potongan baharu. Potongan lama telah dikosongkan.",
    ),
  };
  function resetReveal() {
    relationship = formula = addition = false;
  }
  function vertices() {
    get("proofVertex").replaceChildren(
      ...model.points.map((_, i) => {
        const o = document.createElement("option");
        o.value = i;
        o.textContent = letter(i);
        return o;
      }),
    );
  }
  cards.addEventListener("scroll", () => schedule());
  function schedule() {
    if (!frame)
      frame = requestAnimationFrame(() => {
        frame = 0;
        draw();
      });
  }
  function selectTriangle(id) {
    highlight = id;
    cards
      .querySelectorAll("button")
      .forEach((b) =>
        b.setAttribute("aria-pressed", String(+b.dataset.triangle === id)),
      );
    schedule();
  }
  for (const [en, bm, initial, set] of [
    ["Angles", "Sudut", true, (v) => (labels = v)],
    ["Diagonals", "Pepenjuru", true, (v) => (diagonals = v)],
    ["Sides", "Sisi", false, (v) => (sides = v)],
  ]) {
    const label = document.createElement("label"),
      input = document.createElement("input");
    input.type = "checkbox";
    input.checked = initial;
    input.onchange = () => {
      set(input.checked);
      schedule();
    };
    label.append(input, document.createTextNode(tr(en, bm)));
    host.querySelector(".proof-toggles").append(label);
  }
  function moved(i, p) {
    model.move(i, p);
    hint = null;
    if (!model.state.complete) resetReveal();
    refresh();
  }
  for (const [symbol, dx, dy] of [
    ["←", -5, 0],
    ["↑", 0, -5],
    ["↓", 0, 5],
    ["→", 5, 0],
  ]) {
    const b = document.createElement("button");
    b.textContent = symbol;
    b.ariaLabel = tr("Move vertex ", "Gerakkan bucu ") + symbol;
    b.onclick = () => {
      const i = +get("proofVertex").value,
        p = model.points[i];
      moved(i, {
        x: Math.max(24, Math.min(416, p.x + dx)),
        y: Math.max(30, Math.min(430, p.y + dy)),
      });
    };
    host.querySelector(".proof-nudge").append(b);
  }
  function summary() {
    const panel = get("proofSummary");
    panel.replaceChildren();
    const complete = proof && model.state.complete && model.progress >= 0.999;
    const p = document.createElement("p");
    p.textContent = complete
      ? tr("What do you notice?", "Apa yang anda perhatikan?")
      : tr(
          "Pull the lever to form each triangle’s contribution.",
          "Tarik tuil untuk membentuk sumbangan setiap segi tiga.",
        );
    panel.append(p);
    const reveal = document.createElement("button");
    reveal.id = "proofReveal";
    reveal.disabled = !complete;
    reveal.textContent = tr(
      relationship ? "Hide relationship" : "Reveal relationship",
      relationship ? "Sembunyikan hubungan" : "Dedahkan hubungan",
    );
    reveal.onclick = () => {
      relationship = !relationship;
      if (!relationship) formula = addition = false;
      summary();
      schedule();
    };
    panel.append(reveal);
    if (complete && relationship) {
      const n = model.triangles.length,
        description = document.createElement("p"),
        eq = document.createElement("strong");
      description.textContent = tr(
        `${model.points.length} sides → ${n} triangles. Each triangle contributes 180°.`,
        `${model.points.length} sisi → ${n} segi tiga. Setiap segi tiga menyumbang 180°.`,
      );
      eq.textContent = `${n} × 180° = ${n * 180}°`;
      panel.append(description, eq);
      for (const [id, en, bm, flag, toggle] of [
        [
          "proofAddition",
          addition ? "Hide addition" : "View as addition",
          addition ? "Sembunyikan penambahan" : "Lihat sebagai penambahan",
          addition,
          () => (addition = !addition),
        ],
        [
          "proofFormula",
          formula ? "Hide formula" : "Show formula",
          formula ? "Sembunyikan rumus" : "Tunjuk rumus",
          formula,
          () => (formula = !formula),
        ],
      ]) {
        const b = document.createElement("button");
        b.id = id;
        b.textContent = tr(en, bm);
        b.setAttribute("aria-expanded", String(flag));
        b.onclick = () => {
          toggle();
          summary();
          schedule();
        };
        panel.append(b);
      }
      if (addition) {
        const a = document.createElement("p");
        a.textContent = Array(n).fill("180°").join(" + ") + ` = ${n * 180}°`;
        panel.append(a);
      }
      if (formula) {
        const f = document.createElement("p");
        f.textContent = tr(
          "Number of triangles = n − 2. Interior angle sum = (n − 2) × 180°.",
          "Bilangan segi tiga = n − 2. Jumlah sudut pedalaman = (n − 2) × 180°.",
        );
        const example = document.createElement("p");
        example.textContent = `${model.points.length} − 2 = ${n}; (${model.points.length} − 2) × 180° = ${n * 180}°`;
        panel.append(f, example);
      }
    }
  }
  let cardSignature = "";
  function refresh() {
    const state = model.state,
      triangles = model.triangles;
    host.querySelector(".proof-actions").hidden = !proof;
    host.querySelector(".proof-results").hidden = !proof;
    host.querySelector(".proof-lever-box").hidden = !proof;
    host.classList.toggle("proof-started", proof);
    lever.setAttribute("aria-disabled", String(!proof || !state.complete));
    lever.setAttribute(
      "aria-valuenow",
      String(Math.round(model.progress * 100)),
    );
    lever.querySelector(".proof-grip").style.top = `${model.progress * 100}%`;
    get("proofCut").setAttribute("aria-pressed", String(cutMode));
    get("proofMove").setAttribute("aria-pressed", String(!cutMode));
    get("proofUndo").disabled = get("proofClear").disabled = !model.cuts.length;
    get("proofAuto").disabled = get("proofHint").disabled =
      !!state.error || state.complete;
    get("proofGuide").textContent =
      messages[model.notice] ||
      messages[state.error] ||
      (!proof
        ? tr(
            "Drag the blue vertices to explore. Choose Visual Proof when ready.",
            "Seret bucu biru untuk meneroka. Pilih Bukti Visual apabila bersedia.",
          )
        : state.complete
          ? tr(
              "Your cuts are complete. Pull the lever, then explore the numbered results.",
              "Potongan lengkap. Tarik tuil, kemudian terokai hasil bernombor.",
            )
          : tr(
              `Tap two vertices for each cut (${model.cuts.length}/${model.points.length - 3}). Drag a vertex to edit.`,
              `Ketik dua bucu bagi setiap potongan (${model.cuts.length}/${model.points.length - 3}). Seret bucu untuk sunting.`,
            ));
    const signature = triangles.map((t) => t.id).join(",");
    if (signature !== cardSignature) {
      cardSignature = signature;
      cards.replaceChildren(
        ...triangles.map((t) => {
          const b = document.createElement("button");
          b.className = "proof-result";
          b.dataset.triangle = t.id;
          b.setAttribute("aria-label", tr("Triangle ", "Segi tiga ") + t.id);
          b.innerHTML = `<span class="triangle-number">${t.id}</span><span class="proof-contribution">180°</span>`;
          b.onpointerenter = () => selectTriangle(t.id);
          b.onpointerleave = () => selectTriangle(null);
          b.onfocus = () => selectTriangle(t.id);
          b.onblur = () => selectTriangle(null);
          b.onclick = () => selectTriangle(t.id);
          return b;
        }),
      );
    }
    const formed = proof && state.complete && model.progress >= 0.65;
    cards.style.opacity = formed
      ? String(Math.min(1, (model.progress - 0.65) / 0.25))
      : 0;
    cards.inert = !formed;
    cards.setAttribute("aria-hidden", String(!formed));
    cards
      .querySelectorAll(".proof-contribution")
      .forEach(
        (n) =>
          (n.style.visibility = model.progress >= 0.999 ? "visible" : "hidden"),
      );
    if (model.progress < 0.999) resetReveal();
    summary();
    schedule();
  }
  function draw() {
    const w = board.clientWidth,
      h = board.clientHeight;
    if (!w || !h) return;
    if (proof && cards.clientWidth && cards.clientHeight) {
      const grid = proofResultGrid(
        model.triangles.length,
        cards.clientWidth,
        cards.clientHeight,
      );
      cards.style.gridTemplateColumns = `repeat(${grid.columns}, minmax(0, 1fr))`;
      cards.style.gridAutoRows = `${grid.rowHeight}px`;
    }
    const dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const base = canvas.getBoundingClientRect(),
      results = host.querySelector(".proof-results"),
      rr = results.getBoundingClientRect(),
      mobile = rr.top - base.top > h * 0.3;
    const main = {
      x: 0,
      y: 0,
      w: proof && !mobile ? rr.left - base.left - 14 : w,
      h: proof && mobile ? rr.top - base.top - 12 : h,
    };
    const z = Math.min(main.w / 440, main.h / 470);
    view = {
      x: main.x + (main.w - 440 * z) / 2,
      y: main.y + (main.h - 460 * z) / 2,
      zoom: z,
    };
    const ps = model.points.map((p) => worldToScreen(p, view)),
      state = model.state,
      triangles = model.triangles,
      dark = document.body.classList.contains("dark"),
      ink = dark ? "#f2f4f8" : "#243047",
      background = dark ? "#1a1b1e" : "#fff";
    ctx.strokeStyle = ink;
    ctx.lineWidth = 1.5;
    ctx.font = "13px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const path = (points) => {
      ctx.beginPath();
      points.forEach((p, i) =>
        i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y),
      );
      ctx.closePath();
    };
    path(ps);
    ctx.fillStyle = dark ? "#90a9d012" : "#739bcc0c";
    ctx.fill();
    ctx.stroke();
    const segments = ps.map((p, i) => [p, ps[(i + 1) % ps.length]]),
      arcs = [],
      requests = [],
      centres = [];
    for (const t of triangles) {
      const tp = t.face.map((i) => ps[i]),
        weights = tp.map((_, i) =>
          Math.hypot(
            tp[(i + 1) % 3].x - tp[(i + 2) % 3].x,
            tp[(i + 1) % 3].y - tp[(i + 2) % 3].y,
          ),
        ),
        sum = weights.reduce((a, b) => a + b, 0),
        c = tp.reduce(
          (c, p, i) => ({
            x: c.x + (p.x * weights[i]) / sum,
            y: c.y + (p.y * weights[i]) / sum,
          }),
          { x: 0, y: 0 },
        );
      centres.push(c);
      if (proof) {
        path(tp);
        ctx.fillStyle =
          t.id === highlight
            ? "#659adc35"
            : t.id % 2
              ? "#6488b30b"
              : "#8b83a00d";
        ctx.fill();
        if (t.id === highlight) {
          ctx.strokeStyle = "#6488d4";
          ctx.lineWidth = 3;
          ctx.stroke();
          ctx.lineWidth = 1.5;
          ctx.strokeStyle = ink;
        }
      }
    }
    for (const [a, b] of model.cuts) {
      segments.push([ps[a], ps[b]]);
      if (diagonals) {
        ctx.beginPath();
        ctx.moveTo(ps[a].x, ps[a].y);
        ctx.lineTo(ps[b].x, ps[b].y);
        ctx.stroke();
      }
    }
    if (hint) {
      ctx.save();
      ctx.strokeStyle = "#c39227";
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      ctx.moveTo(ps[hint[0]].x, ps[hint[0]].y);
      ctx.lineTo(ps[hint[1]].x, ps[hint[1]].y);
      ctx.stroke();
      ctx.restore();
    }
    const moving = proof && state.complete && model.progress > 0,
      sourceRadius = Math.min(22, z * 25),
      sourceFont = mobile ? 12 : 13,
      sectors = state.faces.flatMap((face) => {
        const angles = faceAngles(ps, face),
          values = displayValues(
            angles.map((a) => ({ currentValue: a.degrees })),
            (face.length - 2) * 180,
          );
        return angles.map((a, i) => ({ ...a, text: values[i] + "°" }));
      });
    // Draw each current face's corner, not the unsplit polygon corner.
    for (const a of sectors) {
      arcs.push({ ...a, radius: sourceRadius });
      // Keep the source sector as a reference; the proof animates a copy.
      ctx.strokeStyle = "#000";
      angleMark(ctx, {
        ...a,
        radius: sourceRadius,
        fill: colours[a.vertex % 6] + "55",
        rightAngleDisplay: "marker-and-value",
      });
      if (labels)
        requests.push({
          id: a.id,
          angleId: a.id,
          text: a.text,
          candidates: polarCandidates(
            a.p,
            a.start + a.sweep / 2,
            sourceRadius + 16,
            { spread: Math.min(0.22, a.sweep / 6), rings: 6 },
          ),
        });
    }
    if (!state.error)
      ps.forEach((p, i) => {
        const a = interior(ps, i),
          outside = a.start + a.sweep / 2 + Math.PI;
        requests.unshift({
          id: "vertex" + i,
          text: letter(i),
          candidates: polarCandidates(p, outside, 22, { spread: 0.6, step: 8 }),
        });
      });
    if (sides)
      ps.forEach((p, i) =>
        requests.push({
          id: "side" + i,
          text: letter(i) + letter((i + 1) % ps.length),
          candidates: edgeCandidates(p, ps[(i + 1) % ps.length]),
        }),
      );
    ctx.font = `${sourceFont}px sans-serif`;
    labelLayout.begin({
      bounds: { x: 8, y: 8, w: main.w - 16, h: main.h - 16 },
      segments,
      points: [...ps, ...(proof ? centres : [])],
      arcs,
    });
    const stationaryLabels = [],
      sourceLabels = new Map();
    for (const request of requests) {
      const label = labelLayout.place({
        ...request,
        width: ctx.measureText(request.text).width,
        height: sourceFont + 1,
      });
      if (request.angleId) sourceLabels.set(request.angleId, label);
      stationaryLabels.push(label);
    }
    labelLayout.end();
    if (moving)
      triangles.forEach((t) => {
        const button = cards.querySelector(`[data-triangle="${t.id}"]`);
        if (!button) return;
        const r = button.getBoundingClientRect(),
          geometry = proofResultGeometry({
            x: r.left - base.left,
            y: r.top - base.top,
            w: r.width,
            h: r.height,
          }),
          { target, radius, fontSize, bounds } = geometry,
          progress = model.progress,
          gridRect = cards.getBoundingClientRect();
        button.style.setProperty("--proof-value-size", `${fontSize + 2}px`);
        if (
          progress >= 0.999 &&
          (r.bottom < gridRect.top || r.top > gridRect.bottom)
        )
          return;
        const endPieces = anglePieces(ps, t.face, 1, target),
          endLabels = new Map(),
          resultLabels = new LabelLayout();
        ctx.font = `${fontSize}px sans-serif`;
        resultLabels.begin({
          bounds,
          arcs: endPieces.map((a) => ({ ...a, radius })),
          points: [target],
        });
        if (labels)
          for (const a of endPieces) {
            const text = sourceLabels.get(a.id).text;
            endLabels.set(
              a.id,
              resultLabels.place({
                id: a.id,
                text,
                width: ctx.measureText(text).width,
                height: fontSize + 1,
                candidates: polarCandidates(
                  a.p,
                  a.start + a.sweep / 2,
                  radius + fontSize,
                  { spread: Math.min(0.12, a.sweep / 6), rings: 4, step: 8 },
                ),
              }),
            );
          }
        ctx.save();
        if (progress >= 0.999) {
          ctx.beginPath();
          ctx.rect(
            gridRect.left - base.left,
            gridRect.top - base.top,
            gridRect.width,
            gridRect.height,
          );
          ctx.clip();
        }
        const pieces = anglePieces(ps, t.face, progress, target);
        for (const a of pieces) {
          ctx.strokeStyle = "#000";
          ctx.lineWidth = 1.2;
          angleMark(ctx, {
            ...a,
            radius: sourceRadius + (radius - sourceRadius) * a.travel,
            fill: colours[a.vertex % 6] + "55",
            rightAngleDisplay: "marker-and-value",
          });
        }
        if (progress >= 0.999) {
          ctx.strokeStyle = ink;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(target.x - radius - 8, target.y);
          ctx.lineTo(target.x + radius + 8, target.y);
          ctx.stroke();
        }
        if (labels)
          for (const a of pieces) {
            const label = carryAngleLabel(
              a,
              sourceLabels.get(a.id),
              endLabels.get(a.id),
            );
            ctx.font = `${sourceFont + (fontSize - sourceFont) * a.travel}px sans-serif`;
            paintLabel(ctx, label, { ink, background });
          }
        ctx.restore();
      });
    if (proof)
      triangles.forEach((t, j) => {
        const c = centres[j];
        ctx.fillStyle = background;
        ctx.strokeStyle = t.id === highlight ? "#4d83ca" : "#8b94a4";
        ctx.lineWidth = t.id === highlight ? 2 : 1;
        ctx.beginPath();
        ctx.arc(c.x, c.y, mobile ? 8 : 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = ink;
        ctx.font = `${mobile ? 10 : 12}px sans-serif`;
        ctx.fillText(String(t.id), c.x, c.y);
      });
    ps.forEach((p, i) => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, chosen === i ? 8 : 6, 0, Math.PI * 2);
      ctx.fillStyle = chosen === i ? "#edaa31" : "#4c91ff";
      ctx.fill();
      ctx.strokeStyle = ink;
      ctx.lineWidth = 1;
      ctx.stroke();
    });
    ctx.font = `${sourceFont}px sans-serif`;
    for (const label of stationaryLabels)
      paintLabel(ctx, label, { ink, background });
  }
  const pos = (e) => {
    const r = canvas.getBoundingClientRect();
    return screenToWorld({ x: e.clientX - r.left, y: e.clientY - r.top }, view);
  };
  const owner = installCanvasOwnership(canvas, () => (drag = null)),
    hitTriangle = (p) =>
      model.triangles.find((t) =>
        inside(
          p,
          t.face.map((i) => model.points[i]),
        ),
      )?.id ?? null;
  canvas.onpointerdown = (e) => {
    if (e.button !== 0 || !owner.allowed() || drag) return;
    const p = pos(e),
      i = model.points.findIndex(
        (q) => Math.hypot(q.x - p.x, q.y - p.y) < 18 / view.zoom,
      );
    if (i < 0) {
      selectTriangle(hitTriangle(p));
      return;
    }
    e.preventDefault();
    canvas.setPointerCapture(e.pointerId);
    get("proofVertex").value = i;
    drag = {
      id: e.pointerId,
      index: i,
      start: p,
      cut: proof && cutMode,
      moved: false,
    };
  };
  canvas.onpointermove = (e) => {
    const p = pos(e);
    if (!drag) {
      if (e.pointerType === "mouse") selectTriangle(hitTriangle(p));
      return;
    }
    if (drag.id !== e.pointerId) return;
    if (
      !drag.moved &&
      Math.hypot(p.x - drag.start.x, p.y - drag.start.y) * view.zoom < 5
    )
      return;
    drag.moved = true;
    moved(drag.index, {
      x: Math.max(24, Math.min(416, p.x)),
      y: Math.max(30, Math.min(430, p.y)),
    });
  };
  canvas.onpointerleave = () => {
    if (!drag) selectTriangle(null);
  };
  const end = (e) => {
    if (drag?.id !== e.pointerId) return;
    if (e.type === "pointerup" && drag.cut && !drag.moved) {
      if (chosen === null) chosen = drag.index;
      else {
        if (model.add(chosen, drag.index)) resetReveal();
        chosen = null;
        hint = null;
      }
      refresh();
    }
    drag = null;
  };
  canvas.onpointerup = end;
  canvas.onpointercancel = end;
  canvas.onlostpointercapture = end;
  let leverPointer = null;
  const scrub = (e) => {
    const r = lever.getBoundingClientRect();
    model.scrub((e.clientY - r.top) / r.height);
    refresh();
  };
  lever.onpointerdown = (e) => {
    if (!proof || !model.state.complete) return;
    e.preventDefault();
    leverPointer = e.pointerId;
    lever.setPointerCapture(e.pointerId);
    scrub(e);
  };
  lever.onpointermove = (e) => {
    if (e.pointerId === leverPointer) scrub(e);
  };
  lever.onpointerup =
    lever.onpointercancel =
    lever.onlostpointercapture =
      () => (leverPointer = null);
  lever.onkeydown = (e) => {
    const d = { ArrowDown: 0.05, ArrowUp: -0.05, PageDown: 0.2, PageUp: -0.2 }[
      e.key
    ];
    if (d !== undefined || ["Home", "End"].includes(e.key)) {
      e.preventDefault();
      model.scrub(
        e.key === "Home" ? 0 : e.key === "End" ? 1 : model.progress + d,
      );
      refresh();
    }
  };
  function regenerate(n) {
    model.reset(n);
    proof = false;
    cutMode = false;
    chosen = hint = highlight = null;
    resetReveal();
    vertices();
    refresh();
  }
  get("proofSides").onchange = () => {
    const n = Number(get("proofSides").value);
    if (Number.isInteger(n) && n >= 3 && n <= 20) regenerate(n);
  };
  get("proofReset").onclick = () => regenerate(model.points.length);
  get("proofStart").onclick = () => {
    proof = true;
    cutMode = !model.state.complete;
    refresh();
  };
  get("proofCut").onclick = () => {
    cutMode = true;
    chosen = null;
    refresh();
  };
  get("proofMove").onclick = () => {
    cutMode = false;
    chosen = null;
    refresh();
  };
  get("proofUndo").onclick = () => {
    model.cuts.pop();
    model.progress = 0;
    chosen = hint = null;
    resetReveal();
    refresh();
  };
  get("proofClear").onclick = () => {
    model.cuts = [];
    model.progress = 0;
    chosen = hint = null;
    resetReveal();
    refresh();
  };
  get("proofHint").onclick = () => {
    hint = nextDiagonal(model.points, model.cuts);
    schedule();
  };
  get("proofAuto").onclick = () => {
    while (!model.state.complete) {
      const cut = nextDiagonal(model.points, model.cuts);
      if (!cut) break;
      model.add(...cut);
      model.triangles;
    }
    cutMode = false;
    chosen = hint = null;
    refresh();
  };
  get("proofReplay").onclick = () => {
    model.scrub(0);
    resetReveal();
    refresh();
  };
  vertices();
  const observer = new ResizeObserver(schedule);
  observer.observe(board);
  observer.observe(cards);
  observer.observe(get("proofSummary"));
  refresh();
  return () => {
    cancelAnimationFrame(frame);
    observer.disconnect();
    owner.dispose();
    host.classList.remove("proof-mode", "proof-started");
  };
}
