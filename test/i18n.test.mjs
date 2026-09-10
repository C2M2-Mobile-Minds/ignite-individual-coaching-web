import test from "node:test";
import assert from "node:assert/strict";

import { t } from "../js/i18n.js";

// These run before any loadLocale() call, so `strings` is empty and
// `currentLocale` is null — the exact state that produced the prod
// "missing key ... for locale null" warnings on the landing screen.

test("t: falls back to built-in copy for landing/title keys with no locale loaded", () => {
  assert.equal(t("app.title"), "Ignite Individual Coaching");
  assert.equal(t("landing.tagline"), "Ignite your true potential");
  assert.equal(t("landing.cta"), "Começar");
  assert.match(t("landing.message"), /^Se chegaste até à Ignite/);
});

test("t: no console.warn when a fallback key is served pre-locale", () => {
  const warnings = [];
  const original = console.warn;
  console.warn = (...a) => warnings.push(a.join(" "));
  try {
    t("app.title");
    t("landing.cta");
  } finally {
    console.warn = original;
  }
  assert.deepEqual(warnings, []);
});

test("t: an unknown key still warns and echoes the key back", () => {
  const warnings = [];
  const original = console.warn;
  console.warn = (...a) => warnings.push(a.join(" "));
  try {
    assert.equal(t("form.field.does_not_exist"), "form.field.does_not_exist");
  } finally {
    console.warn = original;
  }
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /missing key "form\.field\.does_not_exist"/);
});
