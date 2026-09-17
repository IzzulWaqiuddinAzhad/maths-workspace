import { DocumentStore, newDocument } from "../core.js?v=14";
import { rat, div, display, num, sub, validateProblem, eq } from "./domain.js";
import { planTimeline } from "./scene.js";
import { generateProblem } from "./generator.js";
export const STORAGE_KEY = "maths-workspace-bar-model-v1";
export function studioDocument(language = "en") {
  const d = newDocument();
  d.title = "Bar Model Studio";
  d.studio = {
    schemaVersion: 1,
    entry: "question",
    problem: generateProblem({ language }),
    scene: {
      width: 800,
      height: 400,
      segments: [],
      braces: [],
      labels: [],
      annotations: [],
      scaleMode: "symbolic",
    },
    relations: [],
    saved: [],
  };
  return d;
}
export function validStudio(d) {
  const finite = (n) => Number.isFinite(n) && Math.abs(n) < 1e5;
  const string = (v, max = 200) => typeof v === "string" && v.length <= max;
  const sceneOK = (scene) =>
    scene &&
    scene.width === 800 &&
    scene.height === 400 &&
    Array.isArray(scene.segments) &&
    scene.segments.length <= 100 &&
    new Set(scene.segments.map((s) => s.id)).size === scene.segments.length &&
    scene.segments.every(
      (s) =>
        string(s.id) &&
        string(s.label) &&
        [s.x, s.y, s.w, s.h].every(finite) &&
        s.w > 0 &&
        s.h > 0 &&
        (!s.value || num(rat(s.value)) >= 0),
    ) &&
    Array.isArray(scene.braces) &&
    scene.braces.length <= 100 &&
    scene.braces.every(
      (b) => string(b.id) && string(b.text) && [b.x, b.y, b.w].every(finite),
    ) &&
    Array.isArray(scene.labels) &&
    scene.labels.length <= 100 &&
    scene.labels.every(
      (l) => string(l.id) && string(l.text) && [l.x, l.y].every(finite),
    ) &&
    Array.isArray(scene.annotations) &&
    scene.annotations.length <= 200 &&
    scene.annotations.every(
      (a) =>
        Array.isArray(a.points) &&
        a.points.length <= 10000 &&
        a.points.every((p) => finite(p.x) && finite(p.y)),
    );
  const itemOK = (item) => {
    const p = item.problem;
    if (
      !sceneOK(item.scene) ||
      !Array.isArray(item.relations) ||
      item.relations.length > 30 ||
      !p ||
      !Array.isArray(p.quantities) ||
      p.quantities.length > 100 ||
      !Array.isArray(p.relations) ||
      p.relations.length > 30 ||
      !Array.isArray(p.calculations) ||
      !p.calculations.length ||
      p.calculations.length > 30 ||
      !Array.isArray(p.promptTokens) ||
      !Array.isArray(p.hints) ||
      !string(p.prompt, 3000)
    )
      return false;
    const values = validateProblem(p);
    planTimeline({ ...p, values });
    return (
      p.quantities.every(
        (q) =>
          string(q.id) &&
          string(q.label) &&
          values[q.id] &&
          p.values?.[q.id] &&
          eq(values[q.id], p.values[q.id]),
      ) &&
      p.calculations.every(
        (c) => string(c.equation, 1000) && string(c.narration, 1000),
      )
    );
  };
  try {
    return (
      d?.schemaVersion === 1 &&
      d.studio?.schemaVersion === 1 &&
      string(d.id) &&
      itemOK(d.studio) &&
      Array.isArray(d.studio.saved) &&
      d.studio.saved.length <= 30 &&
      d.studio.saved.every(itemOK)
    );
  } catch {
    return false;
  }
}
export function openStudio(language) {
  let d;
  try {
    d = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!validStudio(d)) d = null;
  } catch {}
  const store = new DocumentStore(d || studioDocument(language));
  const unsubscribe = store.subscribe((doc) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(doc));
    } catch {}
  });
  return { store, dispose: unsubscribe };
}
const id = () => crypto.randomUUID();
export function addBar(
  scene,
  {
    x = 130,
    y = 80,
    w = 260,
    label = "?",
    value = null,
    quantityId = "free",
    fill = "#d9e9fd",
  } = {},
) {
  if (scene.segments.length >= 100)
    throw Error("Keep a model within 100 segments.");
  const s = {
    id: id(),
    quantityId,
    x,
    y,
    w,
    h: 30,
    label,
    value,
    opacity: 1,
    fill,
  };
  scene.segments.push(s);
  return s.id;
}
export function partitionBar(scene, segmentId, count) {
  if (!Number.isInteger(count) || count < 2 || count > 60)
    throw Error("Choose 2–60 equal parts.");
  const s = scene.segments.find((s) => s.id === segmentId);
  if (!s || s.locked) throw Error("Select an unlocked bar.");
  if (count <= 20 && scene.segments.length + count - 1 > 100)
    throw Error("Keep a model within 100 segments.");
  const unit = s.value ? div(s.value, count) : null;
  if (count > 20) {
    s.label = `${unit ? display(unit) : "u"} × ${count}`;
    s.unitCount = count;
    s.equalUnitGroupId = s.id;
    scene.scaleMode = "compressed";
    return;
  }
  s.unitCount = 1;
  const width = s.w / count,
    group = s.id;
  for (let i = 1; i < count; i++)
    scene.segments.push({
      ...s,
      id: id(),
      x: s.x + i * width,
      w: width,
      value: unit,
      label: unit ? display(unit) : "u",
      equalUnitGroupId: group,
    });
  s.w = width;
  s.value = unit;
  s.label = unit ? display(unit) : "u";
  s.equalUnitGroupId = group;
  scene.scaleMode = "equalUnit";
}
export function addBrace(scene, ids, text = "?") {
  const list = scene.segments.filter((s) => ids.includes(s.id));
  if (!list.length) throw Error("Select a bar first.");
  const x = Math.min(...list.map((s) => s.x)),
    right = Math.max(...list.map((s) => s.x + s.w)),
    y = Math.max(...list.map((s) => s.y + s.h)) + 18;
  scene.braces.push({
    id: id(),
    x,
    y,
    w: right - x,
    text,
    opacity: 1,
    segmentIds: ids,
  });
}
export function transferSegment(scene, sourceId, targetId, amount) {
  const source = scene.segments.find((s) => s.id === sourceId),
    target = scene.segments.find((s) => s.id === targetId);
  if (
    !source ||
    !target ||
    source === target ||
    source.locked ||
    target.locked ||
    !source.value ||
    !target.value
  )
    throw Error("Choose two unlocked bars with known values.");
  const n = num(rat(amount)),
    before = num(source.value);
  if (n <= 0 || n >= before)
    throw Error("Transfer less than the source quantity.");
  const width = (source.w * n) / before,
    remaining = before - n;
  source.w -= width;
  source.value = sub(source.value, rat(amount));
  source.label = display(source.value);
  const piece = {
    ...source,
    id: id(),
    x: target.x + target.w,
    y: target.y,
    w: width,
    value: rat(amount),
    label: display(rat(amount)),
    quantityId: "transfer",
  };
  scene.segments.push(piece);
  scene.relations ??= [];
  scene.relations.push({
    type: "transfer",
    pieceId: piece.id,
    sourceId,
    targetId,
    amount: rat(amount),
    invariant: "total",
  });
  return piece.id;
}
