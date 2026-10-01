export type DailyBar = {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type PriceMetrics = {
  date: string;
  price: number;
  historyStart: string;
  low52w: number | null;
  high52w: number | null;
  low5y: number | null;
  distance52w: number | null;
  distance5y: number | null;
  return52w: number | null;
  return3y: number | null;
  return5y: number | null;
};

type RawBar = { t?: unknown; o?: unknown; h?: unknown; l?: unknown; c?: unknown; v?: unknown };
type RawPage = { bars?: Record<string, RawBar[]>; next_page_token?: string | null };
type Fetcher = typeof fetch;

const endpoint = "https://data.alpaca.markets/v2/stocks/bars";
const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function parseBar(raw: RawBar): DailyBar {
  const date = typeof raw.t === "string" ? raw.t.slice(0, 10) : "";
  const values = [raw.o, raw.h, raw.l, raw.c, raw.v].map(Number);
  const [open, high, low, close, volume] = values;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || values.some((x) => !Number.isFinite(x)) ||
      open === undefined || high === undefined || low === undefined || close === undefined || volume === undefined ||
      open <= 0 || low <= 0 || close <= 0 || low > high || open < low || open > high ||
      close < low || close > high || !Number.isSafeInteger(volume) || volume < 0) {
    throw new Error("Alpaca devolvió una barra diaria inválida");
  }
  return { date, open, high, low, close, volume };
}

async function requestPage(url: URL, headers: HeadersInit, fetcher: Fetcher, sleep: (ms: number) => Promise<void>): Promise<RawPage> {
  for (let attempt = 0; attempt < 3; attempt++) {
    let response: Response;
    try {
      response = await fetcher(url.toString(), { headers, signal: AbortSignal.timeout(10000) });
    } catch {
      if (attempt === 2) throw new Error("Alpaca no respondió tras tres intentos");
      await sleep(250 * 2 ** attempt);
      continue;
    }
    if (response.ok) {
      const body: unknown = await response.json();
      if (!body || typeof body !== "object" || !Object.hasOwn(body, "bars") ||
          !((body as RawPage).bars && typeof (body as RawPage).bars === "object") ||
          Array.isArray((body as RawPage).bars) ||
          ((body as RawPage).next_page_token != null && typeof (body as RawPage).next_page_token !== "string")) {
        throw new Error("Respuesta incompleta de Alpaca");
      }
      return body as RawPage;
    }
    if (response.status !== 429 && response.status < 500) throw new Error(`Alpaca HTTP ${response.status}`);
    const header = response.headers.get("Retry-After");
    const seconds = header === null ? NaN : Number(header);
    const dateDelay = header !== null && Number.isNaN(seconds) ? Date.parse(header) - Date.now() : NaN;
    const delay = Number.isFinite(seconds) && seconds >= 0 ? seconds * 1000 :
      Number.isFinite(dateDelay) && dateDelay > 0 ? dateDelay : 250 * 2 ** attempt;
    if (attempt === 2 || delay > 4000) throw new Error(`Alpaca HTTP ${response.status}; reintento diferido`);
    await sleep(delay);
  }
  throw new Error("Alpaca agotó los reintentos");
}

export async function fetchDailyBarsBatch(
  symbols: string[], start: string, end: string, credentials: { key: string; secret: string },
  fetcher: Fetcher = fetch, sleep: (ms: number) => Promise<void> = wait
): Promise<Map<string, DailyBar[]>> {
  const unique = [...new Set(symbols.map((s) => s.toUpperCase()))];
  if (!unique.length || unique.length > 25 || unique.some((s) => !/^[A-Z0-9.\^-]+$/.test(s))) throw new Error("Lote de símbolos inválido");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end) || start >= end) throw new Error("Ventana de mercado inválida");
  if (!credentials.key || !credentials.secret) throw new Error("Faltan credenciales de Alpaca");
  const headers = { "APCA-API-KEY-ID": credentials.key, "APCA-API-SECRET-KEY": credentials.secret };
  const result = new Map(unique.map((s) => [s, new Map<string, DailyBar>()]));
  const seenTokens = new Set<string>();
  let token: string | null = null;
  for (let pageNumber = 0; pageNumber < 100; pageNumber++) {
    const url = new URL(endpoint);
    url.searchParams.set("symbols", unique.join(","));
    url.searchParams.set("timeframe", "1Day");
    url.searchParams.set("start", start);
    url.searchParams.set("end", end); // exclusivo: evita una barra diaria aún abierta
    url.searchParams.set("adjustment", "split");
    url.searchParams.set("feed", "iex");
    url.searchParams.set("limit", "10000");
    if (token) url.searchParams.set("page_token", token);
    const body = await requestPage(url, headers, fetcher, sleep);
    for (const [symbol, rawBars] of Object.entries(body.bars ?? {})) {
      const destination = result.get(symbol);
      if (!destination || !Array.isArray(rawBars)) throw new Error("Alpaca devolvió símbolos o barras inesperados");
      for (const raw of rawBars) {
        const bar = parseBar(raw);
        if (bar.date < start || bar.date >= end) throw new Error("Alpaca devolvió una sesión fuera del intervalo");
        destination.set(bar.date, bar);
      }
    }
    token = body.next_page_token ?? null;
    if (!token) return new Map([...result].map(([symbol, bars]) => [symbol, [...bars.values()].sort((a, b) => a.date.localeCompare(b.date))]));
    if (seenTokens.has(token)) throw new Error("Alpaca repitió el token de paginación");
    seenTokens.add(token);
  }
  throw new Error("Alpaca superó el límite de páginas del lote");
}

function yearsBefore(date: string, years: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCFullYear(d.getUTCFullYear() - years);
  return d.toISOString().slice(0, 10);
}

function enoughHistory(first: string, target: string): boolean {
  return new Date(first).getTime() <= new Date(target).getTime() + 14 * 86400000;
}

function historicalReturn(bars: DailyBar[], last: DailyBar, years: number): number | null {
  const target = yearsBefore(last.date, years);
  const past = bars.filter((b) => b.date <= target).at(-1);
  if (!past || new Date(target).getTime() - new Date(past.date).getTime() > 14 * 86400000) return null;
  return last.close / past.close - 1;
}

export function derivePriceMetrics(bars: DailyBar[]): PriceMetrics | null {
  if (!bars.length) return null;
  const ordered = [...bars].sort((a, b) => a.date.localeCompare(b.date));
  const last = ordered.at(-1)!;
  const year = yearsBefore(last.date, 1), fiveYears = yearsBefore(last.date, 5);
  const oneYearBars = ordered.filter((bar) => bar.date >= year);
  const fiveYearBars = ordered.filter((bar) => bar.date >= fiveYears);
  const validYear = enoughHistory(ordered[0]!.date, year);
  const validFiveYears = enoughHistory(ordered[0]!.date, fiveYears);
  const low52w = validYear ? Math.min(...oneYearBars.map((b) => b.low)) : null;
  const high52w = validYear ? Math.max(...oneYearBars.map((b) => b.high)) : null;
  const low5y = validFiveYears ? Math.min(...fiveYearBars.map((b) => b.low)) : null;
  return {
    date: last.date, price: last.close, historyStart: ordered[0]!.date,
    low52w, high52w, low5y,
    distance52w: low52w === null ? null : last.close / low52w - 1,
    distance5y: low5y === null ? null : last.close / low5y - 1,
    return52w: historicalReturn(ordered, last, 1),
    return3y: historicalReturn(ordered, last, 3),
    return5y: historicalReturn(ordered, last, 5)
  };
}
