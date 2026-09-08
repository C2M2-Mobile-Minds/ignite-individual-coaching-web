// Column definitions for the Google Sheets write.
//
// Single source of truth for which columns land in which tab, derived from the
// form schema so the spreadsheet stays in lockstep with the field ids.
// See docs/field-ids.md.

import { steps, selectedGestacaoPosparto } from "../../../js/formSchema.js";

/** Field ids of a step, in schema order, excluding read-only `note` fields. */
function stepFieldIds(stepId) {
  const step = steps.find((s) => s.id === stepId);
  return step.fields.filter((f) => f.type !== "note").map((f) => f.id);
}

/** Synthetic column (not a field id) prepended to every row. */
export const TIMESTAMP_COLUMN = "submitted_at";

const BASE_COLUMNS = [TIMESTAMP_COLUMN, ...stepFieldIds("dados_basicos")];

export const GERAL_COLUMNS = [...BASE_COLUMNS, ...stepFieldIds("treino_geral")];

const gestacaoBranchIds = [
  ...stepFieldIds("fase_gestacao"),
  ...stepFieldIds("gestacao"),
  ...stepFieldIds("posparto"),
];

export const GESTACAO_COLUMNS = [
  ...BASE_COLUMNS,
  ...gestacaoBranchIds.filter((id, i) => gestacaoBranchIds.indexOf(id) === i),
];

const TAB_NAMES = {
  geral: "Geral",
  gestacao_posparto: "Gestação-Pós-parto",
};

const COLUMNS_BY_FLOW = {
  geral: GERAL_COLUMNS,
  gestacao_posparto: GESTACAO_COLUMNS,
};

/** "geral" | "gestacao_posparto" — which tab a submission belongs in. */
export function flowFor(answers) {
  return selectedGestacaoPosparto(answers) ? "gestacao_posparto" : "geral";
}

/** Ordered column list for a flow. */
export function columnsFor(flow) {
  return COLUMNS_BY_FLOW[flow];
}

/** Sheet tab name for a flow. */
export function tabFor(flow) {
  return TAB_NAMES[flow];
}

/** Render one answer value as a spreadsheet cell string. */
export function serializeCell(value) {
  if (value == null) return "";
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "boolean") return value ? "Sim" : "Não";
  return String(value);
}

/** Ordered row of cell strings for a flow, aligned with columnsFor(flow). */
export function rowFor(flow, answers) {
  return columnsFor(flow).map((col) => serializeCell(answers[col]));
}
