# VISION Stock Scout

Frontend de análisis fundamental en español, preparado para añadirse como carpeta `stock-score/` al repositorio `xiaomistick-prog/blank-app`. El proyecto Streamlit de la raíz permanece independiente.

## Qué incluye

- Next.js App Router, React, TypeScript estricto y Tailwind CSS 4.
- Screener con búsqueda, filtros de índice y sector, score mínimo, ROIC mínimo, PER máximo y proximidad al mínimo de 52 semanas.
- Ordenación por score vigente, ROIC, PER, mínimos de 52 semanas / 5 años y ticker. Los valores ausentes siempre van al final.
- Tarjetas móviles, indicadores desplegables, paginación y fichas con valoración, calidad y solidez.
- Lista personal versionada en `localStorage`, compartida entre pestañas del mismo navegador. No requiere cuentas; no se sincroniza entre dispositivos.
- Fechas de precio, fundamentales, estimaciones e índices; scores incompletos u obsoletos ocultos.
- Lectura masiva de `public.v_stock_score_v1` con caché de una hora. Portada y metodología generadas estáticamente con ISR; fichas generadas bajo demanda.
- Revalidación protegida después de un pipeline y reintentos limitados ante 429 / 5xx / fallos de red.
- Módulo financiero con las once fórmulas solicitadas, probado con pérdidas, patrimonio no positivo, deuda desconocida y efectivo neto.
- Etapa de precios Alpaca por lotes versionada en `supabase/functions/market-prices/`, pendiente de migración, secretos, prueba en entorno aislado y programación. Véase [estado y activación](docs/market-prices.md).

## Ejecutar

Node.js 22 o superior. Las versiones de dependencias y el lockfile están fijados.

```bash
cd stock-score
npm ci
cp .env.example .env.local
# Configura SUPABASE_URL y SUPABASE_PUBLISHABLE_KEY en .env.local.
npm run dev
```

Abre `http://localhost:3000`. Sin variables, la aplicación muestra una conexión pendiente; no introduce datos ficticios.

La clave publicable se obtiene en Supabase → Project Settings → API Keys. El servidor envía el encabezado `apikey` a PostgREST. Las claves opacas `sb_publishable_…` no son JWT y no se envían como `Authorization: Bearer`.

```bash
npm run typecheck
npm test
npm run build
npm start
```

## Datos existentes

Esta implementación se ha conectado al proyecto Supabase existente `vision-stock-scout`, con la vista `public.v_stock_score_v1` creada en la fase anterior. No crea un segundo proyecto ni cambia sus pipelines.

Estado comprobado el **30 de septiembre de 2026**:

| Dato | Estado |
| --- | --- |
| Empresas activas importadas | 154 |
| Aptas para el modelo actual | 92 |
| Con precio | 78 |
| Última fecha de precio disponible | 1 de septiembre de 2026 |
| Puntuaciones calculadas | 0 |
| Pertenencias verificadas a S&P 500 / Nasdaq 100 | 0 |

El catálogo incluye mercados adicionales. Por defecto se muestran las empresas aptas para el modelo; se puede quitar ese filtro. Los filtros de índices solo utilizan pertenencias verificadas y actualmente producen un estado vacío explicado. La página de metodología describe la cobertura real.

**Importante:** las distancias históricas del esquema heredado se guardan como fracciones. `normalizeStock` las multiplica por 100 para mostrarlas en puntos porcentuales; los campos `roe_pct`, `roic_pct`, `operating_margin_pct` y `net_margin_pct` ya llegan multiplicados por 100. Este contrato está documentado y probado.

La cobertura temporal y los ajustes de los mínimos de 5 años deben verificarse en el pipeline antes de utilizarlos como evidencia de valoración histórica. Los fundamentales y estimaciones aún no permiten calcular scores. No se han activado tareas nocturnas en esta fase.

## Caché y errores

`getScreenerData` consulta una vista denormalizada, en páginas de hasta 500 empresas, con orden estable. El universo deduplicado de ambos índices cabe normalmente en dos páginas. La caché de `fetch` se comparte entre portada y fichas; no existe polling en el navegador. Los filtros, ordenación y lista personal no consultan la base de datos.

La regeneración de ISR depende de visitas: `revalidate = 3600` no es un reloj nocturno ni garantiza datos recién cargados. La UI siempre enseña las fechas de origen. Una conexión ausente o una lectura fallida producen estados explícitos. La caché puede seguir sirviendo la última respuesta válida; no se añade un proveedor alternativo silencioso ni se inventan ratios. Un primer fallo sin caché puede dejar el estado de error hasta la siguiente regeneración o revalidación.

Los fallos transitorios se reintentan hasta tres veces, con timeout de 10 s por intento y espera exponencial. Se respeta `Retry-After`; si exige más de 4 s, se difiere la lectura en lugar de incumplir la ventana del proveedor. Un 401/403 no se reintenta. Los logs omiten claves y cuerpos del proveedor. La lectura pública depende de las políticas RLS existentes; nunca se utiliza `service_role`.

## Vercel

1. Incorpora esta carpeta al repositorio existente.
2. Importa el repositorio en Vercel y establece **Root Directory: `stock-score`**, framework Next.js.
3. Configura `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` y, opcionalmente, `REVALIDATE_SECRET` en el entorno de servidor.
4. Compila primero en Preview y revisa cobertura y fechas antes de promover a producción.

`REVALIDATE_SECRET` debe tener al menos 32 caracteres aleatorios y ser distinto de las claves de Supabase o los proveedores. No se incluyen credenciales en el código ni en la entrega.

La ruta `POST /api/revalidate` acepta `Authorization: Bearer <REVALIDATE_SECRET>`. Devuelve 503 si no está configurada, 401 con una credencial inválida y 200 si invalida la etiqueta de datos y las rutas. La política es stale-while-revalidate: la siguiente visita puede recibir el contenido anterior mientras se actualiza.

## FinOps: objetivo inferior a 10 €/mes

| Servicio | Elección | Condición |
| --- | --- | --- |
| Hosting | Vercel Hobby | Uso personal no comercial y dentro de sus cuotas |
| Base de datos y funciones | Supabase Free existente | Controlar almacenamiento, egress y límites de ejecución |
| Precios | Alpaca configurado en el pipeline | Feed y permisos de la cuenta; peticiones multísímbolo e incrementales |
| Fundamentales | SEC EDGAR | Empresas con CIK verificado, identidad del cliente y acceso moderado |
| Estimaciones | FMP, si el plan lo permite | Mantener NULL cuando no haya cobertura gratuita; no contratar automáticamente |
| IBKR | Adaptador futuro opcional | Requiere sesión y permisos propios; no se usa como servicio gratuito garantizado |

La infraestructura de esta fase puede permanecer en 0 € dentro de los planes gratuitos, para uso personal. No es una garantía del coste del suministro completo de datos. Un producto comercial no cumple las condiciones de Hobby; estimaciones completas o permisos de redistribución pueden requerir otro presupuesto. No se han contratado planes ni complementos de pago.

Límites consultados el 30/09/2026: Supabase Free incluye una base de datos de 500 MB y 500.000 invocaciones de Edge Functions; el tiempo máximo de una función en Free es 150 s. Los pipelines deben dividirse en lotes con checkpoints y evitar descargar seis años completos cada noche.

Fuentes oficiales: [Vercel Hobby](https://vercel.com/docs/plans/hobby), [Supabase billing](https://supabase.com/docs/guides/platform/billing-on-supabase), [Edge Function limits](https://supabase.com/docs/guides/functions/limits), [Next.js ISR](https://nextjs.org/docs/app/guides/incremental-static-regeneration).

## Verificación de interfaz

```bash
npx playwright install chromium
npm run build
npm run test:ui
```

El script arranca y cierra su propio servidor, crea un contexto de navegador temporal y escribe capturas e informe en `artifacts/`. Si Chromium ya está instalado en otra ruta, configura `CHROME_EXECUTABLE_PATH`. Requiere el catálogo real configurado y Apple en él. Comprueba búsqueda, lista persistente, filtros, ficha, 404, vista móvil, falta de claves en HTML, errores de hidratación, ISR y revalidación autenticada. El estado vacío de índices y el score mínimo se contrastan con la cobertura actual del catálogo.

## Estructura

| Ruta | Responsabilidad |
| --- | --- |
| `src/app/` | Páginas, estados de error, manifiesto e invalidación |
| `src/components/` | Screener, tarjetas, marca y lista personal |
| `src/lib/data.ts` | Acceso servidor a Supabase y caché |
| `src/lib/normalize.ts` | Contrato, NULL y unidades |
| `src/lib/screener.ts` | Vigencia, filtros y ordenación |
| `src/lib/finance.ts` | Fórmulas financieras puras |
| `tests/` | Casos financieros, HTTP y datos |
| `docs/` | Contrato de datos y siguiente fase del pipeline |

El manifiesto permite una presentación independiente en navegadores compatibles. No se ha implementado un service worker ni se promete funcionamiento sin conexión.
