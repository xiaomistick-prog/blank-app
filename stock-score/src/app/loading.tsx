export default function Loading() {
  return <main className="loading-page" aria-busy="true" aria-label="Cargando catálogo"><div className="loading-logo">VISION.</div><p>Cargando empresas y cobertura…</p><div className="loading-cards">{[1, 2, 3].map(value => <div className="skeleton-card" key={value}/>)}</div></main>;
}
