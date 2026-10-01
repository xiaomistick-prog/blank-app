import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Brand } from "@/components/brand";
import { getScreenerData } from "@/lib/data";
import { date } from "@/lib/format";
import { usableScore } from "@/lib/screener";

export const revalidate = 3600;
export const metadata: Metadata = { title: "Metodología y cobertura" };
const FORMULAS = [
  ["PER trailing", "Precio / EPS de los últimos 12 meses (TTM)"],
  ["PER forward", "Precio / EPS estimado para el próximo ejercicio fiscal"],
  ["EV / EBITDA", "(Capitalización bursátil + deuda total − efectivo) / EBITDA"],
  ["ROE (%)", "(Beneficio neto / fondos propios) × 100"],
  ["ROIC (%)", "(NOPAT / capital invertido) × 100"],
  ["Margen operativo (%)", "(Resultado operativo / ingresos) × 100"],
  ["Margen neto (%)", "(Beneficio neto / ingresos) × 100"],
  ["Deuda / fondos propios", "Deuda total / fondos propios"],
  ["Deuda neta / EBITDA", "(Deuda total − efectivo) / EBITDA"],
  ["Cobertura de intereses", "EBIT / gasto por intereses"],
  ["Liquidez corriente", "Activo corriente / pasivo corriente"]
];

export default async function MethodologyPage() {
  const dataset = await getScreenerData();
  const latest = dataset.stocks.map(stock => stock.market_data_date).filter((value): value is string => Boolean(value)).sort().at(-1) ?? null;
  return <div className="detail-shell"><header className="detail-topbar"><Brand/><Link href="/" className="back-link"><ArrowLeft size={16} aria-hidden="true"/>Volver al catálogo</Link></header><main className="methodology"><p className="section-kicker">METODOLOGÍA Y COBERTURA</p><h1>Entiende qué estás comparando.</h1><p className="intro">El score es una herramienta para ordenar el análisis. Depende de los datos disponibles, de su fecha y de las empresas con las que se compara.</p>
    <section id="datos"><h2>Estado actual de los datos</h2>{dataset.status !== "live" ? <p>{dataset.message}</p> : <><dl className="coverage-list"><div><dt>Empresas importadas</dt><dd>{dataset.stocks.length}</dd></div><div><dt>Con precio</dt><dd>{dataset.stocks.filter(stock => stock.price !== null).length}</dd></div><div><dt>Con score vigente</dt><dd>{dataset.stocks.filter(stock => usableScore(stock, dataset.retrievedAt) !== null).length}</dd></div><div><dt>Con pertenencia a índices verificada</dt><dd>{dataset.stocks.filter(stock => stock.index_codes.length > 0).length}</dd></div></dl><p>Fecha del último precio disponible: <strong>{date(latest)}</strong>. El catálogo importado incluye empresas de distintos mercados. Solo las pertenencias verificadas se incluyen en los filtros S&P 500 y Nasdaq 100.</p></>}<p>Los precios registrados actualmente proceden del pipeline de mercado existente. Todavía hay fundamentales y estimaciones pendientes de completar. Ningún dato de ejemplo se mezcla con este catálogo.</p></section>
    <section><h2>Cómo leer una puntuación</h2><p>La aplicación muestra el modelo ya definido en el proyecto: <strong>calidad 30 %, crecimiento 25 %, valoración 25 % y solidez 20 %</strong>. La normalización compara cada métrica por percentiles dentro de una industria o sector con al menos 15 empresas; si no hay muestra suficiente, utiliza el mercado elegible.</p><ul><li>Se exige al menos un 60 % de cobertura por pilar y un 80 % total.</li><li>Se oculta el score si el precio tiene más de 7 días, los fundamentales más de 550 días o el cálculo está pendiente de actualizar.</li><li>Las empresas no aptas para el modelo quedan excluidas del ranking por score.</li><li>Un ratio ausente no se convierte en cero ni se considera una señal favorable.</li></ul><p>El modelo actual no calcula una puntuación directamente a partir de los once ratios de esta pantalla. Utiliza un conjunto más amplio de métricas; los ratios permiten revisar los fundamentos detrás del análisis.</p></section>
    <section><h2>Ratios financieros</h2><dl className="formula-list">{FORMULAS.map(([label, formula]) => <div key={label}><dt>{label}</dt><dd>{formula}</dd></div>)}</dl><h3>Convenciones</h3><p>Los márgenes y retornos se muestran como porcentajes. Los múltiplos requieren denominadores positivos para ser comparables; EPS no positivo no produce un PER válido. El beneficio neto o NOPAT negativos sí pueden producir márgenes y retornos negativos. La deuda neta negativa se conserva: indica una posición de efectivo neto. Una deuda o un gasto por intereses ausente nunca se supone igual a cero.</p><p>El PER forward se refiere al EPS del próximo ejercicio fiscal, no a los próximos 12 meses. Los periodos y monedas de los componentes deben coincidir antes del cálculo. El pipeline anterior puede aportar un ratio almacenado mientras sus componentes todavía se normalizan; la siguiente fase de datos debe validar esta trazabilidad.</p></section>
    <section><h2>Mínimos e historia</h2><p>La distancia al mínimo se expresa como (precio / mínimo − 1) × 100. Los mínimos de 52 semanas y 5 años solo son comparables con una serie ajustada por desdoblamientos y cobertura suficiente. Una serie corta no acredita un mínimo de 5 años. El PER mínimo histórico requiere precios y EPS conocidos en cada fecha; usar el EPS de hoy en toda la serie introduciría sesgo.</p></section>
    <section><h2>Fuentes y actualización</h2><p>El objetivo de actualización es diario para precios, semanal para fundamentales y estimaciones disponibles, y mensual para revisión del universo e historia. Las fechas de las fichas indican las actualizaciones que realmente se han realizado. La programación automática y el suministro completo de fundamentales son la siguiente fase del proyecto.</p><div className="source-links"><a href="https://docs.alpaca.markets/docs/about-market-data-api" target="_blank" rel="noreferrer">Alpaca · Datos de mercado</a><a href="https://www.sec.gov/search-filings/edgar-application-programming-interfaces" target="_blank" rel="noreferrer">SEC · Fundamentales</a><a href="https://site.financialmodelingprep.com/developer/docs" target="_blank" rel="noreferrer">FMP · Cobertura según plan</a></div><p>La lista personal se guarda exclusivamente en este navegador. No se sincroniza entre dispositivos ni se envía a otros usuarios.</p></section>
  </main><footer className="page-footer"><span>VISION Stock Scout</span><p>Información para análisis. No es una recomendación de inversión.</p></footer></div>;
}
