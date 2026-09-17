import {
  generateProblem,
  FAMILIES,
  TIER_LABELS,
  relationDescription,
} from "./generator.js";
import { display } from "./domain.js";
import { planScene, planTimeline } from "./scene.js";
import { drawVectorScene, escape } from "./renderer.js";
import { createPrintDocument } from "../worksheet-pdf.js?v=20";
import { mountWorksheet } from "../worksheet-ui.js?v=20";
import { mountQuestionEditor } from "./worksheet-editor.js";
export const DEFAULT_COUNTS = { 1: 2, 2: 2, 3: 2, 4: 2, 5: 2 };
export const questionLimit = (tier, space = "standard") =>
  space === "spacious" ? 1 : 2;
export function validateBarConfig(c) {
  const errors = [];
  if (!c.tiers.length) errors.push("Select at least one tier.");
  if (
    c.tiers.some((t) => !Number.isInteger(t) || t < 1 || t > 5) ||
    new Set(c.tiers).size !== c.tiers.length
  )
    errors.push("Choose distinct tiers 1–5.");
  for (const t of c.tiers)
    if (
      !Number.isInteger(c.counts[t]) ||
      c.counts[t] < 1 ||
      c.counts[t] > questionLimit(t, c.space)
    )
      errors.push(
        `Tier ${t}: choose 1–${questionLimit(t, c.space)} word problems to keep a readable page.`,
      );
  if (!c.seed.trim() || c.seed.length > 40)
    errors.push("Enter a seed of 1–40 characters.");
  if (c.title.length > 55) errors.push("Keep the title within 55 characters.");
  return errors;
}
export function generateBarWorksheet(c, family) {
  const errors = validateBarConfig(c);
  if (errors.length) throw Error(errors.join(" "));
  let number = 0;
  return {
    schemaVersion: 1,
    family,
    language: c.language,
    title: c.title,
    seed: c.seed,
    worked: c.worked,
    partial: c.partial,
    worksheetPages: c.tiers.length,
    answerPages: c.tiers.length,
    pages: [...c.tiers]
      .sort((a, b) => a - b)
      .map((tier) => ({
        tier,
        example: generateProblem({
          family,
          tier,
          language: c.language,
          seed: c.seed + "-example-" + tier,
        }),
        questions: Array.from({ length: c.counts[tier] }, (_, i) => ({
          number: ++number,
          problem: generateProblem({
            family,
            tier,
            language: c.language,
            seed: c.seed + "-" + tier + "-" + i,
          }),
        })),
      })),
  };
}
function printScene(scene) {
  const s = structuredClone(scene);
  s.height = 245;
  for (const q of s.segments) {
    q.y *= 0.57;
    q.h = 21;
  }
  for (const q of s.labels) q.y *= 0.57;
  for (const q of s.braces) q.y *= 0.57;
  return s;
}
export async function createBarPDFs(model) {
  const pdf = await createPrintDocument(),
    tr = (a, b) => (model.language === "bm" ? b : a);
  const text = (v, x, y, w = 182, size = 10, bold = false) => {
    pdf.setFont("Worksheet", bold ? "bold" : "normal");
    pdf.setFontSize(size);
    pdf.setTextColor(25);
    const lines = pdf.splitTextToSize(String(v), w);
    pdf.text(lines, x, y, { lineHeightFactor: 1.2 });
    return y + lines.length * size * 0.3528 * 1.2;
  };
  const head = (page, answers = false) => {
    let y = text(
      model.title || tr("Bar Model Studio", "Studio Model Bar"),
      14,
      16,
      182,
      14,
      true,
    );
    text(
      `${tr("Tier", "Tahap")} ${page.tier} — ${TIER_LABELS[page.tier - 1][model.language === "bm" ? 1 : 0]}${answers ? " · " + tr("Answers", "Jawapan") : ""}`,
      14,
      y + 2,
      182,
      10,
      true,
    );
    if (!answers)
      text(
        tr(
          "Name: __________________  Class: __________  Date: __________",
          "Nama: __________________  Kelas: __________  Tarikh: __________",
        ),
        14,
        35,
        182,
        9,
      );
  };
  const footer = (n, answers = false) => {
    pdf.setDrawColor(190);
    pdf.line(14, 283, 196, 283);
    text(`${tr("Seed", "Benih")}: ${model.seed}`, 14, 288, 140, 8);
    text(
      `${answers ? tr("Answers", "Jawapan") : tr("Worksheet", "Latihan")} ${n}`,
      160,
      288,
      36,
      8,
    );
  };
  function modelDiagram(p, x, y, w, h, reveal) {
    drawVectorScene(pdf, printScene(planScene(p, reveal)), x, y, w, h);
  }
  function working(p, x, y, w, size = 9.5) {
    y =
      text(
        p.equation ||
          p.relations
            .map((r) =>
              relationDescription(r, {
                ...p,
                quantities: p.quantities.map((q) => ({
                  ...q,
                  label: q.known
                    ? display(q.value, q.unit === "sen" ? "sen" : "")
                    : q.id.toUpperCase(),
                })),
              }),
            )
            .join("; "),
        x,
        y,
        w,
        size,
      ) + 1;
    for (const step of p.calculations)
      y = text(step.equation, x, y, w, size) + 1;
    return text(p.answerText, x, y, w, size, true);
  }
  for (const [i, page] of model.pages.entries()) {
    if (i) pdf.addPage();
    head(page);
    let start = 45;
    if (model.worked) {
      pdf.setFont("Worksheet", "normal");
      pdf.setFontSize(9);
      const diagramY =
        60 +
        pdf.splitTextToSize(page.example.prompt, 174).length * 9 * 0.3528 * 1.2;
      const panelBottom = diagramY + 55;
      pdf.setDrawColor(185);
      pdf.setFillColor(249);
      pdf.roundedRect(14, 42, 182, panelBottom - 42, 2, 2, "FD");
      text(tr("Worked example", "Contoh penyelesaian"), 18, 49, 174, 11, true);
      const end = text(page.example.prompt, 18, 56, 174, 9);
      if (end > 79)
        throw Error(
          "The example text is too long for this page. Shorten it or choose another seed.",
        );
      modelDiagram(page.example, 17, diagramY, 84, 49, true);
      const finish = working(page.example, 104, diagramY, 87, 8.5);
      if (finish > panelBottom - 2)
        throw Error(
          "This solution needs more space. Choose a different seed or omit the worked example.",
        );
      start = panelBottom + 8;
    }
    const height = (277 - start) / page.questions.length;
    for (const [j, item] of page.questions.entries()) {
      const y = start + j * height,
        end = text(`${item.number}. ${item.problem.prompt}`, 14, y, 182, 10);
      if (end > y + 27)
        throw Error(
          "This question is too long to keep together. Shorten its wording.",
        );
      const diagramHeight = Math.min(
        item.problem.family === "average" ? 44 : 35,
        height - 25,
      );
      if (model.partial && page.tier <= 2)
        modelDiagram(item.problem, 20, end + 2, 170, diagramHeight, false);
      const workY =
        model.partial && page.tier <= 2 ? end + diagramHeight + 5 : end + 8;
      pdf.setDrawColor(185);
      for (let row = workY; row < y + height - 4; row += 7)
        pdf.line(14, row, 196, row);
    }
    footer(i + 1);
  }
  const student = pdf.output("arraybuffer");
  for (const [i, page] of model.pages.entries()) {
    pdf.addPage();
    head(page, true);
    const height = 237 / page.questions.length;
    for (const [j, item] of page.questions.entries()) {
      const y = 42 + j * height;
      text(`${item.number}. ${item.problem.prompt}`, 14, y, 182, 9.5);
      modelDiagram(item.problem, 14, y + 23, 82, 65, true);
      const end = working(item.problem, 100, y + 26, 96, 9.5);
      if (end > y + height - 3)
        throw Error(
          "The answer needs more space. Choose one question per tier.",
        );
      text(
        tr(
          "Check the relationship, not the drawing size.",
          "Semak hubungan, bukan saiz lukisan.",
        ),
        14,
        y + height - 6,
        182,
        8,
      );
    }
    footer(i + 1, true);
  }
  return { student, teacher: pdf.output("arraybuffer") };
}
export function mountBarCreate(host, { language, family, back }) {
  const title =
    FAMILIES.find((f) => f[0] === family)?.[language === "bm" ? 2 : 1] ||
    "Bar Model";
  return mountWorksheet(host, {
    mode: family,
    language,
    back,
    adapter: {
      title: escape(title),
      TIERS: TIER_LABELS,
      DEFAULT_COUNTS,
      questionLimit,
      validateConfig: validateBarConfig,
      generateWorksheet: (c) => generateBarWorksheet(c, family),
      createPDFs: createBarPDFs,
      mountEditor: mountQuestionEditor,
    },
  });
}
