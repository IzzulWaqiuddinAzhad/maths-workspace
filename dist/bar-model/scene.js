import { num, rat, display, linear, sub, add, mul, div, eq } from "./domain.js";
import { relationDescription } from "./generator.js";
const COLOURS = ["#d9e9fd", "#fee4ba", "#dfeeda", "#ebdff7", "#f8dce4"];
export const SCALE_LABELS = {
  proportional: ["Proportional", "Berkadar"],
  equalUnit: ["Equal units", "Unit sama"],
  symbolic: ["Schematic", "Skematik"],
  compressed: ["Compressed", "Dimampatkan"],
};
const clone = (o) => structuredClone(o);
export function planScene(p, reveal = false) {
  const scene = {
      width: 800,
      height: 400,
      segments: [],
      braces: [],
      labels: [],
      annotations: [],
      scaleMode: "symbolic",
    },
    tr = (en, bm) => (p.language === "bm" ? bm : en);
  const quantity = (id) => p.quantities.find((q) => q.id === id),
    value = (id) => num(p.values[id]),
    label = (id) => {
      const q = quantity(id);
      return q?.known || reveal
        ? display(p.values[id], q.unit === "sen" ? "sen" : "")
        : "?";
    };
  const bar = (id, qid, x, y, w, text = label(qid), extra = {}) => {
    const s = {
      id,
      quantityId: qid,
      x,
      y,
      w: Math.max(0.1, w),
      h: 30,
      label: text,
      opacity: 1,
      fill: COLOURS[scene.segments.length % 5],
      ...extra,
    };
    scene.segments.push(s);
    return s;
  };
  const name = (id, text, x, y) => scene.labels.push({ id, text, x, y });
  const brace = (id, x, y, w, text, qid) =>
    scene.braces.push({ id, x, y, w, text, quantityId: qid, opacity: 1 });
  const r = p.relations[0];
  if (r.type === "compose" && p.family !== "average") {
    const ids = r.partIds,
      scale =
        490 /
        ids.reduce(
          (s, id) => s + (quantity(id).known || reveal ? value(id) : 40),
          0,
        );
    scene.scaleMode =
      ids.every((id) => quantity(id).known) || reveal
        ? "proportional"
        : "symbolic";
    let x = 125;
    ids.forEach((id, i) => {
      const w = (quantity(id).known || reveal ? value(id) : 40) * scale;
      bar("part-" + id, id, x, 120, w, label(id));
      name("name-" + id, quantity(id).label, x + w / 2, 98);
      x += w;
    });
    brace(
      "whole",
      125,
      168,
      x - 125,
      quantity(r.wholeId).label + " = " + label(r.wholeId),
      r.wholeId,
    );
  } else if (r.type === "compare") {
    const s = r.smallerId,
      l = r.largerId,
      d = r.differenceId,
      known = quantity(s).known || reveal,
      base = known ? (value(s) / (value(s) + value(d))) * 480 : 280,
      gap = known ? 480 - base : 125;
    scene.scaleMode = known ? "proportional" : "symbolic";
    name("name-a", quantity(s).label, 80, 108);
    name("name-b", quantity(l).label, 80, 228);
    bar("common-a", s, 145, 90, base, label(s), { fill: COLOURS[0] });
    bar("common-b", s, 145, 210, base, label(s), { fill: COLOURS[0] });
    bar("difference", d, 145 + base, 210, gap, label(d), { fill: COLOURS[1] });
    brace(
      "large",
      145,
      260,
      base + gap,
      quantity(l).label + " = " + label(l),
      l,
    );
    brace(
      "difference-brace",
      145 + base,
      180,
      gap,
      tr("Difference", "Beza") + " " + label(d),
      d,
    );
    const t = quantity("t");
    if (t)
      name(
        "total",
        tr("Together", "Kesemuanya") + " = " + label("t"),
        400,
        325,
      );
  } else if (r.type === "change") {
    const before = r.beforeId,
      delta = r.changeId,
      after = r.afterId,
      down = r.direction === "decrease",
      scale = 450 / Math.max(value(before), value(after));
    scene.scaleMode = quantity(before).known ? "proportional" : "symbolic";
    bar(
      "original",
      before,
      130,
      100,
      (down ? value(after) : value(before)) * scale,
      down ? tr("Remaining", "Baki") : label(before),
      { fill: COLOURS[0] },
    );
    bar(
      "change",
      delta,
      130 + (down ? value(after) : value(before)) * scale,
      100,
      value(delta) * scale,
      label(delta),
      { fill: COLOURS[1] },
    );
    brace(
      "before",
      130,
      155,
      (down ? value(before) : value(after)) * scale,
      down
        ? quantity(before).label + " = " + label(before)
        : quantity(after).label + " = " + label(after),
      down ? before : after,
    );
    name(
      "direction",
      down
        ? tr("Remove this portion", "Keluarkan bahagian ini")
        : tr("Add this portion", "Tambah bahagian ini"),
      400,
      230,
    );
  } else if (r.type === "transfer") {
    const a = r.sourceBeforeId,
      b = r.targetBeforeId,
      m = r.amountId,
      scale = 430 / Math.max(value(a), value(b) + value(m));
    scene.scaleMode = quantity(m).known ? "proportional" : "symbolic";
    const move = quantity(m).known || reveal ? value(m) * scale : 90,
      aw = value(a) * scale,
      bw = value(b) * scale;
    bar("source-remainder", a, 140, 80, aw - move, "", { fill: COLOURS[0] });
    bar("transfer-piece", m, 140 + aw - move, 80, move, label(m), {
      fill: COLOURS[1],
    });
    bar("target-original", b, 140, 230, bw, "", { fill: COLOURS[2] });
    name("source-name", quantity(a).label + " = " + label(a), 360, 55);
    name("target-name", quantity(b).label + " = " + label(b), 360, 205);
    brace(
      "total",
      140,
      315,
      Math.max(aw, bw),
      tr("Combined total stays ", "Jumlah bersama kekal ") +
        display(add(p.values[a], p.values[b])),
      null,
    );
  } else if (
    ["repeat", "partition", "scale", "ratio"].includes(r.type) &&
    p.family !== "rate"
  ) {
    let count,
      selected,
      whole,
      unitId,
      lanes = [];
    scene.scaleMode = "equalUnit";
    if (r.type === "ratio") {
      const unitValue = divValue(p.values[r.quantityIds[0]], r.unitCounts[0]);
      r.quantityIds.forEach((id, i) =>
        lanes.push({
          id,
          count: r.unitCounts[i],
          text: quantity(id).label,
          unit: reveal ? display(unitValue) : "u",
        }),
      );
    } else if (p.family === "percentage") {
      count = 20;
      selected = p.parameters.percent / 5;
      whole = "w";
      unitId = "w";
      lanes = [
        {
          id: "w",
          count,
          text: tr("Whole = 100%", "Keseluruhan = 100%"),
          unit: "",
        },
      ];
    } else if (r.type === "partition") {
      count = r.numberOfParts;
      selected = p.parameters.numerator;
      whole = r.wholeId;
      unitId = r.unitId;
      lanes = [
        {
          id: whole,
          count,
          text: quantity(whole).label,
          unit: reveal ? display(p.values[unitId]) : "u",
        },
      ];
    } else {
      count = p.parameters.groups ?? r.count ?? 1;
      whole = r.totalId ?? "t";
      unitId = r.unitId ?? "u";
      lanes = [
        {
          id: whole,
          count,
          text: quantity(whole).label,
          unit: quantity(unitId)?.known || reveal ? label(unitId) : "u",
        },
      ];
      if (p.family === "multiplicativeComparison")
        lanes.unshift({
          id: unitId,
          count: 1,
          text: quantity(unitId).label,
          unit: label(unitId),
        });
    }
    const max = Math.max(...lanes.map((l) => l.count)),
      uw = Math.min(65, 480 / max);
    for (const [i, l] of lanes.entries()) {
      const y = 90 + i * 95;
      name("lane-" + l.id, l.text, 130, y - 20);
      if (l.count > 20) {
        scene.scaleMode = "compressed";
        bar(l.id + "-compressed", l.id, 130, y, 480, `${l.unit} × ${l.count}`);
      } else
        for (let j = 0; j < l.count; j++)
          bar(l.id + "-unit-" + j, l.id, 130 + j * uw, y, uw, l.unit, {
            fill:
              selected !== undefined
                ? j < selected
                  ? COLOURS[1]
                  : COLOURS[0]
                : COLOURS[i % 5],
            unitCount: 1,
            equalUnitGroupId: "unit",
          });
      brace(
        "brace-" + l.id,
        130,
        y + 48,
        Math.min(l.count, 20) * uw,
        label(l.id),
        l.id,
      );
    }
    if (r.type === "ratio") {
      const known = quantity("t") || quantity("d");
      name("given", known.label + " = " + label(known.id), 400, 385);
    }
    if (selected !== undefined)
      name(
        "selected",
        p.family === "percentage"
          ? `${p.parameters.percent}% + ${100 - p.parameters.percent}% = 100%`
          : `${selected}/${count}`,
        400,
        280,
      );
  } else if (p.family === "rate") {
    scene.scaleMode = "equalUnit";
    const counts = [p.parameters.knownCount, p.parameters.wantedCount],
      uw = 480 / Math.max(...counts);
    counts.forEach((c, i) => {
      const y = 95 + i * 130;
      name("rate-" + i, `${c} ${tr("notebooks", "buku nota")}`, 130, y - 20);
      for (let j = 0; j < c; j++)
        bar(
          "rate-" + i + "-" + j,
          i ? "b" : "a",
          130 + j * uw,
          y,
          uw,
          reveal ? label("u") : "u",
          { fill: COLOURS[i] },
        );
      brace(
        "cost-" + i,
        130,
        y + 50,
        c * uw,
        label(i ? "b" : "a"),
        i ? "b" : "a",
      );
    });
  } else if (p.family === "average") {
    scene.scaleMode = p.quantities
      .filter((q) => q.id.startsWith("s"))
      .every((q) => q.known)
      ? "proportional"
      : "symbolic";
    const scores = p.quantities.filter((q) => q.id.startsWith("s")),
      scale = 4.8;
    scores.forEach((q, i) => {
      name("quiz-" + i, q.label, 75, 65 + i * 60);
      bar(
        "score-" + i,
        q.id,
        135,
        45 + i * 60,
        (q.known || reveal ? value(q.id) : 55) * scale,
        label(q.id),
        { fill: COLOURS[i % 5] },
      );
    });
    name("mean", tr("Mean", "Purata") + " = " + label("m"), 400, 380);
  } else if (r.type === "equal") {
    scene.scaleMode = "symbolic";
    const left = linear(r.left),
      right = linear(r.right),
      maxX = Math.max(num(left.a), num(right.a)),
      maxC = Math.max(num(left.b), num(right.b)),
      unitW = Math.min(72, 320 / Math.max(1, maxX)),
      constantScale = Math.min(5, 180 / Math.max(1, maxC));
    for (const [side, e, y] of [
      ["left", left, 90],
      ["right", right, 230],
    ]) {
      let x = 135;
      const a = num(e.a);
      if (a > 12) {
        scene.scaleMode = "compressed";
        bar(
          side + "-x",
          "x",
          x,
          y,
          320,
          reveal ? display(mul(e.a, p.values.x)) : display(e.a) + "x",
          {
            coefficient: a,
            coefficientValue: e.a,
            fill: COLOURS[0],
          },
        );
        x += 320;
      } else {
        for (let i = 0; i < Math.ceil(a); i++) {
          const fraction = Math.min(1, a - i),
            fractionValue = a - i >= 1 ? rat(1) : sub(e.a, i);
          bar(
            side + "-x-" + i,
            "x",
            x,
            y,
            unitW * fraction,
            reveal
              ? display(mul(fractionValue, p.values.x))
              : fraction === 1
                ? "x"
                : display(fractionValue) + "x",
            {
              coefficient: fraction,
              coefficientValue: fractionValue,
              fill: COLOURS[0],
            },
          );
          x += unitW * fraction;
        }
      }
      if (num(e.b) > 0) {
        bar(
          side + "-constant",
          "constant-" + side,
          x,
          y,
          num(e.b) * constantScale,
          display(e.b),
          { constant: num(e.b), constantValue: e.b, fill: COLOURS[1] },
        );
        x += num(e.b) * constantScale;
      }
      name(
        side + "-name",
        side === "left" ? tr("Left", "Kiri") : tr("Right", "Kanan"),
        80,
        y + 18,
      );
      brace(
        side + "-brace",
        135,
        y + 50,
        x - 135,
        side === "left" ? expressionLabel(r.left) : expressionLabel(r.right),
        "x",
      );
    }
    name("equality", "=", 390, 200);
  }
  scene.labels.forEach((l) => (l.text = String(l.text)));
  return scene;
}
const divValue = (v, n) => rat(BigInt(v.n), BigInt(v.d) * BigInt(n));
const expressionLabel = (e) => {
  const l = linear(e);
  return `${eq(l.a, 0) ? "" : display(l.a) + "x"}${eq(l.b, 0) ? "" : (eq(l.a, 0) ? "" : " + ") + display(l.b)}`;
};
export function planTimeline(p) {
  const base = planScene(p),
    states = [base],
    steps = [];
  if (p.family === "average" && p.subtype === "mean") {
    // Cut only the excess; preserve each piece as it moves into a deficit.
    const mean = num(p.values.m),
      recipients = base.segments
        .filter((s) => num(p.values[s.quantityId]) < mean)
        .map((s) => ({
          id: s.id,
          left: (mean - num(p.values[s.quantityId])) * 4.8,
          x: s.x + s.w,
          y: s.y,
        }));
    for (const donor of [...base.segments]) {
      const original = donor.w,
        excess = Math.max(0, original - mean * 4.8);
      donor.label = "";
      if (!excess) continue;
      donor.w -= excess;
      let left = excess,
        offset = 0;
      for (const target of recipients) {
        if (!left) break;
        if (!target.left) continue;
        const width = Math.min(left, target.left);
        base.segments.push({
          ...donor,
          id: donor.id + "-excess-" + target.id,
          x: donor.x + donor.w + offset,
          w: width,
          destination: { x: target.x, y: target.y },
          label: "",
        });
        target.x += width;
        target.left -= width;
        left -= width;
        offset += width;
      }
    }
    base.labels = base.labels.map((l) =>
      l.id.startsWith("quiz-")
        ? {
            ...l,
            x: 80,
            text: l.text + ": " + display(p.values["s" + l.id.slice(5)]),
          }
        : l,
    );
  }
  if (p.family === "rate")
    base.segments
      .filter((s) => s.id.startsWith("rate-1"))
      .forEach((s) => (s.opacity = 0.12));
  let current = clone(base);
  const tr = (en, bm) => (p.language === "bm" ? bm : en);
  for (const [i, calc] of p.calculations.entries()) {
    const from = clone(current),
      to = clone(current);
    const action = calc.action;
    if (action === "join" && p.family === "partWhole") {
      if (i === 0) {
        from.segments.forEach((s, j) => (s.x += j * 22));
        states[0] = clone(from);
      }
      to.braces.forEach((b) => (b.opacity = 1));
    }
    if (action === "align" && p.family === "comparison") {
      from.segments.filter((s) => s.y > 150).forEach((s) => (s.x += 55));
      if (i === 0) states[0] = clone(from);
    }
    if (action === "transfer") {
      const r = p.relations[0],
        piece = to.segments.find((s) => s.id === "transfer-piece"),
        target = to.segments.find((s) => s.id === "target-original");
      piece.x = target.x + target.w;
      piece.y = target.y;
      piece.label = display(p.values[r.amountId]);
      to.labels.find((l) => l.id === "source-name").text =
        p.quantities.find((q) => q.id === r.sourceAfterId).label +
        " = " +
        display(p.values[r.sourceAfterId]);
      to.labels.find((l) => l.id === "target-name").text =
        p.quantities.find((q) => q.id === r.targetAfterId).label +
        " = " +
        display(p.values[r.targetAfterId]);
    }
    if (action === "split" && p.family === "change") {
      to.segments.find((s) => s.id === "change").y += 110;
      to.braces[0].text = tr("After", "Selepas") + " = " + display(p.values.b);
      to.braces[0].w = to.segments.find((s) => s.id === "original").w;
    }
    if (action === "join" && p.family === "change") {
      from.segments.find((s) => s.id === "change").x += 60;
      if (i === 0) states[0] = clone(from);
    }
    if (
      ["partition", "cloneUnit"].includes(action) &&
      [
        "equalGroups",
        "multiplicativeComparison",
        "fraction",
        "ratio",
        "percentage",
        "rate",
      ].includes(p.family)
    ) {
      const lanes = [...new Set(from.segments.map((s) => s.y))];
      for (const y of lanes) {
        const cells = from.segments.filter((s) => s.y === y);
        const first = cells[0];
        if (action === "partition") {
          first.w = cells.reduce((n, s) => n + s.w, 0);
          first.label = "";
        }
        cells.slice(1).forEach((s) => {
          s.opacity = 0;
          if (action === "cloneUnit") {
            s.x = first.x;
            s.y = first.y;
          }
        });
      }
      if (i === 0) states[0] = clone(from);
      to.segments.forEach((s) => (s.opacity = 1));
    }
    if (
      p.family === "average" &&
      action === "partition" &&
      p.subtype === "mean"
    ) {
      for (const piece of to.segments)
        if (piece.destination) {
          piece.x = piece.destination.x;
          piece.y = piece.destination.y;
        }
      to.labels = to.labels.map((l) =>
        l.id.startsWith("quiz-")
          ? {
              ...l,
              text:
                tr("Quiz ", "Kuiz ") +
                (Number(l.id.slice(5)) + 1) +
                ": " +
                display(p.values.m),
            }
          : l,
      );
      to.scaleMode = "proportional";
    }
    if (
      p.family === "comparison" &&
      p.subtype === "totalDifference" &&
      action === "align"
    ) {
      to.segments.find((s) => s.id === "difference").x += 40;
      to.segments.find((s) => s.id === "difference").y += 70;
    }
    if (
      p.family === "average" &&
      p.subtype === "missingValue" &&
      action === "partition"
    ) {
      to.segments.forEach((s) => {
        if (s.quantityId !== "s4") {
          s.opacity = 0.18;
          s.x -= 35;
        } else {
          s.w = num(p.values.s4) * 4.8;
          s.label = display(p.values.s4);
        }
      });
    }
    if (p.family === "rate" && action === "unitise") {
      to.segments
        .filter((s) => s.id.startsWith("rate-0"))
        .forEach((s, j) => {
          s.label = display(p.values.u, "sen");
          s.opacity = j === 0 ? 1 : 0.3;
        });
    }
    if (p.family === "rate" && action === "scale") {
      to.segments.forEach((s) => {
        s.opacity = 1;
        s.label = display(p.values.u, "sen");
      });
      to.braces.find((b) => b.id === "cost-1").text = display(
        p.values.b,
        "sen",
      );
    }
    if (p.family === "percentage" && action === "scale") {
      const n = p.parameters.percent / 5;
      to.segments.forEach((s, j) => {
        s.y += j < n ? 55 : 0;
        s.quantityId = j < n ? "d" : "p";
      });
      to.labels.push({
        id: "discount-value",
        x: 400,
        y: 230,
        text: tr("Discount: ", "Diskaun: ") + display(p.values.d, "sen"),
      });
    }
    if (p.family === "comparison" && action === "rebuild") {
      const d = to.segments.find((s) => s.id === "difference"),
        common = to.segments.find((s) => s.id === "common-b");
      d.x = common.x + common.w;
      d.y = common.y;
    }
    if (p.family === "algebra" && action === "ungroup") {
      const count = p.parameters.coefficient;
      for (const seg of to.segments) {
        if (seg.id.startsWith("left-x-") && seg.id !== "left-x-0") {
          seg.opacity = 0.18;
          seg.y += 48;
        }
        if (seg.constant) {
          seg.constantValue = div(
            seg.constantValue || rat(String(seg.constant)),
            count,
          );
          seg.constant = num(seg.constantValue);
          seg.w /= count;
          seg.label = display(seg.constantValue);
        }
      }
      const lc = to.segments.find((s) => s.id === "left-constant"),
        lx = to.segments.find((s) => s.id === "left-x-0");
      if (lc && lx) lc.x = lx.x + lx.w;
    }
    if (p.family === "algebra" && action === "cancelEqual") {
      const r = p.relations[0],
        l = linear(r.left),
        rr = linear(r.right),
        prior = p.calculations
          .slice(0, i)
          .filter((c) => c.action === "cancelEqual").length,
        shared = Math.min(num(l.a), num(rr.a));
      if (shared > 0 && prior === 0) {
        for (const side of ["left", "right"]) {
          let remaining = num(l.a) <= num(rr.a) ? l.a : rr.a;
          for (const s of to.segments.filter(
            (s) => s.id.startsWith(side + "-x") && s.opacity > 0.5,
          )) {
            if (eq(remaining, 0)) break;
            const original = s.coefficientValue || rat(String(s.coefficient));
            const take = num(remaining) < num(original) ? remaining : original;
            if (num(take) < num(original)) {
              const rest = sub(original, take),
                part = {
                  ...s,
                  id: s.id + "-remainder",
                  coefficientValue: rest,
                  coefficient: num(rest),
                  w: s.w * num(div(rest, original)),
                  x: s.x + s.w * num(div(take, original)),
                  label: (eq(rest, 1) ? "" : display(rest)) + "x",
                };
              to.segments.push(part);
              s.w *= num(div(take, original));
            }
            s.coefficientValue = take;
            s.coefficient = num(take);
            s.label = (eq(take, 1) ? "" : display(take)) + "x";
            s.opacity = 0.18;
            s.y += 48;
            remaining = sub(remaining, take);
          }
        }
      } else {
        const common = Math.min(
          ...["left", "right"].map(
            (side) =>
              to.segments.find(
                (s) => s.id === side + "-constant" && s.opacity > 0.5,
              )?.constant || 0,
          ),
        );
        const commonValue =
          to.segments.find((s) => s.constant === common && s.opacity > 0.5)
            ?.constantValue || rat(String(common));
        for (const side of ["left", "right"]) {
          const s = to.segments.find((s) => s.id === side + "-constant");
          if (!s || !common) continue;
          const original = s.constant;
          if (common && original > common) {
            const remainder = clone(s);
            remainder.id = side + "-remainder";
            remainder.w = (s.w * (original - common)) / original;
            remainder.x = s.x + (s.w * common) / original;
            remainder.constantValue = sub(
              s.constantValue || rat(String(original)),
              commonValue,
            );
            remainder.constant = num(remainder.constantValue);
            remainder.label = display(remainder.constantValue);
            to.segments.push(remainder);
            s.w *= common / original;
            s.constantValue = commonValue;
            s.constant = common;
            s.label = display(s.constantValue);
          }
          s.opacity = 0.18;
          s.y += 48;
        }
      }
    }
    if (
      action === "cloneUnit" &&
      p.family === "algebra" &&
      p.subtype === "fractionalCoefficient"
    ) {
      const source = to.segments.find((s) => s.id === "left-x-0"),
        copy = clone(source);
      copy.id = "left-x-other-half";
      copy.x = source.x + source.w;
      copy.label = display(divValue(p.values.x, 2));
      source.label = display(divValue(p.values.x, 2));
      to.segments.push(copy);
      const right = to.segments.find((s) => s.id === "right-constant");
      if (right)
        to.segments.push({
          ...right,
          id: "right-other-half",
          x: right.x + right.w,
        });
    }
    if (p.family === "algebra" && action === "unitise") {
      const xs = to.segments.filter(
        (s) => s.quantityId === "x" && s.opacity > 0.5,
      );
      const totalUnitValue = xs.reduce(
        (n, s) => add(n, s.coefficientValue || rat(String(s.coefficient))),
        rat(0),
      );
      const totalUnits = num(totalUnitValue);
      const known = to.segments.find((s) => s.constant && s.opacity > 0.5);
      if (known && xs.length && !Number.isInteger(totalUnits)) {
        const keeper = xs[0],
          before = keeper.coefficient;
        keeper.w = Math.min(320, keeper.w / before);
        keeper.coefficient = 1;
        keeper.coefficientValue = rat(1);
        xs.slice(1).forEach((s) => {
          s.opacity = 0.18;
          s.y += 48;
        });
        known.constantValue = p.values.x;
        known.constant = num(p.values.x);
        known.w = Math.min(320, known.w / totalUnits);
        known.label = display(p.values.x);
      }
      if (
        known &&
        Number.isInteger(totalUnits) &&
        totalUnits > 1 &&
        totalUnits <= 12
      ) {
        const unitW = known.w / totalUnits,
          unitValue = div(
            known.constantValue || rat(String(known.constant)),
            totalUnitValue,
          );
        for (let j = 1; j < totalUnits; j++)
          to.segments.push({
            ...known,
            id: known.id + "-unit-" + j,
            x: known.x + j * unitW,
            w: unitW,
            constant: num(unitValue),
            constantValue: unitValue,
            label: display(p.values.x),
          });
        known.w = unitW;
        known.constant = num(unitValue);
        known.constantValue = unitValue;
        known.label = display(p.values.x);
      }
    }
    if (action === "unitise" || action === "rebuild" || action === "verify") {
      const revealed = planScene(p, true);
      for (const s of to.segments) {
        const known = revealed.segments.find((q) => q.id === s.id);
        if (
          known &&
          s.opacity > 0.5 &&
          p.family !== "algebra" &&
          !(p.family === "average" && p.subtype === "mean")
        )
          s.label = known.label;
        if (p.family === "algebra" && s.quantityId === "x" && s.opacity > 0.5)
          s.label = display(
            mul(
              s.coefficientValue || rat(String(s.coefficient || 1)),
              p.values.x,
            ),
          );
      }
      if (action === "verify")
        to.braces.forEach((b) => {
          const q = p.quantities.find((q) => q.id === b.quantityId);
          if (q && p.family !== "algebra")
            b.text =
              q.label +
              " = " +
              display(p.values[q.id], q.unit === "sen" ? "sen" : "");
        });
    }
    if (p.family === "algebra") {
      for (const b of to.braces) {
        const side = b.id.startsWith("left") ? "left" : "right";
        const active = to.segments.filter(
          (s) => s.id.startsWith(side) && s.opacity > 0.5,
        );
        if (active.length) {
          b.x = Math.min(...active.map((s) => s.x));
          b.w = Math.max(...active.map((s) => s.x + s.w)) - b.x;
          b.text = active.map((s) => s.label).join(" + ");
        }
      }
      if (action === "verify")
        to.labels = to.labels
          .filter((l) => l.id !== "solution")
          .concat({
            id: "solution",
            x: 400,
            y: 355,
            text: "x = " + display(p.values.x),
          });
    }
    const step = {
      id: "step-" + i,
      action,
      affectedObjectIds: to.segments
        .filter(
          (s) =>
            JSON.stringify(s) !==
            JSON.stringify(from.segments.find((q) => q.id === s.id)),
        )
        .map((s) => s.id),
      durationMs: 950,
      narration: calc.narration,
      mathematicalMeaning: calc.narration,
      invariant: calc.invariant,
      equationBefore: i
        ? p.calculations[i - 1].equation
        : p.relations.map((r) => relationDescription(r, p)).join("; "),
      equationAfter: calc.equation,
      checkpoint: {
        pauseForStudent: action !== "verify",
        prompt:
          calc.prompt ||
          tr(
            "Explain why this operation preserves the relationship.",
            "Terangkan mengapa operasi ini mengekalkan hubungan.",
          ),
      },
      fromState: from,
      toState: to,
    };
    steps.push(step);
    current = to;
    states.push(clone(to));
  }
  return { initial: states[0], steps, final: current };
}
export function interpolateScene(a, b, t) {
  t = Math.max(0, Math.min(1, t));
  if (t === 0) return clone(a);
  if (t === 1) return clone(b);
  const out = clone(b);
  for (const key of ["segments", "braces", "labels"]) {
    const ids = new Set([
      ...a[key].map((o) => o.id),
      ...b[key].map((o) => o.id),
    ]);
    out[key] = [...ids].map((id) => {
      let x = a[key].find((o) => o.id === id),
        y = b[key].find((o) => o.id === id);
      if (!x) x = { ...y, opacity: 0 };
      if (!y) y = { ...x, opacity: 0 };
      const o = { ...(t < 1 ? x : y) };
      for (const k of ["x", "y", "w", "h", "opacity"])
        if (x[k] !== undefined || y[k] !== undefined)
          o[k] = (x[k] ?? 1) + ((y[k] ?? 1) - (x[k] ?? 1)) * t;
      return o;
    });
  }
  return out;
}
export function timelineAt(plan, progress) {
  const clamped = Math.max(0, Math.min(plan.steps.length, progress));
  if (clamped === plan.steps.length) return clone(plan.final);
  const i = Math.floor(clamped);
  return interpolateScene(
    plan.steps[i].fromState,
    plan.steps[i].toState,
    clamped - i,
  );
}
