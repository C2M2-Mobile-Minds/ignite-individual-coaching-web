# Ignite Individual Coaching — Web Form

Multi-step web form for Ignite Individual Coaching's lead intake, accessed via a link in the company's Instagram profile. Collects user answers, branches into different question sets depending on the user's training goal, and submits responses to both a company email and a Google Sheet.

## Status

**Phase 1 (current):** static web form, no dedicated backend — a single serverless function handles submission.
**Phase 2 (future):** mobile app (Kotlin Multiplatform) and a dedicated API. Not started yet; this repo covers phase 1 only.

## Tech stack

- **Frontend:** vanilla JavaScript, HTML, CSS (no framework)
- **Backend:** one serverless function (Netlify Functions) — no dedicated backend for phase 1
- **Data destinations:** Google Sheets API (spreadsheet) + transactional email API (e.g. Resend/SendGrid)
- **Localization:** i18n-ready via JSON locale files, starting with `pt-PT` only

## Getting started

Prerequisites: [Node.js](https://nodejs.org/) (18+) and npm.

```bash
npm install
cp .env.example .env   # fill in the values (see "Environment variables" below)
npm run dev             # runs `netlify dev` — serves index.html + functions locally
```

If `npm run dev` isn't available (e.g. `netlify-cli` fails to install), serve the static files directly — the serverless function won't be reachable this way, but the form itself will load:

```bash
python -m http.server 8080
# then open http://localhost:8080
```

## Repository structure

```
ignite-individual-coaching-web/
├── index.html
├── css/
│   └── main.css
├── js/
│   ├── formSchema.js      # steps, fields, and branch conditions (data, not markup)
│   ├── formEngine.js      # renders current step from schema, handles forward/back nav + validation
│   ├── countries.js       # EU/EEA dial codes + parse/combine helpers for the phone field
│   ├── i18n.js            # loads locale JSON, exposes t('key') helper
│   └── submit.js          # POSTs final payload to the serverless function
├── locales/
│   └── pt-PT.json
├── netlify/
│   └── functions/
│       └── submit.js      # Sheets write + email send
├── netlify.toml
├── docs/
│   └── field-ids.md      # generated field-ID reference (types, options, conditions)
└── README.md
```

## Form flow

The form is schema-driven: each step is a data object with an optional `condition` function that decides whether it's shown, based on answers collected so far. The schema below mirrors this flowchart exactly — there is no separate page per branch, just conditional steps evaluated at runtime.

```mermaid
flowchart TD
    A(["Página 1: Dados básicos<br/>Nome, contacto e objetivos"]) --> B{"Selecionou gestação<br/>ou pós-parto?"}

    B -- não --> C["Página 2: Treino geral<br/><i>Onde treina, dificuldade,<br/>rotina, nutrição</i>"]
    B -- sim --> D["Página 2: Em que fase?"]

    D -- gestação --> F["Página 3: Gestação<br/><i>Fisio pélvica, semanas,<br/>historial de risco...</i>"]
    D -- pós-parto --> G["Página 3: Pós-parto<br/><i>Tipo de parto, complicações,<br/>acompanhamento...</i>"]

    C --> E(["Envio: email + sheet<br/><small>tab 'Geral'</small>"])
    F --> H(["Envio: email + sheet<br/><small>tab 'Gestação/Pós-parto'</small>"])
    G --> H

    classDef start fill:#E1F5EE,stroke:#0F6E56,stroke-width:1.5px,color:#04342C
    classDef decision fill:#EEEDFE,stroke:#534AB7,stroke-width:1.5px,color:#26215C
    classDef general fill:#E6F1FB,stroke:#185FA5,stroke-width:1.5px,color:#042C53
    classDef pregnancy fill:#FAECE7,stroke:#993C1D,stroke-width:1.5px,color:#4A1B0C
    classDef finish fill:#EAF3DE,stroke:#3B6D11,stroke-width:1.5px,color:#173404

    class A start
    class B decision
    class C general
    class D,F,G pregnancy
    class E,H finish
```

### Question set by page

| Page | Fields |
|---|---|
| 1. Dados básicos | Nome (primeiro e último); contacto telefónico e e-mail; como chegou até à Ignite (checkbox + "outro" com texto livre); objetivo(s) de treino (checkbox, múltipla escolha) |
| 2a. Treino geral | Onde treinas (casa/ginásio); qual a maior dificuldade neste momento (texto livre); como é a tua rotina de treinos (2-3x, 4-5x, 5+/semana); segues orientação alimentar de um nutricionista (sim/não); confiança/compromisso a investir no acompanhamento on-line (sim/não) |
| 2b. Em que fase | Gestação ou pós-parto (checkbox) |
| 3a. Gestação | Acompanhamento por fisioterapia pélvica (sim/não); semanas de gravidez (texto); historial de risco segundo obstetra (texto livre); preferência de treino presencial (CrossFit 4475 / Templo Fitness Estúdio); disponibilidade de horário (2ª, 3ª, 4ª, 6ª — texto livre); aviso de contacto pela treinadora |
| 3b. Pós-parto | Tipo de parto (normal/cesariana); complicações no parto (texto livre); acompanhamento por profissional de exercício físico na gravidez (sim/não); acompanhamento por fisioterapia pélvica na gravidez (sim/não); tempo pós-parto (texto livre); primeira consulta pós-parto com obstetrícia (sim/não); preferência de treino presencial; disponibilidade de horário; aviso de contacto pela treinadora |

Each field has a stable ID (e.g. `nome`, `objetivo_treino`, `fase`, `semanas_gravidez`) used consistently across the form schema, the locale file, the submitted payload, and the spreadsheet columns — only the *display label* changes per locale, never the ID. The full field-ID list (types, options, branch conditions) is documented in [`docs/field-ids.md`](docs/field-ids.md).

## Submission flow

```mermaid
sequenceDiagram
    participant U as Utilizador
    participant W as Web form (browser)
    participant F as Serverless function
    participant S as Google Sheets API
    participant E as Email API

    U->>W: Preenche formulário (respostas por página)
    W->>W: Valida respostas obrigatórias por página
    W->>F: POST payload JSON (flow + respostas)
    F->>S: Escreve linha na tab correspondente (Geral / Gestação-Pós-parto)
    F->>E: Envia email com template correspondente ao flow
    F-->>W: Resposta de sucesso/erro
    W-->>U: Ecrã de confirmação ou erro com retry
```

The spreadsheet write is treated as the source of truth (retried/alerted on failure); the email is a notification and can fail without blocking the submission.

## Localization

Locale files live in `/locales`, keyed by translation ID, not by page:

```json
{
  "form.step1.nome": "Nome (primeiro e último)",
  "form.step1.como_chegou.label": "Como chegou até à Ignite?",
  "form.objetivo.gestacao_posparto": "Acompanhamento gestação e pós-parto"
}
```

Only `pt-PT.json` exists today. Adding a new language later means adding a new JSON file with the same keys — no changes to `formSchema.js`, `formEngine.js`, or the branch logic.

## Environment variables

Set locally in `.env` (never committed — see `.gitignore`) and in the Netlify dashboard for production:

```
GOOGLE_SHEETS_CLIENT_EMAIL=
GOOGLE_SHEETS_PRIVATE_KEY=
GOOGLE_SHEETS_SPREADSHEET_ID=
EMAIL_API_KEY=
COMPANY_EMAIL_TO=
```

## Roadmap

```mermaid
flowchart LR
    A["Phase 1<br/>Web form"] --> B["Phase 2<br/>Mobile app (KMP)"]
    A --> C["Phase 2<br/>Dedicated API"]
    B -.-> C

    classDef current fill:#E1F5EE,stroke:#0F6E56,stroke-width:1.5px,color:#04342C
    classDef future fill:#F1EFE8,stroke:#5F5E5A,stroke-width:1.5px,color:#2C2C2A

    class A current
    class B,C future
```

When phase 2 starts, mobile and backend will live in separate repositories (`ignite-individual-coaching-mobile`, `ignite-individual-coaching-api`), keeping this repo scoped to the web form only.

## License

Proprietary — all rights reserved, © Ignite Individual Coaching.
