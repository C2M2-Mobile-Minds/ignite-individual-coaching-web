# End-to-end QA checklist (issue #17)

Manual pass to run before launch. The branching logic is the highest-risk part of
the project — walk **every** path. Automated coverage for the same paths lives in
`test/formEngine.test.mjs` (branch walks + mid-flow switching) and
`test/submit.function.test.mjs` (per-flow spreadsheet rows); run `npm test` first,
then do this pass for the things tests can't see (real rendering, real devices,
the live Sheet, the notification email).

## Setup

- [ ] `npm ci`
- [ ] `.env` filled from `.env.example` with real Google Sheets + Resend credentials
- [ ] `npm run dev` (netlify dev) — form at the printed URL, function at
      `/.netlify/functions/submit`
- [ ] Browser dev-tools **Console** open and visible for every step
- [ ] Access to the target Google Sheet (both tabs: **Geral**, **Gestação-Pós-parto**)
- [ ] Access to the inbox at `COMPANY_EMAIL_TO`

> A plain static server (`python -m http.server`) will load the form but the
> submit call 404s — use `netlify dev` for anything that submits.

## Branch 1 — Geral (general training)

Step 1 `dados_basicos` → step 2 `treino_geral` → submit.

- [ ] Step 1: fill `nome`, `contacto_telefonico` (pick a country, type a local number),
      `email`; check one `como_chegou` option; check one `objetivo_treino` option
      that is **not** "Gestação e pós-parto". "Seguinte" advances.
- [ ] Step 2 title "SOBRE O TREINO"; 5 controls: `onde_treina` (Casa/Ginásio),
      `dificuldade_atual` (text), `frequencia_treino` (2-3x / 4-5x / 5+),
      `orientacao_nutricional` (Sim/Não), `comprometimento` (Sim/Não).
- [ ] Last step shows **"Enviar"**, not "Seguinte".
- [ ] Submit → success screen ("A nossa equipa será informada…"), no retry button.
- [ ] **Geral tab** gets one new row, columns in this order, values correct:
      `submitted_at, nome, contacto_telefonico, email, como_chegou, como_chegou_outro,
      objetivo_treino, onde_treina, dificuldade_atual, frequencia_treino,
      orientacao_nutricional, comprometimento`
      (radios stored as raw option ids — `casa`, `2_3x`, `sim` — not labels; multi-checkbox
      joined with `, `; `como_chegou_outro` blank unless "outro" was picked).
- [ ] Notification email received, subject mentions "Geral", body lists every answer
      with **human labels** (email does resolve labels; the sheet does not).

## Branch 2 — Gestação

Step 1 → `fase_gestacao` (fase = Gestação) → `gestacao` → submit.

- [ ] Step 1: same as above but check **"Gestação e pós-parto"** in `objetivo_treino`.
      "Seguinte" now goes to "Em que fase te encontras", **not** "SOBRE O TREINO".
- [ ] `fase_gestacao`: 2-option radio (Gestação / Pós-parto). Pick **Gestação**.
- [ ] `gestacao` step: `fisio_pelvica` (Sim/Não), `semanas_gravidez` (text),
      `historial_risco` (text), `preferencia_local` (CrossFit 4475 / Templo Fitness),
      `disponibilidade_horario` (text), then a read-only note ("Será contactada por
      parte da treinadora…") that is **not** a form control.
- [ ] Last step shows "Enviar". Submit → success screen.
- [ ] **Gestação-Pós-parto tab** gets one row, 19 columns:
      `submitted_at, nome, contacto_telefonico, email, como_chegou, como_chegou_outro,
      objetivo_treino, fase, fisio_pelvica, semanas_gravidez, historial_risco,
      preferencia_local, disponibilidade_horario, tipo_parto, complicacoes_parto,
      acomp_exercicio_gravidez, acomp_fisio_gravidez, tempo_posparto,
      primeira_consulta_posparto`
      — `fase` = `gestacao`; all **pós-parto** columns (`tipo_parto` … `primeira_consulta_posparto`)
      **blank**; `nota_contacto` is not a column.
- [ ] Email received, subject mentions "Gestação/Pós-parto".

## Branch 3 — Pós-parto

Step 1 → `fase_gestacao` (fase = Pós-parto) → `posparto` → submit.

- [ ] `fase_gestacao`: pick **Pós-parto**.
- [ ] `posparto` step, 8 controls in order: `tipo_parto` (Normal/Cesariana),
      `complicacoes_parto` (text), `acomp_exercicio_gravidez` (Sim/Não),
      `acomp_fisio_gravidez` (Sim/Não), `tempo_posparto` (text),
      `primeira_consulta_posparto` (Sim/Não), `preferencia_local`,
      `disponibilidade_horario` (text), then the same read-only note.
- [ ] Submit → success screen.
- [ ] **Gestação-Pós-parto tab** row: `fase` = `posparto`; the **gestação-only**
      columns `fisio_pelvica`, `semanas_gravidez`, `historial_risco` **blank**;
      pós-parto columns filled.
- [ ] Email received.

## Navigation

- [ ] "Voltar" appears on every step except step 1.
- [ ] "Voltar" keeps every answer already entered (text values still in the inputs).
- [ ] "Voltar" does **not** trigger validation — you can go back from a half-filled step.
- [ ] "Seguinte" / "Enviar" **is** gated by validation (see below).
- [ ] No reload on any nav click (URL unchanged, console not re-initialised).

## Branch switching mid-flow

- [ ] Enter the gestação branch (pick "Gestação e pós-parto"), advance to
      `fase_gestacao`, pick a `fase`, go **Voltar** to step 1, **uncheck**
      "Gestação e pós-parto". Because `objetivo_treino` is now empty and required,
      "Seguinte" is blocked with an error until you pick another goal. After picking
      one, "Seguinte" goes to **SOBRE O TREINO** — the gestação steps are gone.
- [ ] The resulting **Geral** row has no stale gestação data (`fase`, `semanas_gravidez`
      etc. are simply not columns on that tab).
- [ ] On `fase_gestacao`, flip Gestação ↔ Pós-parto: the following step swaps between
      the `gestacao` and `posparto` question sets. Data typed into the abandoned leaf
      does not appear in the submitted row for the other leaf.

## Required-field validation (every step)

- [ ] Step 1: clicking forward with any of `nome` / `contacto_telefonico` / `email` /
      `como_chegou` / `objetivo_treino` empty shows an inline `role="alert"` error under
      that field and does not advance.
- [ ] `como_chegou_outro` (free text) appears only when "outro" is checked, and is then
      **required** — forward is blocked until it is filled.
- [ ] `contacto_telefonico`: a local part shorter than 6 or longer than 15 digits shows
      the phone error.
- [ ] `email`: a malformed address (no `@`, no domain dot) shows the email error;
      an empty email shows the "required" error, not the format one.
- [ ] `treino_geral`: all 5 fields block when empty.
- [ ] `fase_gestacao`: `fase` blocks when unpicked.
- [ ] `gestacao`: all 5 inputs block when empty; the note never blocks.
- [ ] `posparto`: all 8 inputs block when empty; the note never blocks.
- [ ] Every error clears as soon as the field is corrected (no second click needed).

## Confirmation / error screens

- [ ] Successful submit → success copy, no retry button, form is gone.
- [ ] Force a Sheets failure (temporarily set a bad `GOOGLE_SHEETS_SPREADSHEET_ID`
      in `.env`, restart `netlify dev`) → submit shows the **error screen** with a
      working "Tentar novamente" button; fixing the id and retrying → success.
      **A Sheets write failure must fail the submission — no false success screen.**
- [ ] Break the email config (unset `EMAIL_API_KEY`) → a submission still **succeeds**
      (row written, success screen); the only trace is a `console.error` in the
      `netlify dev` function log. **An email failure must never fail the submission.**
- [ ] While a submit is in flight the button reads "A enviar…" and is disabled;
      a second click does not double-submit.

## Console

- [ ] Zero errors and zero warnings on every step of every branch.
- [ ] In particular, no `t(): missing key` warnings from `js/i18n.js` — a missing
      locale key counts as a failure.

## Mobile device pass (not automatable)

Run the full submit for **all three branches** on:

- [ ] **iOS Safari** (real device)
- [ ] **Android Chrome** (real device)

On each, check:

- [ ] Tap targets for radios / checkboxes are comfortably large.
- [ ] The country `<select>` opens the native picker and the chosen dial code sticks.
- [ ] `contacto_telefonico` opens the numeric keypad; `email` opens the email keyboard.
- [ ] No horizontal scroll / clipped labels / overlapping controls at that width.
- [ ] Success and error screens render correctly.

## Known cosmetic issues (not blockers)

Found during the issue #17 live pass — data is correct, only presentation:

- The notification email renders `submitted_at` as a raw ISO string
  ("Recebida em 2026-09-08T15:33:18.007Z") instead of a friendly date.
- In the **pós-parto** notification email, `preferencia_local` and
  `disponibilidade_horario` are listed before the parto questions, because the
  email follows `columnsFor("gestacao_posparto")` order (where those ids first
  appear in the gestação block) rather than the on-screen pós-parto field order.

## Sign-off

- [ ] All three branches produce correct, complete submissions — no missing or
      mislabeled data.
- [ ] No console errors on any step.
- [ ] No dead ends or unreachable steps found.
- [ ] Live form content and behaviour signed off by **Filipa Fial** (or designated
      reviewer): __________________________  date: __________
