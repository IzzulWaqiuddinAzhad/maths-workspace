import { generateProblem, equationProblem } from "./generator.js";
export const EXPLORATIONS = [
  ["total", "Fixed total, changing difference", "Jumlah tetap, beza berubah"],
  ["difference", "Fixed difference", "Beza tetap"],
  ["ratio", "Fixed ratio", "Nisbah tetap"],
  ["transfer", "Transfer to equalise", "Pindah untuk menyamakan"],
  ["fraction", "Equivalent fractions", "Pecahan setara"],
  ["percentage", "Percentage of a price", "Peratus harga"],
  ["algebra", "Algebra parameter", "Parameter algebra"],
  ["groups", "Equal groups", "Kumpulan sama"],
];
export function exploreProblem(kind, value, language = "en") {
  const tr = (en, bm) => (language === "bm" ? bm : en);
  let p,
    invariant,
    min = 0,
    max = 20,
    step = 1;
  if (kind === "total") {
    const total = 100,
      difference = value * 2;
    p = generateProblem({
      family: "comparison",
      tier: 4,
      language,
      parameters: { smaller: (total - difference) / 2, difference },
      seed: "explore-total",
    });
    invariant = "A + B = 100";
    max = 40;
  }
  if (kind === "difference") {
    p = generateProblem({
      family: "comparison",
      tier: 4,
      language,
      parameters: { smaller: value + 10, difference: 12 },
      seed: "explore-difference",
    });
    invariant = "B − A = 12";
    max = 70;
  }
  if (kind === "ratio") {
    p = generateProblem({
      family: "ratio",
      tier: 3,
      language,
      parameters: { firstUnits: 3, secondUnits: 5, unit: value + 1 },
      seed: "explore-ratio",
    });
    invariant = "A : B = 3 : 5";
    max = 20;
  }
  if (kind === "transfer") {
    p = generateProblem({
      family: "transfer",
      tier: 3,
      language,
      parameters: { first: 46, second: 28, amount: value },
      seed: "explore-transfer",
    });
    invariant = "A + B = 74";
    min = 1;
    max = 20;
  }
  if (kind === "fraction") {
    p = generateProblem({
      family: "fraction",
      tier: 3,
      language,
      parameters: {
        denominator: 2 * (value + 1),
        numerator: value + 1,
        unit: 60 / (value + 1),
      },
      seed: "explore-fraction",
    });
    invariant = `1/2 = ${value + 1}/${2 * (value + 1)}; ${tr("whole", "keseluruhan")} = 120`;
    max = 5;
  }
  if (kind === "percentage") {
    p = generateProblem({
      family: "percentage",
      tier: 3,
      language,
      parameters: { percent: (value + 1) * 5, original: 8000 },
      seed: "explore-percentage",
    });
    invariant = tr(
      "Original = RM80.00; discount + paid = RM80.00",
      "Harga asal = RM80.00; diskaun + bayaran = RM80.00",
    );
    max = 18;
  }
  if (kind === "algebra") {
    p = equationProblem(`4x+${value}=3x+20`, { language });
    invariant = tr(
      "Equality: same operation on both sides",
      "Kesamaan: operasi yang sama pada kedua-dua belah",
    );
    max = 19;
  }
  if (kind === "groups") {
    p = generateProblem({
      family: "equalGroups",
      tier: 1,
      language,
      parameters: { groups: value + 2, unit: 4 },
      seed: "explore-groups",
    });
    invariant = tr(
      "One group = 4 worksheets",
      "Satu kumpulan = 4 helaian latihan",
    );
    max = 18;
  }
  return { problem: p, invariant, min, max, step };
}
