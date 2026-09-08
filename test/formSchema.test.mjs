import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { steps, visibleSteps, visibleFields, selectedGestacaoPosparto } from "../js/formSchema.js";

const locale = JSON.parse(
  readFileSync(fileURLToPath(new URL("../locales/pt-PT.json", import.meta.url)), "utf8"),
);

const stepById = Object.fromEntries(steps.map((s) => [s.id, s]));
const visibleStepIds = (answers) => visibleSteps(answers).map((s) => s.id);

test("step order and ids match the schema contract", () => {
  assert.deepEqual(
    steps.map((s) => s.id),
    ["dados_basicos", "treino_geral", "fase_gestacao", "gestacao", "posparto"],
  );
});

test("general-training branch: no gestacao_posparto goal", () => {
  const answers = { objetivo_treino: ["ganho_massa", "recomposicao"] };
  assert.equal(selectedGestacaoPosparto(answers), false);
  assert.deepEqual(visibleStepIds(answers), ["dados_basicos", "treino_geral"]);
});

test("treino_geral step exposes the issue #7 field ids in order", () => {
  const answers = { objetivo_treino: ["ganho_massa"] };
  assert.deepEqual(
    visibleFields(stepById.treino_geral, answers).map((f) => f.id),
    ["onde_treina", "dificuldade_atual", "frequencia_treino", "orientacao_nutricional", "comprometimento"],
  );
});

test("every treino_geral labelKey (field + option) resolves in pt-PT.json", () => {
  for (const field of stepById.treino_geral.fields) {
    assert.ok(locale[field.labelKey], `missing locale key ${field.labelKey}`);
    for (const opt of field.options ?? []) {
      assert.ok(locale[opt.labelKey], `missing locale key ${opt.labelKey}`);
    }
  }
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
  assert.ok(!fieldIds({ como_chegou: ["redes_sociais"] }).includes("como_chegou_outro"));
  assert.ok(fieldIds({ como_chegou: ["redes_sociais", "outro"] }).includes("como_chegou_outro"));
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
