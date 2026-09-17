import { rat, num, money } from "./domain.js";
export const NAMES = [
  "Aiman",
  "Hakim",
  "Danish",
  "Faris",
  "Aina",
  "Alya",
  "Nurin",
  "Farah",
  "Mei Ling",
  "Jia Wei",
  "Xin Yi",
  "Hui Min",
  "Arjun",
  "Priya",
  "Kavitha",
  "Suresh",
  "Daniel",
  "Hannah",
  "Dayang",
];
export const ITEMS = {
  cards: {
    en: "cards",
    bm: "kad",
    actors: { individualPupil: [0, 250], schoolClub: [0, 500] },
    verbs: ["has", "gives", "receives"],
    discrete: true,
  },
  stickers: {
    en: "stickers",
    bm: "pelekat",
    actors: { individualPupil: [0, 250], schoolClub: [0, 500] },
    verbs: ["has", "gives", "receives"],
    discrete: true,
  },
  books: {
    en: "exercise books",
    bm: "buku latihan",
    actors: {
      individualPupil: [0, 30],
      schoolShop: [0, 1000],
      library: [0, 10000],
    },
    verbs: ["has", "sells", "buys"],
    discrete: true,
  },
  worksheets: {
    en: "worksheets",
    bm: "lembaran kerja",
    actors: { teacher: [0, 250], class: [0, 200] },
    verbs: ["has", "shares"],
    discrete: true,
  },
  umbrellas: {
    en: "umbrellas",
    bm: "payung",
    actors: {
      individualPupil: [0, 3],
      retailShop: [0, 1000],
      supplier: [0, 10000],
    },
    verbs: ["has", "sells", "delivers"],
    discrete: true,
  },
  bottles: {
    en: "bottles of water",
    bm: "botol air",
    actors: { individualPupil: [0, 6], retailShop: [0, 1000] },
    verbs: ["has", "packs"],
    discrete: true,
  },
  bibs: {
    en: "training bibs",
    bm: "bib latihan",
    actors: { sportsTeam: [0, 60], schoolClub: [0, 200] },
    verbs: ["has", "buys", "shares"],
    discrete: true,
  },
  pages: {
    en: "pages",
    bm: "halaman",
    actors: { individualPupil: [0, 400] },
    verbs: ["reads"],
    discrete: true,
  },
};
export function contextQuality({
  itemId,
  actorType,
  value,
  verb = "has",
  groups,
  moneyValue,
}) {
  const reasons = [];
  if (moneyValue !== undefined) {
    try {
      money(moneyValue);
    } catch (e) {
      reasons.push(e.message);
    }
  }
  if (itemId) {
    const item = ITEMS[itemId],
      range = item?.actors[actorType];
    if (!range) reasons.push("The item does not suit this actor.");
    else {
      let v;
      try {
        v = rat(value);
        if (num(v) < range[0] || num(v) > range[1])
          reasons.push("The quantity is outside the plausible range.");
        if (item.discrete && v.d !== "1") reasons.push("Use whole items.");
        if (groups && num(v) % groups !== 0)
          reasons.push(
            "The items cannot be shared equally without a remainder.",
          );
      } catch {
        reasons.push("Invalid quantity");
      }
      if (!item.verbs.includes(verb))
        reasons.push("The action does not suit the item.");
    }
  }
  return { accepted: !reasons.length, reasons };
}
