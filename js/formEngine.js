// Reads the schema, renders the active step's fields into #form-root, and
// handles forward/back navigation — re-evaluating branch conditions each time.
//
// Answers live in one flat in-memory object keyed by field id (see formSchema.js
// for the value shape per field type). Navigation is derived, not stacked: the
// current position is just an index into visibleSteps(answers), recomputed on
// every move, so going back and changing an answer transparently reroutes the
// remaining steps.
//
// On the last step, "next" becomes a submit action; the result swaps #form-root
// for a success or error screen (see renderConfirmation). The network call itself
// lives in submit.js (a stub for now).

import { loadLocale, t } from "./i18n.js";
import { steps, visibleSteps, visibleFields } from "./formSchema.js";
import { EEA_COUNTRIES, DEFAULT_DIAL_CODE, parsePhone, combinePhone } from "./countries.js";
import { submitForm } from "./submit.js";
import { renderLanding } from "./landing.js";
import { applyTheme, applyNeutralTheme, logoForAnswers } from "./theme.js";

/** The single source of truth for what the user has entered and where they are. */
export const state = {
  answers: {},
  currentStepId: steps[0].id,
  // Map of field id -> error message key currently shown. Populated on a
  // blocked "next" click, cleared per-field as the user edits.
  errors: new Map(),
  // True while a submit / retry request is in flight — guards against a
  // double submission and disables the button.
  submitting: false,
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
    if (field.type === "note") continue; // read-only text, nothing to validate
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

/** Drop stored answers for current-step fields whose condition no longer passes. */
function pruneHiddenFieldAnswers() {
  const step = steps.find((s) => s.id === state.currentStepId);
  for (const field of step.fields) {
    if (field.condition && !field.condition(state.answers) && field.id in state.answers) {
      delete state.answers[field.id];
      state.errors.delete(field.id);
    }
  }
}

function setText(fieldId, value) {
  state.answers[fieldId] = value;
  clearFieldError(fieldId);
}

function setRadio(fieldId, optionId) {
  state.answers[fieldId] = optionId;
  clearFieldError(fieldId);
  pruneHiddenFieldAnswers();
}

function toggleCheckboxOption(fieldId, optionId, checked) {
  const current = Array.isArray(state.answers[fieldId]) ? state.answers[fieldId] : [];
  state.answers[fieldId] = checked
    ? [...current, optionId]
    : current.filter((id) => id !== optionId);
  clearFieldError(fieldId);
  pruneHiddenFieldAnswers();
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

const countryByDial = (dial) =>
  EEA_COUNTRIES.find((c) => c.dialCode === dial) ??
  EEA_COUNTRIES.find((c) => c.dialCode === DEFAULT_DIAL_CODE);

const flagImg = (country) =>
  el("img", {
    className: "flag",
    src: `img/flags/${country.code.toLowerCase()}.svg`,
    alt: "",
    width: 20,
    height: 15,
    loading: "lazy",
  });

/**
 * A custom country picker for the `tel` field: a toggle button showing the
 * selected flag + dial code, and an ARIA listbox of every EEA country. Native
 * <select> can't render flag images, hence the hand-rolled widget. `onSelect`
 * receives the chosen dial code string.
 */
function buildCountrySelect(selectedDial, onSelect) {
  const wrap = el("div", { className: "country-select" });
  const toggle = el("button", { type: "button", className: "country-select__toggle" });
  toggle.setAttribute("aria-haspopup", "listbox");
  toggle.setAttribute("aria-expanded", "false");

  const list = el("ul", { className: "country-select__list", hidden: true });
  list.setAttribute("role", "listbox");
  list.tabIndex = -1;

  let current = countryByDial(selectedDial).dialCode;
  let open = false;
  let activeIndex = 0;

  const options = EEA_COUNTRIES.map((c) => {
    const li = el("li", { className: "country-select__option", id: `country-opt-${c.code}` }, [
      flagImg(c),
      el("span", { className: "country-select__name", textContent: `${c.name} (${c.dialCode})` }),
    ]);
    li.setAttribute("role", "option");
    li.dataset.dial = c.dialCode;
    li.addEventListener("click", () => choose(c.dialCode));
    li.addEventListener("mousedown", (e) => e.preventDefault()); // keep focus in the list
    return li;
  });
  list.append(...options);

  const renderToggle = () => {
    const c = countryByDial(current);
    toggle.replaceChildren(
      flagImg(c),
      el("span", { className: "country-select__dial", textContent: c.dialCode }),
      el("span", { className: "country-select__caret", textContent: "▾" }),
    );
    toggle.setAttribute("aria-label", `${t("form.field.contacto_telefonico")}: ${c.name} (${c.dialCode})`);
  };

  const syncSelected = () => {
    options.forEach((li) => li.setAttribute("aria-selected", String(li.dataset.dial === current)));
  };

  const updateActive = () => {
    options.forEach((li, i) => li.classList.toggle("is-active", i === activeIndex));
    const li = options[activeIndex];
    if (li) {
      list.setAttribute("aria-activedescendant", li.id);
      li.scrollIntoView?.({ block: "nearest" });
    }
  };

  const onDocPointer = (e) => {
    if (!wrap.contains(e.target)) setOpen(false);
  };

  function setOpen(next) {
    if (next === open) return;
    open = next;
    list.hidden = !next;
    wrap.classList.toggle("is-open", next);
    toggle.setAttribute("aria-expanded", String(next));
    if (next) {
      activeIndex = Math.max(0, options.findIndex((li) => li.dataset.dial === current));
      updateActive();
      list.focus();
      document.addEventListener("click", onDocPointer);
    } else {
      document.removeEventListener("click", onDocPointer);
    }
  }

  function choose(dial) {
    current = countryByDial(dial).dialCode;
    renderToggle();
    syncSelected();
    setOpen(false);
    toggle.focus();
    onSelect(current);
  }

  toggle.addEventListener("click", () => setOpen(!open));

  list.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      activeIndex = Math.min(activeIndex + 1, options.length - 1);
      updateActive();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      activeIndex = Math.max(activeIndex - 1, 0);
      updateActive();
    } else if (e.key === "Home") {
      e.preventDefault();
      activeIndex = 0;
      updateActive();
    } else if (e.key === "End") {
      e.preventDefault();
      activeIndex = options.length - 1;
      updateActive();
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      choose(options[activeIndex].dataset.dial);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      toggle.focus();
    } else if (/^[a-z]$/i.test(e.key)) {
      const key = e.key.toLowerCase();
      const from = activeIndex + 1;
      const match =
        options.slice(from).findIndex((li) => li.textContent.trim().toLowerCase().startsWith(key)) + from;
      const found =
        match >= from
          ? match
          : options.findIndex((li) => li.textContent.trim().toLowerCase().startsWith(key));
      if (found >= 0) {
        activeIndex = found;
        updateActive();
      }
    }
  });

  renderToggle();
  syncSelected();
  wrap.append(toggle, list);
  return wrap;
}

/** Build the DOM for a single field, wired to update `state.answers`. */
export function renderField(field) {
  const { id, type } = field;

  if (type === "tel") {
    const { dialCode, local } = parsePhone(state.answers[id]);
    let currentDial = dialCode;
    const input = el("input", { type: "tel", id, name: id, value: local, inputMode: "numeric" });
    input.setAttribute("pattern", "[0-9]*");
    // Local part is digits only — strip anything else as it's typed / pasted.
    const sync = () => {
      const digits = input.value.replace(/\D/g, "");
      if (input.value !== digits) input.value = digits;
      setText(id, combinePhone(currentDial, digits));
    };
    const countrySelect = buildCountrySelect(dialCode, (dial) => {
      currentDial = dial;
      sync();
    });
    input.addEventListener("input", sync);
    return el("label", { className: "field", htmlFor: id }, [
      t(field.labelKey),
      el("span", { className: "tel-group" }, [countrySelect, input]),
    ]);
  }

  if (type === "note") {
    // Read-only informational text — not a form control, not validated.
    return el("p", { className: "note", textContent: t(field.textKey) });
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
      fieldset.append(
        el("label", { className: "option-button" }, [
          input,
          el("span", { className: "option-text", textContent: t(opt.labelKey) }),
          el("span", { className: "option-mark", textContent: "✓" }),
        ]),
      );
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
      fieldset.append(
        el("label", { className: "option-button" }, [
          input,
          el("span", { className: "option-text", textContent: t(opt.labelKey) }),
          el("span", { className: "option-mark", textContent: "✓" }),
        ]),
      );
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

function navButton(labelKey, onClick, disabled = false) {
  const button = el("button", { type: "button", textContent: t(labelKey), disabled });
  button.addEventListener("click", onClick);
  return button;
}

// Which step the last renderStep() painted — used to play the entrance
// animation only on an actual step change, not on intra-step re-renders
// (radio / checkbox toggles re-render the whole step).
let lastRenderedStepId = null;

// "fwd" or "back" — which way the user is navigating, set by goNext/goSubmit/
// startForm/init ("fwd") and goBack ("back"). renderStep() reads it to pick
// the matching entrance animation (slide-from-right vs slide-from-left).
let navDirection = "fwd";

// Drop the entrance class once the animation has played. While it's on
// #form-root, `#form-root.step-enter-* > *` keeps a slide animation
// *declared* on every field, and a still-declared transform animation makes
// each field its own stacking context / composited layer in Chrome — which
// traps the country dropdown behind the fields that follow it, regardless of
// z-index. Removing the class after the run clears that.
function clearEntranceAnimation(root) {
  root.addEventListener(
    "animationend",
    () => root.classList.remove("step-enter-fwd", "step-enter-back"),
    { once: true },
  );
}

// Favicon <link> elements that swap with the theme, by their index.html id ->
// the filename (inside img/favicons/<variant>/) each one points to.
const FAVICON_LINKS = {
  "favicon-svg": "favicon.svg",
  "favicon-96": "favicon-96x96.png",
  "favicon-ico": "favicon.ico",
  "favicon-apple": "apple-touch-icon.png",
  "favicon-manifest": "site.webmanifest",
};

/** Point the header/landing logo `<img>` and the favicon `<link>`s at the
 * green/pink variant matching `variant` ("green" | "pink"). */
function setBrandAssets(variant) {
  const logoSrc = `img/ignite-${variant}.png`;
  document.getElementById("header-logo")?.setAttribute("src", logoSrc);
  document.querySelector(".landing-logo")?.setAttribute("src", logoSrc);

  for (const [id, file] of Object.entries(FAVICON_LINKS)) {
    document.getElementById(id)?.setAttribute("href", `img/favicons/${variant}/${file}`);
  }
}

/** Clear #form-root and render the current step: title, fields, nav row. */
export function renderStep() {
  const root = document.getElementById("form-root");
  root.replaceChildren();
  // Theme the steps AFTER dados_basicos; landing + dados_basicos stay neutral.
  if (state.currentStepId === "dados_basicos") {
    applyNeutralTheme();
    setBrandAssets("green");
  } else {
    applyTheme(state.answers);
    setBrandAssets(logoForAnswers(state.answers));
  }

  const { answers, currentStepId } = state;
  const step = steps.find((s) => s.id === currentStepId);

  const stepChanged = currentStepId !== lastRenderedStepId;
  root.classList.toggle("step-enter-fwd", stepChanged && navDirection !== "back");
  root.classList.toggle("step-enter-back", stepChanged && navDirection === "back");
  if (stepChanged) clearEntranceAnimation(root);
  lastRenderedStepId = currentStepId;

  const totalSteps = visibleSteps(answers).length;
  const stepNumber = currentStepIndex(answers, currentStepId) + 1;
  const fill = el("span", { className: "progress-fill" });
  fill.style.width = `${Math.round((stepNumber / totalSteps) * 100)}%`;
  root.append(
    el("div", { className: "progress" }, [
      el("span", {
        className: "progress-label",
        textContent: `${t("form.progress.step")} ${stepNumber} ${t("form.progress.of")} ${totalSteps}`,
      }),
      el("div", { className: "progress-track" }, [fill]),
    ]),
  );

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
  } else {
    const submitKey = state.submitting ? "form.nav.submitting" : "form.nav.submit";
    nav.append(navButton(submitKey, goSubmit, state.submitting));
  }
  root.append(nav);
}

/**
 * Replace #form-root with a terminal screen: a success message, or an error
 * message plus a retry button. Retry re-runs the submit and is disabled while
 * that request is in flight, so duplicate submissions can't slip through.
 */
export function renderConfirmation(status) {
  const root = document.getElementById("form-root");
  root.replaceChildren();
  applyTheme(state.answers, undefined, { confirmation: true }); // keep the terminal screen on-theme
  setBrandAssets(logoForAnswers(state.answers));
  document.querySelector(".page-header")?.setAttribute("hidden", ""); // logo shows below the message instead
  root.classList.add("step-enter-fwd"); // the terminal screen always animates in
  clearEntranceAnimation(root);
  lastRenderedStepId = null;

  const key = status === "success" ? "form.confirmation.success" : "form.confirmation.error";
  const message = el("p", { className: "confirmation" });
  const lines = t(key).split("\n");
  lines.forEach((line, i) => {
    if (i > 0) message.append(el("br"));
    message.append(line);
  });
  root.append(message);

  if (status === "error") {
    const retry = navButton(
      state.submitting ? "form.nav.submitting" : "form.confirmation.retry_button",
      () => runSubmit("error"),
      state.submitting,
    );
    root.append(el("div", { className: "nav" }, [retry]));
  }

  // Logo always last — below the message and (on error) the retry button.
  const logo = el("img", {
    className: "confirmation-logo",
    src: `img/ignite-${logoForAnswers(state.answers)}.png`,
    alt: "",
  });
  root.append(logo);
}

/**
 * Fire the submit once, guarding against a concurrent request.
 * `from` is the screen the call came from ("step" or "error"), re-rendered
 * with its button disabled and relabelled ("A enviar…") for the duration of
 * the request; `#form-root` also carries `aria-busy` while in flight.
 */
async function runSubmit(from) {
  if (state.submitting) return;
  state.submitting = true;
  // Re-render the originating screen so its button shows as disabled.
  if (from === "error") renderConfirmation("error");
  else renderStep();
  document.getElementById("form-root").setAttribute("aria-busy", "true");

  let ok = false;
  try {
    await submitForm(state.answers);
    ok = true;
  } catch {
    ok = false;
  }
  state.submitting = false;
  document.getElementById("form-root").removeAttribute("aria-busy");
  renderConfirmation(ok ? "success" : "error");
}

export function goSubmit() {
  const step = steps.find((s) => s.id === state.currentStepId);
  const invalid = validateStep(step, state.answers);
  if (invalid.length > 0) {
    state.errors = new Map(invalid.map((e) => [e.id, e.messageKey]));
    renderStep();
    return;
  }
  runSubmit("step");
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
    navDirection = "fwd";
    state.currentStepId = next.id;
    renderStep();
  }
}

export function goBack() {
  const prev = prevVisibleStep(state.answers, state.currentStepId);
  if (prev) {
    state.errors.clear();
    navDirection = "back";
    state.currentStepId = prev.id;
    renderStep();
  }
}

/** Reveal the header logo and render the first form step (landing CTA target). */
export function startForm() {
  document.querySelector(".page-header")?.removeAttribute("hidden");
  navDirection = "fwd";
  renderStep();
}

/** Load the locale, set the document title, and show the landing screen. */
export async function init() {
  await loadLocale("pt-PT");
  document.title = t("app.title");
  navDirection = "fwd";
  lastRenderedStepId = null;
  applyNeutralTheme(); // explicit neutral reset (matters on re-init, e.g. in tests)
  document.querySelector(".page-header")?.setAttribute("hidden", "");
  renderLanding(startForm);
  setBrandAssets("green");
}
