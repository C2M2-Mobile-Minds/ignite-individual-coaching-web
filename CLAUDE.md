# CLAUDE.md

Guidance for Claude Code when working in this repo.

## Project

Multi-step lead-intake web form for Ignite Individual Coaching. Static frontend (vanilla JS/HTML/CSS) + one Netlify serverless function. See `README.md` for architecture, form flow, and repository structure — keep that as the source of truth and update it when structure changes.

## Conventions

- No frontend framework — vanilla JS only.
- Form is schema-driven (`js/formSchema.js`); steps/branching are data, not markup.
- Field IDs are stable across `formSchema.js`, locale files, payload, and spreadsheet columns — only labels change per locale.
- Locale strings live in `/locales/<locale>.json`, keyed by translation ID (e.g. `form.step1.nome`), not by page.
- `.env` holds secrets, never commit it — `.env.example` documents the required keys.

## Progress log

- **Issue #1 — Project scaffold and tooling**: created base folder structure (`css/`, `js/`, `locales/`, `netlify/functions/`), stub `index.html`, `.env.example`, `netlify.toml`, `package.json` (netlify-cli dev dependency), added `.netlify/` to `.gitignore`, and a "Getting started" section in the README.
  - Known issue: `npm install` may time out downloading `netlify-cli`'s `sharp` dependency (native binary fetch) depending on network — not a scaffold defect, retry or install on a better connection.
- **Issue #2 — i18n infrastructure**: implemented `loadLocale(locale)` and `t(key)` in `js/i18n.js` (fetches `locales/<locale>.json`, missing keys log a `console.warn` and fall back to the key itself instead of throwing). Seeded `locales/pt-PT.json` with a placeholder `app.title` key and wired `js/formEngine.js` to load the locale and render through `t()` instead of a hardcoded string.
- **Issue #3 — Form schema and data model**: filled `js/formSchema.js` with the 5 steps (`dados_basicos`, `treino_geral`, `fase_gestacao`, `gestacao`, `posparto`) as data-only objects — fields carry `id`/`type`/`required`/`labelKey`/`options`, steps and some fields carry pure `condition(answers)` predicates. Helpers: `selectedGestacaoPosparto`, `visibleSteps`, `visibleFields`. `answers` is a flat object keyed by field id (radio → option id, multi checkbox → array). Field-ID reference in `docs/field-ids.md`. Branch logic covered by `test/formSchema.test.mjs` (`npm test` → `node --test`). Locale keys for every `labelKey` seeded in `locales/pt-PT.json`.
- **Issue #4 — Form engine: step rendering and navigation**: `js/formEngine.js` now reads the schema and drives the form. Exports a mutable `state` (`{ answers, currentStepId }` — flat, keyed by field id), pure DOM-free nav helpers (`nextVisibleStep`/`prevVisibleStep`/`currentStepIndex`, all derived from `visibleSteps(answers)` — no history stack, so changing an earlier answer transparently reroutes the remaining steps), `renderField`/`renderStep`, `goNext`/`goBack`, and `init()`. Rendering by field `type`: text/email/tel → `input`; radio → `fieldset` of radios; multi-`checkbox` (has `options`) → `fieldset`, answer is `string[]`; bare `checkbox` (no `options`, e.g. `aviso_contacto`) → single box, answer is boolean. Text inputs update `state` on `input` without re-render (keeps focus); radio/checkbox changes re-render so field/branch `condition`s re-evaluate live. Nav buttons are `type="button"` — no reload; `index.html` calls `init()` from an inline module. Validation and submit stay out of scope. Tests: `test/formEngine.test.mjs` (jsdom `devDependency`; a `fetch` shim reads the locale JSON so nothing test-only ships in `i18n.js`).
