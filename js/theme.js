// Objetivo-driven page theming (issue #48; palette locked in for the
// palette/logo/typography pass — see docs/superpowers/specs equivalent plan).
//
// Only the "gestação e pós-parto" objective themes the page. Every other
// `objetivo_treino` selection (and no selection) keeps DEFAULT_THEME. This file
// is the SINGLE source for the mapping — when the client wants more objectives
// themed, edit `THEME_BY_OBJETIVO` / `DEFAULT_THEME` here only; no markup or
// logic changes needed.
//
// Scope: `themeForAnswers`/`applyTheme` theme the steps AFTER "dados_basicos"
// and the confirmation screen. The landing screen and "dados_basicos" itself
// always render with NEUTRAL_THEME via `applyNeutralTheme` — the gate lives in
// formEngine.js. In practice the themed steps (fase_gestacao / gestacao /
// posparto) only exist when gestacao_posparto is selected anyway.

const GESTACAO_POSPARTO = "gestacao_posparto";

// Every page shares one flat background (#F2F0EB) — only the text color and
// logo vary by branch. bg/bgAccent/confirmationBg are all the same value on
// every theme below; kept as separate fields (rather than collapsed into one)
// so writeTheme/applyTheme don't need special-casing per call site.

/**
 * Light neutral theme for the landing screen and "dados_basicos" — always
 * used there regardless of answers (objetivo_treino isn't answered yet).
 */
export const NEUTRAL_THEME = {
  bg: "#F2F0EB",
  bgAccent: "#F2F0EB",
  text: "#899064",
  accent: "#4a783a",
  accentBright: "#6aaa55",
  accentHover: "#5a8a4a",
  accentSoft: "rgba(74, 120, 58, 0.16)",
  logo: "green",
};

/** Default theme — used post-dados_basicos when gestacao_posparto isn't
 * selected. */
export const DEFAULT_THEME = {
  bg: "#F2F0EB",
  bgAccent: "#F2F0EB",
  text: "#899064",
  accent: "#4a783a",
  accentBright: "#6aaa55",
  accentHover: "#5a8a4a",
  accentSoft: "rgba(74, 120, 58, 0.16)",
  // Confirmation screen background (and text, for contrast against it) for
  // this theme.
  confirmationBg: "#F2F0EB",
  confirmationText: "#899064",
  logo: "green",
};

/**
 * Palette per themed `objetivo_treino` option id. Keys must match the schema
 * option ids. Currently only `gestacao_posparto` is themed.
 */
export const THEME_BY_OBJETIVO = {
  [GESTACAO_POSPARTO]: {
    bg: "#F2F0EB",
    bgAccent: "#F2F0EB",
    text: "#CA9A8E",
    accent: "#9a3f6b",
    accentBright: "#cc6499",
    accentHover: "#b04f80",
    accentSoft: "rgba(204, 100, 153, 0.16)",
    // Confirmation screen background for this theme — the one page that
    // breaks from the flat #F2F0EB fill everywhere else. Text darkened here
    // (the regular #CA9A8E is too close in tone to #EAA794 to stay legible).
    confirmationBg: "#EAA794",
    confirmationText: "#4a2418",
    logo: "pink",
  },
};

/**
 * The theme object for the given answers: if any selected `objetivo_treino`
 * option has a mapping, use it (first wins if that ever grows), else
 * DEFAULT_THEME. Pure. Never returns NEUTRAL_THEME — that's only for the
 * landing/dados_basicos screens, applied via `applyNeutralTheme`.
 */
export function themeForAnswers(answers) {
  const selected = Array.isArray(answers?.objetivo_treino) ? answers.objetivo_treino : [];
  for (const id of selected) {
    if (THEME_BY_OBJETIVO[id]) return THEME_BY_OBJETIVO[id];
  }
  return DEFAULT_THEME;
}

/** Write `theme`'s tokens onto `root` as CSS custom properties. Always writes
 * the full set so switching themes reverts every token cleanly. `bg`/`bgAccent`
 * are swapped for `theme.confirmationBg` when `confirmation` is true. */
function writeTheme(theme, root, { confirmation = false } = {}) {
  const bg = confirmation ? theme.confirmationBg : theme.bg;
  const bgAccent = confirmation ? theme.confirmationBg : theme.bgAccent;
  const text = confirmation ? theme.confirmationText : theme.text;
  root.style.setProperty("--bg", bg);
  root.style.setProperty("--bg-accent", bgAccent);
  root.style.setProperty("--text", text);
  root.style.setProperty("--accent", theme.accent);
  root.style.setProperty("--accent-bright", theme.accentBright);
  root.style.setProperty("--accent-hover", theme.accentHover);
  root.style.setProperty("--accent-soft", theme.accentSoft);
}

/**
 * Resolve the theme for `answers` and write it onto `root` as CSS custom
 * properties. Pass `confirmation: true` on the terminal screen so the
 * gestação branch gets its confirmation-specific background.
 */
export function applyTheme(answers, root = document.documentElement, opts = {}) {
  writeTheme(themeForAnswers(answers), root, opts);
}

/** Apply the fixed light theme used by the landing screen and dados_basicos. */
export function applyNeutralTheme(root = document.documentElement) {
  writeTheme(NEUTRAL_THEME, root);
}

/** Which logo variant ("green" | "pink") to show for the given answers. */
export function logoForAnswers(answers) {
  return themeForAnswers(answers).logo;
}
