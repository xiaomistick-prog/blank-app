import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { createRequire } from "node:module";

const root = fileURLToPath(new URL("../", import.meta.url));
const output = new URL("../artifacts/", import.meta.url);
await mkdir(output, { recursive: true });
const secret = randomBytes(32).toString("hex");
const port = 4310;
const base = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", String(port)], { cwd: root, env: { ...process.env, REVALIDATE_SECRET: secret }, stdio: ["ignore", "pipe", "pipe"] });
let serverLog = "";
server.stdout.on("data", data => { serverLog += data; });
server.stderr.on("data", data => { serverLog += data; });
const checks = [];
const errors = [];
const require = createRequire(import.meta.url);
const axePath = require.resolve("axe-core/axe.min.js");
let browser;

try {
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    try { if ((await fetch(base)).ok) { ready = true; break; } } catch { /* proceso iniciándose */ }
    if (server.exitCode !== null) throw new Error(`El servidor terminó: ${serverLog}`);
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  assert.ok(ready, `El servidor no arrancó: ${serverLog}`);
  const executablePath = process.env.CHROME_EXECUTABLE_PATH;
  browser = await chromium.launch({ ...(executablePath ? { executablePath } : {}), args: ["--no-sandbox", "--disable-dev-shm-usage"] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1080 }, locale: "es-ES" });
  const page = await context.newPage();
  page.on("pageerror", error => errors.push(error.message));
  page.on("request", request => {
    assert.ok(!request.url().includes(".supabase.co"), "El cliente no debe consultar Supabase directamente");
  });
  await page.goto(base, { waitUntil: "networkidle" });
  const initialIndexPending = await page.getByText("Universo de índices pendiente de verificar", { exact: true }).count() > 0;
  const initialScoreCount = parseInt(await page.locator(".summary-card").nth(2).locator("strong").innerText(), 10);
  assert.ok(await page.getByRole("heading", { level: 1 }).isVisible());
  assert.ok(await page.locator(".stock-card").count() > 0, "Esta prueba requiere un catálogo real configurado");
  assert.ok(!await page.locator("nextjs-portal").count());
  assert.ok(!(await page.content()).includes("sb_publishable_"));
  await page.addScriptTag({ path: axePath });
  const desktopA11y = await page.evaluate(async () => (await window.axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] } })).violations.map(({ id, nodes }) => ({ id, elements: nodes.map(node => node.target) })));
  assert.deepEqual(desktopA11y, [], "Accesibilidad WCAG en escritorio");
  await page.screenshot({ path: fileURLToPath(new URL("desktop.png", output)) });
  checks.push("Catálogo real, sin errores de hidratación ni claves en HTML");

  await page.getByRole("searchbox", { name: "Buscar por ticker o empresa" }).fill("AAPL");
  await page.waitForFunction(() => document.querySelectorAll(".stock-card").length === 1);
  assert.ok((await page.locator(".stock-card").innerText()).includes("Apple Inc."));
  assert.ok((await page.locator(".stock-card").innerText()).includes("Distancia al mínimo de 52 semanas"));
  checks.push("Búsqueda y conversión de distancias a porcentajes");

  await page.getByRole("button", { name: "Guardar AAPL en mi lista", exact: true }).click();
  await page.reload({ waitUntil: "networkidle" });
  await page.locator(".sidebar").getByRole("button", { name: /Mi lista/ }).click();
  assert.equal(await page.locator(".stock-card").count(), 1);
  assert.ok((await page.locator(".stock-card").innerText()).includes("AAPL"));
  await page.getByRole("button", { name: "Quitar AAPL de mi lista", exact: true }).click();
  assert.ok(await page.getByRole("heading", { name: "Tu primera idea empieza aquí" }).isVisible());
  checks.push("Guardar, recargar, recuperar y eliminar la lista personal");

  await page.locator(".sidebar").getByRole("button", { name: "Explorar", exact: true }).click();
  await page.getByRole("button", { name: "S&P 500", exact: true }).click();
  if (initialIndexPending) assert.ok(await page.getByRole("heading", { name: "Este índice aún no está verificado" }).isVisible());
  await page.getByRole("button", { name: "Catálogo actual", exact: true }).click();
  await page.locator(".filter-panel summary").click();
  await page.getByLabel("Score vigente mínimo", { exact: true }).fill("70");
  if (initialScoreCount === 0) assert.equal(await page.locator(".stock-card").count(), 0);
  await page.getByRole("button", { name: "Restablecer filtros", exact: true }).click();
  await page.getByRole("combobox", { name: "Ordenar empresas" }).selectOption("low52");
  assert.ok(await page.locator(".stock-card").count() > 0);
  checks.push("Filtros de índices y score, restablecer y ordenar con valores ausentes");

  await page.getByRole("searchbox").fill("AAPL");
  await page.getByRole("link", { name: "AAPL", exact: true }).click();
  await page.waitForURL("**/accion/AAPL");
  assert.ok(await page.getByRole("heading", { name: "Apple Inc.", exact: true }).isVisible());
  for (const title of ["Valoración", "Calidad", "Solidez"]) assert.ok(await page.getByRole("heading", { name: title, exact: true }).isVisible());
  assert.ok((await page.locator("main").innerText()).includes("Fechas y cobertura"));
  await page.screenshot({ path: fileURLToPath(new URL("ficha.png", output)), fullPage: true });
  checks.push("Ficha con los once ratios, cobertura y fechas");

  await page.goto(`${base}/metodologia`, { waitUntil: "networkidle" });
  assert.ok(await page.getByRole("heading", { name: "Ratios financieros", exact: true }).isVisible());
  await page.goto(`${base}/accion/TICKER-INEXISTENTE`, { waitUntil: "networkidle" });
  assert.ok(await page.getByRole("heading", { name: "Esta empresa no está en el catálogo", exact: true }).isVisible());
  checks.push("Metodología y página 404 para empresas inexistentes");

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(base, { waitUntil: "networkidle" });
  await page.getByRole("searchbox").fill("AAPL");
  await page.screenshot({ path: fileURLToPath(new URL("mobile.png", output)), fullPage: true });
  await page.addScriptTag({ path: axePath });
  const mobileA11y = await page.evaluate(async () => (await window.axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] } })).violations.map(({ id, nodes }) => ({ id, elements: nodes.map(node => node.target) })));
  assert.deepEqual(mobileA11y, [], "Accesibilidad WCAG en móvil");
  for (const width of [360, 390, 430, 768]) {
    await page.setViewportSize({ width, height: 844 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Desbordamiento horizontal a ${width}px`);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Guardar AAPL en mi lista", exact: true }).click();
  await page.locator(".mobile-nav").getByRole("button", { name: /Mi lista/ }).click();
  assert.equal(await page.locator(".stock-card").count(), 1);
  await page.getByRole("button", { name: "Quitar AAPL de mi lista", exact: true }).click();
  checks.push("360–768 px sin desplazamiento horizontal, navegación móvil y axe sin infracciones WCAG");

  const unauthorized = await fetch(`${base}/api/revalidate`, { method: "POST", headers: { Authorization: "Bearer invalid" } });
  assert.equal(unauthorized.status, 401);
  const authorized = await fetch(`${base}/api/revalidate`, { method: "POST", headers: { Authorization: `Bearer ${secret}` } });
  assert.equal(authorized.status, 200);
  const refreshed = await fetch(base);
  assert.equal(refreshed.status, 200);
  const cached = await fetch(base);
  assert.ok(["HIT", "STALE"].includes(cached.headers.get("x-nextjs-cache")));
  checks.push("Revalidación protegida y respuesta de portada servida por ISR");
  assert.deepEqual(errors, []);
  const report = { verifiedAt: new Date().toISOString(), browser: await browser.version(), checks, errors };
  await writeFile(new URL("verification.json", output), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser?.close();
  server.kill("SIGTERM");
}
