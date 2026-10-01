import Link from "next/link";
export default function NotFound() {
  return <main className="standalone-empty"><span className="section-kicker">404</span><h1>Esta empresa no está en el catálogo</h1><p>Comprueba el ticker o vuelve a explorar las empresas disponibles.</p><Link href="/" className="primary-button">Volver al catálogo</Link></main>;
}
