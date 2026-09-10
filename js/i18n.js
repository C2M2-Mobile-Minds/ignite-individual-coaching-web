// Loads locale JSON, exposes t('key') helper.

let strings = {};
let currentLocale = null;

// Built-in fallback for the few strings shown before — or without — a loaded
// locale: the landing screen and the document title. Keeps the UI legible if
// the locale fetch fails, loads late, or the module graph forks (see
// scripts/stamp-assets.mjs). The full copy still lives in locales/*.json and
// takes precedence once loaded.
const FALLBACK = {
  "app.title": "Ignite Individual Coaching",
  "landing.tagline": "Ignite your true potential",
  "landing.message":
    "Se chegaste até à Ignite é porque queres investir em ti. Descobre como é que um plano de ação estruturado e acompanhado vai potenciar o alcance dos teus objetivos.",
  "landing.cta": "Começar",
};

export async function loadLocale(locale) {
  const response = await fetch(`locales/${locale}.json`);
  strings = await response.json();
  currentLocale = locale;
}

export function t(key) {
  if (Object.prototype.hasOwnProperty.call(strings, key)) {
    return strings[key];
  }
  if (Object.prototype.hasOwnProperty.call(FALLBACK, key)) {
    // Silent while no locale is loaded yet (expected during first paint);
    // a warning only if the locale IS loaded but somehow lacks the key.
    if (currentLocale !== null) {
      console.warn(`i18n: key "${key}" missing from locale "${currentLocale}", using fallback`);
    }
    return FALLBACK[key];
  }
  console.warn(`i18n: missing key "${key}" for locale "${currentLocale}"`);
  return key;
}
