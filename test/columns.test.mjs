import test from "node:test";
import assert from "node:assert/strict";

import {
  flowFor,
  serializeCell,
  columnsFor,
  tabFor,
  rowFor,
} from "../netlify/functions/lib/columns.mjs";

// --- flowFor --------------------------------------------------------------

test("flowFor: geral when objetivo_treino lacks gestacao_posparto", () => {
  assert.equal(flowFor({ objetivo_treino: ["ganho_massa", "recomposicao"] }), "geral");
});

test("flowFor: geral when objetivo_treino missing entirely", () => {
  assert.equal(flowFor({}), "geral");
});

test("flowFor: gestacao_posparto when goal picked, regardless of fase", () => {
  assert.equal(flowFor({ objetivo_treino: ["gestacao_posparto"] }), "gestacao_posparto");
  assert.equal(
    flowFor({ objetivo_treino: ["ganho_massa", "gestacao_posparto"], fase: "posparto" }),
    "gestacao_posparto",
  );
});

// --- serializeCell ------------------------------------------------------------

test("serializeCell: arrays join with comma-space", () => {
  assert.equal(serializeCell(["redes_sociais", "fisioterapia"]), "redes_sociais, fisioterapia");
});

test("serializeCell: booleans render as Sim/Não", () => {
  assert.equal(serializeCell(true), "Sim");
  assert.equal(serializeCell(false), "Não");
});

test("serializeCell: null/undefined render as empty string", () => {
  assert.equal(serializeCell(undefined), "");
  assert.equal(serializeCell(null), "");
});

test("serializeCell: strings pass through", () => {
  assert.equal(serializeCell("+351 912345678"), "+351 912345678");
});

// --- columns / tabs --------------------------------------------------------

test("columnsFor(geral): submitted_at first, then dados_basicos, then treino_geral ids", () => {
  assert.deepEqual(columnsFor("geral"), [
    "submitted_at",
    "nome",
    "contacto_telefonico",
    "email",
    "como_chegou",
    "como_chegou_outro",
    "objetivo_treino",
    "onde_treina",
    "dificuldade_atual",
    "frequencia_treino",
    "orientacao_nutricional",
    "comprometimento",
  ]);
});

test("columnsFor(gestacao_posparto): base + fase + gestacao + posparto ids, deduped, no note field", () => {
  const cols = columnsFor("gestacao_posparto");
  assert.deepEqual(cols, [
    "submitted_at",
    "nome",
    "contacto_telefonico",
    "email",
    "como_chegou",
    "como_chegou_outro",
    "objetivo_treino",
    "fase",
    "fisio_pelvica",
    "semanas_gravidez",
    "historial_risco",
    "preferencia_local",
    "disponibilidade_horario",
    "tipo_parto",
    "complicacoes_parto",
    "acomp_exercicio_gravidez",
    "acomp_fisio_gravidez",
    "tempo_posparto",
    "primeira_consulta_posparto",
  ]);
  assert.ok(!cols.includes("nota_contacto"));
});

test("tabFor maps flow to sheet tab name", () => {
  assert.equal(tabFor("geral"), "Geral");
  assert.equal(tabFor("gestacao_posparto"), "Gestação-Pós-parto");
});

// --- rowFor ----------------------------------------------------------------

test("rowFor(geral): values in column order, serialized", () => {
  const answers = {
    submitted_at: "2026-09-08T10:00:00.000Z",
    nome: "Ana",
    contacto_telefonico: "+351 912345678",
    email: "ana@example.com",
    como_chegou: ["redes_sociais", "fisioterapia"],
    objetivo_treino: ["ganho_massa"],
    onde_treina: "casa",
    dificuldade_atual: "tempo",
    frequencia_treino: "2_3x",
    orientacao_nutricional: "nao",
    comprometimento: "sim",
  };
  assert.deepEqual(rowFor("geral", answers), [
    "2026-09-08T10:00:00.000Z",
    "Ana",
    "+351 912345678",
    "ana@example.com",
    "redes_sociais, fisioterapia",
    "", // como_chegou_outro absent
    "ganho_massa",
    "casa",
    "tempo",
    "2_3x",
    "nao",
    "sim",
  ]);
});

test("rowFor(geral): stale branch answers left after a branch switch are ignored", () => {
  // User entered the gestação branch, went back, and cleared the goal. `fase`
  // and leaf answers linger in the flat answers object; the geral projection
  // must not carry them.
  const row = rowFor("geral", {
    nome: "Ana",
    fase: "gestacao",
    semanas_gravidez: "20",
    onde_treina: "casa",
  });
  assert.equal(columnsFor("geral").includes("fase"), false);
  assert.equal(row.length, columnsFor("geral").length);
  assert.equal(row[1], "Ana");
  assert.equal(row[columnsFor("geral").indexOf("onde_treina")], "casa");
});

test("rowFor length always matches columnsFor length", () => {
  assert.equal(rowFor("geral", {}).length, columnsFor("geral").length);
  assert.equal(
    rowFor("gestacao_posparto", {}).length,
    columnsFor("gestacao_posparto").length,
  );
});
