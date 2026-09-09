// Neutral pre-form landing screen. Collects no answers, so it lives outside
// formSchema.js — the form engine paints it into #form-root on init() and swaps
// it for the first step when the CTA is clicked (no page reload).

import { t } from "./i18n.js";

/**
 * Render the landing screen into #form-root.
 * @param {() => void} onStart - called when the CTA is clicked.
 */
export function renderLanding(onStart) {
  const root = document.getElementById("form-root");
  root.replaceChildren();
  root.classList.add("step-enter");

  const view = document.createElement("div");
  view.className = "landing";

  // --- Placeholder assets ---------------------------------------------------
  // Final logotype + neutral palette/fonts pending from client (issue #47).
  // Swap `img/ignite.png` and the `.landing*` tokens in css/main.css when they
  // land; markup/keys stay as-is.
  const logo = document.createElement("img");
  logo.className = "landing-logo";
  logo.src = "img/ignite.png";
  logo.alt = t("app.title");

  const tagline = document.createElement("p");
  tagline.className = "landing-tagline";
  tagline.textContent = t("landing.tagline");

  const message = document.createElement("p");
  message.className = "landing-message";
  message.textContent = t("landing.message");

  const cta = document.createElement("button");
  cta.type = "button";
  cta.className = "landing-cta";
  cta.textContent = t("landing.cta");
  cta.addEventListener("click", onStart);

  view.append(logo, tagline, message, cta);
  root.append(view);
}
