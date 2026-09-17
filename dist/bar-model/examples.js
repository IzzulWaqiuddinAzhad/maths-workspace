import { generateProblem } from "./generator.js";
// Regression examples share the normal generator and exact solver.
export const EXAMPLES = {
  partWhole: { tier: 1, parameters: { first: 28, second: 17 } },
  comparison: { tier: 4, parameters: { smaller: 31, difference: 12 } },
  change: { tier: 1, parameters: { before: 36, change: 12 } },
  transfer: { tier: 1, parameters: { first: 46, second: 28, amount: 9 } },
  equalGroups: { tier: 3, parameters: { groups: 6, unit: 8 } },
  multiplicativeComparison: { tier: 1, parameters: { groups: 3, unit: 18 } },
  fraction: { tier: 1, parameters: { numerator: 3, denominator: 5, unit: 16 } },
  percentage: { tier: 1, parameters: { percent: 25, original: 8000 } },
  ratio: { tier: 1, parameters: { firstUnits: 3, secondUnits: 5, unit: 5 } },
  rate: {
    tier: 1,
    parameters: { knownCount: 4, wantedCount: 9, unitPrice: 360 },
  },
  average: { tier: 3, parameters: { mean: 74, scores: [68, 72, 75, 80, 75] } },
  algebra: { tier: 4, parameters: { answer: 7, coefficient: 4, constant: 13 } },
};
export function exampleProblem(family, language) {
  return generateProblem({
    family,
    language,
    seed: "example-" + family,
    ...EXAMPLES[family],
  });
}
