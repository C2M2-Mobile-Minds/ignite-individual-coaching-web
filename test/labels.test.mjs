import test from "node:test";
import assert from "node:assert/strict";

import { resolveField, resolveValue, notePairs } from "../netlify/functions/lib/labels.mjs";
import { columnsFor, TIMESTAMP_COLUMN } from "../netlify/functions/lib/columns.mjs";

test("resolveField: returns the pt-PT label for a field id", () => {
  assert.equal(resolveField("onde_treina"), "Onde treinas?");
});

test("resolveField: falls back to the id for an unknown field", () => {
  assert.equal(resolveField("nao_existe"), "nao_existe");
});

test("resolveValue: maps a single option id to its label", () => {
  assert.equal(resolveValue("onde_treina", "ginasio"), "Ginásio");
});

test("resolveValue: maps a multi-select array to a joined label list", () => {
  assert.equal(
    resolveValue("objetivo_treino", ["ganho_massa", "saude_longevidade"]),
    "Aumento de Massa Muscular, Bem-estar - Saúde - Longevidade",
  );
});

test("resolveValue: resolves shared sim/nao option keys", () => {
  assert.equal(resolveValue("orientacao_nutricional", "sim"), "Sim");
  assert.equal(resolveValue("fisio_pelvica", "nao"), "Não");
});

test("resolveValue: renders booleans as Sim/Não", () => {
  assert.equal(resolveValue("whatever", true), "Sim");
  assert.equal(resolveValue("whatever", false), "Não");
});

test("resolveValue: passes free-text answers through unchanged", () => {
  assert.equal(
    resolveValue("historial_risco", "Sem historial de risco"),
    "Sem historial de risco",
  );
});

test("resolveValue: resolves the fase splitter value", () => {
  assert.equal(resolveValue("fase", "posparto"), "Pós-parto");
});

test("notePairs: geral flow yields label/value pairs for filled fields only, in column order", () => {
  const answers = {
    nome: "Ana",
    contacto_telefonico: "+351 912345678",
    email: "ana@example.com",
    como_chegou: ["redes_sociais"],
    objetivo_treino: ["ganho_massa"],
    onde_treina: "casa",
    dificuldade_atual: "Falta de tempo",
    frequencia_treino: "2_3x",
    orientacao_nutricional: "nao",
    comprometimento: "sim",
    [TIMESTAMP_COLUMN]: "2026-09-08T10:00:00.000Z",
  };

  const pairs = notePairs("geral", answers);

  // submitted_at is rendered separately, never a pair
  assert.ok(!pairs.some((p) => p.label === TIMESTAMP_COLUMN));
  // empty conditional field is skipped
  assert.ok(!pairs.some((p) => p.label === resolveField("como_chegou_outro")));

  assert.deepEqual(pairs, [
    { label: "Nome", value: "Ana" },
    { label: "Contacto telefónico", value: "+351 912345678" },
    { label: "E-mail", value: "ana@example.com" },
    { label: "Como chegou até à Ignite?", value: "Redes sociais" },
    { label: "Qual o seu objetivo de treino?", value: "Aumento de Massa Muscular" },
    { label: "Onde treinas?", value: "Casa" },
    { label: "Qual a maior dificuldade neste momento?", value: "Falta de tempo" },
    { label: "Qual a tua rotina de treinos ideal?", value: "2-3x/semana" },
    {
      label: "Segues alguma orientação alimentar por parte de um nutricionista?",
      value: "Não",
    },
    {
      label:
        "Estás confiante e comprometido(a) a investir em ti neste acompanhamento on-line?",
      value: "Sim",
    },
  ]);
});

test("notePairs: gestacao_posparto flow only references that branch's columns", () => {
  const answers = {
    nome: "Rita",
    contacto_telefonico: "+351 900000000",
    email: "rita@example.com",
    como_chegou: ["redes_sociais"],
    objetivo_treino: ["gestacao_posparto"],
    fase: "gestacao",
    fisio_pelvica: "sim",
    semanas_gravidez: "22",
    historial_risco: "Não",
    preferencia_local: "crossfit_4475",
    disponibilidade_horario: "Manhãs",
  };

  const pairs = notePairs("gestacao_posparto", answers);
  const labels = pairs.map((p) => p.label);

  assert.ok(labels.includes("Em que fase te encontras"));
  assert.ok(labels.includes("De quantas semanas está?"));
  // no general-branch-only field leaks in
  assert.ok(!labels.includes("Onde treinas?"));
  assert.equal(
    pairs.find((p) => p.label === "Em que fase te encontras").value,
    "Gestação",
  );
});

test("notePairs: pair count never exceeds the flow's non-timestamp column count", () => {
  const full = {};
  for (const col of columnsFor("gestacao_posparto")) full[col] = "x";
  const pairs = notePairs("gestacao_posparto", full);
  assert.equal(pairs.length, columnsFor("gestacao_posparto").length - 1);
});
