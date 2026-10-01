export class HttpError extends Error {
  constructor(public readonly status: number) { super(`Proveedor HTTP ${status}`); this.name = "HttpError"; }
}

function retryDelay(response: Response, attempt: number): number | null {
  const hint = response.headers.get("retry-after");
  if (hint) {
    const seconds = Number(hint);
    const ms = Number.isFinite(seconds) ? seconds * 1000 : Date.parse(hint) - Date.now();
    // Una espera larga se difiere a la siguiente revalidación; no se reintenta antes de la cuota.
    if (Number.isFinite(ms) && ms > 0) return ms <= 4000 ? ms : null;
  }
  return Math.min(300 * 2 ** attempt + Math.random() * 150, 4000);
}

export async function fetchWithRetry(url: string, init: RequestInit & { next?: { revalidate?: number; tags?: string[] } } = {}): Promise<Response> {
  const attempts = 3;
  for (let attempt = 0; attempt < attempts; attempt++) {
    let response: Response;
    try {
      response = await fetch(url, { ...init, signal: AbortSignal.timeout(10_000) });
    } catch (error) {
      if (attempt === attempts - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, 300 * 2 ** attempt));
      continue;
    }
    if (response.ok) return response;
    const transient = response.status === 429 || response.status >= 500;
    if (!transient || attempt === attempts - 1) throw new HttpError(response.status);
    const wait = retryDelay(response, attempt);
    await response.body?.cancel();
    if (wait === null) throw new HttpError(response.status);
    await new Promise(resolve => setTimeout(resolve, wait));
  }
  throw new Error("Reintentos agotados");
}
