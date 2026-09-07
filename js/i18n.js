// Loads locale JSON, exposes t('key') helper.

let strings = {};
let currentLocale = null;

export async function loadLocale(locale) {
  const response = await fetch(`locales/${locale}.json`);
  strings = await response.json();
  currentLocale = locale;
}

export function t(key) {
  if (Object.prototype.hasOwnProperty.call(strings, key)) {
    return strings[key];
  }
  console.warn(`i18n: missing key "${key}" for locale "${currentLocale}"`);
  return key;
}
