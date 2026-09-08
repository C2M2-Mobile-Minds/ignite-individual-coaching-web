// Human-readable labels for submission notification emails.
//
// The Google Sheet stores raw field ids and option ids (see columns.mjs); an
// email to the company needs the real question wording and readable option
// text. Both are derived from the form schema + the pt-PT locale, so nothing
// here guesses key patterns — each option carries its own `labelKey`.

import { steps } from "../../../js/formSchema.js";
import ptPT from "../../../locales/pt-PT.json" with { type: "json" };
import { columnsFor, TIMESTAMP_COLUMN } from "./columns.mjs";

/** Locale lookup with i18n.js-style fallback to the key itself. */
function t(key) {
  if (Object.prototype.hasOwnProperty.call(ptPT, key)) return ptPT[key];
  console.warn(`[labels] missing locale key: ${key}`);
  return key;
}

// Built once at module load, walking every field of every step.
const fieldLabelKey = {};
const optionLabelKeys = {}; // fieldId -> { optionId: labelKey }

for (const step of steps) {
  for (const field of step.fields) {
    if (field.labelKey) fieldLabelKey[field.id] = field.labelKey;
    if (Array.isArray(field.options)) {
      optionLabelKeys[field.id] = {};
      for (const opt of field.options) {
        optionLabelKeys[field.id][opt.id] = opt.labelKey;
      }
    }
  }
}

/** Question wording for a field id (falls back to the id). */
export function resolveField(id) {
  return fieldLabelKey[id] ? t(fieldLabelKey[id]) : id;
}

/** Readable text for one stored answer value. */
export function resolveValue(fieldId, value) {
  if (value == null) return "";
  if (typeof value === "boolean") return value ? "Sim" : "Não";
  const opts = optionLabelKeys[fieldId] || {};
  if (Array.isArray(value)) {
    return value.map((v) => (opts[v] ? t(opts[v]) : String(v))).join(", ");
  }
  return opts[value] ? t(opts[value]) : String(value);
}

/** True when an answer value carries no information worth emailing. */
function isEmpty(value) {
  if (value == null) return true;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === "string") return value.trim() === "";
  return false;
}

/**
 * Ordered { label, value } pairs for a flow's filled fields, in the same
 * column order as the sheet, excluding the synthetic timestamp column and
 * any field left empty.
 */
export function notePairs(flow, answers) {
  return columnsFor(flow)
    .filter((col) => col !== TIMESTAMP_COLUMN && !isEmpty(answers[col]))
    .map((col) => ({
      label: resolveField(col),
      value: resolveValue(col, answers[col]),
    }));
}
