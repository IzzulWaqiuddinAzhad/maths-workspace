import {
  generateProblem,
  FAMILIES,
  TIER_LABELS,
  equationProblem,
  relationDescription,
} from "./generator.js";
import {
  rat,
  mul,
  div,
  display,
  num,
  add,
  eq,
  verifyAnswer,
  equivalentRelations,
  validateProblem,
} from "./domain.js";
import { planScene, planTimeline, timelineAt, SCALE_LABELS } from "./scene.js";
import { createSceneRenderer, escape } from "./renderer.js";
import {
  openStudio,
  validStudio,
  addBar,
  partitionBar,
  addBrace,
  transferSegment,
} from "./store.js";
import { EXPLORATIONS, exploreProblem } from "./explore.js";
import { screenToWorld, zoomAt } from "../core.js?v=14";
import { installCanvasOwnership } from "../interaction.js?v=20";
import { mountBarCreate } from "./worksheet.js";
import { exampleProblem } from "./examples.js";
import { pointerToViewport } from "./coordinates.js";
export function mountBarStudio(host, { language = () => "en", back }) {
  const lang = () => language(),
    tr = (a, b) => (lang() === "bm" ? b : a);
  const session = openStudio(lang()),
    store = session.store;
  let tab = "build",
    entry = store.document.studio.entry || "question",
    role = "teacher",
    progress = 0,
    playing = false,
    speed = 1,
    viewMode = "split",
    representation = "bar",
    showLabels = true,
    showNarration = true,
    showInvariant = true,
    highlight = null,
    selected = null,
    tool = "draw",
    lastTool = "draw",
    temporary = false,
    snap = true,
    attempted = false,
    hintLevel = 0,
    feedback = "",
    expression = "",
    view = { x: 0, y: 0, zoom: 1 },
    drag = null,
    liveScene = null,
    frame = 0,
    lastTime = 0,
    renderCanvas = null,
    owner = null,
    disposeCreate = null,
    disposed = false,
    exploreKind = "total",
    exploreValue = 10,
    explored = null;
  host.classList.add("bar-studio-host");
  const root = document.createElement("div");
  root.className = "bar-studio";
  host.append(root);
  const state = () => store.document.studio,
    p = () => explored?.problem || state().problem;
  let plan = planTimeline(p());
  const get = (s) => root.querySelector(s),
    all = (s) => [...root.querySelectorAll(s)];
  const button = (id, en, bm) =>
      `<button data-action="${id}">${tr(en, bm)}</button>`,
    option = (value, label, current) =>
      `<option value="${escape(value)}" ${current === value ? "selected" : ""}>${escape(label)}</option>`;
  function resetProblem(problem) {
    store.transact((d) => {
      d.studio.problem = problem;
      d.studio.entry = "question";
      d.studio.relations = [];
      d.studio.scene = {
        width: 800,
        height: 400,
        segments: [],
        braces: [],
        labels: [],
        annotations: [],
        scaleMode: "symbolic",
      };
    });
    explored = null;
    plan = planTimeline(problem);
    progress = 0;
    playing = false;
    attempted = false;
    feedback = "";
    hintLevel = 0;
    selected = null;
    view = { x: 0, y: 0, zoom: 1 };
  }
  const act = (id, fn) => {
    const e = get(`[data-action="${id}"]`);
    if (e)
      e.onclick = () => {
        try {
          fn();
        } catch (error) {
          feedback = error.message;
          status();
        }
      };
  };
  function status() {
    if (get("[data-feedback]")) get("[data-feedback]").textContent = feedback;
  }
  function transact(fn) {
    store.transact((d) => fn(d.studio));
    draw();
    properties();
    historyButtons();
  }
  function historyButtons() {
    if (get('[data-action="undo"]'))
      get('[data-action="undo"]').disabled = !store.past.length;
    if (get('[data-action="redo"]'))
      get('[data-action="redo"]').disabled = !store.future.length;
  }
  function baseScene() {
    if (liveScene && tab === "build") return liveScene;
    if (tab === "solve")
      return timelineAt(
        plan,
        matchMedia("(prefers-reduced-motion: reduce)").matches
          ? Math.floor(progress)
          : progress,
      );
    if (tab === "explore") return planScene(p(), true);
    if (entry === "free" || state().scene.segments.length) return state().scene;
    if (role === "student" && p().tier >= 3) return state().scene;
    return plan.initial;
  }
  function draw() {
    if (!renderCanvas) return;
    const scene = structuredClone(baseScene());
    scene.annotations = [
      ...(scene.annotations || []),
      ...(tab === "solve"
        ? (liveScene || state().scene).annotations || []
        : []),
    ];
    if (
      entry === "question" &&
      role === "student" &&
      p().tier === 2 &&
      tab === "build"
    )
      scene.braces = scene.braces.map((b) => ({ ...b, text: "?" }));
    renderCanvas(scene, { view, labels: showLabels, highlight, selected });
    const badge = get("[data-scale]");
    if (badge)
      badge.textContent =
        SCALE_LABELS[scene.scaleMode]?.[lang() === "bm" ? 1 : 0] ||
        scene.scaleMode;
    const idx = Math.min(
        plan.steps.length - 1,
        Math.max(0, Math.ceil(progress) - 1),
      ),
      step = plan.steps[idx];
    drawRepresentation();
    if (get("[data-equation]")) {
      get("[data-equation]").replaceChildren();
      const equations =
        role === "student" && !attempted
          ? []
          : entry === "free"
            ? [
                state()
                  .scene.segments.map((s) => s.label || "?")
                  .join(" + "),
              ]
            : progress > 0
              ? [step.equationAfter]
              : p().relations.map((r) => relationDescription(r, p()));
      for (const line of equations) {
        const b = document.createElement("button");
        b.className = "bar-equation-token";
        b.textContent = line;
        b.onclick = () => {
          highlight = highlight ? "" : p().targetQuantityIds[0];
          draw();
        };
        get("[data-equation]").append(b);
      }
    }
    if (get("[data-narration]"))
      get("[data-narration]").textContent =
        progress > 0
          ? step.narration
          : tr(
              "Identify the quantities and relationships before calculating.",
              "Kenal pasti kuantiti dan hubungan sebelum mengira.",
            );
    if (get("[data-invariant]"))
      get("[data-invariant]").textContent =
        explored?.invariant ||
        tr("Preserve: ", "Kekalkan: ") +
          ({
            total: tr("combined total", "jumlah bersama"),
            whole: tr("the whole", "keseluruhan"),
            unitSize: tr("equal unit size", "saiz unit sama"),
            difference: tr("the difference", "beza"),
            ratio: tr("the ratio", "nisbah"),
            equality: tr("equality", "kesamaan"),
          }[step.invariant] || step.invariant);
    if (get("[data-scrub]")) {
      get("[data-scrub]").value = progress;
      get("[data-step]").textContent =
        `${Math.floor(progress)} / ${plan.steps.length}`;
      get('[data-action="previous"]').disabled = progress <= 0;
      get('[data-action="next"]').disabled =
        progress >= plan.steps.length || (role === "student" && !attempted);
      get('[data-action="play"]').disabled = role === "student" && !attempted;
      get('[data-action="play"]').textContent = playing
        ? tr("Pause", "Jeda")
        : tr("Play", "Main");
    }
  }
  function properties() {
    const panel = get("[data-properties]");
    if (!panel) return;
    const s = state().scene.segments.find((s) => s.id === selected);
    panel.innerHTML = s
      ? `<h4>${tr("Selected bar", "Bar dipilih")}</h4><label>${tr("Label", "Label")}<input data-label maxlength="50" value="${escape(s.label)}"></label><label>${tr("Value", "Nilai")}<input data-value type="number" min="0" max="10000" step="any" value="${s.value ? num(s.value) : ""}"></label><label><input data-lock type="checkbox" ${s.locked ? "checked" : ""}>${tr("Freeze", "Kunci")}</label><label>${tr("Equal parts", "Bahagian sama")}<input data-parts type="number" data-math-mode="integer" min="2" max="60" value="2"></label>${button("partition", "Divide equally", "Bahagi sama rata")}${button("clone", "Clone unit", "Salin unit")}${button("brace", "Add brace", "Tambah kurungan")}${button("wholeBrace", "Total brace", "Kurungan jumlah")}${button("delete", "Delete bar", "Padam bar")}<label>${tr("Transfer to", "Pindah kepada")}<select data-transfer-target>${state()
          .scene.segments.filter((q) => q.id !== s.id)
          .map((q) => option(q.id, q.label || q.quantityId, ""))
          .join(
            "",
          )}</select></label><label>${tr("Amount", "Jumlah")}<input data-transfer-amount type="number" min="1" max="10000" value="1"></label>${button("transfer", "Transfer segment", "Pindahkan segmen")}`
      : `<p>${tr("Draw or select a bar to edit its label, value and equal parts.", "Lukis atau pilih bar untuk menyunting label, nilai dan bahagiannya.")}</p>`;
    if (!s) return;
    panel.insertAdjacentHTML(
      "beforeend",
      `<label>${tr("Colour", "Warna")}<select data-bar-colour>${[
        ["#d9e9fd", "Blue", "Biru"],
        ["#fee4ba", "Orange", "Jingga"],
        ["#dfeeda", "Green", "Hijau"],
        ["#ebdff7", "Purple", "Ungu"],
        ["#f8dce4", "Pink", "Merah jambu"],
      ]
        .map((c) => option(c[0], tr(c[1], c[2]), s.fill))
        .join(
          "",
        )}</select></label>${button("unknown", "Mark unknown", "Tandakan tidak diketahui")}`,
    );
    get("[data-bar-colour]").onchange = (e) =>
      transact(
        (st) =>
          (st.scene.segments.find((q) => q.id === s.id).fill = e.target.value),
      );
    act("unknown", () =>
      transact((st) => {
        const bar = st.scene.segments.find((q) => q.id === s.id);
        bar.value = null;
        bar.label = "?";
        st.scene.scaleMode = "symbolic";
      }),
    );
    get("[data-label]").onchange = (e) =>
      transact(
        (st) =>
          (st.scene.segments.find((q) => q.id === s.id).label = e.target.value),
      );
    get("[data-value]").onchange = (e) => {
      try {
        const value = rat(e.target.value);
        if (num(value) < 0) throw Error("Use a non-negative value");
        transact((st) => {
          const q = st.scene.segments.find((q) => q.id === s.id);
          q.value = value;
          q.label = display(value);
        });
      } catch (e) {
        feedback = e.message;
        status();
      }
    };
    get("[data-lock]").onchange = (e) =>
      transact(
        (st) =>
          (st.scene.segments.find((q) => q.id === s.id).locked =
            e.target.checked),
      );
    act("partition", () =>
      transact((st) =>
        partitionBar(st.scene, s.id, +get("[data-parts]").value),
      ),
    );
    act("clone", () =>
      transact((st) => {
        const copy = {
          ...s,
          id: crypto.randomUUID(),
          x: s.x + s.w,
          value: s.value,
        };
        if (st.scene.segments.length >= 100)
          throw Error(
            tr(
              "Keep a model within 100 segments.",
              "Hadkan model kepada 100 segmen.",
            ),
          );
        st.scene.segments.push(copy);
      }),
    );
    act("brace", () => transact((st) => addBrace(st.scene, [s.id], s.label)));
    act("wholeBrace", () =>
      transact((st) =>
        addBrace(
          st.scene,
          st.scene.segments
            .filter((q) => Math.abs(q.y - s.y) < 5)
            .map((q) => q.id),
          tr("Whole", "Keseluruhan"),
        ),
      ),
    );
    act("delete", () => {
      transact((st) => {
        st.scene.segments = st.scene.segments.filter((q) => q.id !== s.id);
        st.scene.braces = st.scene.braces.filter(
          (b) => !b.segmentIds?.includes(s.id),
        );
      });
      selected = null;
      properties();
    });
    act("transfer", () =>
      transact((st) =>
        transferSegment(
          st.scene,
          s.id,
          get("[data-transfer-target]").value,
          get("[data-transfer-amount]").value,
        ),
      ),
    );
  }
  function relationEditor() {
    const types = [
      ["compose", "Part–whole", "Bahagian–keseluruhan"],
      ["compare", "Comparison", "Perbandingan"],
      ["change", "Change", "Perubahan"],
      ["repeat", "Equal groups", "Kumpulan sama"],
      ["scale", "Scale / fraction", "Skala / pecahan"],
      ["ratio", "Ratio", "Nisbah"],
      ["equal", "Equality", "Kesamaan"],
      ["transfer", "Transfer", "Pemindahan"],
    ];
    return `<details class="bar-relations"><summary>${tr("Construct the relationship", "Bina hubungan")}</summary><label>${tr("Relationship", "Hubungan")}<select data-relation-type>${types.map((t) => option(t[0], tr(t[1], t[2]), "compose")).join("")}</select></label><div data-relation-fields></div>${button("addRelation", "Add relationship", "Tambah hubungan")}${button("checkModel", "Check my model", "Semak model saya")}<p data-relations-list></p></details>`;
  }
  function relationFields() {
    const type = get("[data-relation-type]").value,
      labels = {
        compose: ["Whole", "Part 1", "Part 2", "Part 3 (optional)"],
        compare: ["Larger", "Smaller", "Difference"],
        change: ["After", "Before", "Change"],
        repeat: ["Total", "Unit"],
        scale: ["Target", "Source"],
        ratio: ["Quantity A", "Quantity B"],
        equal: ["Left quantity", "Right quantity"],
        transfer: [
          "Source before",
          "Target before",
          "Amount",
          "Source after",
          "Target after",
        ],
      }[type];
    get("[data-relation-fields]").innerHTML =
      labels
        .map(
          (l, i) =>
            `<label>${escape(tr(l, { Whole: "Keseluruhan", "Part 1": "Bahagian 1", "Part 2": "Bahagian 2", "Part 3 (optional)": "Bahagian 3 (pilihan)", Larger: "Lebih besar", Smaller: "Lebih kecil", Difference: "Beza", After: "Selepas", Before: "Sebelum", Change: "Perubahan", Total: "Jumlah", Unit: "Unit", Target: "Sasaran", Source: "Sumber", "Quantity A": "Kuantiti A", "Quantity B": "Kuantiti B", "Left quantity": "Kuantiti kiri", "Right quantity": "Kuantiti kanan", "Source before": "Sumber sebelum", "Target before": "Sasaran sebelum", Amount: "Jumlah", "Source after": "Sumber selepas", "Target after": "Sasaran selepas" }[l] || l))}<select data-rq="${i}">${i === 3 && type === "compose" ? option("", "—", "") : ""}${p()
              .quantities.map((q) =>
                option(
                  q.id,
                  q.label,
                  type === "compose" && i === 3
                    ? ""
                    : p().quantities[i % p().quantities.length].id,
                ),
              )
              .join("")}</select></label>`,
        )
        .join("") +
      (["repeat", "scale", "ratio"].includes(type)
        ? `<label>${tr("Count / numerator", "Bilangan / pengangka")}<input data-factor type="number" data-math-mode="integer" min="1" max="60" value="3"></label>`
        : "") +
      (["scale", "ratio"].includes(type)
        ? `<label>${tr("Denominator / second count", "Penyebut / bilangan kedua")}<input data-denominator type="number" data-math-mode="integer" min="1" max="60" value="5"></label>`
        : "") +
      (type === "change"
        ? `<select data-direction><option value="increase">+</option><option value="decrease">−</option></select>`
        : "");
    get("[data-relations-list]").textContent = state()
      .relations.map((r) => relationDescription(r, p()))
      .join("\n");
  }
  function addRelation() {
    const type = get("[data-relation-type]").value,
      ids = all("[data-rq]").map((e) => e.value),
      a = +get("[data-factor]")?.value || 1,
      b = +get("[data-denominator]")?.value || 1;
    let r;
    if (type === "compose")
      r = { type, wholeId: ids[0], partIds: ids.slice(1).filter(Boolean) };
    if (type === "compare")
      r = { type, largerId: ids[0], smallerId: ids[1], differenceId: ids[2] };
    if (type === "change")
      r = {
        type,
        afterId: ids[0],
        beforeId: ids[1],
        changeId: ids[2],
        direction: get("[data-direction]").value,
      };
    if (type === "repeat")
      r = { type, totalId: ids[0], unitId: ids[1], count: a };
    if (type === "scale")
      r = { type, targetId: ids[0], sourceId: ids[1], factor: rat(a, b) };
    if (type === "ratio")
      r = { type, quantityIds: ids.slice(0, 2), unitCounts: [a, b] };
    if (type === "equal") r = { type, leftId: ids[0], rightId: ids[1] };
    if (type === "transfer")
      r = {
        type,
        sourceBeforeId: ids[0],
        targetBeforeId: ids[1],
        amountId: ids[2],
        sourceAfterId: ids[3],
        targetAfterId: ids[4],
      };
    if (new Set(ids.filter(Boolean)).size !== ids.filter(Boolean).length)
      throw Error(
        tr(
          "Choose distinct quantities for each role.",
          "Pilih kuantiti berlainan bagi setiap peranan.",
        ),
      );
    transact((st) => {
      st.relations.push(r);
      try {
        st.scene = planScene({
          ...p(),
          relations: [r, ...st.relations.filter((q) => q !== r)],
        });
      } catch {}
    });
    relationFields();
    feedback = tr(
      "Relationship added. Check whether it represents the story.",
      "Hubungan ditambah. Semak sama ada ia mewakili cerita.",
    );
    status();
  }
  function checkModel() {
    attempted = true;
    const ok = equivalentRelations(
      p().relations,
      state().relations,
      p().quantities,
    );
    feedback = ok
      ? tr(
          "Your relationships are correct. Different layouts are accepted.",
          "Hubungan anda betul. Susun atur berlainan diterima.",
        )
      : tr(
          "Check the whole, difference, equal units and transfer direction. A correct number alone is not a complete model.",
          "Semak keseluruhan, beza, unit sama dan arah pemindahan. Nilai betul sahaja belum membentuk model lengkap.",
        );
    status();
    draw();
    return ok;
  }
  function answerPanel() {
    return `<form data-answer-form><h4>${tr("Try the answer", "Cuba jawab")}</h4>${p()
      .targetQuantityIds.map((id) => {
        const q = p().quantities.find((q) => q.id === id);
        return `<label>${escape(q.label)} ${q.unit === "sen" ? "RM" : ""}<input data-answer="${id}" type="number" step="any" min="0" max="100000">${q.unit !== "sen" && p().values[id].d !== "1" ? `<span>/</span><input data-answer-denominator="${id}" aria-label="${tr("Denominator", "Penyebut")}" type="number" data-math-mode="integer" min="1" max="100000" value="1">` : ""}${q.unit === "sen" ? "" : escape(q.unit)}</label>`;
      })
      .join(
        "",
      )}${button("submitAnswer", "Check answer", "Semak jawapan")}</form>${p().family === "algebra" ? button("myEquation", "Enter my model equation", "Masukkan persamaan model saya") : ""}${button("hint", "Hint", "Petunjuk")}${button("which", "Which model is correct?", "Model manakah betul?")}<div data-choice></div>`;
  }
  function render() {
    owner?.dispose();
    owner = null;
    disposeCreate?.();
    disposeCreate = null;
    renderCanvas = null;
    root.innerHTML = `<div class="bar-heading">${button("back", "← Library", "← Pustaka")}<div><span class="explorer-kicker">${tr("Bar model", "Model bar")}</span><h2>${tr("Bar Model Studio", "Studio Model Bar")}</h2></div><select data-role aria-label="${tr("Learning mode", "Mod pembelajaran")}">${option("teacher", tr("Teacher", "Guru"), role)}${option("student", tr("Student", "Murid"), role)}</select>${button("fullscreen", "Full screen", "Skrin penuh")}</div><nav class="bar-tabs" aria-label="${tr("Bar Model sections", "Bahagian Model Bar")}">${[
      ["build", "Build", "Bina"],
      ["solve", "Solve", "Selesaikan"],
      ["explore", "Explore", "Teroka"],
      ["create", "Create", "Cipta"],
    ]
      .map(
        (t) =>
          `<button data-tab="${t[0]}" aria-current="${tab === t[0] ? "page" : "false"}">${tr(t[1], t[2])}</button>`,
      )
      .join(
        "",
      )}</nav><div data-content></div><p data-feedback role="status" aria-live="polite"></p>`;
    act("back", back);
    act("fullscreen", () => {
      if (!document.fullscreenElement) host.requestFullscreen?.();
      else document.exitFullscreen?.();
    });
    get("[data-role]").onchange = (e) => {
      role = e.target.value;
      progress = 0;
      attempted = false;
      playing = false;
      render();
    };
    all("[data-tab]").forEach(
      (b) =>
        (b.onclick = () => {
          playing = false;
          if (b.dataset.tab === "solve" && state().entry === "free") {
            feedback = tr(
              "Enter an equation or load a question for guided solution steps. Your free model remains saved.",
              "Masukkan persamaan atau muat soalan untuk langkah penyelesaian berpandu. Model bebas anda kekal disimpan.",
            );
            status();
            return;
          }
          tab = b.dataset.tab;
          entry = tab === "build" ? state().entry || "question" : "question";
          if (tab !== "explore") explored = null;
          plan = planTimeline(p());
          progress = 0;
          render();
        }),
    );
    if (tab === "create") {
      disposeCreate = mountBarCreate(get("[data-content]"), {
        language: lang(),
        family: state().problem.family,
        back: () => {
          tab = "build";
          render();
        },
      });
      status();
      return;
    }
    const content = get("[data-content]");
    if (tab === "build")
      content.innerHTML = `<div class="bar-config"><label>${tr("Family", "Famili")}<select data-family>${FAMILIES.map((f) => option(f[0], tr(f[1], f[2]), p().family)).join("")}</select></label><label>${tr("Tier", "Tahap")}<select data-tier>${TIER_LABELS.map((t, i) => option(String(i + 1), `${i + 1} — ${tr(t[0], t[1])}`, String(p().tier))).join("")}</select></label>${button("new", "New question", "Soalan baharu")}${button("example", "Load example", "Muat contoh")}${button("context", "Change context", "Tukar konteks")}${button("free", "Build freely", "Bina bebas")}${button("equationEntry", "Enter equation", "Masukkan persamaan")}<details><summary>${tr("Save and open", "Simpan dan buka")}</summary><label>${tr("Seed", "Benih")}<input data-seed value="${escape(p().seed)}" maxlength="40"></label>${button("seed", "Generate from seed", "Jana daripada benih")}${button("save", "Save example", "Simpan contoh")}<select data-saved aria-label="${tr("Saved examples", "Contoh tersimpan")}"><option value="">—</option>${state()
        .saved.map((s, i) => option(String(i), s.title, ""))
        .join(
          "",
        )}</select>${button("open", "Open", "Buka")}${button("export", "Export JSON", "Eksport JSON")}<label class="bar-file">${tr("Import JSON", "Import JSON")}<input type="file" data-import accept="application/json"></label></details></div><div data-equation-entry hidden></div>`;
    if (tab === "build" && matchMedia("(max-width:750px)").matches) {
      const config = get(".bar-config"),
        details = document.createElement("details");
      details.className = "bar-mobile-question-settings";
      const summary = document.createElement("summary");
      summary.textContent = tr("Question settings", "Tetapan soalan");
      details.append(summary);
      config.before(details);
      details.append(config);
    }
    if (tab === "explore") {
      if (!explored) {
        const first = exploreProblem(exploreKind, exploreValue, lang());
        explored = first;
        plan = planTimeline(first.problem);
        progress = plan.steps.length;
      }
      content.innerHTML = `<div class="bar-config"><label>${tr("Activity", "Aktiviti")}<select data-exploration>${EXPLORATIONS.map((e) => option(e[0], tr(e[1], e[2]), exploreKind)).join("")}</select></label><label>${tr("Change the parameter", "Ubah parameter")}<input data-explore-value type="range" min="${explored.min}" max="${explored.max}" step="${explored.step}" value="${exploreValue}"></label><output data-parameter>${exploreValue}</output></div>`;
    }
    content.insertAdjacentHTML(
      "beforeend",
      `<article class="bar-question" data-question></article><div class="bar-view-options"><label>${tr("View", "Paparan")}<select data-view>${option("bar", tr("Bar only", "Bar sahaja"), viewMode)}${option("split", tr("Split view", "Paparan berpecah"), viewMode)}${option("equation", tr("Equation only", "Persamaan sahaja"), viewMode)}</select></label><label><input type="checkbox" data-labels ${showLabels ? "checked" : ""}>${tr("Labels", "Label")}</label><label><input type="checkbox" data-narration-toggle ${showNarration ? "checked" : ""}>${tr("Narration", "Penerangan")}</label><label><input type="checkbox" data-invariant-toggle ${showInvariant ? "checked" : ""}>${tr("Invariant", "Invarian")}</label><span class="bar-badge" data-scale></span></div><div class="bar-workarea" data-view-mode="${viewMode}"><section class="bar-stage-column"><div class="bar-canvas-actions">${button("draw", "Draw bar", "Lukis bar")}${button("select", "Select", "Pilih")}${button("pan", "Pan", "Alih")}${button("annotate", "Annotate", "Catat")}${button("zoomIn", "+", "+")}${button("zoomOut", "−", "−")}${button("resetView", "Reset view", "Tetap paparan")}${button("undo", "Undo", "Buat asal")}${button("redo", "Redo", "Buat semula")}<label><input type="checkbox" data-snap ${snap ? "checked" : ""}>${tr("Snap", "Lekat")}</label></div><svg class="bar-canvas" tabindex="0" aria-label="${tr("Interactive bar model", "Model bar interaktif")}"></svg><div class="bar-equations" data-equation></div></section>${tab === "build" ? `<aside class="bar-properties"><button class="bar-mobile-close" data-action="closeMobileTools">${tr("Close tools", "Tutup alat")}</button><details open><summary>${tr("Bar tools", "Alat bar")}</summary><div data-properties></div></details>${entry === "question" ? relationEditor() + answerPanel() : ""}${role === "teacher" ? button("teaching", "Use teaching model", "Gunakan model pengajaran") : ""}</aside>` : ""}</div><section class="bar-story-controls"><p data-narration ${showNarration ? "" : "hidden"}></p><p data-invariant ${showInvariant ? "" : "hidden"}></p></section>${tab !== "build" ? `<div class="bar-timeline">${button("previous", "Previous", "Sebelum")}${button("play", "Play", "Main")}<input data-scrub type="range" min="0" max="${plan.steps.length}" step="0.01" value="${progress}" aria-label="${tr("Solution progress", "Kemajuan penyelesaian")}"><span data-step></span>${button("next", "Next", "Seterusnya")}${button("restart", "Restart", "Mula semula")}<select data-speed aria-label="${tr("Playback speed", "Kelajuan main")}">${[0.5, 1, 1.5, 2].map((s) => option(String(s), s + "×", String(speed))).join("")}</select>${role === "student" && !attempted ? button("try", "Make an attempt in Build", "Cuba dahulu dalam Bina") : ""}</div>` : ""}`,
    );
    if (p().family === "rate") {
      get(".bar-view-options").insertAdjacentHTML(
        "beforeend",
        `<label>${tr("Representation", "Perwakilan")}<select data-representation>${option("bar", tr("Bar model", "Model bar"), representation)}${option("table", tr("Ratio table", "Jadual nisbah"), representation)}${option("numberLine", tr("Double number line", "Garis nombor berganda"), representation)}</select></label>`,
      );
      get(".bar-stage-column").insertAdjacentHTML(
        "beforeend",
        '<div class="bar-rate-view" data-rate-view hidden></div>',
      );
      get("[data-representation]").onchange = (e) => {
        representation = e.target.value;
        draw();
      };
    }
    if (tab === "build") {
      get(".bar-view-options").insertAdjacentHTML(
        "beforeend",
        `<button class="bar-mobile-tools" data-action="mobileTools">${tr("Tools and answer", "Alat dan jawapan")}</button>`,
      );
      act("mobileTools", () =>
        get(".bar-properties").classList.add("bar-sheet-open"),
      );
      act("closeMobileTools", () =>
        get(".bar-properties").classList.remove("bar-sheet-open"),
      );
    }
    prompt();
    renderCanvas = createSceneRenderer(get("svg"));
    bindCanvas();
    properties();
    historyButtons();
    act("new", () => {
      resetProblem(
        generateProblem({
          family: get("[data-family]").value,
          tier: +get("[data-tier]").value,
          language: lang(),
          seed: crypto.randomUUID().slice(0, 8),
        }),
      );
      entry = "question";
      render();
    });
    act("example", () => {
      resetProblem(exampleProblem(get("[data-family]").value, lang()));
      entry = "question";
      render();
    });
    act("seed", () => {
      resetProblem(
        generateProblem({
          family: get("[data-family]").value,
          tier: +get("[data-tier]").value,
          language: lang(),
          seed: get("[data-seed]").value || "bar",
        }),
      );
      render();
    });
    act("context", () => {
      resetProblem(
        generateProblem({
          family: p().family,
          tier: p().tier,
          language: lang(),
          seed: p().seed,
          parameters: p().parameters,
          contextSeed: crypto.randomUUID(),
        }),
      );
      render();
    });
    act("free", () => {
      entry = "free";
      selected = null;
      transact((st) => {
        st.entry = "free";
        st.scene = {
          width: 800,
          height: 400,
          segments: [],
          braces: [],
          labels: [],
          annotations: [],
          scaleMode: "symbolic",
        };
        st.relations = [];
      });
      render();
    });
    act("teaching", () => {
      transact((st) => {
        st.scene = planScene(p());
        st.relations = structuredClone(p().relations);
      });
      render();
    });
    act("equationEntry", () => equationEditor());
    act("myEquation", () => equationEditor(true));
    act("save", () => {
      transact((st) => {
        if (st.saved.length >= 30) throw Error("Save up to 30 examples.");
        st.saved.push({
          title:
            FAMILIES.find((f) => f[0] === p().family)?.[
              lang() === "bm" ? 2 : 1
            ] +
            " · " +
            p().seed,
          entry,
          problem: structuredClone(p()),
          scene: structuredClone(st.scene),
          relations: structuredClone(st.relations),
        });
      });
      feedback = tr(
        "Example saved on this device.",
        "Contoh disimpan pada peranti ini.",
      );
      render();
    });
    act("open", () => {
      if (get("[data-saved]").value === "") return;
      const item = state().saved[+get("[data-saved]").value];
      if (!item) return;
      resetProblem(item.problem);
      entry = item.entry || "question";
      transact((st) => {
        st.entry = entry;
        st.scene = structuredClone(item.scene);
        st.relations = structuredClone(item.relations);
      });
      render();
    });
    act("export", () =>
      download(
        JSON.stringify(store.document, null, 2),
        "bar-model.json",
        "application/json",
      ),
    );
    if (get("[data-import]"))
      get("[data-import]").onchange = async (e) => {
        try {
          const file = e.target.files[0];
          if (!file || file.size > 2e6)
            throw Error("Choose a Bar Model JSON under 2 MB.");
          const d = JSON.parse(await file.text());
          if (!validStudio(d))
            throw Error("This is not a valid Bar Model file.");
          validateProblem(d.studio.problem);
          store.transact((current) => (current.studio = d.studio));
          entry = state().entry || "question";
          plan = planTimeline(p());
          progress = 0;
          render();
        } catch (error) {
          feedback = error.message;
          status();
        }
      };
    for (const t of ["draw", "select", "pan", "annotate"])
      act(t, () => {
        tool = t;
        lastTool = t;
        temporary = false;
        all("[data-action]").forEach((b) =>
          b.classList.toggle("active", b.dataset.action === tool),
        );
      });
    act("undo", () => {
      store.undo();
      entry = state().entry || "question";
      selected = null;
      plan = planTimeline(p());
      progress = 0;
      render();
    });
    act("redo", () => {
      store.redo();
      entry = state().entry || "question";
      selected = null;
      plan = planTimeline(p());
      progress = 0;
      render();
    });
    act("zoomIn", () => {
      view = zoomAt(view, { x: 400, y: 200 }, 1.2);
      draw();
    });
    act("zoomOut", () => {
      view = zoomAt(view, { x: 400, y: 200 }, 1 / 1.2);
      draw();
    });
    act("resetView", () => {
      view = { x: 0, y: 0, zoom: 1 };
      draw();
    });
    get("[data-snap]").onchange = (e) => (snap = e.target.checked);
    get("[data-view]").onchange = (e) => {
      viewMode = e.target.value;
      get(".bar-workarea").dataset.viewMode = viewMode;
    };
    get("[data-labels]").onchange = (e) => {
      showLabels = e.target.checked;
      draw();
    };
    get("[data-narration-toggle]").onchange = (e) => {
      showNarration = e.target.checked;
      get("[data-narration]").hidden = !showNarration;
    };
    get("[data-invariant-toggle]").onchange = (e) => {
      showInvariant = e.target.checked;
      get("[data-invariant]").hidden = !showInvariant;
    };
    if (get("[data-relation-type]")) {
      get("[data-relation-type]").onchange = relationFields;
      relationFields();
      act("addRelation", addRelation);
      act("checkModel", checkModel);
      get("[data-answer-form]").onsubmit = (e) => e.preventDefault();
      act("submitAnswer", () => {
        attempted = true;
        const answer = {};
        for (const field of all("[data-answer]")) {
          const q = p().quantities.find((q) => q.id === field.dataset.answer);
          answer[q.id] =
            q.unit === "sen"
              ? mul(rat(field.value), 100)
              : div(
                  rat(field.value),
                  rat(get(`[data-answer-denominator="${q.id}"]`)?.value || "1"),
                );
        }
        feedback = verifyAnswer(p(), answer)
          ? tr(
              "Correct. Explain how your model represents the relationships.",
              "Betul. Terangkan bagaimana model anda mewakili hubungan.",
            )
          : tr(
              "Check the relationship and units. Try a hint before revealing a solution.",
              "Semak hubungan dan unit. Cuba petunjuk sebelum mendedahkan penyelesaian.",
            );
        status();
        draw();
      });
      act("hint", () => {
        feedback = p().hints[Math.min(hintLevel++, p().hints.length - 1)];
        status();
      });
      act("which", () => {
        const correctLeft = Math.random() < 0.5,
          good = planScene(p()),
          bad = structuredClone(good);
        const missing = bad.segments.pop();
        if (missing)
          bad.braces = bad.braces.filter(
            (b) => b.y < missing.y || b.x + b.w < missing.x,
          );
        get("[data-choice]").innerHTML =
          `<p>${tr("Which model includes every quantity and relationship?", "Model manakah merangkumi semua kuantiti dan hubungan?")}</p>${[0, 1].map((i) => `<button class="bar-model-choice" data-choice-index="${i}" aria-label="${tr("Choose model", "Pilih model")} ${i + 1}"><svg class="bar-canvas"></svg><span>${tr("Model", "Model")} ${i + 1}</span></button>`).join("")}`;
        all("[data-choice-index]").forEach((button, i) => {
          createSceneRenderer(button.querySelector("svg"))(
            (i === 0) === correctLeft ? good : bad,
          );
          button.onclick = () => {
            attempted = true;
            feedback =
              (i === 0) === correctLeft
                ? tr(
                    "Correct. Every part is represented. Explain the missing part in the other model.",
                    "Betul. Semua bahagian diwakili. Terangkan bahagian yang hilang dalam model lain.",
                  )
                : tr(
                    "A part is missing. Match each quantity in the story to the bars.",
                    "Satu bahagian hilang. Padankan setiap kuantiti dalam cerita dengan bar.",
                  );
            status();
            draw();
          };
        });
      });
    }

    act("previous", () => {
      playing = false;
      progress = Math.max(0, Math.ceil(progress) - 1);
      draw();
    });
    act("next", () => {
      playing = false;
      progress = Math.min(plan.steps.length, Math.floor(progress) + 1);
      draw();
    });
    act("play", () => {
      playing = !playing;
      lastTime = 0;
      draw();
      if (playing) animate();
    });
    act("restart", () => {
      playing = false;
      progress = 0;
      draw();
    });
    act("try", () => {
      tab = "build";
      render();
    });
    if (get("[data-scrub]")) {
      get("[data-scrub]").disabled = role === "student" && !attempted;
      get("[data-scrub]").oninput = (e) => {
        playing = false;
        progress = +e.target.value;
        draw();
      };
      get("[data-speed]").onchange = (e) => (speed = +e.target.value);
    }
    if (tab === "explore") {
      get("[data-exploration]").onchange = (e) => {
        exploreKind = e.target.value;
        exploreValue = exploreKind === "transfer" ? 9 : 0;
        explored = null;
        render();
      };
      get("[data-explore-value]").oninput = (e) => {
        try {
          exploreValue = +e.target.value;
          explored = exploreProblem(exploreKind, exploreValue, lang());
          plan = planTimeline(p());
          progress = plan.steps.length;
          get("[data-parameter]").textContent = exploreValue;
          prompt();
          draw();
        } catch (error) {
          feedback = error.message;
          status();
        }
      };
    }
    status();
    draw();
  }
  function drawRepresentation() {
    const target = get("[data-rate-view]");
    if (!target) return;
    const active = representation !== "bar";
    get(".bar-canvas").hidden = active;
    target.hidden = !active;
    if (!active) return;
    const known = p().parameters.knownCount,
      wanted = p().parameters.wantedCount;
    const cost = (id) =>
      p().quantities.find((q) => q.id === id).known ||
      progress >= (id === "u" ? 1 : 2)
        ? display(p().values[id], "sen")
        : "?";
    if (representation === "table")
      target.innerHTML = `<table><caption>${tr("Same cost per notebook", "Harga senaskhah yang sama")}</caption><tr><th>${tr("Notebooks", "Buku nota")}</th><th>${tr("Cost", "Harga")}</th></tr>${[
        [known, "a"],
        [1, "u"],
        [wanted, "b"],
      ]
        .map(([n, id]) => `<tr><td>${n}</td><td>${cost(id)}</td></tr>`)
        .join("")}</table>`;
    else
      target.innerHTML = `<svg viewBox="0 0 800 220" role="img" aria-label="${tr("Double number line", "Garis nombor berganda")}"><text x="20" y="35">${tr("Notebooks", "Buku nota")}</text><text x="20" y="170">RM</text><path d="M 70 80 H 735 M 70 140 H 735" stroke="#34485f"/>${[
        [0, "0"],
        [known, cost("a")],
        [wanted, cost("b")],
      ]
        .map(([n, c]) => {
          const x = 70 + (n / Math.max(known, wanted)) * 650;
          return `<path d="M ${x} 70 v 20 M ${x} 130 v 20" stroke="#34485f"/><text x="${x}" y="60" text-anchor="middle">${n}</text><text x="${x}" y="175" text-anchor="middle">${escape(c)}</text>`;
        })
        .join("")}</svg>`;
  }
  function prompt() {
    const article = get("[data-question]");
    if (!article) return;
    article.replaceChildren();
    if (entry === "free") {
      article.textContent = tr(
        "Draw bars, label quantities and connect relationships. Layout changes do not change numerical values.",
        "Lukis bar, label kuantiti dan hubungkan hubungan. Perubahan susun atur tidak mengubah nilai.",
      );
      return;
    }
    for (const token of p().promptTokens) {
      if (token.quantityId) {
        const b = document.createElement("button");
        b.className = "bar-prompt-token";
        b.textContent = token.text;
        b.onclick = () => {
          highlight = highlight === token.quantityId ? null : token.quantityId;
          draw();
        };
        article.append(b);
      } else article.append(document.createTextNode(token.text));
    }
  }
  function equationEditor(checkCurrent = false) {
    const panel = get("[data-equation-entry]");
    panel.hidden = !panel.hidden;
    if (panel.hidden) return;
    panel.innerHTML = `<p>${tr("Linear equations with positive bar sections. Use the keypad or a physical keyboard.", "Persamaan linear dengan bahagian bar positif. Gunakan pad kekunci atau papan kekunci fizikal.")}</p><div data-expression tabindex="0" role="textbox" aria-label="${tr("Equation", "Persamaan")}" aria-readonly="true"></div><div class="bar-math-keys">${["7", "8", "9", "x", "(", "4", "5", "6", "+", ")", "1", "2", "3", "−", "×", "0", ".", "/", "=", "⌫", "C"].map((k) => `<button data-expression-key="${k}">${k}</button>`).join("")}</div>${button("solveExpression", "Build this equation", "Bina persamaan ini")}`;
    const enter = (key) => {
      if (key === "⌫" || key === "Backspace")
        expression = expression.slice(0, -1);
      else if (key === "C" || key === "Delete") expression = "";
      else if (/^[\dx().+*/=−×-]$/.test(key) && expression.length < 150)
        expression += key;
      get("[data-expression]").textContent = expression;
    };
    all("[data-expression-key]").forEach(
      (b) => (b.onclick = () => enter(b.dataset.expressionKey)),
    );
    get("[data-expression]").onkeydown = (e) => {
      if (e.key === "Enter") {
        get('[data-action="solveExpression"]').click();
        return;
      }
      if (
        /^[\dx().+*/=-]$/.test(e.key) ||
        ["Backspace", "Delete"].includes(e.key)
      ) {
        e.preventDefault();
        enter(e.key);
      }
    };
    act("solveExpression", () => {
      const candidate = equationProblem(expression, { language: lang() });
      if (checkCurrent) {
        transact((st) => {
          st.relations = candidate.relations;
          st.scene = planScene({
            ...p(),
            relations: candidate.relations,
            equation: expression,
          });
        });
        checkModel();
        panel.hidden = true;
        return;
      }
      resetProblem(candidate);
      entry = "question";
      tab = "solve";
      render();
    });
    enter("");
  }
  function bindCanvas() {
    const svg = get("svg"),
      pointers = new Map();
    owner = installCanvasOwnership(svg, () => {
      drag = null;
      liveScene = null;
      pointers.clear();
      draw();
    });
    const local = (e) => {
        const b = svg.getBoundingClientRect();
        return pointerToViewport(e, b);
      },
      world = (e) => screenToWorld(local(e), view);
    svg.onpointerdown = (e) => {
      if (e.button !== 0 || !owner.allowed() || pointers.size >= 2) return;
      e.preventDefault();
      svg.setPointerCapture(e.pointerId);
      pointers.set(e.pointerId, local(e));
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        drag = {
          pinch: true,
          startView: { ...view },
          mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
          distance: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)),
        };
        liveScene = null;
        return;
      }
      if (drag) return;
      const point = world(e),
        hit = e.target.closest("[data-segment]")?.dataset.segment,
        resize = e.target.dataset.resize;
      if (tab !== "build" && tool !== "annotate") {
        drag = {
          pan: true,
          id: e.pointerId,
          start: local(e),
          view: { ...view },
        };
        return;
      }
      if (tool === "pan") {
        drag = {
          pan: true,
          id: e.pointerId,
          start: local(e),
          view: { ...view },
        };
        return;
      }
      if (tool === "annotate") {
        liveScene = structuredClone(state().scene);
        liveScene.annotations.push({ points: [point] });
        drag = { ink: true, id: e.pointerId };
        return;
      }
      const own = state().scene.segments.find((s) => s.id === (hit || resize));
      if (own) {
        selected = own.id;
        properties();
        if (own.locked) {
          draw();
          return;
        }
        liveScene = structuredClone(state().scene);
        drag = {
          move: !resize,
          resize: !!resize,
          id: e.pointerId,
          segment: own.id,
          start: point,
          original: { ...own },
        };
        draw();
        return;
      }
      if (hit) {
        highlight = baseScene().segments.find((s) => s.id === hit)?.quantityId;
        draw();
        return;
      }
      if (tool === "select" && temporary) {
        tool = lastTool;
        temporary = false;
      }
      if (tool === "select") {
        selected = null;
        properties();
        draw();
        return;
      }
      if (tool === "draw") {
        liveScene = structuredClone(state().scene);
        const id = addBar(liveScene, { x: point.x, y: point.y, w: 1 });
        drag = { create: true, id: e.pointerId, segment: id, start: point };
        selected = id;
        draw();
      }
    };
    svg.onpointermove = (e) => {
      if (!pointers.has(e.pointerId) || !drag) return;
      pointers.set(e.pointerId, local(e));
      if (drag.pinch) {
        const [a, b] = [...pointers.values()];
        if (!b) return;
        const midpoint = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
          next = zoomAt(
            drag.startView,
            drag.mid,
            Math.hypot(a.x - b.x, a.y - b.y) / drag.distance,
          );
        view = {
          ...next,
          x: next.x + midpoint.x - drag.mid.x,
          y: next.y + midpoint.y - drag.mid.y,
        };
        draw();
        return;
      }
      if (drag.id !== e.pointerId) return;
      if (drag.pan) {
        const p = local(e);
        view = {
          ...drag.view,
          x: drag.view.x + p.x - drag.start.x,
          y: drag.view.y + p.y - drag.start.y,
        };
        draw();
        return;
      }
      const p = world(e);
      if (drag.ink) {
        liveScene.annotations.at(-1).points.push(p);
        draw();
        return;
      }
      const s = liveScene.segments.find((s) => s.id === drag.segment);
      if (drag.create) {
        s.x = Math.min(p.x, drag.start.x);
        s.y = drag.start.y;
        s.w = Math.max(1, Math.abs(p.x - drag.start.x));
      } else if (drag.resize) s.w = Math.max(15, p.x - s.x);
      else {
        s.x = drag.original.x + p.x - drag.start.x;
        s.y = drag.original.y + p.y - drag.start.y;
      }
      if (snap && !e.shiftKey) {
        const other = liveScene.segments.filter((q) => q.id !== s.id);
        for (const q of other) {
          if (Math.abs(s.x - q.x) < 8 / view.zoom) s.x = q.x;
          if (Math.abs(s.x - q.x - q.w) < 8 / view.zoom) s.x = q.x + q.w;
          if (Math.abs(s.y - q.y) < 8 / view.zoom) s.y = q.y;
        }
        s.y = Math.round(s.y / 5) * 5;
      }
      liveScene.scaleMode = "symbolic";
      draw();
    };
    const end = (e) => {
      if (!pointers.has(e.pointerId)) return;
      pointers.delete(e.pointerId);
      if (drag?.pinch) {
        drag = null;
        pointers.clear();
        return;
      }
      if (drag?.id !== e.pointerId) return;
      if (e.type === "pointerup" && liveScene) {
        if (
          !drag.create ||
          liveScene.segments.find((s) => s.id === drag.segment).w > 15
        ) {
          const scene = liveScene;
          store.transact((d) => (d.studio.scene = scene));
          if (drag.create) {
            lastTool = "draw";
            tool = "select";
            temporary = true;
          }
        }
      }
      drag = null;
      liveScene = null;
      properties();
      historyButtons();
      draw();
    };
    svg.onpointerup = end;
    svg.onpointercancel = end;
    svg.onlostpointercapture = end;
    svg.onwheel = (e) => {
      e.preventDefault();
      view = zoomAt(view, local(e), Math.exp(-e.deltaY * 0.001));
      draw();
    };
    svg.onkeydown = (e) => {
      if (e.key === "Enter" && e.target.dataset.segment) {
        selected = e.target.dataset.segment;
        properties();
        draw();
        e.preventDefault();
        return;
      }

      if (
        !selected ||
        !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)
      )
        return;
      e.preventDefault();
      transact((st) => {
        const s = st.scene.segments.find((s) => s.id === selected);
        if (!s || s.locked) return;
        s.x += e.key === "ArrowLeft" ? -5 : e.key === "ArrowRight" ? 5 : 0;
        s.y += e.key === "ArrowUp" ? -5 : e.key === "ArrowDown" ? 5 : 0;
      });
    };
  }
  function animate(time = 0) {
    if (disposed || !playing) return;
    if (lastTime) {
      const old = progress,
        increment = ((time - lastTime) / 950) * speed;
      progress = Math.min(plan.steps.length, progress + increment);
      if (role === "student" && Math.floor(progress) > Math.floor(old)) {
        progress = Math.ceil(old);
        playing = false;
      }
      if (progress >= plan.steps.length) playing = false;
    }
    lastTime = time;
    draw();
    if (playing) frame = requestAnimationFrame(animate);
  }
  render();
  return () => {
    disposed = true;
    playing = false;
    cancelAnimationFrame(frame);
    owner?.dispose();
    disposeCreate?.();
    session.dispose();
    root.remove();
    host.classList.remove("bar-studio-host");
  };
}
export function download(content, filename, type) {
  const url = URL.createObjectURL(new Blob([content], { type })),
    a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
