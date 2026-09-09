// Objetivo-driven page theming (issue #48).
//
// The form's accent colour follows the training objective picked on Page 1
// (`objetivo_treino`). This file is the SINGLE source for the colour-to-objetivo
// mapping — when the client delivers the final palettes, edit `THEME_BY_OBJETIVO`
// (and `DEFAULT_THEME`) here only; no markup or logic changes needed.
//
// Placeholder hues for now, same holding pattern as the landing screen (#47).
//
// Multiple objectives can be selected (it's a checkbox group). Interim rule
// (pending client confirmation): the theme follows the FIRST selected option in
// schema order. No selection -> DEFAULT_THEME.
//
// Scope: the theme is applied on the steps AFTER "dados_basicos" (and the
// confirmation screen). The landing screen and "dados_basicos" itself always
// render with DEFAULT_THEME — the gate lives in formEngine.js.

import { steps } from "./formSchema.js";

/** Neutral/default theme — the existing green brand accent, black ground. */
export const DEFAULT_THEME = {
  bg: "#000",
  accent: "#4a783a",
  accentBright: "#6aaa55",
  accentHover: "#5a8a4a",
  accentSoft: "rgba(74, 120, 58, 0.16)",
};

/**
 * Accent per `objetivo_treino` option id. PLACEHOLDER colours — swap for the
 * client's final palette when it arrives. Keys must match the schema option ids.
 */
export const THEME_BY_OBJETIVO = {
  ganho_massa: {
    bg: "#140b0a",
    accent: "#8a3b2f",
    accentBright: "#c05c48",
    accentHover: "#a4472f",
    accentSoft: "rgba(192, 92, 72, 0.16)",
  },
  recomposicao: {
    bg: "#0a1213",
    accent: "#2f6f7a",
    accentBright: "#48a7b6",
    accentHover: "#3a8894",
    accentSoft: "rgba(72, 167, 182, 0.16)",
  },
  saude_longevidade: {
    bg: "#0b110a",
    accent: "#4a783a",
    accentBright: "#6aaa55",
    accentHover: "#5a8a4a",
    accentSoft: "rgba(74, 120, 58, 0.16)",
  },
  reforco_modalidade: {
    bg: "#0e0b14",
    accent: "#5a4a86",
    accentBright: "#8571c0",
    accentHover: "#6d5aa0",
    accentSoft: "rgba(133, 113, 192, 0.16)",
  },
  forca_atletismo: {
    bg: "#13100a",
    accent: "#8a6a1f",
    accentBright: "#c79b3a",
    accentHover: "#a4802a",
    accentSoft: "rgba(199, 155, 58, 0.16)",
  },
  gestacao_posparto: {
    bg: "#140b11",
    accent: "#9a3f6b",
    accentBright: "#cc6499",
    accentHover: "#b04f80",
    accentSoft: "rgba(204, 100, 153, 0.16)",
  },
};

/** `objetivo_treino` option ids in schema order — drives the "first selected" rule. */
export const OBJETIVO_ORDER = (
  steps
    .find((s) => s.id === "dados_basicos")
    .fields.find((f) => f.id === "objetivo_treino").options
).map((o) => o.id);

/**
 * The theme object for the given answers: the first `objetivo_treino` option in
 * schema order that is selected and has a mapping, else DEFAULT_THEME. Pure.
 */
export function themeForAnswers(answers) {
  const selected = Array.isArray(answers?.objetivo_treino) ? answers.objetivo_treino : [];
  for (const id of OBJETIVO_ORDER) {
    if (selected.includes(id) && THEME_BY_OBJETIVO[id]) return THEME_BY_OBJETIVO[id];
  }
  return DEFAULT_THEME;
}

/**
 * Resolve the theme for `answers` and write it onto `root` as CSS custom
 * properties. Always writes the full set (default included) so deselecting an
 * objetivo reverts cleanly.
 */
export function applyTheme(answers, root = document.documentElement) {
  const theme = themeForAnswers(answers);
  root.style.setProperty("--bg", theme.bg);
  root.style.setProperty("--accent", theme.accent);
  root.style.setProperty("--accent-bright", theme.accentBright);
  root.style.setProperty("--accent-hover", theme.accentHover);
  root.style.setProperty("--accent-soft", theme.accentSoft);
}
