import test from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_THEME,
  THEME_BY_OBJETIVO,
  OBJETIVO_ORDER,
  themeForAnswers,
  applyTheme,
} from "../js/theme.js";
import { steps } from "../js/formSchema.js";

test("OBJETIVO_ORDER matches the schema's objetivo_treino option ids", () => {
  const schemaIds = steps
    .find((s) => s.id === "dados_basicos")
    .fields.find((f) => f.id === "objetivo_treino")
    .options.map((o) => o.id);
  assert.deepEqual(OBJETIVO_ORDER, schemaIds);
});

test("themeForAnswers: a single known objetivo returns its theme", () => {
  assert.equal(themeForAnswers({ objetivo_treino: ["forca_atletismo"] }), THEME_BY_OBJETIVO.forca_atletismo);
});

test("themeForAnswers: no / empty / missing objetivo returns DEFAULT_THEME", () => {
  assert.equal(themeForAnswers({}), DEFAULT_THEME);
  assert.equal(themeForAnswers({ objetivo_treino: [] }), DEFAULT_THEME);
  assert.equal(themeForAnswers(undefined), DEFAULT_THEME);
});

test("themeForAnswers: an unknown id returns DEFAULT_THEME", () => {
  assert.equal(themeForAnswers({ objetivo_treino: ["not_a_real_id"] }), DEFAULT_THEME);
});

test("themeForAnswers: multiple selected -> first in schema order, not insertion order", () => {
  // reforco_modalidade comes before forca_atletismo in the schema
  const answers = { objetivo_treino: ["forca_atletismo", "reforco_modalidade"] };
  assert.equal(themeForAnswers(answers), THEME_BY_OBJETIVO.reforco_modalidade);
});

test("applyTheme: writes the full custom-property set onto the given root", () => {
  const root = { style: new Map([["setProperty", null]]) };
  const props = {};
  root.style = { setProperty: (k, v) => (props[k] = v) };

  applyTheme({ objetivo_treino: ["recomposicao"] }, root);
  assert.equal(props["--accent"], THEME_BY_OBJETIVO.recomposicao.accent);
  assert.equal(props["--accent-bright"], THEME_BY_OBJETIVO.recomposicao.accentBright);
  assert.equal(props["--accent-hover"], THEME_BY_OBJETIVO.recomposicao.accentHover);
  assert.equal(props["--accent-soft"], THEME_BY_OBJETIVO.recomposicao.accentSoft);

  applyTheme({}, root);
  assert.equal(props["--accent"], DEFAULT_THEME.accent);
});
