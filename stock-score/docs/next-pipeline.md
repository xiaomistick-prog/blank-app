# Siguiente fase: suministro de datos y programación

El frontend está integrado con la vista real. La siguiente fase debe completar y verificar los datos antes de publicar un ranking utilizable. Este documento es una especificación pendiente; no declara tareas activadas.

## Orden de implementación

1. **Universo verificable.** Importar las listas autorizadas de S&P 500 y Nasdaq 100, deduplicar empresas / clases de acciones, resolver símbolos por proveedor y CIK, y registrar fecha efectiva, fuente y verificación. No inferir pertenencia por cotización en Nasdaq.
2. **Precios diarios.** Adaptador Alpaca multsímbolo, última sesión cerrada real, ventanas incrementales y todos los `next_page_token`. No etiquetar el día de ejecución como fecha de mercado. Persistir el proveedor realmente usado si hay un fallback explícito.
3. **Fundamentales semanales.** SEC `companyfacts` por CIK verificado y cambios de presentación; separar balance de cierre y flujos TTM. Conservar moneda, periodo y filing conocido en la fecha del análisis. No sumar tags ausentes como deuda cero.
4. **Estimaciones e historia mensuales.** FMP únicamente si la cuenta permite sus endpoints y cobertura. Mantener EPS forward ausente si no hay acceso. Verificar al menos cinco años completos, ajustes por splits y EPS conocido en cada fecha para PER histórico.
5. **Scoring y publicación.** Ejecutar el modelo existente con cohortes mínimas, cobertura y versión. Escribir precios, ratios y scores de forma idempotente; publicar un snapshot coherente y después llamar al endpoint de revalidación del frontend.

## Frecuencias objetivo

| Cadencia | Datos | Estrategia |
| --- | --- | --- |
| Diaria, después de sesión cerrada | Precios y ratios dependientes del precio | Peticiones masivas e incrementales; no repetir descargas de 6 años |
| Semanal | Nuevos filings, TTM y estimaciones disponibles | Consultar cambios y respetar cuotas por proveedor |
| Mensual | Universo, historia y revisión del modelo | Fuente verificable y backfill por lotes con checkpoint |

El cron usa UTC y debe respetar el cambio estacional de la hora de cierre estadounidense. Festivos y fines de semana no generan una nueva fecha de mercado. La frescura se calcula con fechas de datos reales.

## Supabase Free

- Usar `pg_cron` para encolar lotes y una Edge Function con un límite de trabajo por invocación, o una función planificada equivalente.
- El presupuesto temporal de Free es 150 s: lotes pequeños, timeout por proveedor, reintentos limitados, checkpoints y reanudación. El tamaño exacto del lote se mide, no se presupone.
- Guardar claves en secretos de funciones y Vault, nunca en tablas públicas, SQL de migraciones, logs ni variables del cliente.
- Revisar la autenticación de `pipeline-refresh`: su versión existente exige usuario `authenticated` y no constituye una interfaz de cron segura por sí sola. Definir autorización específica de jobs, limitar la ejecución e impedir invocaciones arbitrarias de cualquier usuario.
- Claves `sb_publishable_…` / `sb_secret_…` no son JWT. Si la función cambia de mecanismo de autenticación, comprobar la compatibilidad de `verify_jwt` y validar la credencial en el handler.
- Lock o lease por job, clave idempotente por lote / sesión, heartbeat y salida con recuentos de éxitos, ausencias y fallos. Los datos incompletos no sustituyen un snapshot válido como si estuvieran completos.
- Retención acotada de payloads y logs; guardar datos normalizados y metadatos suficientes para trazabilidad. Medir tamaño de tablas e índices frente a los 500 MB gratuitos.

## Criterios para activar el ranking

- Universo y símbolos comprobados; fechas de mercado reales.
- Once fórmulas conciliadas con los componentes de cada empresa y periodos / monedas coherentes.
- Patrimonio no positivo, bancos / aseguradoras, interés nulo y EBITDA negativo tratados explícitamente por el modelo sectorial.
- Reconciliación de deuda, efectivo, NOPAT, capital invertido y EPS forward sin imputaciones silenciosas.
- Cohortes, cobertura, percentiles y puntuaciones reproducibles por versión.
- Una prueba de pipeline de extremo a extremo con un lote pequeño, incluidos 429 / 5xx y reejecución idempotente, antes de configurar el cron completo.
- Coste y acceso de proveedores confirmados con las cuentas existentes. No contratar FMP ni datos IBKR de pago automáticamente.

Fuentes: [Alpaca market data](https://docs.alpaca.markets/docs/about-market-data-api), [SEC APIs](https://www.sec.gov/search-filings/edgar-application-programming-interfaces), [Supabase scheduling](https://supabase.com/docs/guides/functions/schedule-functions), [Supabase Edge limits](https://supabase.com/docs/guides/functions/limits).
