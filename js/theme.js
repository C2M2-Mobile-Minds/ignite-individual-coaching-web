// Objetivo-driven page theming (issue #48).
//
// Only the "gestação e pós-parto" objective themes the page. Every other
// `objetivo_treino` selection (and no selection) keeps DEFAULT_THEME. This file
// is the SINGLE source for the mapping — when the client delivers final palettes
// (or wants more objectives themed), edit `THEME_BY_OBJETIVO` / `DEFAULT_THEME`
// here only; no markup or logic changes needed.
//
// Placeholder hues for now, same holding pattern as the landing screen (#47).
//
// Scope: the theme is applied on the steps AFTER "dados_basicos" (and the
// confirmation screen). The landing screen and "dados_basicos" itself always
// render with DEFAULT_THEME — the gate lives in formEngine.js. In practice the
// themed steps (fase_gestacao / gestacao / posparto) only exist when
// gestacao_posparto is selected anyway.

const GESTACAO_POSPARTO = "gestacao_posparto";

/** Neutral/default theme — the existing green brand accent, black ground. */
export const DEFAULT_THEME = {
  bg: "#000",
  accent: "#4a783a",
  accentBright: "#6aaa55",
  accentHover: "#5a8a4a",
  accentSoft: "rgba(74, 120, 58, 0.16)",
};

/**
 * Palette per themed `objetivo_treino` option id. PLACEHOLDER colours — swap for
 * the client's final palette when it arrives. Keys must match the schema option
 * ids. Currently only `gestacao_posparto` is themed.
 */
export const THEME_BY_OBJETIVO = {
  [GESTACAO_POSPARTO]: {
    bg: "#140b11",
    accent: "#9a3f6b",
    accentBright: "#cc6499",
    accentHover: "#b04f80",
    accentSoft: "rgba(204, 100, 153, 0.16)",
  },
};

/**
 * The theme object for the given answers: if any selected `objetivo_treino`
 * option has a mapping, use it (first wins if that ever grows), else
 * DEFAULT_THEME. Pure.
 */
export function themeForAnswers(answers) {
  const selected = Array.isArray(answers?.objetivo_treino) ? answers.objetivo_treino : [];
  for (const id of selected) {
    if (THEME_BY_OBJETIVO[id]) return THEME_BY_OBJETIVO[id];
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
