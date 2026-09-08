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
| `maior_dificuldade` | text | yes | — | free text |
| `rotina_treinos` | radio | yes | `2_3x`, `4_5x`, `5_mais` | sessions per week |
| `orientacao_nutricionista` | radio | yes | `sim`, `nao` | |
| `compromisso_online` | radio | yes | `sim`, `nao` | confidence/commitment with online coaching |

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
| `preferencia_treino_presencial` | radio | yes | `crossfit_4475`, `templo_fitness` | |
| `disponibilidade_horario` | text | yes | — | availability (2ª, 3ª, 4ª, 6ª) |
| `aviso_contacto` | checkbox | yes | — | acknowledges the trainer will make contact |

## Step: `posparto`

Condition: `objetivo_treino` includes `gestacao_posparto` **and** `fase === "posparto"`.

| field id | type | required | option ids | notes |
|---|---|---|---|---|
| `tipo_parto` | radio | yes | `normal`, `cesariana` | |
| `complicacoes_parto` | text | yes | — | free text |
| `acompanhamento_exercicio_gravidez` | radio | yes | `sim`, `nao` | exercise professional during pregnancy |
| `fisio_pelvica_gravidez` | radio | yes | `sim`, `nao` | pelvic physiotherapy during pregnancy |
| `tempo_posparto` | text | yes | — | time since birth |
| `primeira_consulta_posparto` | radio | yes | `sim`, `nao` | first post-partum obstetric appointment done |
| `preferencia_treino_presencial` | radio | yes | `crossfit_4475`, `templo_fitness` | |
| `disponibilidade_horario` | text | yes | — | |
| `aviso_contacto` | checkbox | yes | — | acknowledges the trainer will make contact |

## Shared option sets

- **sim/não**: `sim`, `nao`
- **preferência de treino presencial**: `crossfit_4475`, `templo_fitness`
