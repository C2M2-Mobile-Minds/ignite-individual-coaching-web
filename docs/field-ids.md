# Field ID reference

Generated from `js/formSchema.js`. Field ids are **stable** across the schema,
locale files (`locales/<locale>.json`), the submitted payload, and the
spreadsheet columns. Only the display label changes per locale — never the id.

`answers` shape by field type:

| type | value in `answers` |
|---|---|
| `text`, `email`, `tel` | string |
| `radio` | selected option id (string) |
| `checkbox` (single) | boolean-ish / option id |
| `checkbox` with `multiple: true` | array of selected option ids |
| `note` | none — read-only informational text, never stored or validated |

## Step: `dados_basicos`

Always shown (entry step).

| field id | type | required | option ids | notes |
|---|---|---|---|---|
| `nome` | text | yes | — | first + last name in one field |
| `contacto_telefonico` | tel | yes | — | |
| `email` | email | yes | — | |
| `como_chegou` | checkbox (multiple) | yes | `instagram`, `recomendacao`, `pesquisa`, `redes_sociais`, `fisioterapia`, `amigos_familiares`, `outro` | how they found Ignite |
| `como_chegou_outro` | text | yes | — | shown only when `como_chegou` includes `outro`; cleared when `outro` is unchecked |
| `objetivo_treino` | checkbox (multiple) | yes | `perda_peso`, `ganho_massa`, `condicao_fisica`, `saude_bem_estar`, `recomposicao`, `saude_longevidade`, `reforco_modalidade`, `forca_atletismo`, `gestacao_posparto` | training goals; `gestacao_posparto` drives the branch |

## Step: `treino_geral`

Condition: `objetivo_treino` does **not** include `gestacao_posparto`.

| field id | type | required | option ids | notes |
|---|---|---|---|---|
| `onde_treina` | radio | yes | `casa`, `ginasio` | |
| `dificuldade_atual` | text | yes | — | free text |
| `frequencia_treino` | radio | yes | `2_3x`, `4_5x`, `5_mais` | sessions per week (option ids retained across the #7 rename) |
| `orientacao_nutricional` | radio | yes | `sim`, `nao` | |
| `comprometimento` | radio | yes | `sim`, `nao` | confidence/commitment with online coaching |

## Step: `fase_gestacao`

Condition: `objetivo_treino` includes `gestacao_posparto`.

| field id | type | required | option ids | notes |
|---|---|---|---|---|
| `fase` | radio | yes | `gestacao`, `posparto` | branch splitter |

## Step: `gestacao`

Condition: `objetivo_treino` includes `gestacao_posparto` **and** `fase === "gestacao"`.

| field id | type | required | option ids | notes |
|---|---|---|---|---|
| `fisio_pelvica` | radio | yes | `sim`, `nao` | pelvic physiotherapy follow-up |
| `semanas_gravidez` | text | yes | — | weeks of pregnancy |
| `historial_risco` | text | yes | — | risk history per obstetrician |
| `preferencia_local` | radio | yes | `crossfit_4475`, `templo_fitness` | in-person training location (renamed from `preferencia_treino_presencial` in #9 — one-off, step unshipped) |
| `disponibilidade_horario` | text | yes | — | availability (2ª, 3ª, 4ª, 6ª) |
| `nota_contacto` | note | — | — | read-only closing note (`form.note.contacto_treinadora`); replaced the `aviso_contacto` checkbox for this step in #9 |

## Step: `posparto`

Condition: `objetivo_treino` includes `gestacao_posparto` **and** `fase === "posparto"`.

| field id | type | required | option ids | notes |
|---|---|---|---|---|
| `tipo_parto` | radio | yes | `normal`, `cesariana` | |
| `complicacoes_parto` | text | yes | — | free text |
| `acomp_exercicio_gravidez` | radio | yes | `sim`, `nao` | exercise professional during pregnancy (renamed from `acompanhamento_exercicio_gravidez` in #10 — one-off, step unshipped) |
| `acomp_fisio_gravidez` | radio | yes | `sim`, `nao` | pelvic physiotherapy during pregnancy (renamed from `fisio_pelvica_gravidez` in #10 — one-off, step unshipped) |
| `tempo_posparto` | text | yes | — | time since birth |
| `primeira_consulta_posparto` | radio | yes | `sim`, `nao` | first post-partum obstetric appointment done |
| `preferencia_local` | radio | yes | `crossfit_4475`, `templo_fitness` | |
| `disponibilidade_horario` | text | yes | — | |
| `nota_contacto` | note | — | — | read-only closing note (`form.note.contacto_treinadora`); replaced the `aviso_contacto` checkbox for this step in #10 |

## Shared option sets

- **sim/não**: `sim`, `nao`
- **preferência de local**: `crossfit_4475`, `templo_fitness`

## Spreadsheet tabs

The Netlify function (`netlify/functions/submit.mjs`) writes one row per
submission. Column order is derived from this schema by
`netlify/functions/lib/columns.mjs` — headers are the field ids, auto-written
to row 1 when a tab is empty. One synthetic leading column:

| column | value |
|---|---|
| `submitted_at` | ISO-8601 timestamp set server-side at write time (not a form field) |

Array answers (`como_chegou`, `objetivo_treino`) are joined with `, `;
booleans render as `Sim` / `Não`. `note` fields (`nota_contacto`) are never
written.

- **Tab `Geral`** — flow `geral` (`objetivo_treino` excludes `gestacao_posparto`).
  Columns: `submitted_at` + `dados_basicos` ids + `treino_geral` ids.
- **Tab `Gestação-Pós-parto`** — flow `gestacao_posparto` (`objetivo_treino`
  includes `gestacao_posparto`, either `fase`). Columns: `submitted_at` +
  `dados_basicos` ids + `fase` + the union of `gestacao` and `posparto` ids
  (shared ids `preferencia_local` / `disponibilidade_horario` appear once).
