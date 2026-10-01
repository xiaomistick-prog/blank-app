import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ChartNoAxesCombined, Gem, ShieldCheck } from "lucide-react";
import { Brand } from "@/components/brand";
import { WatchlistButton } from "@/components/watchlist-button";
import { getScreenerData } from "@/lib/data";
import { date, money, multiple, number, percent } from "@/lib/format";
import { isPriceStale, usableScore } from "@/lib/screener";
import type { NumericField, Stock } from "@/lib/types";

export const revalidate = 3600;
export function generateStaticParams() { return []; }
type Props = { params: Promise<{ ticker: string }> };
type Metric = { label: string; field: NumericField; format: "multiple" | "percent"; note?: string };
const GROUPS: { title: string; Icon: typeof Gem; metrics: Metric[] }[] = [
  { title: "Valoración", Icon: Gem, metrics: [
    { label: "PER trailing", field: "pe_trailing", format: "multiple", note: "Beneficio por acción de los últimos 12 meses" },
    { label: "PER forward", field: "pe_forward", format: "multiple", note: "EPS estimado para el próximo ejercicio fiscal" },
    { label: "EV / EBITDA", field: "ev_ebitda", format: "multiple" },
    { label: "PER mínimo de 5 años", field: "pe_5y_min", format: "multiple" },
    { label: "Distancia al mínimo de 52 semanas", field: "distance_52w_low_pct", format: "percent" },
    { label: "Distancia al mínimo de 5 años", field: "distance_5y_low_pct", format: "percent", note: "Cobertura y ajustes de la serie histórica pendientes de verificar" }
  ] },
  { title: "Calidad", Icon: ChartNoAxesCombined, metrics: [
    { label: "ROE", field: "roe_pct", format: "percent" },
    { label: "ROIC", field: "roic_pct", format: "percent" },
    { label: "Margen operativo", field: "operating_margin_pct", format: "percent" },
    { label: "Margen neto", field: "net_margin_pct", format: "percent" }
  ] },
  { title: "Solidez", Icon: ShieldCheck, metrics: [
    { label: "Deuda / fondos propios", field: "debt_to_equity", format: "multiple" },
    { label: "Deuda neta / EBITDA", field: "net_debt_ebitda", format: "multiple" },
    { label: "Cobertura de intereses", field: "interest_coverage", format: "multiple" },
    { label: "Liquidez corriente", field: "current_ratio", format: "multiple" }
  ] }
];

function findStock(stocks: Stock[], ticker: string) { return stocks.find(stock => stock.ticker.toUpperCase() === ticker.toUpperCase()); }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const [{ ticker }, dataset] = await Promise.all([params, getScreenerData()]);
  const stock = findStock(dataset.stocks, ticker);
  return { title: stock ? `${stock.ticker} · ${stock.name}` : "Ficha de empresa" };
}

export default async function StockPage({ params }: Props) {
  const [{ ticker }, dataset] = await Promise.all([params, getScreenerData()]);
  const stock = findStock(dataset.stocks, ticker);
  if (dataset.status !== "live") return <main className="standalone-empty"><h1>La ficha no está disponible</h1><p>{dataset.message}</p><Link className="primary-button" href="/">Volver al catálogo</Link></main>;
  if (!stock) notFound();
  const score = usableScore(stock, dataset.retrievedAt);
  const stale = isPriceStale(stock, dataset.retrievedAt);
  return <div className="detail-shell"><a href="#stock-content" className="skip-link">Saltar al contenido</a><header className="detail-topbar"><Brand/><Link href="/" className="back-link"><ArrowLeft size={16} aria-hidden="true"/>Volver al catálogo</Link></header><main id="stock-content"><span className="detail-ticker">{stock.ticker} · {stock.exchange ?? "Mercado sin identificar"}</span><div className="detail-heading"><div><h1>{stock.name}</h1><p>{stock.sector ?? "Sector sin clasificar"} · {stock.currency}{stock.index_codes.length > 0 && ` · ${stock.index_codes.map(code => code === "SP500" ? "S&P 500" : "Nasdaq 100").join(" / ")}`}</p></div><WatchlistButton companyId={stock.company_id} ticker={stock.ticker}/></div>
    {(stale || score === null) && <div className="data-notice" role="status"><ShieldCheck size={19} aria-hidden="true"/><div><strong>{score === null ? "Score no disponible para esta empresa" : "Revisa la fecha del precio"}</strong><p>{!stock.score_eligible ? "Esta empresa no es apta para el modelo actual. " : score === null ? "Faltan datos, cobertura suficiente o un cálculo vigente. " : ""}{stale ? "El precio no está actualizado. " : ""}Consulta las fechas antes de comparar.</p></div></div>}
    <section className="detail-summary" aria-label="Resumen de la empresa"><div><h2>Último cierre</h2><p className="large-value">{money(stock.price, stock.currency)}</p><p>{date(stock.market_data_date)}{stale && stock.price !== null ? " · Precio antiguo" : ""}</p></div><div><h2>Score vigente</h2><p className="large-value">{score === null ? "—" : `${number(score, 0)} / 100`}</p><p>{score === null ? "No disponible" : "Modelo " + (stock.score_model_version ?? "sin identificar")}</p></div><div><h2>Cobertura del modelo</h2><p className="large-value">{percent(stock.score_coverage === null ? null : stock.score_coverage * 100, 0)}</p><p>Umbral mínimo: 80 %</p></div></section>
    <div className="detail-groups">{GROUPS.map(({ title, Icon, metrics }) => <section className="metric-section" key={title}><h2><Icon size={19} aria-hidden="true"/>{title}</h2><dl>{metrics.map(metric => <div key={metric.field}><dt>{metric.label}</dt><dd>{metric.format === "percent" ? percent(stock[metric.field]) : multiple(stock[metric.field])}</dd>{metric.note && <small>{metric.note}</small>}</div>)}</dl></section>)}</div>
    <p className="metric-footnote">— = dato ausente o ratio no comparable. Los porcentajes se expresan en puntos porcentuales; los múltiplos, en veces.</p>
    <section className="provenance"><h2>Fechas y cobertura</h2><dl><div><dt>Precio de mercado</dt><dd>{date(stock.market_data_date)}</dd></div><div><dt>Fundamentales</dt><dd>{date(stock.fundamentals_date)}</dd></div><div><dt>Estimaciones</dt><dd>{date(stock.estimates_date)}</dd></div><div><dt>Verificación de índices</dt><dd>{date(stock.last_membership_check)}</dd></div></dl><p>{stock.index_codes.length === 0 ? "Pertenencia a índices pendiente de verificar. " : ""}Las fechas corresponden a los datos disponibles, no al momento en que abres la ficha. Los ratios almacenados pueden proceder del pipeline anterior cuando sus componentes aún no están normalizados. <Link href="/metodologia" className="underline">Consultar metodología y fuentes.</Link></p></section>
  </main><footer className="page-footer"><span>VISION Stock Scout</span><p>Información para análisis. No es una recomendación de inversión.</p></footer></div>;
}
