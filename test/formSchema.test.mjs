import test from "node:test";
import assert from "node:assert/strict";

import { steps, visibleSteps, visibleFields, selectedGestacaoPosparto } from "../js/formSchema.js";

const stepById = Object.fromEntries(steps.map((s) => [s.id, s]));
const visibleStepIds = (answers) => visibleSteps(answers).map((s) => s.id);

test("step order and ids match the schema contract", () => {
  assert.deepEqual(
    steps.map((s) => s.id),
    ["dados_basicos", "treino_geral", "fase_gestacao", "gestacao", "posparto"],
  );
});

test("general-training branch: no gestacao_posparto goal", () => {
  const answers = { objetivo_treino: ["perda_peso", "condicao_fisica"] };
  assert.equal(selectedGestacaoPosparto(answers), false);
  assert.deepEqual(visibleStepIds(answers), ["dados_basicos", "treino_geral"]);
});

test("gestacao branch: gestacao_posparto goal + fase=gestacao", () => {
  const answers = { objetivo_treino: ["gestacao_posparto"], fase: "gestacao" };
  assert.equal(selectedGestacaoPosparto(answers), true);
  assert.deepEqual(visibleStepIds(answers), ["dados_basicos", "fase_gestacao", "gestacao"]);
});

test("posparto branch: gestacao_posparto goal + fase=posparto", () => {
  const answers = { objetivo_treino: ["gestacao_posparto"], fase: "posparto" };
  assert.deepEqual(visibleStepIds(answers), ["dados_basicos", "fase_gestacao", "posparto"]);
});

test("fase not yet answered: splitter shown, neither leaf shown", () => {
  const answers = { objetivo_treino: ["gestacao_posparto"] };
  assert.deepEqual(visibleStepIds(answers), ["dados_basicos", "fase_gestacao"]);
});

test("empty answers: defaults to the general-training branch", () => {
  // No gestacao_posparto goal selected => general branch is the default path.
  assert.deepEqual(visibleStepIds({}), ["dados_basicos", "treino_geral"]);
});

test("field-level condition: como_chegou_outro appears only when 'outro' checked", () => {
  const fieldIds = (answers) => visibleFields(stepById.dados_basicos, answers).map((f) => f.id);
  assert.ok(!fieldIds({ como_chegou: ["instagram"] }).includes("como_chegou_outro"));
  assert.ok(fieldIds({ como_chegou: ["instagram", "outro"] }).includes("como_chegou_outro"));
  assert.ok(!fieldIds({}).includes("como_chegou_outro"));
});

test("every field has a stable id and a labelKey; options have ids", () => {
  for (const step of steps) {
    assert.ok(step.id && step.titleKey, `step ${step.id} needs id + titleKey`);
    for (const field of step.fields) {
      assert.ok(field.id, "field needs id");
      assert.ok(field.labelKey, `field ${field.id} needs labelKey`);
      assert.ok(["text", "email", "tel", "radio", "checkbox"].includes(field.type));
      if (field.options) {
        for (const opt of field.options) {
          assert.ok(opt.id && opt.labelKey, `option in ${field.id} needs id + labelKey`);
        }
      }
    }
  }
});
