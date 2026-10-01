import test from "node:test";
import assert from "node:assert/strict";
import { calculateRatios, type FinancialInputs } from "../src/lib/finance";

const inputs: FinancialInputs = { price: 120, epsTtm: 6, estimatedEps: 8, marketCap: 1200, totalDebt: 400, cash: 100, ebitda: 150, ebit: 120, netIncome: 80, equity: 400, nopat: 90, investedCapital: 600, operatingIncome: 120, revenue: 800, interestExpense: 20, currentAssets: 250, currentLiabilities: 125 };

test("las once fórmulas respetan los múltiplos y las unidades porcentuales", () => {
  assert.deepEqual(calculateRatios(inputs), { peTrailing: 20, peForward: 15, evEbitda: 10, roePct: 20, roicPct: 15, operatingMarginPct: 15, netMarginPct: 10, debtEquity: 1, netDebtEbitda: 2, interestCoverage: 6, currentRatio: 2 });
});

test("EPS, patrimonio y gastos no positivos no generan ratios comparables", () => {
  const result = calculateRatios({ ...inputs, epsTtm: -6, estimatedEps: 0, equity: -400, ebitda: 0, interestExpense: 0, currentLiabilities: 0 });
  for (const key of ["peTrailing", "peForward", "roePct", "debtEquity", "evEbitda", "netDebtEbitda", "interestCoverage", "currentRatio"] as const) assert.equal(result[key], null);
});

test("una deuda desconocida no se convierte en deuda cero", () => {
  const result = calculateRatios({ ...inputs, totalDebt: null });
  assert.equal(result.evEbitda, null);
  assert.equal(result.netDebtEbitda, null);
  assert.equal(result.debtEquity, null);
});

test("mantiene efectivo neto, pérdidas y NOPAT negativo", () => {
  const result = calculateRatios({ ...inputs, cash: 700, netIncome: -80, nopat: -90 });
  assert.equal(result.netDebtEbitda, -2);
  assert.equal(result.roePct, -20);
  assert.equal(result.netMarginPct, -10);
  assert.equal(result.roicPct, -15);
});
