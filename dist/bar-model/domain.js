// Exact, JSON-safe rational arithmetic. Money is expressed in integer sen.
const gcd = (a, b) => {
  a = a < 0n ? -a : a;
  while (b) {
    [a, b] = [b, a % b];
  }
  return a || 1n;
};
export function rat(n, d = 1) {
  if (n && typeof n === "object") return rat(n.n, n.d);
  if (typeof n === "string" && n.includes("/")) {
    const [a, b] = n.split("/");
    return rat(a, b);
  }
  if (typeof n === "string" && n.includes(".")) {
    if (!/^-?\d+\.\d+$/.test(n)) throw Error("Invalid number");
    const places = n.split(".")[1].length;
    return rat(BigInt(n.replace(".", "")), 10n ** BigInt(places));
  }
  n = BigInt(n);
  d = BigInt(d);
  if (!d) throw Error("Division by zero");
  if (d < 0n) {
    n = -n;
    d = -d;
  }
  const g = gcd(n, d);
  return { n: String(n / g), d: String(d / g) };
}
export const add = (a, b) => {
  a = rat(a);
  b = rat(b);
  return rat(
    BigInt(a.n) * BigInt(b.d) + BigInt(b.n) * BigInt(a.d),
    BigInt(a.d) * BigInt(b.d),
  );
};
export const neg = (a) => rat(-BigInt(rat(a).n), rat(a).d),
  sub = (a, b) => add(a, neg(b)),
  mul = (a, b) => {
    a = rat(a);
    b = rat(b);
    return rat(BigInt(a.n) * BigInt(b.n), BigInt(a.d) * BigInt(b.d));
  },
  div = (a, b) => {
    b = rat(b);
    return mul(a, rat(b.d, b.n));
  },
  eq = (a, b) => {
    a = rat(a);
    b = rat(b);
    return a.n === b.n && a.d === b.d;
  },
  num = (a) => {
    a = rat(a);
    return Number(a.n) / Number(a.d);
  },
  fmt = (a) => {
    a = rat(a);
    return a.d === "1" ? a.n : `${a.n}/${a.d}`;
  };
export function money(source) {
  if (!/^\d+(\.\d{1,2})?$/.test(source))
    throw Error("Money requires at most two decimal places");
  const value = mul(rat(source), 100);
  if (value.d !== "1") throw Error("Use whole sen");
  return value;
}
export function display(value, unit = "") {
  const v = rat(value);
  if (unit === "sen") {
    if (v.d !== "1") throw Error("Money requires whole sen");
    const n = BigInt(v.n),
      sign = n < 0n ? "-" : "",
      a = n < 0n ? -n : n;
    return `${sign}RM${a / 100n}.${String(a % 100n).padStart(2, "0")}`;
  }
  return fmt(v) + (unit ? " " + unit : "");
}
export function parseExpression(source) {
  if (source.length > 150)
    throw Error("Keep the equation within 150 characters");
  const tokens =
    source
      .replaceAll("×", "*")
      .replaceAll("÷", "/")
      .replaceAll("−", "-")
      .match(/\d+(?:\.\d+)?|x|[()+*/-]/g) || [];
  if (
    tokens.join("") !==
    source
      .replace(/\s/g, "")
      .replaceAll("×", "*")
      .replaceAll("÷", "/")
      .replaceAll("−", "-")
  )
    throw Error("Use numbers, x, brackets and arithmetic signs.");
  let i = 0;
  const atom = () => {
    const t = tokens[i++];
    if (t === "-")
      return {
        type: "multiply",
        factors: [{ type: "number", value: rat(-1) }, atom()],
      };
    if (t === "(") {
      const e = sum();
      if (tokens[i++] !== ")") throw Error("Close the bracket");
      return e;
    }
    if (t === "x") return { type: "variable", name: "x" };
    if (t && /^\d/.test(t)) return { type: "number", value: rat(t) };
    throw Error("Incomplete expression");
  };
  const product = () => {
    let a = atom();
    while (
      i < tokens.length &&
      (["*", "/", "(", "x"].includes(tokens[i]) || /^\d/.test(tokens[i]))
    ) {
      const op = tokens[i];
      if (["*", "/"].includes(op)) i++;
      const b = atom();
      a =
        op === "/"
          ? { type: "divide", numerator: a, denominator: b }
          : { type: "multiply", factors: [a, b] };
    }
    return a;
  };
  const sum = () => {
    let a = product();
    while (["+", "-"].includes(tokens[i])) {
      const op = tokens[i++],
        b = product();
      a =
        op === "+"
          ? { type: "add", terms: [a, b] }
          : { type: "subtract", left: a, right: b };
    }
    return a;
  };
  const result = sum();
  if (i !== tokens.length) throw Error("Unexpected expression");
  return result;
}
export function linear(ast) {
  if (ast.type === "number") return { a: rat(0), b: ast.value };
  if (ast.type === "variable") return { a: rat(1), b: rat(0) };
  if (ast.type === "add")
    return ast.terms
      .map(linear)
      .reduce((x, y) => ({ a: add(x.a, y.a), b: add(x.b, y.b) }));
  if (ast.type === "subtract") {
    const x = linear(ast.left),
      y = linear(ast.right);
    return { a: sub(x.a, y.a), b: sub(x.b, y.b) };
  }
  if (ast.type === "multiply") {
    return ast.factors.map(linear).reduce((x, y) => {
      if (!eq(x.a, 0) && !eq(y.a, 0))
        throw Error("Use a graph or an area model for nonlinear expressions.");
      return { a: add(mul(x.a, y.b), mul(y.a, x.b)), b: mul(x.b, y.b) };
    });
  }
  if (ast.type === "divide") {
    const x = linear(ast.numerator),
      y = linear(ast.denominator);
    if (!eq(y.a, 0))
      throw Error("A variable denominator needs another representation.");
    return { a: div(x.a, y.b), b: div(x.b, y.b) };
  }
  throw Error("Unknown expression");
}
export const expressionText = (e) => {
  const { a, b } = linear(e);
  return (
    `${eq(a, 0) ? "" : eq(a, 1) ? "x" : fmt(a) + "x"}${eq(b, 0) ? "" : (num(b) > 0 && !eq(a, 0) ? " + " : "") + fmt(b)}` ||
    "0"
  );
};
export function relationRows(r) {
  const row = (terms, total = 0) => ({
    terms: terms.reduce((out, [id, c]) => {
      out[id] = add(out[id] || 0, c);
      return out;
    }, {}),
    total: rat(total),
  });
  switch (r.type) {
    case "compose":
      return [row([[r.wholeId, 1], ...r.partIds.map((id) => [id, -1])])];
    case "compare":
      return [
        row([
          [r.largerId, 1],
          [r.smallerId, -1],
          [r.differenceId, -1],
        ]),
      ];
    case "change":
      return [
        row([
          [r.afterId, 1],
          [r.beforeId, -1],
          [r.changeId, r.direction === "decrease" ? 1 : -1],
        ]),
      ];
    case "repeat":
      return [
        row([
          [r.totalId, 1],
          [r.unitId, neg(r.count)],
        ]),
      ];
    case "scale":
      return [
        row([
          [r.targetId, 1],
          [r.sourceId, neg(r.factor)],
        ]),
      ];
    case "partition":
      return [
        row([
          [r.wholeId, 1],
          [r.unitId, -r.numberOfParts],
        ]),
      ];
    case "ratio":
      return r.quantityIds.slice(1).map((id, i) =>
        row([
          [r.quantityIds[0], r.unitCounts[i + 1]],
          [id, -r.unitCounts[0]],
        ]),
      );
    case "transfer":
      return [
        row([
          [r.sourceAfterId, 1],
          [r.sourceBeforeId, -1],
          [r.amountId, 1],
        ]),
        row([
          [r.targetAfterId, 1],
          [r.targetBeforeId, -1],
          [r.amountId, -1],
        ]),
      ];
    case "equal": {
      if (r.leftId)
        return [
          row([
            [r.leftId, 1],
            [r.rightId, -1],
          ]),
        ];
      const l = linear(r.left),
        q = linear(r.right);
      return [row([[r.variableId, sub(l.a, q.a)]], sub(q.b, l.b))];
    }
    default:
      throw Error("Unknown relation");
  }
}
export function rref(rows, ids) {
  const matrix = rows.map((r) =>
    ids.map((id) => r.terms[id] || rat(0)).concat(r.total),
  );
  let lead = 0;
  for (let col = 0; col < ids.length && lead < matrix.length; col++) {
    const found = matrix.findIndex((r, i) => i >= lead && !eq(r[col], 0));
    if (found < 0) continue;
    [matrix[lead], matrix[found]] = [matrix[found], matrix[lead]];
    const pivot = matrix[lead][col];
    matrix[lead] = matrix[lead].map((n) => div(n, pivot));
    for (let i = 0; i < matrix.length; i++)
      if (i !== lead && !eq(matrix[i][col], 0)) {
        const f = matrix[i][col];
        matrix[i] = matrix[i].map((n, j) => sub(n, mul(f, matrix[lead][j])));
      }
    lead++;
  }
  if (
    matrix.some(
      (r) => r.slice(0, -1).every((n) => eq(n, 0)) && !eq(r.at(-1), 0),
    )
  )
    throw Error("The relationships contradict one another.");
  return matrix.filter((r) => r.some((n) => !eq(n, 0)));
}
export function solve(problem) {
  const ids = problem.quantities.map((q) => q.id);
  const rows = problem.relations.flatMap(relationRows);
  for (const q of problem.quantities)
    if (q.known) rows.push({ terms: { [q.id]: rat(1) }, total: rat(q.value) });
  const m = rref(rows, ids),
    values = {};
  for (const r of m) {
    const i = r.slice(0, -1).findIndex((n) => !eq(n, 0));
    if (i >= 0 && r.slice(0, -1).filter((n) => !eq(n, 0)).length === 1)
      values[ids[i]] = r.at(-1);
  }
  for (const id of problem.targetQuantityIds)
    if (!values[id])
      throw Error("More information is needed to determine the unknown.");
  return values;
}
export function validateProblem(p) {
  const ids = new Set(p.quantities.map((q) => q.id));
  if (ids.size !== p.quantities.length) throw Error("Duplicate quantity");
  for (const r of p.relations) {
    const rows = relationRows(r);
    for (const row of rows) {
      for (const id of Object.keys(row.terms))
        if (!ids.has(id)) throw Error("Unknown quantity");
      if (!["equal", "scale"].includes(r.type)) {
        const units = new Set(
          Object.keys(row.terms).map(
            (id) => p.quantities.find((q) => q.id === id).unit,
          ),
        );
        if (units.size > 1) throw Error("Incompatible units");
      }
    }
  }
  const values = solve(p);
  for (const q of p.quantities) {
    const v = values[q.id];
    if (v && num(v) < 0)
      throw Error("Negative physical quantities are not valid");
    if (v && ["discrete", "money", "score"].includes(q.kind) && v.d !== "1")
      throw Error("This quantity must be a whole item or whole sen.");
    if (q.kind === "score" && v && num(v) > 100)
      throw Error("A quiz score cannot exceed 100.");
  }
  return values;
}
export function equivalentRelations(expected, actual, quantities) {
  try {
    const ids = quantities.map((q) => q.id);
    return (
      JSON.stringify(rref(expected.flatMap(relationRows), ids)) ===
      JSON.stringify(rref(actual.flatMap(relationRows), ids))
    );
  } catch {
    return false;
  }
}
export function verifyAnswer(p, answer) {
  const solved = solve(p);
  return p.targetQuantityIds.every((id) => {
    try {
      return eq(solved[id], answer[id]);
    } catch {
      return false;
    }
  });
}
