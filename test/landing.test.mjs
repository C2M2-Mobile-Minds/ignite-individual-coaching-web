import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

const dom = new JSDOM('<!doctype html><html><body><div id="form-root"></div></body></html>');
global.window = dom.window;
global.document = dom.window.document;

// Import renderLanding WITHOUT ever calling loadLocale() — this is the exact
// prod failure mode: landing.js held a module instance of i18n.js whose locale
// was never loaded (the stamper had forked it from formEngine.js's instance).
// The built-in FALLBACK in i18n.js must carry the render.
const { renderLanding } = await import("../js/landing.js");

test("landing renders real copy (not raw keys) with no locale loaded", () => {
  const warnings = [];
  const original = console.warn;
  console.warn = (...a) => warnings.push(a.join(" "));
  try {
    renderLanding(() => {});
  } finally {
    console.warn = original;
  }

  const root = document.getElementById("form-root");
  assert.equal(root.querySelector(".landing-tagline").textContent, "Ignite your true potential");
  assert.equal(root.querySelector(".landing-cta").textContent, "Começar");
  assert.match(root.querySelector(".landing-message").textContent, /^Se chegaste até à Ignite/);
  assert.equal(root.querySelector(".landing-logo").alt, "Ignite Individual Coaching");

  // None of the values are the untranslated key, and nothing warned.
  assert.equal(root.querySelector(".landing-cta").textContent.includes("landing."), false);
  assert.deepEqual(warnings, []);
});

test("landing CTA is a plain button wired to the callback", () => {
  let started = 0;
  renderLanding(() => started++);
  document.getElementById("form-root").querySelector(".landing-cta").click();
  assert.equal(started, 1);
});
