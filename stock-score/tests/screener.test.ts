import test from "node:test";
import assert from "node:assert/strict";
import { finiteNumber, normalizeStock } from "../src/lib/normalize";
import { DEFAULT_FILTERS, filterAndSort, usableScore } from "../src/lib/screener";
import { decodeWatchlist } from "../src/lib/watchlist";
import type { Stock } from "../src/lib/types";

const NOW = "2026-09-30T12:00:00Z";
function stock(id: string, extra: Record<string, unknown> = {}): Stock {
  const result = normalizeStock({ company_id: id, ticker: id, name: `Company ${id}`, currency: "USD", score_eligible: true, market_data_date: "2026-09-29", fundamentals_date: "2026-06-30", as_of_date: "2026-09-29", score_state: "vigente", score_total: 80, score_coverage: 0.9, index_codes: [], ...extra });
  assert.ok(result);
  return result;
}

test("normaliza números PostgreSQL sin confundir NULL, vacío y cero", () => {
  assert.equal(finiteNumber("329.6800000000"), 329.68);
  assert.equal(finiteNumber(null), null);
  assert.equal(finiteNumber(""), null);
  assert.equal(finiteNumber(false), null);
  assert.equal(finiteNumber("NaN"), null);
  assert.equal(finiteNumber(Infinity), null);
  assert.equal(finiteNumber(0), 0);
  assert.equal(normalizeStock({ ticker: "AAPL" }), null);
});

test("convierte distancias heredadas a porcentajes sin multiplicar el ROIC ya convertido", () => {
  const apple = stock("AAPL", { distance_52w_low_pct: "0.4590515811", distance_5y_low_pct: "1.6550696626", roic_pct: "15.5", pe_trailing: -5 });
  assert.ok(Math.abs(apple.distance_52w_low_pct! - 45.90515811) < 1e-8);
  assert.ok(Math.abs(apple.distance_5y_low_pct! - 165.50696626) < 1e-8);
  assert.equal(apple.roic_pct, 15.5);
  assert.equal(apple.pe_trailing, null);
});

test("descarta índices desconocidos y no deduce pertenencia por ticker", () => {
  assert.deepEqual(stock("AAPL", { index_codes: ["SP500", "inventado", "NDX100"] }).index_codes, ["SP500", "NDX100"]);
  assert.equal(filterAndSort([stock("AAPL")], { ...DEFAULT_FILTERS, index: "SP500" }, NOW).length, 0);
});

test("oculta scores antiguos, inválidos, incompletos o pendientes de recalcular", () => {
  assert.equal(usableScore(stock("A"), NOW), 80);
  for (const extra of [{ market_data_date: "2026-09-01" }, { fundamentals_date: null }, { fundamentals_date: "invalid" }, { fundamentals_date: "2024-01-01" }, { score_coverage: 0.79 }, { score_eligible: false }, { score_state: "pendiente_recalculo" }, { score_total: 101 }, { as_of_date: "2026-09-20" }]) assert.equal(usableScore(stock("A", extra), NOW), null);
});

test("los filtros numéricos excluyen ausentes y usan puntos porcentuales", () => {
  const rows = [stock("A", { roic_pct: 20, pe_trailing: 18, distance_52w_low_pct: 0.09 }), stock("B", { roic_pct: null, pe_trailing: null, distance_52w_low_pct: null }), stock("C", { roic_pct: 12, pe_trailing: 25, distance_52w_low_pct: 0.15 })];
  assert.deepEqual(filterAndSort(rows, { ...DEFAULT_FILTERS, minRoic: "15", maxPe: "20", maxLowDistance: "10" }, NOW).map(value => value.ticker), ["A"]);
  assert.equal(filterAndSort([stock("OLD", { market_data_date: "2026-09-01" })], { ...DEFAULT_FILTERS, minScore: "1" }, NOW).length, 0);
});

test("ordena NULL al final, resuelve empates y limita a la lista guardada", () => {
  const rows = [stock("ZZ", { pe_trailing: null }), stock("C", { pe_trailing: 20 }), stock("A", { pe_trailing: 10 }), stock("B", { pe_trailing: 10 })];
  assert.deepEqual(filterAndSort(rows, { ...DEFAULT_FILTERS, sort: "pe" }, NOW).map(value => value.ticker), ["A", "B", "C", "ZZ"]);
  assert.deepEqual(filterAndSort(rows, { ...DEFAULT_FILTERS, search: "company b" }, NOW, new Set(["A", "B"])).map(value => value.ticker), ["B"]);
  assert.deepEqual(rows.map(value => value.ticker), ["ZZ", "C", "A", "B"]);
});

test("lista versionada resistente a JSON corrupto, duplicados y valores inesperados", () => {
  assert.deepEqual(decodeWatchlist("{broken"), []);
  assert.deepEqual(decodeWatchlist(JSON.stringify({ version: 2, companyIds: ["A"] })), []);
  assert.deepEqual(decodeWatchlist(JSON.stringify({ version: 1, companyIds: ["A", "A", 42, "<script>", "B"] })), ["A", "B"]);
});
