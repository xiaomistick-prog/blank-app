import type { Filters, Stock } from "./types";

export const DEFAULT_FILTERS: Filters = {
  search: "", index: "all", sector: "all", minScore: "", minRoic: "",
  maxPe: "", maxLowDistance: "", onlyEligible: true, sort: "score"
};

export function isPriceStale(stock: Pick<Stock, "market_data_date">, now: string): boolean {
  if (!stock.market_data_date) return true;
  const age = Date.parse(now) - Date.parse(`${stock.market_data_date.slice(0, 10)}T00:00:00Z`);
  return !Number.isFinite(age) || age > 7 * 86400000 || age < -86400000;
}

export function usableScore(stock: Stock, now: string): number | null {
  if (!stock.score_eligible || stock.score_state !== "vigente" || isPriceStale(stock, now) || stock.score_total === null || stock.score_total < 0 || stock.score_total > 100 || stock.score_coverage === null || stock.score_coverage < 0.8 || stock.score_coverage > 1) return null;
  const fundamentalsAge = stock.fundamentals_date ? Date.parse(now) - Date.parse(`${stock.fundamentals_date.slice(0, 10)}T00:00:00Z`) : NaN;
  if (!Number.isFinite(fundamentalsAge) || fundamentalsAge > 550 * 86400000 || fundamentalsAge < -86400000) return null;
  if (!stock.as_of_date || !Number.isFinite(Date.parse(stock.as_of_date)) || (stock.market_data_date !== null && stock.as_of_date.slice(0, 10) < stock.market_data_date.slice(0, 10))) return null;
  return stock.score_total;
}

function threshold(input: string): number | null {
  if (input.trim() === "") return null;
  const value = Number(input);
  return Number.isFinite(value) ? value : null;
}

function compareNullable(a: number | null, b: number | null, descending: boolean): number {
  if (a === null) return b === null ? 0 : 1;
  if (b === null) return -1;
  return descending ? b - a : a - b;
}

export function filterAndSort(stocks: readonly Stock[], filters: Filters, now: string, watchlist?: ReadonlySet<string>): Stock[] {
  const query = filters.search.trim().toLocaleLowerCase("es");
  const minScore = threshold(filters.minScore);
  const minRoic = threshold(filters.minRoic);
  const maxPe = threshold(filters.maxPe);
  const maxDistance = threshold(filters.maxLowDistance);
  return stocks.filter(stock => {
    if (watchlist && !watchlist.has(stock.company_id)) return false;
    if (query && !`${stock.ticker} ${stock.name}`.toLocaleLowerCase("es").includes(query)) return false;
    if (filters.index !== "all" && !stock.index_codes.includes(filters.index)) return false;
    if (filters.sector !== "all" && stock.sector !== filters.sector) return false;
    if (filters.onlyEligible && !stock.score_eligible) return false;
    const score = usableScore(stock, now);
    if (minScore !== null && (score === null || score < minScore)) return false;
    if (minRoic !== null && (stock.roic_pct === null || stock.roic_pct < minRoic)) return false;
    if (maxPe !== null && (stock.pe_trailing === null || stock.pe_trailing <= 0 || stock.pe_trailing > maxPe)) return false;
    if (maxDistance !== null && (stock.distance_52w_low_pct === null || stock.distance_52w_low_pct > maxDistance)) return false;
    return true;
  }).sort((a, b) => {
    let delta = 0;
    switch (filters.sort) {
      case "score": delta = compareNullable(usableScore(a, now), usableScore(b, now), true); break;
      case "roic": delta = compareNullable(a.roic_pct, b.roic_pct, true); break;
      case "pe": delta = compareNullable(a.pe_trailing !== null && a.pe_trailing > 0 ? a.pe_trailing : null, b.pe_trailing !== null && b.pe_trailing > 0 ? b.pe_trailing : null, false); break;
      case "low52": delta = compareNullable(a.distance_52w_low_pct, b.distance_52w_low_pct, false); break;
      case "low5y": delta = compareNullable(a.distance_5y_low_pct, b.distance_5y_low_pct, false); break;
      case "ticker": break;
    }
    return delta || a.ticker.localeCompare(b.ticker, "en", { numeric: true });
  });
}

export function activeFilterCount(filters: Filters): number {
  return [filters.index !== "all", filters.sector !== "all", filters.minScore !== "", filters.minRoic !== "", filters.maxPe !== "", filters.maxLowDistance !== "", filters.onlyEligible].filter(Boolean).length;
}
