const numbers = new Map<number, Intl.NumberFormat>();
const currencies = new Map<string, Intl.NumberFormat>();
const dates = new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });

export function number(value: number | null, digits = 1): string {
  if (value === null || !Number.isFinite(value)) return "—";
  let formatter = numbers.get(digits);
  if (!formatter) { formatter = new Intl.NumberFormat("es-ES", { minimumFractionDigits: digits, maximumFractionDigits: digits }); numbers.set(digits, formatter); }
  return formatter.format(value);
}

export function money(value: number | null, currency: string): string {
  if (value === null || !Number.isFinite(value)) return "—";
  const precision = value < 1 ? 4 : 2;
  const key = `${currency}:${precision}`;
  let formatter = currencies.get(key);
  if (!formatter) { formatter = new Intl.NumberFormat("es-ES", { style: "currency", currency, currencyDisplay: "symbol", maximumFractionDigits: precision }); currencies.set(key, formatter); }
  return formatter.format(value);
}

export function percent(value: number | null, digits = 1): string {
  return value === null ? "—" : `${number(value, digits)} %`;
}

export function multiple(value: number | null): string {
  return value === null ? "—" : `${number(value)}×`;
}

export function date(value: string | null): string {
  if (!value || !Number.isFinite(Date.parse(value))) return "Sin fecha";
  return dates.format(new Date(value));
}
