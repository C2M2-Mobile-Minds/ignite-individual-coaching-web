import test from "node:test";
import assert from "node:assert/strict";

import { appendRow } from "../netlify/functions/lib/sheets.mjs";

function fakeDeps(responses) {
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    calls.push({ url: String(url), method: init.method || "GET", body: init.body });
    const next = responses.shift();
    return {
      ok: next.ok ?? true,
      status: next.status ?? 200,
      json: async () => next.json ?? {},
      text: async () => next.text ?? "",
    };
  };
  return {
    calls,
    deps: {
      spreadsheetId: "SHEET_ID",
      getAccessToken: async () => "tok",
      fetchImpl,
    },
  };
}

test("appendRow: writes header row when the tab is empty, then appends data", async () => {
  const { calls, deps } = fakeDeps([
    { json: {} }, // GET 1:1 -> no values
    { json: {} }, // PUT headers
    { json: {} }, // POST append
  ]);

  await appendRow(
    { tab: "Geral", headers: ["submitted_at", "nome"], row: ["2026-01-01", "Ana"] },
    deps,
  );

  assert.equal(calls.length, 3);
  assert.match(calls[0].url, /\/values\/Geral!1%3A1(\?|$)/);
  assert.equal(calls[0].method, "GET");

  assert.equal(calls[1].method, "PUT");
  assert.match(calls[1].url, /valueInputOption=RAW/);
  assert.deepEqual(JSON.parse(calls[1].body).values, [["submitted_at", "nome"]]);

  assert.equal(calls[2].method, "POST");
  assert.match(calls[2].url, /\/values\/Geral!A%3AA:append\?/);
  assert.match(calls[2].url, /insertDataOption=INSERT_ROWS/);
  assert.deepEqual(JSON.parse(calls[2].body).values, [["2026-01-01", "Ana"]]);
});

test("appendRow: skips header write when the tab already has a header row", async () => {
  const { calls, deps } = fakeDeps([
    { json: { values: [["submitted_at", "nome"]] } }, // GET 1:1 -> has values
    { json: {} }, // POST append
  ]);

  await appendRow(
    { tab: "Geral", headers: ["submitted_at", "nome"], row: ["x", "y"] },
    deps,
  );

  assert.equal(calls.length, 2);
  assert.equal(calls[1].method, "POST");
});

test("appendRow: encodes non-ascii tab names", async () => {
  const { calls, deps } = fakeDeps([
    { json: { values: [["a"]] } },
    { json: {} },
  ]);

  await appendRow({ tab: "Gestação-Pós-parto", headers: ["a"], row: ["b"] }, deps);

  assert.match(calls[0].url, /Gesta%C3%A7%C3%A3o-P%C3%B3s-parto/);
});

test("appendRow: sends the bearer token", async () => {
  const { calls, deps } = fakeDeps([{ json: { values: [["a"]] } }, { json: {} }]);
  deps.fetchImpl = async (url, init) => {
    calls.push(init.headers);
    return { ok: true, status: 200, json: async () => ({ values: [["a"]] }) };
  };
  // re-wrap: simplest is to just check via a custom impl
  const headers = [];
  await appendRow(
    { tab: "Geral", headers: ["a"], row: ["b"] },
    {
      spreadsheetId: "S",
      getAccessToken: async () => "abc123",
      fetchImpl: async (url, init = {}) => {
        headers.push(init.headers || {});
        return { ok: true, status: 200, json: async () => ({ values: [["a"]] }) };
      },
    },
  );
  assert.ok(headers.every((h) => h.Authorization === "Bearer abc123"));
});

test("appendRow: throws a stage-tagged error on a non-2xx response", async () => {
  const { deps } = fakeDeps([
    { json: { values: [["a"]] } },
    { ok: false, status: 500, text: "boom" }, // append fails
  ]);

  await assert.rejects(
    appendRow({ tab: "Geral", headers: ["a"], row: ["b"] }, deps),
    (err) => {
      assert.equal(err.stage, "sheets");
      assert.match(err.message, /500/);
      return true;
    },
  );
});
