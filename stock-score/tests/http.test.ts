import test from "node:test";
import assert from "node:assert/strict";
import { fetchWithRetry, HttpError } from "../src/lib/http";

test("429 respeta Retry-After y vuelve a intentar sin reenviar secretos al log", async () => {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls++; return calls === 1 ? new Response(null, { status: 429, headers: { "retry-after": "0.001" } }) : new Response("[]"); };
  try { const response = await fetchWithRetry("https://example.test"); assert.equal(response.status, 200); assert.equal(calls, 2); }
  finally { globalThis.fetch = original; }
});

test("401 no se reintenta", async () => {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls++; return new Response(null, { status: 401 }); };
  try { await assert.rejects(fetchWithRetry("https://example.test"), error => error instanceof HttpError && error.status === 401); assert.equal(calls, 1); }
  finally { globalThis.fetch = original; }
});

test("limita los reintentos ante un proveedor caído", async () => {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls++; return new Response(null, { status: 503, headers: { "retry-after": "0.001" } }); };
  try { await assert.rejects(fetchWithRetry("https://example.test"), error => error instanceof HttpError && error.status === 503); assert.equal(calls, 3); }
  finally { globalThis.fetch = original; }
});

test("un Retry-After largo difiere la lectura sin incumplir la ventana del proveedor", async () => {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls++; return new Response(null, { status: 429, headers: { "retry-after": "120" } }); };
  try { await assert.rejects(fetchWithRetry("https://example.test"), error => error instanceof HttpError && error.status === 429); assert.equal(calls, 1); }
  finally { globalThis.fetch = original; }
});
