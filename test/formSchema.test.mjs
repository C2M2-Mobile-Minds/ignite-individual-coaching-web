import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
  steps,
  visibleSteps,
  visibleFields,
  selectedGestacaoPosparto,
  totalVisibleSteps,
} from "../js/formSchema.js";

const locale = JSON.parse(
  readFileSync(fileURLToPath(new URL("../locales/pt-PT.json", import.meta.url)), "utf8"),
);

const stepById = Object.fromEntries(steps.map((s) => [s.id, s]));
const visibleStepIds = (answers) => visibleSteps(answers).map((s) => s.id);

test("step order and ids match the schema contract", () => {
  assert.deepEqual(
    steps.map((s) => s.id),
    [
      "dados_basicos", "modalidade_treino", "treino_geral_online", "treino_geral_presencial",
      "comprometimento", "fase_gestacao", "gestacao", "posparto",
    ],
  );
});

test("general-training branch: no gestacao_posparto goal", () => {
  const answers = { objetivo_treino: ["ganho_massa", "recomposicao"] };
  assert.equal(selectedGestacaoPosparto(answers), false);
  // modalidade not yet answered => neither sub-branch step shown.
  assert.deepEqual(visibleStepIds(answers), ["dados_basicos", "modalidade_treino", "comprometimento"]);
});

test("modalidade_treino step: online selection shows only the online sub-branch", () => {
  const answers = { objetivo_treino: ["ganho_massa"], modalidade_treino: "online" };
  assert.deepEqual(
    visibleStepIds(answers),
    ["dados_basicos", "modalidade_treino", "treino_geral_online", "comprometimento"],
  );
});

test("modalidade_treino step: presencial selection shows only the presencial sub-branch", () => {
  const answers = { objetivo_treino: ["ganho_massa"], modalidade_treino: "presencial" };
  assert.deepEqual(
    visibleStepIds(answers),
    ["dados_basicos", "modalidade_treino", "treino_geral_presencial", "comprometimento"],
  );
});

test("treino_geral_online step exposes the issue #7 field ids in order", () => {
  const answers = { objetivo_treino: ["ganho_massa"], modalidade_treino: "online" };
  assert.deepEqual(
    visibleFields(stepById.treino_geral_online, answers).map((f) => f.id),
    ["onde_treina", "dificuldade_atual", "frequencia_treino", "orientacao_nutricional"],
  );
});

test("treino_geral_presencial step exposes its field ids in order", () => {
  const answers = { objetivo_treino: ["ganho_massa"], modalidade_treino: "presencial" };
  assert.deepEqual(
    visibleFields(stepById.treino_geral_presencial, answers).map((f) => f.id),
    ["frequencia_presencial", "localizacao_presencial", "disponibilidade_presencial"],
  );
});

test("every modalidade / presencial labelKey resolves in pt-PT.json", () => {
  for (const stepId of ["modalidade_treino", "treino_geral_presencial"]) {
    assert.ok(locale[stepById[stepId].titleKey], `missing step title key for ${stepId}`);
    for (const field of stepById[stepId].fields) {
      assert.ok(locale[field.labelKey ?? field.textKey], `missing locale key for ${field.id}`);
      for (const opt of field.options ?? []) {
        assert.ok(locale[opt.labelKey], `missing locale key ${opt.labelKey}`);
      }
    }
  }
});

test("comprometimento is its own step in the general branch (issue #45)", () => {
  const answers = { objetivo_treino: ["ganho_massa"] };
  assert.deepEqual(
    visibleFields(stepById.comprometimento, answers).map((f) => f.id),
    ["comprometimento"],
  );
  assert.ok(locale[stepById.comprometimento.titleKey], "missing step title key");
  assert.ok(locale[stepById.comprometimento.fields[0].labelKey], "missing field key");
});

test("every treino_geral_online labelKey (field + option) resolves in pt-PT.json", () => {
  for (const field of stepById.treino_geral_online.fields) {
    assert.ok(locale[field.labelKey], `missing locale key ${field.labelKey}`);
    for (const opt of field.options ?? []) {
      assert.ok(locale[opt.labelKey], `missing locale key ${opt.labelKey}`);
    }
  }
});

test("every fase_gestacao labelKey (field + option) resolves in pt-PT.json", () => {
  assert.ok(locale[stepById.fase_gestacao.titleKey], "missing step title key");
  for (const field of stepById.fase_gestacao.fields) {
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

test("gestacao step exposes the issue #9 field ids in order", () => {
  const answers = { objetivo_treino: ["gestacao_posparto"], fase: "gestacao" };
  assert.deepEqual(
    visibleFields(stepById.gestacao, answers).map((f) => f.id),
    ["fisio_pelvica", "semanas_gravidez", "historial_risco", "preferencia_local", "disponibilidade_horario"],
  );
});

test("every gestacao labelKey / textKey (field + option) resolves in pt-PT.json", () => {
  assert.ok(locale[stepById.gestacao.titleKey], "missing step title key");
  for (const field of stepById.gestacao.fields) {
    assert.ok(locale[field.labelKey ?? field.textKey], `missing locale key for ${field.id}`);
    for (const opt of field.options ?? []) {
      assert.ok(locale[opt.labelKey], `missing locale key ${opt.labelKey}`);
    }
  }
});

test("posparto branch: gestacao_posparto goal + fase=posparto", () => {
  const answers = { objetivo_treino: ["gestacao_posparto"], fase: "posparto" };
  assert.deepEqual(visibleStepIds(answers), ["dados_basicos", "fase_gestacao", "posparto"]);
});

test("posparto step exposes the issue #10 field ids in order", () => {
  const answers = { objetivo_treino: ["gestacao_posparto"], fase: "posparto" };
  assert.deepEqual(
    visibleFields(stepById.posparto, answers).map((f) => f.id),
    [
      "tipo_parto", "complicacoes_parto", "acomp_exercicio_gravidez", "acomp_fisio_gravidez",
      "tempo_posparto", "primeira_consulta_posparto", "preferencia_local", "disponibilidade_horario",
    ],
  );
});

test("every posparto labelKey / textKey (field + option) resolves in pt-PT.json", () => {
  assert.ok(locale[stepById.posparto.titleKey], "missing step title key");
  for (const field of stepById.posparto.fields) {
    assert.ok(locale[field.labelKey ?? field.textKey], `missing locale key for ${field.id}`);
    for (const opt of field.options ?? []) {
      assert.ok(locale[opt.labelKey], `missing locale key ${opt.labelKey}`);
    }
  }
});

test("totalVisibleSteps: geral branch is 4 even before modalidade_treino is answered", () => {
  assert.equal(totalVisibleSteps({ objetivo_treino: ["ganho_massa"] }), 4);
  assert.equal(
    totalVisibleSteps({ objetivo_treino: ["ganho_massa"], modalidade_treino: "online" }),
    4,
  );
  assert.equal(
    totalVisibleSteps({ objetivo_treino: ["ganho_massa"], modalidade_treino: "presencial" }),
    4,
  );
});

test("totalVisibleSteps: gestação/pós-parto branch is 3 even before fase is answered", () => {
  assert.equal(totalVisibleSteps({ objetivo_treino: ["gestacao_posparto"] }), 3);
  assert.equal(
    totalVisibleSteps({ objetivo_treino: ["gestacao_posparto"], fase: "gestacao" }),
    3,
  );
  assert.equal(
    totalVisibleSteps({ objetivo_treino: ["gestacao_posparto"], fase: "posparto" }),
    3,
  );
});

test("totalVisibleSteps: empty answers default to the geral branch total of 4", () => {
  assert.equal(totalVisibleSteps({}), 4);
});

test("fase not yet answered: splitter shown, neither leaf shown", () => {
  const answers = { objetivo_treino: ["gestacao_posparto"] };
  assert.deepEqual(visibleStepIds(answers), ["dados_basicos", "fase_gestacao"]);
});

test("empty answers: defaults to the general-training branch", () => {
  // No gestacao_posparto goal selected => general branch is the default path.
  assert.deepEqual(visibleStepIds({}), ["dados_basicos", "modalidade_treino", "comprometimento"]);
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
      assert.ok(["text", "email", "tel", "radio", "checkbox", "note"].includes(field.type));
      if (field.type === "note") {
        assert.ok(field.textKey, `note ${field.id} needs textKey`);
        assert.ok(!field.required, `note ${field.id} must not be required`);
        continue;
      }
      assert.ok(field.labelKey, `field ${field.id} needs labelKey`);
      if (field.options) {
        for (const opt of field.options) {
          assert.ok(opt.id && opt.labelKey, `option in ${field.id} needs id + labelKey`);
        }
      }
    }
  }
});
