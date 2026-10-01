"use client";
import { Star } from "lucide-react";
import { useWatchlist } from "@/lib/use-watchlist";

export function WatchlistButton({ companyId, ticker }: { companyId: string; ticker: string }) {
  const { ids, toggle, error } = useWatchlist();
  const saved = ids.includes(companyId);
  return <div><button type="button" className={`primary-button ${saved ? "saved-button" : ""}`} aria-pressed={saved} onClick={() => toggle(companyId)}><Star size={17} aria-hidden="true" fill={saved ? "currentColor" : "none"}/>{saved ? `${ticker} en mi lista` : "Guardar en mi lista"}</button>{error && <p className="storage-warning" role="alert">No se puede guardar en este navegador.</p>}</div>;
}
