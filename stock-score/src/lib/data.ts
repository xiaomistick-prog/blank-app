import "server-only";
import { cache } from "react";
import { fetchWithRetry } from "./http";
import { normalizeStock } from "./normalize";
import { NUMERIC_FIELDS, type ScreenerDataset, type Stock } from "./types";

export const SCREENER_CACHE_TAG = "stock-screener-v1";
const SELECT_FIELDS = ["company_id", "ticker", "name", "exchange", "currency", "sector", "industry", "company_type", "score_eligible", "index_codes", "last_membership_check", "as_of_date", "data_updated_at", "market_data_date", "fundamentals_date", "estimates_date", "data_quality", "score_model_version", "score_state", ...NUMERIC_FIELDS].join(",");

// Una lectura masiva, reutilizada por la portada y todas las fichas. Sin polling cliente.
export const getScreenerData = cache(async (): Promise<ScreenerDataset> => {
  const retrievedAt = new Date().toISOString();
  const base = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!base || !key) return { stocks: [], status: "configuration_required", retrievedAt, invalidRows: 0, message: "La conexión de datos todavía no está configurada." };
  try {
    const stocks: Stock[] = [];
    let invalidRows = 0;
    const pageSize = 500;
    for (let offset = 0; offset < 2000; offset += pageSize) {
      const url = new URL("/rest/v1/v_stock_score_v1", base);
      if (url.protocol !== "https:") throw new Error("La conexión de datos requiere HTTPS");
      url.searchParams.set("select", SELECT_FIELDS);
      url.searchParams.set("order", "company_id.asc");
      url.searchParams.set("limit", String(pageSize));
      url.searchParams.set("offset", String(offset));
      const response = await fetchWithRetry(url.toString(), {
        headers: { apikey: key, Accept: "application/json" },
        next: { revalidate: 3600, tags: [SCREENER_CACHE_TAG] }
      });
      const rows: unknown = await response.json();
      if (!Array.isArray(rows)) throw new Error("Respuesta de datos inválida");
      for (const row of rows) {
        const stock = normalizeStock(row);
        if (stock) stocks.push(stock); else invalidRows++;
      }
      if (rows.length < pageSize) return { stocks, status: "live", retrievedAt, invalidRows, message: invalidRows > 0 ? "Algunos registros incompletos no se han podido mostrar." : null };
    }
    throw new Error("El catálogo supera el límite de lectura seguro");
  } catch (error) {
    // No registra claves, URLs con secretos ni cuerpos del proveedor.
    console.error("[screener] lectura fallida", error instanceof Error ? error.name : "UnknownError");
    return { stocks: [], status: "unavailable", retrievedAt, invalidRows: 0, message: "No se han podido cargar los datos. Inténtalo de nuevo más tarde." };
  }
});
