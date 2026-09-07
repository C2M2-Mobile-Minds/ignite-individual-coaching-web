// Renders current step from schema, handles nav + validation.

import { loadLocale, t } from "./i18n.js";

await loadLocale("pt-PT");
document.title = t("app.title");
document.getElementById("form-root").textContent = t("app.title");
