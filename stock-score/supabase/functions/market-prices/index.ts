import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import postgres from "npm:postgres@3.4.7";
import { derivePriceMetrics, fetchDailyBarsBatch, type DailyBar } from "../_shared/alpaca.ts";

const BATCH_SIZE = 12;
const CURSOR = "ALPACA"; // FK ya existente en ops.data_sources
const LOCK_ID = 75942026;
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }
});

function authorized(request: Request): boolean {
  const secret = Deno.env.get("PIPELINE_JOB_SECRET") ?? "";
  const token = request.headers.get("Authorization")?.match(/^Bearer (\S+)$/)?.[1] ?? "";
  if (secret.length < 32 || !token || token.length > 512) return false;
  const a = new TextEncoder().encode(secret), b = new TextEncoder().encode(token);
  let mismatch = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) mismatch |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return mismatch === 0;
}

function firstBackfillDate(end: string): string {
  const date = new Date(`${end}T00:00:00Z`);
  date.setUTCFullYear(date.getUTCFullYear() - 5);
  date.setUTCDate(date.getUTCDate() - 20);
  return date.toISOString().slice(0, 10);
}

function recentStart(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 4);
  return d.toISOString().slice(0, 10);
}

type Company = { id: string; ticker: string; symbol: string };

Deno.serve(async (request) => {
  if (request.method !== "POST") return json({ error: "POST required" }, 405);
  if (!authorized(request)) return json({ error: "Unauthorized" }, 401);
  const url = Deno.env.get("SUPABASE_DB_URL");
  const key = Deno.env.get("ALPACA_API_KEY_ID"), secret = Deno.env.get("ALPACA_API_SECRET_KEY");
  if (!url || !key || !secret) return json({ error: "Pipeline configuration missing" }, 503);

  // Programar desde las 04:00 UTC: el día UTC anterior ya cerró en Nueva York.
  const now = new Date();
  if (now.getUTCHours() < 4) return json({ status: "too_early" }, 409);
  const cycleDate = now.toISOString().slice(0, 10);
  const end = cycleDate; // fecha exclusiva; nunca descarga una barra intradía abierta
  const db = postgres(url, { prepare: false, max: 1, idle_timeout: 180 });
  let locked = false;
  let jobId: string | null = null;
  try {
    const lock = await db`select pg_try_advisory_lock(${LOCK_ID}) as acquired`;
    locked = lock[0]?.acquired === true;
    if (!locked) return json({ status: "already_running" }, 409);

    const cursorRows = await db`select cursor_payload from ops.source_watermarks where source_code=${CURSOR}`;
    const cursor = (cursorRows[0]?.cursor_payload ?? {}) as { cycleDate?: string; after?: string; done?: boolean };
    if (cursor.cycleDate === cycleDate && cursor.done) return json({ status: "already_completed", cycleDate });
    const after = cursor.cycleDate === cycleDate && typeof cursor.after === "string" ? cursor.after : "";
    const companyRows = await db<Company[]>`
      select id,ticker,coalesce(alpaca_symbol,ticker) as symbol
      from public.companies where is_active=true and score_eligible=true and ticker>${after}
      order by ticker limit ${BATCH_SIZE + 1}`;
    const companies = companyRows.slice(0, BATCH_SIZE);
    if (!companies.length) {
      await db`insert into ops.source_watermarks(source_code,last_success_at,cursor_payload)
        values(${CURSOR},now(),${db.json({ cycleDate, after: "", done: true })})
        on conflict(source_code) do update set last_success_at=now(),cursor_payload=excluded.cursor_payload,updated_at=now()`;
      return json({ status: "completed", cycleDate, processed: 0 });
    }

    jobId = crypto.randomUUID();
    await db`insert into ops.jobs(id,job_type,status,trigger_type,input_payload,companies_total,started_at)
      values(${jobId},'daily_market','running','edge_function',${db.json({ cycleDate, after, feed: "iex", adjustment: "split", symbols: companies.map((c) => c.symbol) })},${companies.length},now())`;

    const latest = new Map<string, string>();
    for (const company of companies) {
      const rows = await db`select max(session_date)::text as session_date from ops.price_bars where company_id=${company.id}`;
      if (rows[0]?.session_date) latest.set(company.id, String(rows[0].session_date));
    }
    const full = cycleDate.endsWith("-01"); // al menos una reconstrucción completa por mes, también tras splits
    const firstDate = firstBackfillDate(end);
    const start = full || latest.size !== companies.length ? firstDate :
      companies.map((c) => recentStart(latest.get(c.id)!)).sort()[0]!;
    const barsBySymbol = await fetchDailyBarsBatch(companies.map((c) => c.symbol), start, end, { key, secret });
    let processed = 0;
    let updated = 0;
    const missing: string[] = [];

    for (const company of companies) {
      const bars = barsBySymbol.get(company.symbol.toUpperCase()) ?? [];
      if (!bars.length) { missing.push(company.ticker); continue; }
      for (let offset = 0; offset < bars.length; offset += 400) {
        const payload = bars.slice(offset, offset + 400).map((bar) => ({
          company_id: company.id, session_date: bar.date, open: bar.open, high: bar.high,
          low: bar.low, close: bar.close, volume: bar.volume
        }));
        await db`insert into ops.price_bars(company_id,session_date,open,high,low,close,volume,feed,adjustment)
          select company_id,session_date,open,high,low,close,volume,'iex','split'
          from jsonb_to_recordset(${db.json(payload)}::jsonb)
            as x(company_id uuid,session_date date,open numeric,high numeric,low numeric,close numeric,volume bigint)
          on conflict(company_id,session_date) do update set
            open=excluded.open,high=excluded.high,low=excluded.low,close=excluded.close,
            volume=excluded.volume,fetched_at=now()`;
      }
      const historyRows = await db`select session_date::text as date,open::float8,high::float8,
        low::float8,close::float8,volume::float8 from ops.price_bars
        where company_id=${company.id} and session_date>=${firstDate}::date order by session_date`;
      const history = historyRows.map((r) => ({
        date: String(r.date), open: Number(r.open), high: Number(r.high),
        low: Number(r.low), close: Number(r.close), volume: Number(r.volume)
      })) as DailyBar[];
      const m = derivePriceMetrics(history);
      if (!m || m.date >= end) throw new Error(`Fecha de mercado inválida: ${company.ticker}`);
      // Los scores se invalidan hasta que el proceso financiero vuelva a calcularlos.
      const changed = await db`insert into public.company_snapshot_latest(
          company_id,as_of_date,market_data_date,data_updated_at,data_quality,price_source_code,
          price,low_52w,high_52w,low_5y,distance_52w_low_pct,distance_5y_low_pct,
          return_52w_pct,return_3y_pct,return_5y_pct,price_history_start)
        values(${company.id},${m.date},${m.date},now(),'partial','ALPACA',
          ${m.price},${m.low52w},${m.high52w},${m.low5y},${m.distance52w},${m.distance5y},
          ${m.return52w},${m.return3y},${m.return5y},${m.historyStart})
        on conflict(company_id) do update set
          as_of_date=excluded.as_of_date,market_data_date=excluded.market_data_date,data_updated_at=now(),
          data_quality='partial',price_source_code='ALPACA',price=excluded.price,
          low_52w=excluded.low_52w,high_52w=excluded.high_52w,low_5y=excluded.low_5y,
          distance_52w_low_pct=excluded.distance_52w_low_pct,distance_5y_low_pct=excluded.distance_5y_low_pct,
          return_52w_pct=excluded.return_52w_pct,return_3y_pct=excluded.return_3y_pct,
          return_5y_pct=excluded.return_5y_pct,price_history_start=excluded.price_history_start,
          market_cap=case when public.company_snapshot_latest.shares_outstanding>0
            then excluded.price*public.company_snapshot_latest.shares_outstanding else null end,
          pe_trailing=case when public.company_snapshot_latest.eps_ttm>0
            then excluded.price/public.company_snapshot_latest.eps_ttm else null end,
          pe_forward=case when public.company_snapshot_latest.estimated_eps_next_fy>0
            then excluded.price/public.company_snapshot_latest.estimated_eps_next_fy else null end,
          ath=null,distance_ath_pct=null,pe_relative=null,pe_5y_mean=null,pe_5y_median=null,
          pe_5y_min=null,pe_5y_max=null,pe_5y_percentile=null,pe_vs_5y_mean_pct=null,
          valuation_zscore=null,pe_history_observations=null,
          ev_ebit=null,ev_ebitda=null,ev_fcff=null,fcf_yield=null,
          score_total=null,score_growth=null,score_quality=null,score_valuation=null,
          score_balance=null,score_coverage=null,score_model_version=null
        where public.company_snapshot_latest.market_data_date is null
           or excluded.market_data_date>public.company_snapshot_latest.market_data_date
        returning company_id`;
      processed++;
      updated += changed.length;
    }

    const status = missing.length ? (processed ? "partial" : "failed") : updated ? "succeeded" : "skipped";
    const done = companyRows.length <= BATCH_SIZE;
    if (done && cycleDate.endsWith("-01")) {
      await db`delete from ops.price_bars where session_date<${firstDate}::date`;
    }
    await db`update ops.jobs set status=${status},companies_processed=${processed},
      companies_failed=${missing.length},error_summary=${missing.length ? JSON.stringify(missing) : null},finished_at=now()
      where id=${jobId}`;
    await db`insert into ops.source_watermarks(source_code,last_attempt_at,last_success_at,cursor_payload)
      values(${CURSOR},now(),now(),${db.json({ cycleDate, after: companies.at(-1)!.ticker, done })})
      on conflict(source_code) do update set last_attempt_at=now(),last_success_at=now(),
        cursor_payload=excluded.cursor_payload,updated_at=now()`;
    return json({ status, cycleDate, processed, updated, missing, done });
  } catch (error) {
    // Nunca registrar URL de base de datos, claves, cuerpos completos ni cabeceras.
    console.error("[market-prices] failed", error instanceof Error ? error.name : "UnknownError");
    if (jobId) {
      try { await db`update ops.jobs set status='failed',error_summary='Provider or database error',finished_at=now() where id=${jobId}`; } catch { /* el intento se reanuda por cursor */ }
    }
    return json({ error: "No se actualizó el lote; puede reintentarse" }, 503);
  } finally {
    if (locked) {
      try { await db`select pg_advisory_unlock(${LOCK_ID})`; } catch { /* conexión cerrada */ }
    }
    await db.end({ timeout: 2 });
  }
});
