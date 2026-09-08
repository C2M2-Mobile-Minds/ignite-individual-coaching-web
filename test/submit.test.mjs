import test, { afterEach } from "node:test";
import assert from "node:assert/strict";

import { submitForm } from "../js/submit.js";

const origFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = origFetch;
});

test("POSTs the payload as JSON to the Netlify function and resolves its body", async () => {
  let seen;
  globalThis.fetch = async (url, init) => {
    seen = { url: String(url), init };
    return { ok: true, json: async () => ({ ok: true, flow: "geral" }) };
  };

  const result = await submitForm({ nome: "Ana" });

  assert.equal(seen.url, "/.netlify/functions/submit");
  assert.equal(seen.init.method, "POST");
  assert.equal(seen.init.headers["Content-Type"], "application/json");
  assert.deepEqual(JSON.parse(seen.init.body), { nome: "Ana" });
  assert.deepEqual(result, { ok: true, flow: "geral" });
});

test("throws when the function responds non-ok", async () => {
  globalThis.fetch = async () => ({ ok: false, status: 502, json: async () => ({ error: "sheets_write_failed" }) });
  await assert.rejects(submitForm({ nome: "Ana" }), /502|sheets_write_failed/);
});

test("rejects when fetch itself throws (network failure)", async () => {
  globalThis.fetch = async () => {
    throw new TypeError("Failed to fetch");
  };
  await assert.rejects(submitForm({ nome: "Ana" }), /Failed to fetch/);
});
