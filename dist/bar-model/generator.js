import {
  rat,
  add,
  sub,
  mul,
  div,
  eq,
  num,
  display,
  parseExpression,
  linear,
  validateProblem,
} from "./domain.js";
import { seededRandom } from "../worksheet-model.js?v=18";
import { NAMES, contextQuality } from "./context.js";
export const FAMILIES = [
  ["partWhole", "Part–part–whole", "Bahagian–bahagian–keseluruhan"],
  ["comparison", "Comparison", "Perbandingan"],
  ["change", "Before and after", "Sebelum dan selepas"],
  ["transfer", "Transfer", "Pemindahan"],
  ["equalGroups", "Equal groups", "Kumpulan sama"],
  [
    "multiplicativeComparison",
    "Multiplicative comparison",
    "Perbandingan gandaan",
  ],
  ["fraction", "Fractions", "Pecahan"],
  ["percentage", "Percentages", "Peratus"],
  ["ratio", "Ratio", "Nisbah"],
  ["rate", "Rate", "Kadar"],
  ["average", "Average", "Purata"],
  ["algebra", "Linear algebra", "Algebra linear"],
];
export const TIER_LABELS = [
  ["Read a model", "Baca model"],
  ["Complete a model", "Lengkapkan model"],
  ["Build and solve", "Bina dan selesaikan"],
  ["Connect several steps", "Hubungkan beberapa langkah"],
  ["Reason and justify", "Taakul dan jelaskan"],
];
export function generateProblem({
  family = "partWhole",
  tier = 1,
  language = "en",
  seed = "bar-model",
  parameters = {},
  contextSeed = seed,
} = {}) {
  if (
    !FAMILIES.some((f) => f[0] === family) ||
    !Number.isInteger(tier) ||
    tier < 1 ||
    tier > 5
  )
    throw Error("Choose a supported family and tier.");
  for (const key of [
    "groups",
    "denominator",
    "numerator",
    "firstUnits",
    "secondUnits",
    "thirdUnits",
    "knownCount",
    "wantedCount",
    "coefficient",
  ]) {
    if (
      parameters[key] !== undefined &&
      (!Number.isInteger(parameters[key]) ||
        parameters[key] < 1 ||
        parameters[key] > 60)
    )
      throw Error(`${key}: choose a whole number from 1 to 60.`);
  }
  if (
    family === "percentage" &&
    parameters.percent !== undefined &&
    parameters.percent % 5 !== 0
  )
    throw Error("Use percentage steps of 5% for this partitioned model.");
  if (
    family === "algebra" &&
    tier >= 4 &&
    parameters.coefficient !== undefined &&
    parameters.coefficient <= 3
  )
    throw Error("This example requires more than three x-units on the left.");
  const rng = seededRandom(seed),
    cr = seededRandom(contextSeed),
    r = (a, b) => a + Math.floor(rng() * (b - a + 1)),
    pick = (key, fallback) => parameters[key] ?? fallback,
    tr = (en, bm) => (language === "bm" ? bm : en);
  const ni = Math.floor(cr() * NAMES.length),
    A = NAMES[ni],
    B = NAMES[(ni + 1 + Math.floor(cr() * (NAMES.length - 1))) % NAMES.length],
    p = {
      id: `bar-${family}-${seed}`,
      schemaVersion: 1,
      seed,
      contextSeed,
      language,
      family,
      tier,
      subtype: "",
      prompt: "",
      quantities: [],
      relations: [],
      targetQuantityIds: [],
      answer: {},
      context: { names: [A, B], checks: [] },
      parameters: {},
      hints: [],
      calculations: [],
    };
  const values = {};
  const q = (
    id,
    label,
    value,
    known = true,
    unit = tr("cards", "kad"),
    kind = "discrete",
    role = "part",
  ) => {
    const v = typeof value === "object" ? rat(value) : rat(String(value));
    values[id] = v;
    p.quantities.push({
      id,
      label,
      known,
      value: known ? v : null,
      unit,
      kind,
      semanticRole: role,
    });
    if (!known) {
      p.targetQuantityIds.push(id);
      p.answer[id] = v;
    }
    return id;
  };
  const val = (id) =>
      display(values[id], p.quantities.find((q) => q.id === id).unit),
    n = (id) => display(values[id]),
    c = (action, en, bm, equation, invariant = "equality") =>
      p.calculations.push({
        action,
        narration: tr(en, bm),
        equation,
        invariant,
        prompt: tr("What should happen next?", "Apakah langkah seterusnya?"),
      });
  const check = (itemId, actorType, value, verb = "has", groups) =>
    p.context.checks.push({ itemId, actorType, value, verb, groups });
  if (family === "partWhole") {
    const a = pick("first", r(12, 40)),
      b = pick("second", r(8, 35)),
      third = tier >= 4 ? pick("third", r(5, 25)) : 0,
      unknown = tier === 2 ? "b" : "w",
      unit = tr("books", "buku");
    q("a", tr("Morning", "Pagi"), a, true, unit);
    q("b", tr("Afternoon", "Petang"), b, unknown !== "b", unit);
    if (third) q("c", tr("Evening", "Malam"), third, true, unit);
    q(
      "w",
      tr("Total sold", "Jumlah jualan"),
      a + b + third,
      unknown !== "w",
      unit,
    );
    p.relations = [
      {
        type: "compose",
        wholeId: "w",
        partIds: third ? ["a", "b", "c"] : ["a", "b"],
      },
    ];
    p.subtype = unknown === "b" ? "missingPart" : "whole";
    p.prompt =
      unknown === "b"
        ? tr(
            `The school bookshop sold ${a + b} exercise books today, including ${a} in the morning. How many did it sell in the afternoon?`,
            `Kedai buku sekolah menjual ${a + b} buku latihan hari ini, termasuk ${a} pada waktu pagi. Berapakah jualan pada waktu petang?`,
          )
        : tr(
            `The school bookshop sold ${a} exercise books in the morning and ${b} in the afternoon${third ? `, then ${third} during an evening event` : ""}. How many books were sold altogether?`,
            `Kedai buku sekolah menjual ${a} buku latihan pada waktu pagi dan ${b} pada waktu petang${third ? `, kemudian ${third} semasa acara malam` : ""}. Berapakah jumlah buku yang dijual?`,
          );
    c(
      "join",
      "Join the parts under one whole brace.",
      "Gabungkan bahagian di bawah kurungan keseluruhan.",
      unknown === "b"
        ? `${n("w")} − ${a} = ${b}`
        : `${a} + ${b}${third ? " + " + third : ""} = ${n("w")}`,
      "whole",
    );
    check("books", "schoolShop", a + b + third, "sells");
    p.parameters = { first: a, second: b, ...(third ? { third } : {}) };
  }
  if (family === "comparison") {
    const small = pick("smaller", r(15, 60)),
      diff = pick("difference", r(5, 25)),
      large = small + diff,
      total = small + large,
      advanced = tier >= 4,
      unknown = advanced
        ? "both"
        : tier === 2
          ? "difference"
          : tier === 3
            ? "smaller"
            : "larger",
      unit = advanced ? tr("stickers", "pelekat") : "sen",
      f = advanced ? 1 : 100;
    q(
      "a",
      A,
      mul(rat(String(small)), f),
      !advanced && unknown !== "smaller",
      unit,
      advanced ? "discrete" : "money",
      "smaller",
    );
    q(
      "b",
      B,
      mul(add(rat(String(small)), rat(String(diff))), f),
      !advanced && unknown !== "larger",
      unit,
      advanced ? "discrete" : "money",
      "larger",
    );
    q(
      "d",
      tr("Difference", "Beza"),
      mul(rat(String(diff)), f),
      unknown !== "difference",
      unit,
      advanced ? "discrete" : "money",
      "difference",
    );
    p.relations = [
      { type: "compare", largerId: "b", smallerId: "a", differenceId: "d" },
    ];
    if (advanced) {
      q("t", tr("Together", "Kesemuanya"), total, true, unit);
      p.relations.push({ type: "compose", wholeId: "t", partIds: ["a", "b"] });
    }
    p.subtype = advanced ? "totalDifference" : unknown;
    p.prompt = advanced
      ? tr(
          `${A} and ${B} have ${total} stickers altogether. ${B} has ${diff} more than ${A}. How many stickers does each have?`,
          `${A} dan ${B} mempunyai ${total} pelekat kesemuanya. ${B} mempunyai ${diff} lebih daripada ${A}. Berapakah bilangan pelekat setiap orang?`,
        )
      : unknown === "difference"
        ? tr(
            `${A} has saved ${val("a")} and ${B} has saved ${val("b")}. How much more has ${B} saved?`,
            `${A} menyimpan ${val("a")} dan ${B} menyimpan ${val("b")}. Berapakah beza simpanan mereka?`,
          )
        : unknown === "smaller"
          ? tr(
              `${B} has saved ${val("b")}, which is ${val("d")} more than ${A}. How much has ${A} saved?`,
              `${B} menyimpan ${val("b")}, iaitu ${val("d")} lebih daripada ${A}. Berapakah simpanan ${A}?`,
            )
          : tr(
              `${A} has saved ${val("a")}. ${B} has saved ${val("d")} more. How much has ${B} saved?`,
              `${A} menyimpan ${val("a")}. ${B} menyimpan ${val("d")} lebih daripada ${A}. Berapakah simpanan ${B}?`,
            );
    c(
      "align",
      "Align both bars at a common starting point.",
      "Jajarkan kedua-dua bar pada titik mula yang sama.",
      advanced
        ? `${total} − ${diff} = ${2 * small}`
        : tr(
            "Larger = smaller + difference",
            "Lebih besar = lebih kecil + beza",
          ),
      advanced ? "total" : "difference",
    );
    if (advanced) {
      c(
        "unitise",
        "Divide the remainder into two equal unknown parts.",
        "Bahagikan baki kepada dua bahagian sama.",
        `${2 * small} ÷ 2 = ${small}`,
        "unitSize",
      );
      c(
        "rebuild",
        "Reattach the difference to the larger quantity.",
        "Sambungkan semula beza pada kuantiti lebih besar.",
        `${small} + ${diff} = ${large}`,
      );
    } else
      c(
        "exposeGap",
        "Use the unmatched section to find the unknown.",
        "Gunakan bahagian yang tidak sepadan untuk mencari nilai tidak diketahui.",
        `${val("a")} + ${val("d")} = ${val("b")}`,
        "difference",
      );
    if (advanced) {
      check("stickers", "individualPupil", large);
      check("stickers", "individualPupil", small);
    }
    p.parameters = { smaller: small, difference: diff };
  }
  if (family === "change") {
    const start = pick("before", r(20, 55)),
      delta = pick("change", r(4, 18)),
      down = tier === 2 || tier === 4,
      after = start + (down ? -delta : delta),
      unit = tr("bibs", "bib"),
      unknown = tier === 3 ? "before" : "after";
    q("a", tr("Before", "Sebelum"), start, unknown !== "before", unit);
    q(
      "d",
      down ? tr("Removed", "Dikeluarkan") : tr("Added", "Ditambah"),
      delta,
      true,
      unit,
    );
    q("b", tr("After", "Selepas"), after, unknown !== "after", unit);
    p.relations = [
      {
        type: "change",
        beforeId: "a",
        changeId: "d",
        afterId: "b",
        direction: down ? "decrease" : "increase",
      },
    ];
    p.subtype = down ? "decrease" : "increase";
    p.prompt =
      unknown === "before"
        ? tr(
            `A school sports club bought ${delta} training bibs and now has ${after}. How many did it have before?`,
            `Kelab sukan sekolah membeli ${delta} bib latihan dan kini mempunyai ${after}. Berapakah bilangan bib sebelumnya?`,
          )
        : tr(
            `A school sports club has ${start} training bibs. It ${down ? "sets aside" : "buys"} ${delta}${down ? " damaged bibs" : " more"}. How many ${down ? "usable " : ""}bibs remain?`,
            `Kelab sukan sekolah mempunyai ${start} bib latihan. Kelab itu ${down ? "mengasingkan" : "membeli"} ${delta} ${down ? "bib rosak" : "bib lagi"}. Berapakah bilangan bib ${down ? "yang boleh digunakan" : "sekarang"}?`,
          );
    c(
      down ? "split" : "join",
      down
        ? "Detach the removed portion; keep the remainder."
        : "Attach the new portion to the original bar.",
      down
        ? "Pisahkan bahagian yang dikeluarkan; kekalkan baki."
        : "Sambungkan bahagian baharu kepada bar asal.",
      `${start} ${down ? "−" : "+"} ${delta} = ${after}`,
      "whole",
    );
    check("bibs", "schoolClub", start);
    check("bibs", "schoolClub", after);
    p.parameters = { before: start, change: delta };
  }
  if (family === "transfer") {
    const b = pick("second", r(15, 35)),
      move = pick("amount", r(3, 14)),
      a = pick("first", b + 2 * move),
      advanced = tier >= 4;
    q("a0", A + " " + tr("before", "sebelum"), a);
    q("b0", B + " " + tr("before", "sebelum"), b);
    q("m", tr("Transferred", "Dipindahkan"), move, !advanced);
    q("a1", A + " " + tr("after", "selepas"), a - move, false);
    q("b1", B + " " + tr("after", "selepas"), b + move, false);
    p.relations = [
      {
        type: "transfer",
        sourceBeforeId: "a0",
        targetBeforeId: "b0",
        amountId: "m",
        sourceAfterId: "a1",
        targetAfterId: "b1",
      },
    ];
    if (advanced)
      p.relations.push({ type: "equal", leftId: "a1", rightId: "b1" });
    if (advanced) p.targetQuantityIds = ["m"];
    p.subtype = advanced ? "makeEqual" : "after";
    p.prompt = tr(
      `${A} has ${a} cards and ${B} has ${b}. ${advanced ? `How many cards must ${A} give ${B} so they have equal numbers?` : `${A} gives ${move} cards to ${B}. How many does each have afterwards?`}`,
      `${A} mempunyai ${a} kad dan ${B} mempunyai ${b}. ${advanced ? `Berapakah kad yang perlu diberikan oleh ${A} kepada ${B} supaya bilangan mereka sama?` : `${A} memberikan ${move} kad kepada ${B}. Berapakah bilangan kad setiap orang selepas itu?`}`,
    );
    if (advanced)
      c(
        "exposeGap",
        "Half the difference must be transferred.",
        "Separuh daripada beza perlu dipindahkan.",
        `(${a} − ${b}) ÷ 2 = ${move}`,
        "total",
      );
    c(
      "transfer",
      "Move the same segment from one bar to the other.",
      "Pindahkan segmen yang sama daripada satu bar kepada bar yang lain.",
      `${a} − ${move} = ${a - move}; ${b} + ${move} = ${b + move}`,
      "total",
    );
    check("cards", "individualPupil", a);
    check("cards", "individualPupil", b + move);
    p.parameters = { first: a, second: b, amount: move };
  }
  if (family === "equalGroups" || family === "multiplicativeComparison") {
    const count = pick("groups", r(3, 8)),
      u = pick("unit", r(4, 12)),
      total = count * u,
      grouping = family === "equalGroups" && tier === 2,
      product = family === "multiplicativeComparison" || tier === 1,
      unit =
        family === "equalGroups"
          ? tr("worksheets", "lembaran")
          : tr("books", "buku");
    q(
      "u",
      family === "equalGroups"
        ? tr("One group", "Satu kumpulan")
        : tr("Shelf A", "Rak A"),
      u,
      product || grouping,
      unit,
    );
    q(
      "t",
      family === "equalGroups" ? tr("Total", "Jumlah") : tr("Shelf B", "Rak B"),
      total,
      !product,
      unit,
    );
    if (grouping) {
      q("n", tr("Groups", "Kumpulan"), count, false, tr("groups", "kumpulan"));
      p.relations = [
        { type: "scale", sourceId: "n", factor: rat(u), targetId: "t" },
      ];
    } else p.relations = [{ type: "repeat", unitId: "u", count, totalId: "t" }];
    p.subtype = grouping ? "grouping" : product ? "product" : "sharing";
    p.prompt =
      family === "multiplicativeComparison"
        ? tr(
            `Shelf A in the school library holds ${u} reference books. Shelf B holds ${count} times as many. How many books are on Shelf B?`,
            `Rak A di perpustakaan sekolah mempunyai ${u} buku rujukan. Rak B mempunyai ${count} kali bilangan itu. Berapakah bilangan buku di Rak B?`,
          )
        : grouping
          ? tr(
              `Cikgu ${A} has ${total} worksheets. Each group needs ${u}. How many groups can receive worksheets?`,
              `Cikgu ${A} mempunyai ${total} lembaran kerja. Setiap kumpulan memerlukan ${u}. Berapakah kumpulan yang boleh menerimanya?`,
            )
          : product
            ? tr(
                `Cikgu ${A} gives ${u} worksheets to each of ${count} groups. How many worksheets are needed?`,
                `Cikgu ${A} memberikan ${u} lembaran kerja kepada setiap ${count} kumpulan. Berapakah jumlah lembaran yang diperlukan?`,
              )
            : tr(
                `Cikgu ${A} shares ${total} worksheets equally among ${count} groups. How many does each group receive?`,
                `Cikgu ${A} membahagikan ${total} lembaran kerja sama rata kepada ${count} kumpulan. Berapakah yang diterima setiap kumpulan?`,
              );
    c(
      product ? "cloneUnit" : "partition",
      product
        ? "Repeat one equal group."
        : "Partition the total into equal groups.",
      product
        ? "Ulang satu kumpulan sama."
        : "Bahagikan jumlah kepada kumpulan sama.",
      product
        ? `${u} × ${count} = ${total}`
        : grouping
          ? `${total} ÷ ${u} = ${count}`
          : `${total} ÷ ${count} = ${u}`,
      "unitSize",
    );
    check(
      family === "equalGroups" ? "worksheets" : "books",
      family === "equalGroups" ? "teacher" : "library",
      total,
      family === "equalGroups" ? "shares" : "has",
      family === "equalGroups" ? count : undefined,
    );
    p.parameters = { groups: count, unit: u };
  }
  if (family === "fraction") {
    const den = pick("denominator", r(3, 8)),
      a = pick("numerator", r(1, den - 1)),
      u = pick("unit", r(8, 20)),
      whole = den * u,
      part = a * u,
      reverse = tier >= 4,
      unit = tr("pages", "halaman");
    if (a <= 0 || a >= den)
      throw Error("Use a fraction strictly between zero and one.");
    q("w", tr("Whole book", "Seluruh buku"), whole, !reverse, unit);
    q("p", tr("Pages read", "Halaman dibaca"), part, reverse, unit);
    q("u", tr("One equal part", "Satu bahagian sama"), u, false, unit);
    p.relations = [
      { type: "partition", wholeId: "w", numberOfParts: den, unitId: "u" },
      { type: "repeat", unitId: "u", count: a, totalId: "p" },
    ];
    p.subtype = reverse ? "wholeFromPart" : "partOfWhole";
    p.prompt = reverse
      ? tr(
          `${A} has read ${part} pages, which is ${a}/${den} of a book. How many pages does the book have?`,
          `${A} telah membaca ${part} halaman, iaitu ${a}/${den} daripada sebuah buku. Berapakah jumlah halaman buku itu?`,
        )
      : tr(
          `${A} reads ${a}/${den} of a ${whole}-page book. How many pages has ${A} read?`,
          `${A} membaca ${a}/${den} daripada buku yang mempunyai ${whole} halaman. Berapakah halaman yang telah dibaca?`,
        );
    p.targetQuantityIds = reverse ? ["w"] : ["p"];
    p.answer = Object.fromEntries(
      p.targetQuantityIds.map((id) => [id, values[id]]),
    );
    c(
      "partition",
      "Divide into equal denominator parts.",
      "Bahagikan kepada bahagian sama mengikut penyebut.",
      reverse ? `${part} ÷ ${a} = ${u}` : `${whole} ÷ ${den} = ${u}`,
      "whole",
    );
    c(
      "rebuild",
      "Combine the required equal parts.",
      "Gabungkan bahagian sama yang diperlukan.",
      reverse ? `${u} × ${den} = ${whole}` : `${u} × ${a} = ${part}`,
      "unitSize",
    );
    check("pages", "individualPupil", whole, "reads");
    p.parameters = { denominator: den, numerator: a, unit: u };
  }
  if (family === "percentage") {
    const percent = pick("percent", [10, 20, 25, 50][r(0, 3)]),
      original = pick("original", r(4, 15) * 1000),
      discount = (original * percent) / 100,
      after = original - discount,
      reverse = tier >= 4;
    if (!Number.isInteger(discount) || percent <= 0 || percent >= 100)
      throw Error("Use a valid percentage that produces whole sen.");
    q(
      "w",
      tr("Original price", "Harga asal"),
      original,
      !reverse,
      "sen",
      "money",
    );
    q("d", tr("Discount", "Diskaun"), discount, false, "sen", "money");
    q("p", tr("Price paid", "Harga dibayar"), after, reverse, "sen", "money");
    p.relations = [
      {
        type: "scale",
        sourceId: "w",
        factor: rat(percent, 100),
        targetId: "d",
      },
      { type: "compose", wholeId: "w", partIds: ["d", "p"] },
    ];
    p.targetQuantityIds = reverse ? ["w"] : ["p"];
    p.answer = Object.fromEntries(
      p.targetQuantityIds.map((id) => [id, values[id]]),
    );
    p.subtype = reverse ? "reverseDiscount" : "discount";
    p.prompt = reverse
      ? tr(
          `After a ${percent}% discount, a school bag costs ${val("p")}. What was its original price?`,
          `Selepas diskaun ${percent}%, harga beg sekolah ialah ${val("p")}. Berapakah harga asalnya?`,
        )
      : tr(
          `A school bag costs ${val("w")}. A shop gives a ${percent}% discount. What is the price after the discount?`,
          `Harga beg sekolah ialah ${val("w")}. Kedai memberikan diskaun ${percent}%. Berapakah harga selepas diskaun?`,
        );
    c(
      "partition",
      "Identify the discount and remaining percentage.",
      "Kenal pasti peratus diskaun dan peratus baki.",
      `100% − ${percent}% = ${100 - percent}%`,
      "whole",
    );
    c(
      "scale",
      reverse
        ? "Scale the known percentage back to the whole."
        : "Calculate the remaining percentage of the price.",
      reverse
        ? "Skalakan peratus diketahui kepada keseluruhan."
        : "Hitung peratus baki daripada harga.",
      reverse
        ? `${val("p")} ÷ ${100 - percent} × 100 = ${val("w")}`
        : `${val("w")} × ${100 - percent}/100 = ${val("p")}`,
      "ratio",
    );
    p.parameters = { percent, original };
  }
  if (family === "ratio") {
    const a = pick("firstUnits", r(2, 4)),
      b = pick("secondUnits", a + r(1, 4)),
      u = pick("unit", r(3, 9)),
      three = tier === 5,
      c3 = three ? pick("thirdUnits", r(2, 5)) : 0,
      unit = tr("bibs", "bib"),
      diff = tier === 4;
    q("a", tr("Red bibs", "Bib merah"), a * u, false, unit);
    q("b", tr("Blue bibs", "Bib biru"), b * u, false, unit);
    if (three) q("c", tr("Green bibs", "Bib hijau"), c3 * u, false, unit);
    const ids = three ? ["a", "b", "c"] : ["a", "b"];
    p.relations = [
      {
        type: "ratio",
        quantityIds: ids,
        unitCounts: three ? [a, b, c3] : [a, b],
      },
    ];
    if (diff) {
      q("d", tr("Difference", "Beza"), (b - a) * u, true, unit);
      p.relations.push({
        type: "compare",
        largerId: "b",
        smallerId: "a",
        differenceId: "d",
      });
    } else {
      q("t", tr("Total", "Jumlah"), (a + b + c3) * u, true, unit);
      p.relations.push({ type: "compose", wholeId: "t", partIds: ids });
    }
    p.subtype = diff ? "difference" : three ? "threeTerm" : "total";
    p.prompt = tr(
      `The ratio of red to blue${three ? " to green" : ""} training bibs in a school club is ${[a, b, ...(three ? [c3] : [])].join(":")}. ${diff ? `There are ${(b - a) * u} more blue bibs than red bibs.` : `There are ${(a + b + c3) * u} bibs altogether.`} How many of each colour are there?`,
      `Nisbah bib latihan merah kepada biru${three ? " kepada hijau" : ""} di sebuah kelab sekolah ialah ${[a, b, ...(three ? [c3] : [])].join(":")}. ${diff ? `Bib biru melebihi bib merah sebanyak ${(b - a) * u}.` : `Terdapat ${(a + b + c3) * u} bib kesemuanya.`} Berapakah bilangan setiap warna?`,
    );
    c(
      "partition",
      "Count equal ratio units.",
      "Kira unit nisbah yang sama.",
      diff
        ? `${b} − ${a} = ${b - a}`
        : `${a} + ${b}${three ? " + " + c3 : ""} = ${a + b + c3}`,
      "unitSize",
    );
    c(
      "unitise",
      "Find the value of one ratio unit.",
      "Cari nilai satu unit nisbah.",
      `${diff ? (b - a) * u : (a + b + c3) * u} ÷ ${diff ? b - a : a + b + c3} = ${u}`,
      "unitSize",
    );
    c(
      "rebuild",
      "Build every quantity from the common unit.",
      "Bina setiap kuantiti daripada unit yang sama.",
      ids.map((id, i) => `${[a, b, c3][i]} × ${u} = ${n(id)}`).join("; "),
      "ratio",
    );
    check("bibs", "schoolClub", (a + b + c3) * u);
    p.parameters = {
      firstUnits: a,
      secondUnits: b,
      ...(three ? { thirdUnits: c3 } : {}),
      unit: u,
    };
  }
  if (family === "rate") {
    const count = pick("knownCount", r(3, 6)),
      wanted = pick("wantedCount", r(7, 12)),
      price = pick("unitPrice", r(8, 30) * 20);
    q(
      "u",
      tr("Price per notebook", "Harga senaskhah"),
      price,
      false,
      "sen",
      "money",
    );
    q(
      "a",
      tr("Known cost", "Kos diketahui"),
      count * price,
      true,
      "sen",
      "money",
    );
    q(
      "b",
      tr("Requested cost", "Kos diminta"),
      wanted * price,
      false,
      "sen",
      "money",
    );
    p.relations = [
      { type: "repeat", unitId: "u", count, totalId: "a" },
      { type: "repeat", unitId: "u", count: wanted, totalId: "b" },
    ];
    p.targetQuantityIds = ["b"];
    p.answer = { b: values.b };
    p.subtype = "unitRate";
    p.prompt = tr(
      `${count} notebooks cost ${val("a")}. What will ${wanted} notebooks cost at the same rate?`,
      `${count} buku nota berharga ${val("a")}. Berapakah harga ${wanted} buku nota pada kadar yang sama?`,
    );
    c(
      "unitise",
      "Divide the cost and item count by the same factor.",
      "Bahagikan kos dan bilangan barang dengan faktor yang sama.",
      `${val("a")} ÷ ${count} = ${val("u")}`,
      "ratio",
    );
    c(
      "scale",
      "Scale the unit cost by the requested item count.",
      "Darab harga seunit dengan bilangan barang diminta.",
      `${val("u")} × ${wanted} = ${val("b")}`,
      "ratio",
    );
    p.parameters = { knownCount: count, wantedCount: wanted, unitPrice: price };
  }
  if (family === "average") {
    const mean = pick("mean", r(55, 82)),
      deviations = [-6, -2, 1, 4, 3],
      scores = pick(
        "scores",
        deviations.map((v) => mean + v),
      ),
      missing = tier >= 2,
      unit = tr("marks", "markah");
    scores.forEach((v, i) =>
      q(
        "s" + i,
        tr("Quiz", "Kuiz") + " " + (i + 1),
        v,
        !missing || i < 4,
        unit,
        "score",
      ),
    );
    q(
      "t",
      tr("Total marks", "Jumlah markah"),
      scores.reduce((a, b) => a + b, 0),
      false,
      unit,
      "continuous",
    );
    q("m", tr("Mean", "Purata"), mean, missing, unit, "score");
    p.relations = [
      { type: "compose", wholeId: "t", partIds: scores.map((_, i) => "s" + i) },
      { type: "repeat", unitId: "m", count: 5, totalId: "t" },
    ];
    p.targetQuantityIds = [missing ? "s4" : "m"];
    p.answer = Object.fromEntries(
      p.targetQuantityIds.map((id) => [id, values[id]]),
    );
    p.subtype = missing ? "missingValue" : "mean";
    p.prompt = missing
      ? tr(
          `${A}'s mean score for five quizzes is ${mean}. Four scores are ${scores.slice(0, 4).join(", ")}. What is the fifth score?`,
          `Purata markah lima kuiz ${A} ialah ${mean}. Empat markah ialah ${scores.slice(0, 4).join(", ")}. Berapakah markah kuiz kelima?`,
        )
      : tr(
          `${A} scores ${scores.join(", ")} in five quizzes. Find the mean score.`,
          `${A} mendapat ${scores.join(", ")} markah dalam lima kuiz. Cari purata markah.`,
        );
    c(
      "join",
      "Combine all values to establish the total.",
      "Gabungkan semua nilai untuk memperoleh jumlah.",
      missing
        ? `${mean} × 5 = ${mean * 5}`
        : `${scores.join(" + ")} = ${mean * 5}`,
      "total",
    );
    c(
      "partition",
      missing
        ? "Remove the four known scores from the total."
        : "Redistribute the total equally among five bars.",
      missing
        ? "Tolak empat markah diketahui daripada jumlah."
        : "Agihkan jumlah sama rata kepada lima bar.",
      missing
        ? `${mean * 5} − (${scores.slice(0, 4).join(" + ")}) = ${scores[4]}`
        : `${mean * 5} ÷ 5 = ${mean}`,
      "total",
    );
    p.parameters = { mean, scores };
  }
  if (family === "algebra") {
    const x = pick("answer", r(3, 12)),
      a = pick("coefficient", tier < 4 ? r(2, 5) : 4),
      b = pick("constant", r(2, 15)),
      rightA = tier >= 4 ? 3 : 0,
      brackets = tier === 3,
      half = tier === 2,
      left = half ? "x/2" : brackets ? `${a}(x+${b})` : `${a}x+${b}`,
      right = half
        ? String(x)
        : brackets
          ? String(a * (x + b))
          : rightA
            ? `${rightA}x+${(a - rightA) * x + b}`
            : String(a * x + b);
    const answer = half ? x * 2 : x;
    q(
      "x",
      tr("Cards in one set", "Kad dalam satu set"),
      answer,
      false,
      tr("cards", "kad"),
    );
    p.relations = [
      {
        type: "equal",
        left: parseExpression(left),
        right: parseExpression(right),
        variableId: "x",
      },
    ];
    p.subtype = half
      ? "fractionalCoefficient"
      : brackets
        ? "brackets"
        : rightA
          ? "bothSides"
          : "oneSide";
    p.equation = `${left} = ${right}`;
    p.prompt = half
      ? tr(
          `Half of a pack contains ${x} cards. How many cards are in the whole pack?`,
          `Separuh daripada satu pek mengandungi ${x} kad. Berapakah bilangan kad dalam seluruh pek?`,
        )
      : brackets
        ? tr(
            `${a} identical packs each contain one set of cards and ${b} extra cards. Together they contain ${a * (x + b)} cards. How many cards are in one set?`,
            `${a} pek yang sama masing-masing mengandungi satu set kad dan ${b} kad tambahan. Jumlahnya ${a * (x + b)} kad. Berapakah kad dalam satu set?`,
          )
        : rightA
          ? tr(
              `Pack A has ${a} equal sets and ${b} extra cards. Pack B has ${rightA} of the same sets and ${(a - rightA) * x + b} extra cards. Both packs contain the same total. How many cards are in one set?`,
              `Pek A mempunyai ${a} set sama dan ${b} kad tambahan. Pek B mempunyai ${rightA} set yang sama dan ${(a - rightA) * x + b} kad tambahan. Kedua-dua pek mempunyai jumlah yang sama. Berapakah kad dalam satu set?`,
            )
          : tr(
              `${A} has ${a} equal sets of cards and ${b} extra cards, making ${a * x + b} altogether. How many cards are in each set?`,
              `${A} mempunyai ${a} set kad sama dan ${b} kad tambahan, berjumlah ${a * x + b}. Berapakah kad dalam setiap set?`,
            );
    const l = linear(p.relations[0].left),
      rr = linear(p.relations[0].right);
    if (half)
      c(
        "cloneUnit",
        "Clone the known half and recombine the whole.",
        "Salin separuh yang diketahui dan gabungkan keseluruhan.",
        `${x} × 2 = ${answer}`,
        "equality",
      );
    else {
      if (brackets)
        c(
          "ungroup",
          "Divide both sides by the number of identical groups.",
          "Bahagikan kedua-dua belah dengan bilangan kumpulan yang sama.",
          `x + ${b} = ${x + b}`,
          "equality",
        );
      if (rightA)
        c(
          "cancelEqual",
          "Remove the same x-units from both sides.",
          "Keluarkan unit x yang sama daripada kedua-dua belah.",
          `${a - rightA}x + ${b} = ${(a - rightA) * x + b}`,
          "equality",
        );
      c(
        "cancelEqual",
        "Remove the same constant from both sides.",
        "Keluarkan pemalar yang sama daripada kedua-dua belah.",
        `${brackets ? "x" : num(sub(l.a, rr.a)) + "x"} = ${brackets ? x : num(sub(rr.b, l.b))}`,
        "equality",
      );
      c(
        "unitise",
        "Divide both sides by the remaining number of x-units.",
        "Bahagikan kedua-dua belah dengan bilangan unit x yang tinggal.",
        `x = ${answer}`,
        "equality",
      );
    }
    p.parameters = { answer: x, coefficient: a, constant: b };
  }
  if (tier === 5)
    p.prompt += tr(
      " Explain your model and check the answer using the original relationship.",
      " Terangkan model anda dan semak jawapan menggunakan hubungan asal.",
    );
  const solved = validateProblem(p);
  for (const id of p.targetQuantityIds)
    if (!eq(solved[id], p.answer[id]))
      throw Error("Generated answer does not match the independent solver.");
  const reasons = p.context.checks.flatMap((v) => contextQuality(v).reasons);
  if (reasons.length) throw Error(reasons.join(" "));
  p.quality = { accepted: true, reasons: [], verified: true };
  p.values = solved;
  p.answerText = p.targetQuantityIds
    .map(
      (id) =>
        `${p.quantities.find((q) => q.id === id).label}: ${display(solved[id], p.quantities.find((q) => q.id === id).unit)}`,
    )
    .join("; ");
  p.verification = p.relations
    .map((rel) => relationDescription(rel, p, solved))
    .join("; ");
  c(
    "verify",
    "Substitute the results into the original relationships.",
    "Gantikan hasil ke dalam hubungan asal.",
    p.verification,
    "equality",
  );
  p.hints = [
    tr(
      "Which quantities are known, and which are unknown?",
      "Kuantiti manakah diketahui dan tidak diketahui?",
    ),
    tr(
      "Choose the relationship before calculating.",
      "Pilih hubungan sebelum mengira.",
    ),
    tr(
      "Check what the whole, equal unit or difference represents.",
      "Semak maksud keseluruhan, unit sama atau beza.",
    ),
    tr(
      "Use the first mathematical action in Solve, then pause.",
      "Gunakan tindakan matematik pertama dalam Selesaikan, kemudian berhenti.",
    ),
  ];
  p.promptTokens = tokenise(p);
  return p;
}
export function tokenise(p) {
  let tokens = [{ text: p.prompt }];
  for (const q of p.quantities.filter((q) => q.known)) {
    const word = display(q.value, q.unit === "sen" ? "sen" : "");
    let done = false;
    tokens = tokens.flatMap((t) => {
      if (t.quantityId || done) return [t];
      let i = t.text.indexOf(word);
      while (
        i >= 0 &&
        ((i > 0 && /[0-9.]/.test(t.text[i - 1])) ||
          /[0-9.]/.test(t.text[i + word.length] || ""))
      )
        i = t.text.indexOf(word, i + 1);
      if (i < 0) return [t];
      done = true;
      return [
        { text: t.text.slice(0, i) },
        { text: word, quantityId: q.id },
        { text: t.text.slice(i + word.length) },
      ];
    });
  }
  return tokens
    .filter((t) => t.text)
    .map((t, i) => ({ id: "token" + i, ...t }));
}
export function relationDescription(r, p, values = null) {
  const v = (id) =>
    values
      ? display(values[id], p.quantities.find((q) => q.id === id).unit)
      : (p.quantities.find((q) => q.id === id)?.label ?? id);
  switch (r.type) {
    case "compose":
      return `${r.partIds.map(v).join(" + ")} = ${v(r.wholeId)}`;
    case "compare":
      return `${v(r.smallerId)} + ${v(r.differenceId)} = ${v(r.largerId)}`;
    case "change":
      return `${v(r.beforeId)} ${r.direction === "decrease" ? "−" : "+"} ${v(r.changeId)} = ${v(r.afterId)}`;
    case "repeat":
      return `${r.count} × ${v(r.unitId)} = ${v(r.totalId)}`;
    case "partition":
      return `${v(r.wholeId)} ÷ ${r.numberOfParts} = ${v(r.unitId)}`;
    case "scale":
      return `${v(r.sourceId)} × ${display(r.factor)} = ${v(r.targetId)}`;
    case "ratio":
      return (
        r.quantityIds.map(v).join(" : ") + " = " + r.unitCounts.join(" : ")
      );
    case "transfer":
      return `${v(r.sourceBeforeId)} + ${v(r.targetBeforeId)} = ${v(r.sourceAfterId)} + ${v(r.targetAfterId)}`;
    case "equal":
      if (r.leftId) return `${v(r.leftId)} = ${v(r.rightId)}`;
      if (values) {
        const l = linear(r.left),
          rr = linear(r.right),
          x = values[r.variableId];
        return `${display(add(mul(l.a, x), l.b))} = ${display(add(mul(rr.a, x), rr.b))}`;
      }
      return p.equation || "Left = right";
    default:
      return "";
  }
}
export function equationProblem(
  source,
  { language = "en", seed = "equation" } = {},
) {
  const tr = (en, bm) => (language === "bm" ? bm : en);
  const sides = source.split("=");
  if (sides.length !== 2)
    throw Error("Enter one equation with an equals sign.");
  const left = parseExpression(sides[0]),
    right = parseExpression(sides[1]),
    l = linear(left),
    r = linear(right);
  if (num(l.a) < 0 || num(r.a) < 0 || num(l.b) < 0 || num(r.b) < 0)
    throw Error("Negative bar sections need a number line or graph.");
  const p = {
    id: "equation-" + seed,
    schemaVersion: 1,
    family: "algebra",
    subtype: "custom",
    tier: 5,
    language,
    seed,
    equation: source,
    prompt:
      language === "bm"
        ? "Cari x. Terangkan operasi yang sama pada kedua-dua belah."
        : "Find x. Explain the same operation on both sides.",
    quantities: [
      {
        id: "x",
        label: "x",
        known: false,
        unit: "",
        kind: "continuous",
        value: null,
      },
    ],
    relations: [{ type: "equal", left, right, variableId: "x" }],
    targetQuantityIds: ["x"],
    context: { names: [], checks: [] },
    parameters: {},
  };
  p.values = validateProblem(p);
  if (num(p.values.x) <= 0)
    throw Error(
      "This bar model needs a positive solution. Use the Cartesian tool for other equations.",
    );
  p.answer = { x: p.values.x };
  p.answerText = "x = " + display(p.values.x);
  p.verification = relationDescription(p.relations[0], p, p.values);
  const commonX = BigInt(sub(l.a, r.a).n) <= 0n ? l.a : r.a,
    commonC = BigInt(sub(l.b, r.b).n) <= 0n ? l.b : r.b;
  const afterX = [
    { a: sub(l.a, commonX), b: l.b },
    { a: sub(r.a, commonX), b: r.b },
  ];
  const afterC = afterX.map((e) => ({ ...e, b: sub(e.b, commonC) }));
  const term = (e) =>
    [
      eq(e.a, 0) ? "" : eq(e.a, 1) ? "x" : display(e.a) + "x",
      eq(e.b, 0) ? "" : display(e.b),
    ]
      .filter(Boolean)
      .join(" + ") || "0";
  p.calculations = [];
  const push = (action, en, bm, equation) =>
    p.calculations.push({
      action,
      narration: language === "bm" ? bm : en,
      equation,
      invariant: "equality",
    });
  if (!eq(commonX, 0))
    push(
      "cancelEqual",
      "Remove the same x-units from both sides.",
      "Keluarkan unit x yang sama daripada kedua-dua belah.",
      afterX.map(term).join(" = "),
    );
  if (!eq(commonC, 0))
    push(
      "cancelEqual",
      "Remove the same constant from both sides.",
      "Keluarkan pemalar yang sama daripada kedua-dua belah.",
      afterC.map(term).join(" = "),
    );
  push(
    "unitise",
    "Divide both sides into equal x-units.",
    "Bahagikan kedua-dua belah kepada unit x sama.",
    p.answerText,
  );
  push(
    "verify",
    "Substitute into the original equation.",
    "Gantikan dalam persamaan asal.",
    p.verification,
  );
  p.hints = [
    tr("Identify x-units and constants.", "Kenal pasti unit x dan pemalar."),
    tr(
      "What is common to both sides?",
      "Apakah yang sama pada kedua-dua belah?",
    ),
    tr(
      "Remove equal quantities from both sides.",
      "Keluarkan kuantiti yang sama daripada kedua-dua belah.",
    ),
    tr(
      "Divide by the remaining coefficient.",
      "Bahagikan dengan pekali yang tinggal.",
    ),
  ];
  p.promptTokens = [{ id: "t0", text: p.prompt }];
  p.quality = { accepted: true, reasons: [], verified: true };
  return p;
}
