import Link from "next/link";
import { ArrowUpRight, ChevronDown, Star } from "lucide-react";
import { date, money, multiple, number, percent } from "@/lib/format";
import { isPriceStale, usableScore } from "@/lib/screener";
import type { Stock } from "@/lib/types";

export function StockCard({ stock, now, saved, onToggle }: { stock: Stock; now: string; saved: boolean; onToggle: (id: string) => void }) {
  const score = usableScore(stock, now);
  const stale = stock.price !== null && isPriceStale(stock, now);
  const initial = stock.ticker.replace(/[^a-zA-Z]/g, "").slice(0, 2) || stock.ticker.slice(0, 2);
  const tone = [...stock.ticker].reduce((total, char) => total + char.charCodeAt(0), 0) % 4;
  return <article className="stock-card">
    <div className="stock-card-head">
      <span className={`ticker-avatar avatar-${tone}`} aria-hidden="true">{initial}</span>
      <div className="stock-identity"><Link href={`/accion/${encodeURIComponent(stock.ticker)}`} className="ticker-link">{stock.ticker}<ArrowUpRight size={14} aria-hidden="true"/></Link><p title={stock.name}>{stock.name}</p></div>
      <button type="button" className={`icon-button star-button ${saved ? "is-saved" : ""}`} onClick={() => onToggle(stock.company_id)} aria-pressed={saved} aria-label={`${saved ? "Quitar" : "Guardar"} ${stock.ticker} ${saved ? "de" : "en"} mi lista`}><Star size={19} fill={saved ? "currentColor" : "none"} aria-hidden="true"/></button>
    </div>
    <div className="stock-tags"><span>{stock.sector ?? "Sector sin clasificar"}</span>{stock.index_codes.map(code => <span className="index-tag" key={code}>{code === "SP500" ? "S&P 500" : "Nasdaq 100"}</span>)}</div>
    <div className="stock-price-score">
      <div><span className="eyebrow">Último cierre</span><p className="stock-price">{money(stock.price, stock.currency)}</p><span className={`price-date ${stale ? "is-stale" : ""}`}>{stock.price === null ? "Precio no disponible" : `${stale ? "Precio antiguo · " : ""}${date(stock.market_data_date)}`}</span></div>
      <div className={`score-box ${score === null ? "score-pending" : ""}`}><span className="eyebrow">Score</span><p>{score === null ? "—" : number(score, 0)}{score !== null && <small>/100</small>}</p><span>{score === null ? "No disponible" : "Vigente"}</span></div>
    </div>
    <dl className="card-metrics"><div><dt>PER TTM</dt><dd>{multiple(stock.pe_trailing)}</dd></div><div><dt>ROIC</dt><dd>{percent(stock.roic_pct)}</dd></div><div><dt>DN / EBITDA</dt><dd>{multiple(stock.net_debt_ebitda)}</dd></div></dl>
    <div className="low-distance"><span>Distancia al mínimo de 52 semanas</span><strong>{stock.distance_52w_low_pct === null ? "—" : `${stock.distance_52w_low_pct >= 0 ? "+" : ""}${percent(stock.distance_52w_low_pct)}`}</strong></div>
    <details className="card-details"><summary>Más indicadores<ChevronDown size={15} aria-hidden="true"/></summary><dl className="expanded-metrics"><div><dt>PER forward · próximo FY</dt><dd>{multiple(stock.pe_forward)}</dd></div><div><dt>EV / EBITDA</dt><dd>{multiple(stock.ev_ebitda)}</dd></div><div><dt>ROE</dt><dd>{percent(stock.roe_pct)}</dd></div><div><dt>Margen operativo</dt><dd>{percent(stock.operating_margin_pct)}</dd></div><div><dt>Distancia al mínimo de 5 años</dt><dd>{percent(stock.distance_5y_low_pct)}</dd></div><div><dt>PER mínimo de 5 años</dt><dd>{multiple(stock.pe_5y_min)}</dd></div></dl><Link className="text-link" href={`/accion/${encodeURIComponent(stock.ticker)}`}>Abrir ficha completa <ArrowUpRight size={14} aria-hidden="true"/></Link></details>
  </article>;
}
