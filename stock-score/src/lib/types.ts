export const INDEX_CODES = ["SP500", "NDX100"] as const;
export type IndexCode = (typeof INDEX_CODES)[number];

export const NUMERIC_FIELDS = [
  "price", "market_cap", "low_52w", "low_5y", "distance_52w_low_pct",
  "distance_5y_low_pct", "score_total", "score_quality", "score_growth",
  "score_valuation", "score_balance", "score_coverage", "eps_ttm",
  "estimated_eps_next_fy", "ebitda_ttm", "ebit_ttm", "total_debt", "gross_debt",
  "cash", "revenue_ttm", "net_income_ttm", "shareholder_equity", "nopat_ttm",
  "invested_capital", "interest_expense_ttm", "current_assets", "current_liabilities",
  "pe_trailing", "pe_forward", "ev_ebitda", "roe_pct", "roic_pct",
  "operating_margin_pct", "net_margin_pct", "debt_to_equity", "net_debt_ebitda",
  "interest_coverage", "current_ratio", "pe_5y_min", "pe_5y_percentile"
] as const;
export type NumericField = (typeof NUMERIC_FIELDS)[number];
export type ScoreState = "sin_puntuacion" | "precio_obsoleto" | "fundamentales_obsoletos" | "cobertura_insuficiente" | "pendiente_recalculo" | "vigente";

export type Stock = Record<NumericField, number | null> & {
  company_id: string;
  ticker: string;
  name: string;
  exchange: string | null;
  currency: string;
  sector: string | null;
  industry: string | null;
  company_type: string | null;
  score_eligible: boolean;
  index_codes: IndexCode[];
  last_membership_check: string | null;
  as_of_date: string | null;
  data_updated_at: string | null;
  market_data_date: string | null;
  fundamentals_date: string | null;
  estimates_date: string | null;
  data_quality: string | null;
  score_model_version: string | null;
  score_state: ScoreState;
};

export type DatasetStatus = "live" | "configuration_required" | "unavailable";
export interface ScreenerDataset {
  stocks: Stock[];
  status: DatasetStatus;
  retrievedAt: string;
  invalidRows: number;
  message: string | null;
}

export type SortKey = "score" | "roic" | "pe" | "low52" | "low5y" | "ticker";
export interface Filters {
  search: string;
  index: "all" | IndexCode;
  sector: string;
  minScore: string;
  minRoic: string;
  maxPe: string;
  maxLowDistance: string;
  onlyEligible: boolean;
  sort: SortKey;
}
