import Link from "next/link";

export function Brand() {
  return <Link href="/" className="brand" aria-label="Vision Stock Scout, inicio">
    <span className="brand-mark" aria-hidden="true"><svg viewBox="0 0 32 32" width="26" height="26" fill="none"><path d="M6 23 12 10l5 10L26 7" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/><path d="M21 7h5v5" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/></svg></span>
    <span><strong>VISION<span className="brand-dot">.</span></strong><small>STOCK SCOUT</small></span>
  </Link>;
}
