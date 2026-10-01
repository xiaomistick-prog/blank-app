"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowDownUp, ArrowRight, BookOpen, Check, ChevronDown, CircleHelp, Database, LayoutGrid, ListFilter, Search, ShieldCheck, Star, X } from "lucide-react";
import { Brand } from "./brand";
import { StockCard } from "./stock-card";
import { date } from "@/lib/format";
import { activeFilterCount, DEFAULT_FILTERS, filterAndSort, isPriceStale, usableScore } from "@/lib/screener";
import { useWatchlist } from "@/lib/use-watchlist";
import type { Filters, ScreenerDataset, SortKey } from "@/lib/types";

const PAGE_SIZE = 24;
const SORT_OPTIONS: { value: SortKey; label: string }[] = [{ value: "score", label: "Mayor score vigente" }, { value: "roic", label: "Mayor ROIC" }, { value: "pe", label: "Menor PER TTM" }, { value: "low52", label: "Cerca del mínimo de 52 s." }, { value: "low5y", label: "Cerca del mínimo de 5 años" }, { value: "ticker", label: "Ticker A–Z" }];

export function Dashboard({ dataset }: { dataset: ScreenerDataset }) {
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [view, setView] = useState<"explore" | "watchlist">("explore");
  const [page, setPage] = useState(1);
  const watchlist = useWatchlist();
  const ids = useMemo(() => new Set(watchlist.ids), [watchlist.ids]);
  const sectors = useMemo(() => [...new Set(dataset.stocks.map(stock => stock.sector).filter((value): value is string => Boolean(value)))].sort(), [dataset.stocks]);
  const results = useMemo(() => filterAndSort(dataset.stocks, filters, dataset.retrievedAt, view === "watchlist" ? ids : undefined), [dataset.stocks, dataset.retrievedAt, filters, view, ids]);
  const summary = useMemo(() => {
    const priced = dataset.stocks.filter(stock => stock.price !== null);
    const dates = priced.map(stock => stock.market_data_date).filter((value): value is string => Boolean(value)).sort();
    return { priced: priced.length, scored: dataset.stocks.filter(stock => usableScore(stock, dataset.retrievedAt) !== null).length, indexed: dataset.stocks.filter(stock => stock.index_codes.length > 0).length, stale: priced.filter(stock => isPriceStale(stock, dataset.retrievedAt)).length, latestDate: dates.at(-1) ?? null };
  }, [dataset]);
  const pages = Math.max(1, Math.ceil(results.length / PAGE_SIZE));
  const currentPage = Math.min(page, pages);
  const visible = results.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const count = activeFilterCount(filters);

  function update<K extends keyof Filters>(key: K, value: Filters[K]) { setFilters(current => ({ ...current, [key]: value })); setPage(1); }
  function changeView(next: "explore" | "watchlist") { setView(next); setPage(1); }
  function reset() { setFilters(DEFAULT_FILTERS); setPage(1); }

  const navigation = <><button type="button" className={`nav-item ${view === "explore" ? "active" : ""}`} onClick={() => changeView("explore")} aria-pressed={view === "explore"}><LayoutGrid size={18} aria-hidden="true"/>Explorar</button><button type="button" className={`nav-item ${view === "watchlist" ? "active" : ""}`} onClick={() => changeView("watchlist")} aria-pressed={view === "watchlist"}><Star size={18} aria-hidden="true"/>Mi lista<span className="nav-count">{watchlist.ids.length}</span></button></>;

  return <div className="app-layout">
    <a href="#main-content" className="skip-link">Saltar al contenido</a>
    <aside className="sidebar"><Brand/><div className="sidebar-caption">TU ESPACIO DE ANÁLISIS</div><nav aria-label="Navegación principal">{navigation}<Link className="nav-item" href="/metodologia"><BookOpen size={18} aria-hidden="true"/>Metodología</Link></nav><div className="sidebar-footer"><span className="status-dot"/><div><strong>Datos con contexto</strong><p>Fechas, cobertura y fuentes siempre visibles.</p></div><ShieldCheck size={21} aria-hidden="true"/></div></aside>
    <div className="main-shell">
      <header className="topbar"><div className="mobile-brand"><Brand/></div><div className="breadcrumb"><span>Mercado de acciones</span><span>/</span><strong>{view === "explore" ? "Explorar" : "Mi lista"}</strong></div><div className="topbar-right"><span className="close-date"><span className={`status-dot ${summary.stale > 0 ? "amber" : ""}`}/>Último cierre: {summary.latestDate ? date(summary.latestDate) : "sin datos"}</span><Link href="/metodologia" className="icon-button" aria-label="Consultar metodología"><CircleHelp size={20} aria-hidden="true"/></Link></div></header>
      <nav className="mobile-nav" aria-label="Secciones">{navigation}</nav>
      <main id="main-content" className="dashboard-main">
        <section className="hero"><div><p className="section-kicker"><span className="tiny-line"/>ANÁLISIS FUNDAMENTAL</p><h1>{view === "explore" ? <>Tu próxima idea,<br/><span>con más criterio.</span></> : <>Tu lista.<br/><span>Tu punto de partida.</span></>}</h1><p className="hero-description">Compara valoración, calidad y solidez.<br className="desktop-break"/> Guarda las empresas que quieres seguir.</p></div><div className="hero-note"><span className="note-icon"><ShieldCheck size={23} aria-hidden="true"/></span><div><strong>El dato antes que el score</strong><p>Una puntuación solo se muestra con cobertura suficiente y datos vigentes.</p><Link href="/metodologia">Cómo se calcula<ArrowRight size={15} aria-hidden="true"/></Link></div></div></section>

        <section className="summary-grid" aria-label="Cobertura del catálogo"><div className="summary-card"><span className="summary-icon"><LayoutGrid size={18} aria-hidden="true"/></span><div><p>Empresas en el catálogo</p><strong>{dataset.stocks.length}</strong><small>Importadas · no equivalen al universo de índices</small></div></div><div className="summary-card"><span className="summary-icon"><Database size={18} aria-hidden="true"/></span><div><p>Con precio disponible</p><strong>{summary.priced}<span> / {dataset.stocks.length}</span></strong><small>{summary.stale > 0 ? `${summary.stale} con precio antiguo` : "Con fecha de mercado identificada"}</small></div></div><div className="summary-card"><span className="summary-icon green"><ShieldCheck size={18} aria-hidden="true"/></span><div><p>Con score vigente</p><strong>{summary.scored}<span> / {dataset.stocks.length}</span></strong><small>{summary.scored === 0 ? "Pendiente de completar los fundamentales" : "Cobertura mínima del 80 %"}</small></div></div></section>

        {dataset.status !== "live" ? <div className="data-notice notice-error" role="status"><Database size={19} aria-hidden="true"/><div><strong>{dataset.status === "configuration_required" ? "Conexión pendiente" : "Datos temporalmente no disponibles"}</strong><p>{dataset.message}</p></div></div> : (summary.indexed === 0 || summary.stale > 0 || dataset.message) && <div className="data-notice" role="status"><CircleHelp size={19} aria-hidden="true"/><div><strong>{summary.indexed === 0 ? "Universo de índices pendiente de verificar" : "Revisa la fecha de los datos"}</strong><p>{summary.indexed === 0 && "La pertenencia al S&P 500 y al Nasdaq 100 aún no está verificada. "}{summary.stale > 0 && "Los precios disponibles tienen más de 7 días. "}{dataset.message ?? "Los datos ausentes se muestran como —."}</p></div><Link href="/metodologia#datos">Ver cobertura<ArrowUpRightIcon/></Link></div>}
        {watchlist.error && <p className="storage-warning" role="alert">El navegador no permite guardar tu lista. Habilita el almacenamiento local para conservarla.</p>}

        <section className="explorer" aria-labelledby="explorer-title">
          <div className="explorer-heading"><div><h2 id="explorer-title">{view === "explore" ? "Explora el catálogo" : "Empresas guardadas"}</h2><p>{view === "explore" ? "Filtra por lo que importa en tu análisis." : "Tu lista se guarda en este dispositivo y navegador."}</p></div><span className="results-count">{results.length} {results.length === 1 ? "empresa" : "empresas"}</span></div>
          <div className="search-row"><div className="search-field"><Search size={19} aria-hidden="true"/><label htmlFor="search" className="sr-only">Buscar por ticker o empresa</label><input id="search" type="search" placeholder="Busca un ticker o una empresa…" value={filters.search} onChange={event => update("search", event.target.value)}/>{filters.search && <button type="button" className="icon-button" onClick={() => update("search", "")} aria-label="Borrar búsqueda"><X size={17} aria-hidden="true"/></button>}</div><div className="sort-field"><ArrowDownUp size={16} aria-hidden="true"/><label htmlFor="sort" className="sr-only">Ordenar empresas</label><select id="sort" value={filters.sort} onChange={event => update("sort", event.target.value as SortKey)}>{SORT_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select><ChevronDown size={14} aria-hidden="true"/></div></div>
          <div className="universe-tabs" role="group" aria-label="Filtrar por índice">{([{ value: "all", label: "Catálogo actual" }, { value: "SP500", label: "S&P 500" }, { value: "NDX100", label: "Nasdaq 100" }] as const).map(option => <button type="button" key={option.value} aria-pressed={filters.index === option.value} className={filters.index === option.value ? "selected" : ""} onClick={() => update("index", option.value)}>{option.label}{filters.index === option.value && <Check size={13} aria-hidden="true"/>}</button>)}</div>
          <details className="filter-panel"><summary><span><ListFilter size={17} aria-hidden="true"/>Filtros avanzados{count > 0 && <span className="filter-count">{count}</span>}</span><ChevronDown size={16} aria-hidden="true"/></summary><div className="filter-fields"><label>Sector<select value={filters.sector} onChange={event => update("sector", event.target.value)}><option value="all">Todos los sectores</option>{sectors.map(sector => <option key={sector} value={sector}>{sector}</option>)}</select></label><label>Score vigente mínimo<input type="number" min="0" max="100" step="1" placeholder="Ej. 70" value={filters.minScore} onChange={event => update("minScore", event.target.value)}/></label><label>ROIC mínimo (%)<input type="number" step="0.1" placeholder="Ej. 15" value={filters.minRoic} onChange={event => update("minRoic", event.target.value)}/></label><label>PER TTM máximo<input type="number" min="0" step="0.1" placeholder="Ej. 25" value={filters.maxPe} onChange={event => update("maxPe", event.target.value)}/></label><label>A máx. (%) del mínimo de 52 s.<input type="number" min="0" step="0.1" placeholder="Ej. 10" value={filters.maxLowDistance} onChange={event => update("maxLowDistance", event.target.value)}/></label><label className="checkbox-label"><input type="checkbox" checked={filters.onlyEligible} onChange={event => update("onlyEligible", event.target.checked)}/><span>Solo aptas para el modelo de scoring</span></label></div><div className="filter-bottom"><p>Los filtros numéricos excluyen los valores ausentes. Las cifras antiguas conservan su fecha.</p><button type="button" className="text-button" onClick={reset}>Restablecer filtros</button></div></details>
          {count > 0 && <div className="active-filters"><span>{count} {count === 1 ? "filtro activo" : "filtros activos"}</span><button type="button" onClick={reset}>Limpiar<X size={13} aria-hidden="true"/></button></div>}
          <div className="result-announcement sr-only" role="status" aria-live="polite">{results.length} resultados. Página {currentPage} de {pages}.</div>
          {results.length > 0 ? <><div className="stock-grid">{visible.map(stock => <StockCard key={stock.company_id} stock={stock} now={dataset.retrievedAt} saved={ids.has(stock.company_id)} onToggle={watchlist.toggle}/>)}</div><div className="pagination"><p>{(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, results.length)} de {results.length} empresas</p><div><button type="button" disabled={currentPage === 1} onClick={() => { setPage(currentPage - 1); document.getElementById("explorer-title")?.scrollIntoView({ block: "start" }); }}>Anterior</button><span>{currentPage} / {pages}</span><button type="button" disabled={currentPage === pages} onClick={() => { setPage(currentPage + 1); document.getElementById("explorer-title")?.scrollIntoView({ block: "start" }); }}>Siguiente</button></div></div></> : <div className="empty-state"><span className="empty-icon">{view === "watchlist" && watchlist.ids.length === 0 ? <Star size={27} aria-hidden="true"/> : <Search size={27} aria-hidden="true"/>}</span><h3>{view === "watchlist" && watchlist.ids.length === 0 ? "Tu primera idea empieza aquí" : filters.index !== "all" && summary.indexed === 0 ? "Este índice aún no está verificado" : "No hay empresas con estos criterios"}</h3><p>{view === "watchlist" && watchlist.ids.length === 0 ? "Pulsa la estrella de una empresa para guardarla y volver a ella." : filters.index !== "all" && summary.indexed === 0 ? "Las empresas aparecerán aquí cuando se confirme su pertenencia al índice." : dataset.status !== "live" ? "El catálogo se mostrará cuando la conexión de datos esté disponible." : "Prueba otros filtros. Un dato ausente nunca se interpreta como cero."}</p><button type="button" className="primary-button" onClick={() => { reset(); changeView("explore"); }}>Ver catálogo<ArrowRight size={16} aria-hidden="true"/></button></div>}
        </section>
        <footer className="page-footer"><span>VISION Stock Scout · Análisis con trazabilidad</span><p>Información para análisis. No es una recomendación de inversión.</p></footer>
      </main>
    </div>
  </div>;
}

function ArrowUpRightIcon() { return <ArrowRight size={15} aria-hidden="true"/>; }
