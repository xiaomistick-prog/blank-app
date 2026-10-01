import { INDEX_CODES, NUMERIC_FIELDS, type ScoreState, type Stock } from "./types";

const SCORE_STATES: ReadonlySet<string> = new Set(["sin_puntuacion", "precio_obsoleto", "fundamentales_obsoletos", "cobertura_insuficiente", "pendiente_recalculo", "vigente"]);
const TEXT_FIELDS = ["exchange", "sector", "industry", "company_type", "last_membership_check", "as_of_date", "data_updated_at", "market_data_date", "fundamentals_date", "estimates_date", "data_quality", "score_model_version"] as const;

export function finiteNumber(value: unknown): number | null {
  if (typeof value !== "number" && typeof value !== "string") return null;
  if (typeof value === "string" && value.trim() === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function normalizeStock(value: unknown): Stock | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  if (typeof row.company_id !== "string" || !row.company_id || typeof row.ticker !== "string" || !row.ticker || typeof row.name !== "string" || !row.name) return null;
  const numeric = Object.fromEntries(NUMERIC_FIELDS.map(key => [key, finiteNumber(row[key])])) as Pick<Stock, (typeof NUMERIC_FIELDS)[number]>;
  // El esquema heredado guarda estas dos distancias como fracciones, pese al sufijo _pct.
  // El contrato de la UI utiliza puntos porcentuales: 0,459 equivale a 45,9 %.
  for (const field of ["distance_52w_low_pct", "distance_5y_low_pct"] as const) {
    if (numeric[field] !== null) numeric[field] = finiteNumber(numeric[field] * 100);
  }
  for (const field of ["pe_trailing", "pe_forward"] as const) {
    if (numeric[field] !== null && numeric[field] <= 0) numeric[field] = null;
  }
  const denominators = {
    pe_trailing: "eps_ttm", pe_forward: "estimated_eps_next_fy", ev_ebitda: "ebitda_ttm",
    roe_pct: "shareholder_equity", roic_pct: "invested_capital", operating_margin_pct: "revenue_ttm",
    net_margin_pct: "revenue_ttm", debt_to_equity: "shareholder_equity", net_debt_ebitda: "ebitda_ttm",
    interest_coverage: "interest_expense_ttm", current_ratio: "current_liabilities"
  } as const;
  for (const [metric, denominator] of Object.entries(denominators) as [keyof typeof denominators, (typeof denominators)[keyof typeof denominators]][]) {
    if (numeric[denominator] !== null && numeric[denominator] <= 0) numeric[metric] = null;
  }
  const strings = Object.fromEntries(TEXT_FIELDS.map(key => [key, typeof row[key] === "string" ? row[key] : null])) as Pick<Stock, (typeof TEXT_FIELDS)[number]>;
  return {
    ...numeric, ...strings,
    company_id: row.company_id,
    ticker: row.ticker,
    name: row.name,
    currency: typeof row.currency === "string" && /^[A-Z]{3}$/.test(row.currency) ? row.currency : "XXX",
    score_eligible: row.score_eligible === true,
    index_codes: Array.isArray(row.index_codes) ? row.index_codes.filter((code): code is (typeof INDEX_CODES)[number] => INDEX_CODES.some(valid => valid === code)) : [],
    score_state: typeof row.score_state === "string" && SCORE_STATES.has(row.score_state) ? row.score_state as ScoreState : "sin_puntuacion"
  };
}
