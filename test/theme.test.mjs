import test from "node:test";
import assert from "node:assert/strict";

import { DEFAULT_THEME, THEME_BY_OBJETIVO, themeForAnswers, applyTheme } from "../js/theme.js";

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

test("applyTheme: writes the full custom-property set onto the given root", () => {
  const props = {};
  const root = { style: { setProperty: (k, v) => (props[k] = v) } };

  applyTheme({ objetivo_treino: ["gestacao_posparto"] }, root);
  assert.equal(props["--bg"], THEME_BY_OBJETIVO.gestacao_posparto.bg);
  assert.equal(props["--accent"], THEME_BY_OBJETIVO.gestacao_posparto.accent);
  assert.equal(props["--accent-bright"], THEME_BY_OBJETIVO.gestacao_posparto.accentBright);
  assert.equal(props["--accent-hover"], THEME_BY_OBJETIVO.gestacao_posparto.accentHover);
  assert.equal(props["--accent-soft"], THEME_BY_OBJETIVO.gestacao_posparto.accentSoft);

  applyTheme({}, root);
  assert.equal(props["--bg"], DEFAULT_THEME.bg);
  assert.equal(props["--accent"], DEFAULT_THEME.accent);
});
