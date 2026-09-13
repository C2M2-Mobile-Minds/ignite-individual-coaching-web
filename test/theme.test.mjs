import test from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_THEME,
  NEUTRAL_THEME,
  THEME_BY_OBJETIVO,
  themeForAnswers,
  applyTheme,
  applyNeutralTheme,
  logoForAnswers,
} from "../js/theme.js";

test("only gestacao_posparto has a themed palette", () => {
  assert.deepEqual(Object.keys(THEME_BY_OBJETIVO), ["gestacao_posparto"]);
});

test("themeForAnswers: gestacao_posparto selected -> its theme", () => {
  assert.equal(
    themeForAnswers({ objetivo_treino: ["gestacao_posparto"] }),
    THEME_BY_OBJETIVO.gestacao_posparto,
  );
  // still themed when combined with other objectives
  assert.equal(
    themeForAnswers({ objetivo_treino: ["ganho_massa", "gestacao_posparto"] }),
    THEME_BY_OBJETIVO.gestacao_posparto,
  );
});

test("themeForAnswers: any other / no selection -> DEFAULT_THEME", () => {
  assert.equal(themeForAnswers({ objetivo_treino: ["ganho_massa", "forca_atletismo"] }), DEFAULT_THEME);
  assert.equal(themeForAnswers({ objetivo_treino: [] }), DEFAULT_THEME);
  assert.equal(themeForAnswers({}), DEFAULT_THEME);
  assert.equal(themeForAnswers(undefined), DEFAULT_THEME);
});

test("locked-in palette hex values", () => {
  // Every page is a flat #F2F0EB fill; only text/logo vary by branch, except
  // the gestação confirmation screen, which breaks from the fill.
  assert.equal(DEFAULT_THEME.bg, "#F2F0EB");
  assert.equal(DEFAULT_THEME.confirmationBg, "#F2F0EB");
  assert.equal(DEFAULT_THEME.text, "#899064");
  assert.equal(DEFAULT_THEME.confirmationText, "#899064");
  assert.equal(DEFAULT_THEME.logo, "green");

  assert.equal(THEME_BY_OBJETIVO.gestacao_posparto.bg, "#F2F0EB");
  assert.equal(THEME_BY_OBJETIVO.gestacao_posparto.text, "#CA9A8E");
  assert.equal(THEME_BY_OBJETIVO.gestacao_posparto.confirmationBg, "#EAA794");
  assert.equal(THEME_BY_OBJETIVO.gestacao_posparto.confirmationText, "#4a2418");
  assert.equal(THEME_BY_OBJETIVO.gestacao_posparto.logo, "pink");

  assert.equal(NEUTRAL_THEME.bg, "#F2F0EB");
  assert.equal(NEUTRAL_THEME.text, "#899064");
  assert.equal(NEUTRAL_THEME.logo, "green");
});

test("logoForAnswers: green by default, pink for gestacao_posparto", () => {
  assert.equal(logoForAnswers({}), "green");
  assert.equal(logoForAnswers({ objetivo_treino: ["ganho_massa"] }), "green");
  assert.equal(logoForAnswers({ objetivo_treino: ["gestacao_posparto"] }), "pink");
});

test("applyTheme: writes the full custom-property set onto the given root", () => {
  const props = {};
  const root = { style: { setProperty: (k, v) => (props[k] = v) } };

  applyTheme({ objetivo_treino: ["gestacao_posparto"] }, root);
  assert.equal(props["--bg"], THEME_BY_OBJETIVO.gestacao_posparto.bg);
  assert.equal(props["--bg-accent"], THEME_BY_OBJETIVO.gestacao_posparto.bgAccent);
  assert.equal(props["--text"], THEME_BY_OBJETIVO.gestacao_posparto.text);
  assert.equal(props["--accent"], THEME_BY_OBJETIVO.gestacao_posparto.accent);
  assert.equal(props["--accent-bright"], THEME_BY_OBJETIVO.gestacao_posparto.accentBright);
  assert.equal(props["--accent-hover"], THEME_BY_OBJETIVO.gestacao_posparto.accentHover);
  assert.equal(props["--accent-soft"], THEME_BY_OBJETIVO.gestacao_posparto.accentSoft);

  applyTheme({}, root);
  assert.equal(props["--bg"], DEFAULT_THEME.bg);
  assert.equal(props["--accent"], DEFAULT_THEME.accent);
});

test("applyTheme: confirmation option swaps bg/bg-accent for confirmationBg", () => {
  const props = {};
  const root = { style: { setProperty: (k, v) => (props[k] = v) } };

  applyTheme({ objetivo_treino: ["gestacao_posparto"] }, root, { confirmation: true });
  assert.equal(props["--bg"], THEME_BY_OBJETIVO.gestacao_posparto.confirmationBg);
  assert.equal(props["--bg-accent"], THEME_BY_OBJETIVO.gestacao_posparto.confirmationBg);

  applyTheme({}, root, { confirmation: true });
  assert.equal(props["--bg"], DEFAULT_THEME.confirmationBg);
  assert.equal(props["--bg-accent"], DEFAULT_THEME.confirmationBg);
});

test("applyNeutralTheme: writes NEUTRAL_THEME regardless of answers", () => {
  const props = {};
  const root = { style: { setProperty: (k, v) => (props[k] = v) } };

  applyNeutralTheme(root);
  assert.equal(props["--bg"], NEUTRAL_THEME.bg);
  assert.equal(props["--bg-accent"], NEUTRAL_THEME.bgAccent);
  assert.equal(props["--text"], NEUTRAL_THEME.text);
  assert.equal(props["--accent"], NEUTRAL_THEME.accent);
});
