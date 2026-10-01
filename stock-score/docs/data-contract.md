# Contrato de lectura v1

Origen: `public.v_stock_score_v1`, vista PostgreSQL con `security_invoker = true`, SELECT para `anon`/`authenticated` y RLS en las tablas base. El frontend no accede a los esquemas privados `finance` ni `ops`.

## Campos y unidades

| Familia | Campos | Convención |
| --- | --- | --- |
| Identidad | `company_id`, `ticker`, `name`, `exchange`, `currency`, `sector`, `industry`, `company_type` | Una fila por empresa activa; `company_id` es la clave de la lista |
| Elegibilidad | `score_eligible` | Booleano; no implica pertenencia a un índice |
| Universo | `index_codes`, `last_membership_check` | Solo SP500 / NDX100 y periodos efectivos verificados |
| Fechas | `as_of_date`, `market_data_date`, `fundamentals_date`, `estimates_date`, `data_updated_at` | Fecha de origen distinta de fecha de lectura |
| Precio | `price`, `low_52w`, `low_5y` | Moneda de la empresa; sin conversión FX |
| Distancias heredadas | `distance_52w_low_pct`, `distance_5y_low_pct` | **Fracciones en la vista actual**; UI × 100 |
| Retornos y márgenes | `roe_pct`, `roic_pct`, `operating_margin_pct`, `net_margin_pct` | Puntos porcentuales ya convertidos; no volver a × 100 |
| Valoración | `pe_trailing`, `pe_forward`, `ev_ebitda`, `pe_5y_min` | Múltiplos; forward = siguiente ejercicio fiscal |
| Solidez | `debt_to_equity`, `net_debt_ebitda`, `interest_coverage`, `current_ratio` | Múltiplos; efectivo neto negativo se conserva |
| Scoring | `score_total`, `score_quality`, `score_growth`, `score_valuation`, `score_balance` | Escala del modelo existente de 0 a 100 |
| Cobertura | `score_coverage` | Fracción entre 0 y 1 |
| Estado | `score_state`, `score_model_version`, `data_quality` | Modelo identificado y guardas de vigencia |

Las cuatro columnas originales `roe`, `roic`, `operating_margin` y `net_margin` son fracciones y no se utilizan como porcentajes en la UI. Los números REST pueden llegar como números o cadenas decimales; `NULL`, cadenas vacías, NaN y valores no finitos permanecen ausentes. Moneda desconocida se expresa como `XXX`, nunca se presupone USD.

La vista prioriza componentes normalizados y puede utilizar ratios almacenados del pipeline heredado cuando faltan componentes. Eso no verifica automáticamente la coherencia temporal, contable ni sectorial del cálculo.

## Vigencia de score

Se exige empresa elegible, estado `vigente`, score de 0–100, cobertura ≥ 0,80, precio con antigüedad ≤ 7 días, fundamentales con antigüedad ≤ 550 días y una fecha de cálculo no anterior a la del precio. No se aceptan fechas no válidas o futuras más allá del margen de un día UTC. Las guardas del cliente complementan las de la vista.

Los demás ratios se muestran con sus fechas, incluso si son antiguos. El filtro por score no utiliza un cálculo obsoleto; los filtros de ratios y distancias conservan explícitamente la fecha del precio.

## Consulta de comprobación (solo lectura)

```sql
select count(*) as empresas,
       count(price) as con_precio,
       count(score_total) as con_score,
       count(*) filter (where cardinality(index_codes) > 0) as con_indice,
       max(market_data_date) as ultimo_precio
from public.v_stock_score_v1;

select ticker, price, low_52w, distance_52w_low_pct,
       (price / nullif(low_52w, 0) - 1) as distancia_fraccion,
       roic_pct, score_state
from public.v_stock_score_v1
where ticker = 'AAPL';
```

Las migraciones anteriores ya están aplicadas al proyecto existente. Este paquete no replica el esquema completo ni contiene una migración parcial que pudiera sobrescribir datos o vistas inadvertidamente. Para instalar sobre una base nueva se debe versionar primero la línea base completa del proyecto.
