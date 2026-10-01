export interface FinancialInputs {
  price: number | null;
  epsTtm: number | null;
  estimatedEps: number | null;
  marketCap: number | null;
  totalDebt: number | null;
  cash: number | null;
  ebitda: number | null;
  ebit: number | null;
  netIncome: number | null;
  equity: number | null;
  nopat: number | null;
  investedCapital: number | null;
  operatingIncome: number | null;
  revenue: number | null;
  interestExpense: number | null;
  currentAssets: number | null;
  currentLiabilities: number | null;
}

// Denominadores no positivos no producen múltiplos comparables. Nunca se imputan ceros.
function ratio(numerator: number | null, denominator: number | null, percentage = false): number | null {
  if (numerator === null || denominator === null || !Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) return null;
  const value = numerator / denominator * (percentage ? 100 : 1);
  return Number.isFinite(value) ? value : null;
}

export function calculateRatios(input: FinancialInputs) {
  const ev = input.marketCap !== null && input.totalDebt !== null && input.cash !== null ? input.marketCap + input.totalDebt - input.cash : null;
  const netDebt = input.totalDebt !== null && input.cash !== null ? input.totalDebt - input.cash : null;
  return {
    peTrailing: ratio(input.price, input.epsTtm),
    peForward: ratio(input.price, input.estimatedEps),
    evEbitda: ratio(ev, input.ebitda),
    roePct: ratio(input.netIncome, input.equity, true),
    roicPct: ratio(input.nopat, input.investedCapital, true),
    operatingMarginPct: ratio(input.operatingIncome, input.revenue, true),
    netMarginPct: ratio(input.netIncome, input.revenue, true),
    debtEquity: ratio(input.totalDebt, input.equity),
    netDebtEbitda: ratio(netDebt, input.ebitda),
    interestCoverage: ratio(input.ebit, input.interestExpense),
    currentRatio: ratio(input.currentAssets, input.currentLiabilities)
  };
}
