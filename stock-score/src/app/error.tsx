"use client";
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="standalone-empty"><h1>No se ha podido abrir el catálogo</h1><p>Se ha producido un error temporal. Vuelve a intentarlo.</p><button type="button" className="primary-button" onClick={reset}>Reintentar</button></main>;
}
