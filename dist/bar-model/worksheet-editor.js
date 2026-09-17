import { generateProblem, FAMILIES } from "./generator.js";
import { escape } from "./renderer.js";
import { validateProblem } from "./domain.js";
const titles = {
  first: ["First quantity", "Kuantiti pertama"],
  second: ["Second quantity", "Kuantiti kedua"],
  third: ["Third quantity", "Kuantiti ketiga"],
  smaller: [
    "Smaller quantity (RM for saving problems)",
    "Kuantiti kecil (RM bagi simpanan)",
  ],
  difference: ["Difference", "Beza"],
  before: ["Before", "Sebelum"],
  change: ["Change amount", "Jumlah perubahan"],
  amount: ["Transfer amount", "Jumlah dipindahkan"],
  groups: ["Groups", "Kumpulan"],
  unit: ["Unit value", "Nilai seunit"],
  denominator: ["Denominator", "Penyebut"],
  numerator: ["Numerator", "Pengangka"],
  percent: ["Percent", "Peratus"],
  original: ["Original price (sen)", "Harga asal (sen)"],
  firstUnits: ["First ratio units", "Unit nisbah pertama"],
  secondUnits: ["Second ratio units", "Unit nisbah kedua"],
  thirdUnits: ["Third ratio units", "Unit nisbah ketiga"],
  knownCount: ["Known item count", "Bilangan diketahui"],
  wantedCount: ["Requested item count", "Bilangan diminta"],
  unitPrice: ["Unit price (sen)", "Harga seunit (sen)"],
  mean: ["Mean", "Purata"],
  answer: ["Value of x", "Nilai x"],
  coefficient: ["Coefficient", "Pekali"],
  constant: ["Constant", "Pemalar"],
};
export function renumber(model) {
  let number = 0;
  for (const page of model.pages)
    for (const item of page.questions) item.number = ++number;
  return model;
}
export function editQuestion(model, pageIndex, itemIndex, parameters, seed) {
  const next = structuredClone(model),
    page = next.pages[pageIndex],
    original = itemIndex < 0 ? page.example : page.questions[itemIndex].problem;
  const p = generateProblem({
    family: next.family,
    tier: page.tier,
    language: next.language,
    seed: seed || original.seed,
    contextSeed: seed || original.contextSeed || original.seed,
    parameters: parameters || {},
  });
  if (itemIndex < 0) page.example = p;
  else page.questions[itemIndex].problem = p;
  return renumber(next);
}
export function moveQuestion(model, pageIndex, itemIndex, direction) {
  const next = structuredClone(model),
    items = next.pages[pageIndex].questions,
    to = itemIndex + direction;
  if (to < 0 || to >= items.length) return next;
  [items[to], items[itemIndex]] = [items[itemIndex], items[to]];
  return renumber(next);
}
export function readQuestionBank(value) {
  if (
    value.schemaVersion !== 1 ||
    !FAMILIES.some((f) => f[0] === value.family) ||
    !Array.isArray(value.pages) ||
    value.pages.length < 1 ||
    value.pages.length > 5 ||
    !["en", "bm"].includes(value.language)
  )
    throw Error("Invalid Bar Model question bank.");
  const model = structuredClone(value);
  const tiers = new Set();
  for (const page of model.pages) {
    if (
      !Number.isInteger(page.tier) ||
      page.tier < 1 ||
      page.tier > 5 ||
      tiers.has(page.tier) ||
      !Array.isArray(page.questions) ||
      page.questions.length < 1 ||
      page.questions.length > 2
    )
      throw Error("Invalid tier or question count.");
    tiers.add(page.tier);
    for (const p of [page.example, ...page.questions.map((q) => q.problem)]) {
      validateProblem(p);
      if (p.family !== model.family || p.tier !== page.tier)
        throw Error("Question and worksheet settings must match.");
    }
  }
  if (
    typeof model.title !== "string" ||
    model.title.length > 55 ||
    typeof model.seed !== "string" ||
    model.seed.length > 40
  )
    throw Error("Invalid worksheet title or seed.");
  for (const page of model.pages) {
    const canonical = (p) =>
      generateProblem({
        family: model.family,
        tier: page.tier,
        language: model.language,
        seed: p.seed,
        contextSeed: p.contextSeed || p.seed,
        parameters: p.parameters,
      });
    page.example = canonical(page.example);
    page.questions = page.questions.map((q) => ({
      ...q,
      problem: canonical(q.problem),
    }));
  }
  model.worksheetPages = model.pages.length;
  model.answerPages = model.pages.length;
  return renumber(model);
}
export function mountQuestionEditor(host, model, rebuild) {
  const tr = (en, bm) => (model.language === "bm" ? bm : en);
  host.innerHTML = `<details class="bar-bank-editor"><summary>${tr("Review and edit individual questions", "Semak dan sunting setiap soalan")}</summary><p>${tr("Change values, regenerate one question, or reorder within a tier. The diagram and answer are rebuilt together.", "Ubah nilai, jana semula satu soalan atau susun semula dalam tahap. Rajah dan jawapan dikemas kini bersama.")}</p><button data-bank-save>${tr("Save question bank", "Simpan bank soalan")}</button><label>${tr("Open question bank", "Buka bank soalan")}<input data-bank-open type="file" accept="application/json"></label><p data-bank-status role="status"></p>${model.pages
    .map(
      (page, pi) =>
        `<h4>${tr("Tier", "Tahap")} ${page.tier}</h4>${[
          ...(model.worked
            ? [
                {
                  problem: page.example,
                  number: tr("Example", "Contoh"),
                  index: -1,
                },
              ]
            : []),
          ...page.questions.map((item, i) => ({ ...item, index: i })),
        ]
          .map(
            (item) =>
              `<details data-item data-page="${pi}" data-index="${item.index}"><summary>${escape(item.number)}. ${escape(item.problem.prompt)}</summary>${Object.entries(
                item.problem.parameters,
              )
                .map(([key, value]) =>
                  Array.isArray(value)
                    ? value
                        .map(
                          (v, i) =>
                            `<label>${tr("Score", "Markah")} ${i + 1}<input type="number" min="0" max="100" data-parameter="${key}" data-array="${i}" value="${v}"></label>`,
                        )
                        .join("")
                    : `<label>${escape((titles[key] || [key, key])[model.language === "bm" ? 1 : 0])}<input type="number" min="0" max="100000" step="any" data-parameter="${key}" value="${value}"></label>`,
                )
                .join(
                  "",
                )}<button data-apply>${tr("Apply values", "Gunakan nilai")}</button><button data-new>${tr("Regenerate this question", "Jana semula soalan ini")}</button>${item.index >= 0 ? `<button data-move="-1" ${item.index === 0 ? "disabled" : ""}>↑ ${tr("Move up", "Ke atas")}</button><button data-move="1" ${item.index === page.questions.length - 1 ? "disabled" : ""}>↓ ${tr("Move down", "Ke bawah")}</button>` : ""}</details>`,
          )
          .join("")}`,
    )
    .join("")}</details>`;
  const status = (message) =>
    (host.querySelector("[data-bank-status]").textContent = message);
  const run = (fn) => {
    try {
      rebuild(fn());
    } catch (e) {
      status(e.message);
    }
  };
  for (const item of host.querySelectorAll("[data-item]")) {
    const pi = +item.dataset.page,
      qi = +item.dataset.index;
    item.querySelector("[data-new]").onclick = () =>
      run(() =>
        editQuestion(model, pi, qi, null, crypto.randomUUID().slice(0, 8)),
      );
    item.querySelector("[data-apply]").onclick = () =>
      run(() => {
        const parameters = {};
        for (const input of item.querySelectorAll("[data-parameter]")) {
          const value = +input.value;
          if (!Number.isFinite(value)) throw Error("Enter valid numbers.");
          if (input.dataset.array !== undefined) {
            parameters[input.dataset.parameter] ??= [];
            parameters[input.dataset.parameter][+input.dataset.array] = value;
          } else parameters[input.dataset.parameter] = value;
        }
        return editQuestion(model, pi, qi, parameters);
      });
    for (const button of item.querySelectorAll("[data-move]"))
      button.onclick = () =>
        run(() => moveQuestion(model, pi, qi, +button.dataset.move));
  }
  host.querySelector("[data-bank-save]").onclick = () => {
    const url = URL.createObjectURL(
        new Blob([JSON.stringify(model, null, 2)], {
          type: "application/json",
        }),
      ),
      a = document.createElement("a");
    a.href = url;
    a.download = "bar-model-question-bank.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  host.querySelector("[data-bank-open]").onchange = async (e) => {
    try {
      const file = e.target.files[0];
      if (!file || file.size > 2e6)
        throw Error("Choose a question bank under 2 MB.");
      const value = readQuestionBank(JSON.parse(await file.text()));
      await rebuild(value);
    } catch (error) {
      status(error.message);
    }
  };
}
