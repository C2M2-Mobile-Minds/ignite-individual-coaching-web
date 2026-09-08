// Reads the schema, renders the active step's fields into #form-root, and
// handles forward/back navigation — re-evaluating branch conditions each time.
//
// Answers live in one flat in-memory object keyed by field id (see formSchema.js
// for the value shape per field type). Navigation is derived, not stacked: the
// current position is just an index into visibleSteps(answers), recomputed on
// every move, so going back and changing an answer transparently reroutes the
// remaining steps.
//
// Required-field validation and submission are intentionally out of scope here.

import { loadLocale, t } from "./i18n.js";
import { steps, visibleSteps, visibleFields } from "./formSchema.js";
import { EEA_COUNTRIES, DEFAULT_DIAL_CODE, parsePhone, combinePhone } from "./countries.js";

/** The single source of truth for what the user has entered and where they are. */
export const state = {
  answers: {},
  currentStepId: steps[0].id,
  // Map of field id -> error message key currently shown. Populated on a
  // blocked "next" click, cleared per-field as the user edits.
  errors: new Map(),
};

// --- Pure navigation helpers (no DOM) ---------------------------------------

/** Index of currentStepId within visibleSteps(answers), clamped into range. */
export function currentStepIndex(answers, currentStepId) {
  const visible = visibleSteps(answers);
  const idx = visible.findIndex((s) => s.id === currentStepId);
  if (idx === -1) return 0;
  return idx;
}

/** The next visible step after currentStepId, or null if it is the last one. */
export function nextVisibleStep(answers, currentStepId) {
  const visible = visibleSteps(answers);
  const idx = currentStepIndex(answers, currentStepId);
  return visible[idx + 1] ?? null;
}

/** The previous visible step before currentStepId, or null if it is the first. */
export function prevVisibleStep(answers, currentStepId) {
  const visible = visibleSteps(answers);
  const idx = currentStepIndex(answers, currentStepId);
  return idx > 0 ? visible[idx - 1] : null;
}

// --- Validation (no DOM) -------------------------------------------------------

/** Is this field's stored answer non-empty for its type? */
export function isFieldFilled(field, answers) {
  const value = answers[field.id];
  if (field.type === "checkbox" && field.options) {
    return Array.isArray(value) && value.length > 0;
  }
  if (field.type === "checkbox") {
    return value === true;
  }
  if (field.type === "radio") {
    return value !== undefined && value !== null && value !== "";
  }
  // text / email / tel
  return typeof value === "string" && value.trim() !== "";
}

// Pragmatic email shape check — one @, a dot in the domain, no spaces.
// Not RFC 5322; the serverless function is the real gate.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Format error key for a filled field, or null if it looks fine. */
function formatError(field, answers) {
  const value = String(answers[field.id] ?? "").trim();
  if (field.type === "email" && !EMAIL_RE.test(value)) {
    return "validation.email";
  }
  if (field.type === "tel") {
    const { local } = parsePhone(value);
    const digits = local.replace(/\D/g, "");
    if (digits.length < 6 || digits.length > 15) return "validation.phone";
  }
  return null;
}

/**
 * `{ id, messageKey }` for every visible field that fails validation:
 * required fields left empty, then filled fields with a bad format.
 */
export function validateStep(step, answers) {
  const errors = [];
  for (const field of visibleFields(step, answers)) {
    if (!isFieldFilled(field, answers)) {
      if (field.required) errors.push({ id: field.id, messageKey: "validation.required" });
      continue;
    }
    const format = formatError(field, answers);
    if (format) errors.push({ id: field.id, messageKey: format });
  }
  return errors;
}

/** Drop a field's error and remove its message node without a full re-render. */
function clearFieldError(fieldId) {
  if (!state.errors.delete(fieldId)) return;
  const root = document.getElementById("form-root");
  root?.querySelector(`.error[data-for="${fieldId}"]`)?.remove();
  root?.querySelector(`#${fieldId}`)?.removeAttribute("aria-invalid");
}

// --- Answer mutation -------------------------------------------------------

function setText(fieldId, value) {
  state.answers[fieldId] = value;
  clearFieldError(fieldId);
}

function setRadio(fieldId, optionId) {
  state.answers[fieldId] = optionId;
  clearFieldError(fieldId);
}

function toggleCheckboxOption(fieldId, optionId, checked) {
  const current = Array.isArray(state.answers[fieldId]) ? state.answers[fieldId] : [];
  state.answers[fieldId] = checked
    ? [...current, optionId]
    : current.filter((id) => id !== optionId);
  clearFieldError(fieldId);
}

function setBooleanCheckbox(fieldId, checked) {
  state.answers[fieldId] = checked;
  clearFieldError(fieldId);
}

// --- Rendering ----------------------------------------------------------------

function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  Object.assign(node, props);
  for (const child of children) {
    node.append(child);
  }
  return node;
}

/** Build the DOM for a single field, wired to update `state.answers`. */
export function renderField(field) {
  const { id, type } = field;

  if (type === "tel") {
    const { dialCode, local } = parsePhone(state.answers[id]);
    const select = el("select", { name: `${id}_country` });
    for (const c of EEA_COUNTRIES) {
      select.append(
        el("option", {
          value: c.dialCode,
          textContent: `${c.name} (${c.dialCode})`,
          selected: c.dialCode === dialCode,
        }),
      );
    }
    const input = el("input", { type: "tel", id, name: id, value: local });
    const sync = () => setText(id, combinePhone(select.value, input.value));
    select.addEventListener("change", sync);
    input.addEventListener("input", sync);
    return el("label", { className: "field", htmlFor: id }, [
      t(field.labelKey),
      el("span", { className: "tel-group" }, [select, input]),
    ]);
  }

  if (type === "text" || type === "email") {
    const input = el("input", {
      type,
      id,
      name: id,
      value: state.answers[id] ?? "",
    });
    input.addEventListener("input", () => setText(id, input.value));
    return el("label", { className: "field", htmlFor: id }, [t(field.labelKey), input]);
  }

  if (type === "radio") {
    const fieldset = el("fieldset", { className: "field" }, [
      el("legend", { textContent: t(field.labelKey) }),
    ]);
    for (const opt of field.options) {
      const input = el("input", {
        type: "radio",
        name: id,
        value: opt.id,
        checked: state.answers[id] === opt.id,
      });
      input.addEventListener("change", () => {
        if (input.checked) {
          setRadio(id, opt.id);
          renderStep();
        }
      });
      fieldset.append(el("label", {}, [input, t(opt.labelKey)]));
    }
    return fieldset;
  }

  if (type === "checkbox" && field.options) {
    const selected = Array.isArray(state.answers[id]) ? state.answers[id] : [];
    const fieldset = el("fieldset", { className: "field" }, [
      el("legend", { textContent: t(field.labelKey) }),
    ]);
    for (const opt of field.options) {
      const input = el("input", {
        type: "checkbox",
        name: id,
        value: opt.id,
        checked: selected.includes(opt.id),
      });
      input.addEventListener("change", () => {
        toggleCheckboxOption(id, opt.id, input.checked);
        renderStep();
      });
      fieldset.append(el("label", {}, [input, t(opt.labelKey)]));
    }
    return fieldset;
  }

  if (type === "checkbox") {
    const input = el("input", {
      type: "checkbox",
      id,
      name: id,
      checked: state.answers[id] === true,
    });
    input.addEventListener("change", () => {
      setBooleanCheckbox(id, input.checked);
      renderStep();
    });
    return el("label", { className: "field", htmlFor: id }, [input, t(field.labelKey)]);
  }

  throw new Error(`renderField: unknown field type "${type}" for "${id}"`);
}

function navButton(labelKey, onClick) {
  const button = el("button", { type: "button", textContent: t(labelKey) });
  button.addEventListener("click", onClick);
  return button;
}

/** Clear #form-root and render the current step: title, fields, nav row. */
export function renderStep() {
  const root = document.getElementById("form-root");
  root.replaceChildren();

  const { answers, currentStepId } = state;
  const step = steps.find((s) => s.id === currentStepId);

  root.append(el("h1", { textContent: t(step.titleKey) }));

  for (const field of visibleFields(step, answers)) {
    const node = renderField(field);
    if (state.errors.has(field.id)) {
      const message = el("span", {
        className: "error",
        role: "alert",
        textContent: t(state.errors.get(field.id)),
      });
      message.setAttribute("data-for", field.id);
      node.append(message);
      (node.querySelector("input") ?? node.querySelector("select, textarea"))
        ?.setAttribute("aria-invalid", "true");
    }
    root.append(node);
  }

  const nav = el("div", { className: "nav" });
  if (prevVisibleStep(answers, currentStepId)) {
    nav.append(navButton("form.nav.back", goBack));
  }
  if (nextVisibleStep(answers, currentStepId)) {
    nav.append(navButton("form.nav.next", goNext));
  }
  root.append(nav);
}

export function goNext() {
  const step = steps.find((s) => s.id === state.currentStepId);
  const invalid = validateStep(step, state.answers);
  if (invalid.length > 0) {
    state.errors = new Map(invalid.map((e) => [e.id, e.messageKey]));
    renderStep();
    return;
  }
  const next = nextVisibleStep(state.answers, state.currentStepId);
  if (next) {
    state.errors.clear();
    state.currentStepId = next.id;
    renderStep();
  }
}

export function goBack() {
  const prev = prevVisibleStep(state.answers, state.currentStepId);
  if (prev) {
    state.errors.clear();
    state.currentStepId = prev.id;
    renderStep();
  }
}

/** Load the locale, set the document title, and render the first step. */
export async function init() {
  await loadLocale("pt-PT");
  document.title = t("app.title");
  renderStep();
}
