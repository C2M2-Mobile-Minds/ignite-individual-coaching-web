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

const preferenciaTreinoPresencialOptions = [
  { id: "crossfit_4475", labelKey: "form.option.preferencia_treino_presencial.crossfit_4475" },
  { id: "templo_fitness", labelKey: "form.option.preferencia_treino_presencial.templo_fitness" },
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
          { id: "instagram", labelKey: "form.option.como_chegou.instagram" },
          { id: "recomendacao", labelKey: "form.option.como_chegou.recomendacao" },
          { id: "pesquisa", labelKey: "form.option.como_chegou.pesquisa" },
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
          { id: "perda_peso", labelKey: "form.option.objetivo_treino.perda_peso" },
          { id: "ganho_massa", labelKey: "form.option.objetivo_treino.ganho_massa" },
          { id: "condicao_fisica", labelKey: "form.option.objetivo_treino.condicao_fisica" },
          { id: "saude_bem_estar", labelKey: "form.option.objetivo_treino.saude_bem_estar" },
          { id: "recomposicao", labelKey: "form.option.objetivo_treino.recomposicao" },
          { id: "saude_longevidade", labelKey: "form.option.objetivo_treino.saude_longevidade" },
          { id: "reforco_modalidade", labelKey: "form.option.objetivo_treino.reforco_modalidade" },
          { id: "forca_atletismo", labelKey: "form.option.objetivo_treino.forca_atletismo" },
          { id: GESTACAO_POSPARTO, labelKey: "form.option.objetivo_treino.gestacao_posparto" },
        ],
      },
    ],
  },

  {
    id: "treino_geral",
    titleKey: "form.step.treino_geral.title",
    // General-training branch: shown when gestação/pós-parto was NOT selected.
    condition: (answers) => !selectedGestacaoPosparto(answers),
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
      { id: "maior_dificuldade", type: "text", required: true, labelKey: "form.field.maior_dificuldade" },
      {
        id: "rotina_treinos",
        type: "radio",
        required: true,
        labelKey: "form.field.rotina_treinos",
        options: [
          { id: "2_3x", labelKey: "form.option.rotina_treinos.2_3x" },
          { id: "4_5x", labelKey: "form.option.rotina_treinos.4_5x" },
          { id: "5_mais", labelKey: "form.option.rotina_treinos.5_mais" },
        ],
      },
      {
        id: "orientacao_nutricionista",
        type: "radio",
        required: true,
        labelKey: "form.field.orientacao_nutricionista",
        options: simNao,
      },
      {
        id: "compromisso_online",
        type: "radio",
        required: true,
        labelKey: "form.field.compromisso_online",
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
        id: "preferencia_treino_presencial",
        type: "radio",
        required: true,
        labelKey: "form.field.preferencia_treino_presencial",
        options: preferenciaTreinoPresencialOptions,
      },
      { id: "disponibilidade_horario", type: "text", required: true, labelKey: "form.field.disponibilidade_horario" },
      { id: "aviso_contacto", type: "checkbox", required: true, labelKey: "form.field.aviso_contacto" },
    ],
  },

  {
    id: "posparto",
    titleKey: "form.step.posparto.title",
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
        id: "acompanhamento_exercicio_gravidez",
        type: "radio",
        required: true,
        labelKey: "form.field.acompanhamento_exercicio_gravidez",
        options: simNao,
      },
      {
        id: "fisio_pelvica_gravidez",
        type: "radio",
        required: true,
        labelKey: "form.field.fisio_pelvica_gravidez",
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
        id: "preferencia_treino_presencial",
        type: "radio",
        required: true,
        labelKey: "form.field.preferencia_treino_presencial",
        options: preferenciaTreinoPresencialOptions,
      },
      { id: "disponibilidade_horario", type: "text", required: true, labelKey: "form.field.disponibilidade_horario" },
      { id: "aviso_contacto", type: "checkbox", required: true, labelKey: "form.field.aviso_contacto" },
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
