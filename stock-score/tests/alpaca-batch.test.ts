import assert from "node:assert/strict";
import test from "node:test";
import { derivePriceMetrics, fetchDailyBarsBatch, type DailyBar } from "../supabase/functions/_shared/alpaca";

const creds = { key: "test-key", secret: "test-secret" };
const bar = (date: string, close: number) => ({ t: `${date}T04:00:00Z`, o: close, h: close + 1, l: close - 1, c: close, v: 1200 });
const from = "2026-09-29", to = "2026-10-01";

test("Alpaca multi-symbol pagination follows every token, even when a page has only one ticker", async () => {
  const requests: URL[] = [];
  const pages = [
    { bars: { AAPL: [bar("2026-09-29", 329)] }, next_page_token: "next" },
    { bars: { AAPL: [bar("2026-09-30", 333)], MSFT: [bar("2026-09-30", 512)] }, next_page_token: null }
  ];
  const fetcher = (async (input: string | URL | Request) => {
    requests.push(new URL(String(input)));
    return Response.json(pages.shift());
  }) as typeof fetch;
  const result = await fetchDailyBarsBatch(["aapl", "MSFT"], from, to, creds, fetcher);
  assert.deepEqual(result.get("AAPL")?.map((x) => x.close), [329, 333]);
  assert.deepEqual(result.get("MSFT")?.map((x) => x.close), [512]);
  assert.equal(requests.length, 2);
  assert.equal(requests[1]?.searchParams.get("page_token"), "next");
  assert.equal(requests[0]?.searchParams.get("symbols"), "AAPL,MSFT");
  assert.equal(requests[0]?.searchParams.get("adjustment"), "split");
  assert.equal(requests[0]?.searchParams.get("feed"), "iex");
  assert.equal(requests[0]?.searchParams.get("end"), to);
});

test("429 retries within budget, but 401 never retries and a repeated token fails", async () => {
  let attempts = 0;
  const sleeps: number[] = [];
  const fetcher = (async () => {
    attempts++;
    return attempts === 1 ? new Response(null, { status: 429, headers: { "Retry-After": "1" } }) :
      Response.json({ bars: { AAPL: [bar("2026-09-30", 333)] }, next_page_token: null });
  }) as typeof fetch;
  await fetchDailyBarsBatch(["AAPL"], from, to, creds, fetcher, async (ms) => { sleeps.push(ms); });
  assert.equal(attempts, 2);
  assert.deepEqual(sleeps, [1000]);

  let unauthorized = 0;
  await assert.rejects(fetchDailyBarsBatch(["AAPL"], from, to, creds,
    (async () => { unauthorized++; return new Response(null, { status: 401 }); }) as typeof fetch), /HTTP 401/);
  assert.equal(unauthorized, 1);

  await assert.rejects(fetchDailyBarsBatch(["AAPL"], from, to, creds,
    (async () => Response.json({ bars: {}, next_page_token: "same" })) as typeof fetch), /repitió el token/);
});

test("missing histories remain unavailable; a complete split-adjusted history yields price windows", () => {
  const b = (date: string, close: number): DailyBar => ({ date, open: close, high: close + 1, low: close - 1, close, volume: 100 });
  const short = derivePriceMetrics([b("2026-09-29", 8), b("2026-09-30", 10)]);
  assert.equal(short?.price, 10);
  assert.equal(short?.low52w, null);
  assert.equal(short?.low5y, null);
  assert.equal(short?.return52w, null);

  const full = derivePriceMetrics([
    b("2021-09-29", 2), b("2023-09-29", 4), b("2025-09-30", 8), b("2026-09-30", 10)
  ]);
  assert.equal(full?.low52w, 7);
  assert.equal(full?.high52w, 11);
  assert.equal(full?.low5y, 3); // la sesión anterior al quinto aniversario queda fuera
  assert.equal(full?.return52w, 0.25);
  assert.equal(full?.return3y, 1.5);
  assert.equal(full?.return5y, 4);
});

test("a malformed bar aborts the batch instead of publishing an incomplete price", async () => {
  const bad = { ...bar("2026-09-30", 10), l: 20 };
  await assert.rejects(fetchDailyBarsBatch(["AAPL"], from, to, creds,
    (async () => Response.json({ bars: { AAPL: [bad] } })) as typeof fetch), /barra diaria inválida/);
});
