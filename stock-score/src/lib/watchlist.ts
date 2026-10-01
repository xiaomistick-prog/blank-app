export const WATCHLIST_KEY = "vision-stock-scout:watchlist:v1";

export function decodeWatchlist(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object" || !("version" in value) || value.version !== 1 || !("companyIds" in value) || !Array.isArray(value.companyIds)) return [];
    return [...new Set(value.companyIds.filter((id): id is string => typeof id === "string" && /^[a-zA-Z0-9_-]{1,80}$/.test(id)))].slice(0, 1000);
  } catch { return []; }
}
