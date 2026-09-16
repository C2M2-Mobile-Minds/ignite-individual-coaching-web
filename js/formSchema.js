// Steps, fields, and branch conditions (data, not markup).
//
// This file is the single source of truth for both rendering (formEngine.js)
// and branch logic. It contains NO UI code — only data and the pure
// `condition(answers)` predicates that decide which steps/fields are shown.
//
// `answers` is a flat object keyed by field id:
//   - text/email/tel  -> string
//   - radio           -> the selected option id (string)
//   - checkbox        -> array of selected option ids (string[])
//
// Field ids are stable across this schema, the locale files, the submitted
// payload, and the spreadsheet columns. Only the display label changes per
// locale. Full field-id reference: docs/field-ids.md
//
// `*Key` properties are i18n translation ids resolved later through t().

const OUTRO = "outro";
const GESTACAO_POSPARTO = "gestacao_posparto";

/** True when the user picked the "gestação e pós-parto" training goal. */
export function selectedGestacaoPosparto(answers) {
  const objetivos = answers.objetivo_treino;
  return Array.isArray(objetivos) && objetivos.includes(GESTACAO_POSPARTO);
}

const simNao = [
  { id: "sim", labelKey: "form.option.sim" },
  { id: "nao", labelKey: "form.option.nao" },
];

const preferenciaLocalOptions = [
  { id: "crossfit_4475", labelKey: "form.option.preferencia_local.crossfit_4475" },
  { id: "templo_fitness", labelKey: "form.option.preferencia_local.templo_fitness" },
];

const frequenciaPresencialOptions = [
  { id: "1x", labelKey: "form.option.frequencia_presencial.1x" },
  { id: "2x", labelKey: "form.option.frequencia_presencial.2x" },
];

const localizacaoPresencialOptions = [
  { id: "crossfit_4475", labelKey: "form.option.localizacao_presencial.crossfit_4475" },
  { id: "templo_fitness", labelKey: "form.option.localizacao_presencial.templo_fitness" },
];

export const steps = [
  {
    id: "dados_basicos",
    titleKey: "form.step.dados_basicos.title",
    // Always shown — entry step.
    fields: [
      { id: "nome", type: "text", required: true, labelKey: "form.field.nome" },
      { id: "contacto_telefonico", type: "tel", required: true, labelKey: "form.field.contacto_telefonico" },
      { id: "email", type: "email", required: true, labelKey: "form.field.email" },
      {
        id: "como_chegou",
        type: "checkbox",
        multiple: true,
        required: true,
        labelKey: "form.field.como_chegou",
        options: [
          { id: "redes_sociais", labelKey: "form.option.como_chegou.redes_sociais" },
          { id: "fisioterapia", labelKey: "form.option.como_chegou.fisioterapia" },
          { id: "amigos_familiares", labelKey: "form.option.como_chegou.amigos_familiares" },
          { id: OUTRO, labelKey: "form.option.como_chegou.outro" },
        ],
      },
      {
        id: "como_chegou_outro",
        type: "text",
        required: true,
        labelKey: "form.field.como_chegou_outro",
        // Only shown when "outro" is checked above.
        condition: (answers) =>
          Array.isArray(answers.como_chegou) && answers.como_chegou.includes(OUTRO),
      },
      {
        id: "objetivo_treino",
        type: "checkbox",
        multiple: true,
        required: true,
        labelKey: "form.field.objetivo_treino",
        options: [
          { id: "ganho_massa", labelKey: "form.option.objetivo_treino.ganho_massa" },
          { id: "recomposicao", labelKey: "form.option.objetivo_treino.recomposicao" },
          { id: "saude_longevidade", labelKey: "form.option.objetivo_treino.saude_longevidade" },
          { id: "reforco_modalidade", labelKey: "form.option.objetivo_treino.reforco_modalidade" },
          { id: "forca_atletismo", labelKey: "form.option.objetivo_treino.forca_atletismo" },
          { id: GESTACAO_POSPARTO, labelKey: "form.option.objetivo_treino.gestacao_posparto" },
          { id: "crossfit", labelKey: "form.option.objetivo_treino.crossfit" },
        ],
      },
    ],
  },

  {
    id: "modalidade_treino",
    titleKey: "form.step.modalidade_treino.title",
    // General-training branch: shown when gestação/pós-parto was NOT selected.
    // Forks the branch into an online and a presencial question set (issue #50).
    condition: (answers) => !selectedGestacaoPosparto(answers),
    fields: [
      {
        id: "modalidade_treino",
        type: "radio",
        required: true,
        labelKey: "form.field.modalidade_treino",
        options: [
          { id: "online", labelKey: "form.option.modalidade_treino.online" },
          { id: "presencial", labelKey: "form.option.modalidade_treino.presencial" },
        ],
      },
    ],
  },

  {
    id: "treino_geral_online",
    titleKey: "form.step.treino_geral_online.title",
    // Online sub-branch — the original issue #7 question set, unchanged.
    // (Renamed from `treino_geral` in #50 — one-off, step unshipped.)
    group: "treino_geral",
    groupCondition: (answers) => !selectedGestacaoPosparto(answers),
    condition: (answers) =>
      !selectedGestacaoPosparto(answers) && answers.modalidade_treino === "online",
    fields: [
      {
        id: "onde_treina",
        type: "radio",
        required: true,
        labelKey: "form.field.onde_treina",
        options: [
          { id: "casa", labelKey: "form.option.onde_treina.casa" },
          { id: "ginasio", labelKey: "form.option.onde_treina.ginasio" },
        ],
      },
      { id: "dificuldade_atual", type: "text", required: true, labelKey: "form.field.dificuldade_atual" },
      {
        id: "frequencia_treino",
        type: "radio",
        required: true,
        labelKey: "form.field.frequencia_treino",
        options: [
          { id: "2_3x", labelKey: "form.option.frequencia_treino.2_3x" },
          { id: "4_5x", labelKey: "form.option.frequencia_treino.4_5x" },
          { id: "5_mais", labelKey: "form.option.frequencia_treino.5_mais" },
        ],
      },
      {
        id: "orientacao_nutricional",
        type: "radio",
        required: true,
        labelKey: "form.field.orientacao_nutricional",
        options: simNao,
      },
    ],
  },

  {
    id: "treino_geral_presencial",
    titleKey: "form.step.treino_geral_presencial.title",
    // Presencial sub-branch — distinct, smaller question set (issue #50).
    group: "treino_geral",
    groupCondition: (answers) => !selectedGestacaoPosparto(answers),
    condition: (answers) =>
      !selectedGestacaoPosparto(answers) && answers.modalidade_treino === "presencial",
    fields: [
      {
        id: "frequencia_presencial",
        type: "radio",
        required: true,
        labelKey: "form.field.frequencia_presencial",
        options: frequenciaPresencialOptions,
      },
      {
        id: "localizacao_presencial",
        type: "radio",
        required: true,
        labelKey: "form.field.localizacao_presencial",
        options: localizacaoPresencialOptions,
      },
      { id: "disponibilidade_presencial", type: "text", required: true, labelKey: "form.field.disponibilidade_presencial" },
    ],
  },

  {
    id: "comprometimento",
    titleKey: "form.step.comprometimento.title",
    // Own step in the general-training branch (issue #45). Both the online and
    // presencial sub-branches (issue #50) converge here — condition is the plain
    // general-branch negation, independent of `modalidade_treino`.
    condition: (answers) => !selectedGestacaoPosparto(answers),
    fields: [
      {
        id: "comprometimento",
        type: "radio",
        required: true,
        labelKey: "form.field.comprometimento",
        options: simNao,
      },
    ],
  },

  {
    id: "fase_gestacao",
    titleKey: "form.step.fase_gestacao.title",
    // Gestação/pós-parto branch splitter.
    condition: (answers) => selectedGestacaoPosparto(answers),
    fields: [
      {
        id: "fase",
        type: "radio",
        required: true,
        labelKey: "form.field.fase",
        hideLabel: true,
        options: [
          { id: "gestacao", labelKey: "form.option.fase.gestacao" },
          { id: "posparto", labelKey: "form.option.fase.posparto" },
        ],
      },
    ],
  },

  {
    id: "gestacao",
    titleKey: "form.step.gestacao.title",
    group: "leaf_gestacao_posparto",
    groupCondition: (answers) => selectedGestacaoPosparto(answers),
    condition: (answers) => selectedGestacaoPosparto(answers) && answers.fase === "gestacao",
    fields: [
      {
        id: "fisio_pelvica",
        type: "radio",
        required: true,
        labelKey: "form.field.fisio_pelvica",
        options: simNao,
      },
      { id: "semanas_gravidez", type: "text", required: true, labelKey: "form.field.semanas_gravidez" },
      { id: "historial_risco", type: "text", required: true, labelKey: "form.field.historial_risco" },
      {
        id: "preferencia_local",
        type: "radio",
        required: true,
        labelKey: "form.field.preferencia_local",
        options: preferenciaLocalOptions,
      },
      { id: "disponibilidade_horario", type: "text", required: true, labelKey: "form.field.disponibilidade_horario" },
    ],
  },

  {
    id: "posparto",
    titleKey: "form.step.posparto.title",
    group: "leaf_gestacao_posparto",
    groupCondition: (answers) => selectedGestacaoPosparto(answers),
    condition: (answers) => selectedGestacaoPosparto(answers) && answers.fase === "posparto",
    fields: [
      {
        id: "tipo_parto",
        type: "radio",
        required: true,
        labelKey: "form.field.tipo_parto",
        options: [
          { id: "normal", labelKey: "form.option.tipo_parto.normal" },
          { id: "cesariana", labelKey: "form.option.tipo_parto.cesariana" },
        ],
      },
      { id: "complicacoes_parto", type: "text", required: true, labelKey: "form.field.complicacoes_parto" },
      {
        id: "acomp_exercicio_gravidez",
        type: "radio",
        required: true,
        labelKey: "form.field.acomp_exercicio_gravidez",
        options: simNao,
      },
      {
        id: "acomp_fisio_gravidez",
        type: "radio",
        required: true,
        labelKey: "form.field.acomp_fisio_gravidez",
        options: simNao,
      },
      { id: "tempo_posparto", type: "text", required: true, labelKey: "form.field.tempo_posparto" },
      {
        id: "primeira_consulta_posparto",
        type: "radio",
        required: true,
        labelKey: "form.field.primeira_consulta_posparto",
        options: simNao,
      },
      {
        id: "preferencia_local",
        type: "radio",
        required: true,
        labelKey: "form.field.preferencia_local",
        options: preferenciaLocalOptions,
      },
      { id: "disponibilidade_horario", type: "text", required: true, labelKey: "form.field.disponibilidade_horario" },
    ],
  },
];

/** Steps whose `condition` (if any) passes for the given answers, in order. */
export function visibleSteps(answers) {
  return steps.filter((step) => !step.condition || step.condition(answers));
}

/** Fields of a step whose `condition` (if any) passes for the given answers. */
export function visibleFields(step, answers) {
  return step.fields.filter((field) => !field.condition || field.condition(answers));
}

/**
 * Count of steps toward the progress total: like `visibleSteps().length`, but a
 * still-undecided exclusive group (e.g. `treino_geral_online`/`_presencial`, both
 * hidden pending a `modalidade_treino` answer) still counts once via `groupCondition`
 * instead of vanishing until the sub-choice is made.
 */
export function totalVisibleSteps(answers) {
  const seen = new Set();
  let count = 0;
  for (const step of steps) {
    const key = step.group ?? step.id;
    if (seen.has(key)) continue;
    seen.add(key);
    const passes = step.group
      ? step.groupCondition(answers)
      : !step.condition || step.condition(answers);
    if (passes) count++;
  }
  return count;
}
