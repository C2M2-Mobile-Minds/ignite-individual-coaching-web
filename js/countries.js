// EU/EEA country dial codes for the phone field's country picker.
//
// Names are inline Portuguese for now; the full locale pass (issue #6) can move
// them to `locales/<locale>.json` under a `country.<code>` key without touching
// callers. `code` is the ISO 3166-1 alpha-2 code — a stable key, also used to
// resolve the flag SVG at `img/flags/<code lowercased>.svg`.

export const DEFAULT_DIAL_CODE = "+351"; // Portugal

/** Alphabetical by Portuguese name. */
export const EEA_COUNTRIES = [
  { code: "DE", name: "Alemanha", dialCode: "+49" },
  { code: "AT", name: "Áustria", dialCode: "+43" },
  { code: "BE", name: "Bélgica", dialCode: "+32" },
  { code: "BG", name: "Bulgária", dialCode: "+359" },
  { code: "CZ", name: "Chéquia", dialCode: "+420" },
  { code: "CY", name: "Chipre", dialCode: "+357" },
  { code: "HR", name: "Croácia", dialCode: "+385" },
  { code: "DK", name: "Dinamarca", dialCode: "+45" },
  { code: "SK", name: "Eslováquia", dialCode: "+421" },
  { code: "SI", name: "Eslovénia", dialCode: "+386" },
  { code: "ES", name: "Espanha", dialCode: "+34" },
  { code: "EE", name: "Estónia", dialCode: "+372" },
  { code: "FI", name: "Finlândia", dialCode: "+358" },
  { code: "FR", name: "França", dialCode: "+33" },
  { code: "GR", name: "Grécia", dialCode: "+30" },
  { code: "HU", name: "Hungria", dialCode: "+36" },
  { code: "IE", name: "Irlanda", dialCode: "+353" },
  { code: "IS", name: "Islândia", dialCode: "+354" },
  { code: "IT", name: "Itália", dialCode: "+39" },
  { code: "LV", name: "Letónia", dialCode: "+371" },
  { code: "LI", name: "Listenstaine", dialCode: "+423" },
  { code: "LT", name: "Lituânia", dialCode: "+370" },
  { code: "LU", name: "Luxemburgo", dialCode: "+352" },
  { code: "MT", name: "Malta", dialCode: "+356" },
  { code: "NO", name: "Noruega", dialCode: "+47" },
  { code: "NL", name: "Países Baixos", dialCode: "+31" },
  { code: "PL", name: "Polónia", dialCode: "+48" },
  { code: "PT", name: "Portugal", dialCode: "+351" },
  { code: "RO", name: "Roménia", dialCode: "+40" },
  { code: "SE", name: "Suécia", dialCode: "+46" },
];

// Longest dial codes first, so "+351" is matched before "+35" would be.
const DIAL_CODES = EEA_COUNTRIES
  .map((c) => c.dialCode)
  .sort((a, b) => b.length - a.length);

/** Split a stored "+351 912 345 678" into its dial code and local part. */
export function parsePhone(value) {
  const trimmed = String(value ?? "").trim();
  const dialCode = DIAL_CODES.find((dc) => trimmed === dc || trimmed.startsWith(dc + " "));
  if (dialCode) {
    return { dialCode, local: trimmed.slice(dialCode.length).trim() };
  }
  return { dialCode: DEFAULT_DIAL_CODE, local: trimmed.replace(/^\+\d+\s*/, "") };
}

/** Recombine a dial code + local number, or "" when the local part is blank. */
export function combinePhone(dialCode, local) {
  const number = String(local ?? "").trim();
  return number === "" ? "" : dialCode + " " + number;
}
