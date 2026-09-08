import test from "node:test";
import assert from "node:assert/strict";

import {
  EEA_COUNTRIES,
  DEFAULT_DIAL_CODE,
  parsePhone,
  combinePhone,
} from "../js/countries.js";

test("EEA_COUNTRIES is a sane list", () => {
  assert.ok(EEA_COUNTRIES.length >= 27);
  assert.ok(EEA_COUNTRIES.every((c) => /^\+\d+$/.test(c.dialCode)));
  assert.ok(EEA_COUNTRIES.every((c) => c.code.length === 2 && c.name));
  const pt = EEA_COUNTRIES.find((c) => c.code === "PT");
  assert.equal(pt.dialCode, "+351");
  assert.equal(DEFAULT_DIAL_CODE, "+351");
  // no duplicate dial codes
  assert.equal(new Set(EEA_COUNTRIES.map((c) => c.dialCode)).size, EEA_COUNTRIES.length);
});

test("parsePhone splits a stored value on its dial code", () => {
  assert.deepEqual(parsePhone("+351 912345678"), { dialCode: "+351", local: "912345678" });
  assert.deepEqual(parsePhone("+33 612 345 678"), { dialCode: "+33", local: "612 345 678" });
});

test("parsePhone falls back to the default dial code", () => {
  assert.deepEqual(parsePhone(""), { dialCode: "+351", local: "" });
  assert.deepEqual(parsePhone(undefined), { dialCode: "+351", local: "" });
  assert.deepEqual(parsePhone("912345678"), { dialCode: "+351", local: "912345678" });
});

test("combinePhone joins, or returns '' for a blank local part", () => {
  assert.equal(combinePhone("+351", "912 345 678"), "+351 912 345 678");
  assert.equal(combinePhone("+34", "  "), "");
  assert.equal(combinePhone("+34", ""), "");
});

test("parsePhone / combinePhone round-trip", () => {
  const stored = "+49 15112345678";
  const { dialCode, local } = parsePhone(stored);
  assert.equal(combinePhone(dialCode, local), stored);
});
