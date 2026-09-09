import test from "node:test";
import assert from "node:assert/strict";

import { createHandler } from "../netlify/functions/submit.mjs";

const validAnswers = {
  nome: "Ana",
  email: "ana@example.com",
  contacto_telefonico: "+351 912345678",
  objetivo_treino: ["ganho_massa"],
  onde_treina: "casa",
};

function makeHandler() {
  const appended = [];
  const emails = [];
  const handler = createHandler({
    appendRow: async (args) => {
      appended.push(args);
    },
    sendNotification: async (args) => {
      emails.push(args);
    },
  });
  return { handler, appended, emails };
}

const post = (body) => ({ httpMethod: "POST", body: JSON.stringify(body) });

test("rejects non-POST with 405", async () => {
  const { handler } = makeHandler();
  const res = await handler({ httpMethod: "GET" });
  assert.equal(res.statusCode, 405);
});

test("rejects malformed JSON with 400 bad_request", async () => {
  const { handler } = makeHandler();
  const res = await handler({ httpMethod: "POST", body: "{not json" });
  assert.equal(res.statusCode, 400);
  assert.equal(JSON.parse(res.body).error, "bad_request");
});

test("rejects missing required identity fields with 400 validation", async () => {
  const { handler } = makeHandler();
  const res = await handler(post({ nome: "Ana" }));
  assert.equal(res.statusCode, 400);
  const body = JSON.parse(res.body);
  assert.equal(body.error, "validation");
  assert.deepEqual(body.fields.sort(), ["contacto_telefonico", "email"]);
});

test("writes a geral row and returns 200 with the derived flow", async () => {
  const { handler, appended } = makeHandler();
  const res = await handler(post(validAnswers));
  assert.equal(res.statusCode, 200);
  const body = JSON.parse(res.body);
  assert.equal(body.ok, true);
  assert.equal(body.flow, "geral");

  assert.equal(appended.length, 1);
  assert.equal(appended[0].tab, "Geral");
  assert.equal(appended[0].headers[0], "submitted_at");
  // submitted_at cell is a fresh ISO timestamp
  assert.match(appended[0].row[0], /^\d{4}-\d{2}-\d{2}T/);
  assert.equal(appended[0].row[1], "Ana");
});

test("routes gestacao_posparto submissions to the other tab", async () => {
  const { handler, appended } = makeHandler();
  const res = await handler(
    post({ ...validAnswers, objetivo_treino: ["gestacao_posparto"], fase: "posparto" }),
  );
  assert.equal(res.statusCode, 200);
  assert.equal(JSON.parse(res.body).flow, "gestacao_posparto");
  assert.equal(appended[0].tab, "Gestação-Pós-parto");
});

test("a fase=gestacao submission fills the row cell-for-cell, pós-parto cells blank", async () => {
  const { handler, appended } = makeHandler();
  const answers = {
    nome: "Bea",
    email: "bea@example.com",
    contacto_telefonico: "+351 912000111",
    como_chegou: ["fisioterapia"],
    objetivo_treino: ["gestacao_posparto"],
    fase: "gestacao",
    fisio_pelvica: "sim",
    semanas_gravidez: "24",
    historial_risco: "Nenhum",
    preferencia_local: "crossfit_4475",
    disponibilidade_horario: "Manhãs",
  };
  const res = await handler(post(answers));
  assert.equal(res.statusCode, 200);
  assert.equal(JSON.parse(res.body).flow, "gestacao_posparto");

  const { headers, row } = appended[0];
  const cell = (name) => row[headers.indexOf(name)];
  assert.equal(headers[0], "submitted_at");
  assert.match(cell("submitted_at"), /^\d{4}-\d{2}-\d{2}T/);
  assert.equal(cell("nome"), "Bea");
  assert.equal(cell("como_chegou"), "fisioterapia");
  assert.equal(cell("objetivo_treino"), "gestacao_posparto");
  assert.equal(cell("fase"), "gestacao");
  // radios are stored as raw option ids in the sheet (label resolution happens
  // only in the notification email, see lib/labels.mjs)
  assert.equal(cell("fisio_pelvica"), "sim");
  assert.equal(cell("semanas_gravidez"), "24");
  assert.equal(cell("historial_risco"), "Nenhum");
  assert.equal(cell("preferencia_local"), "crossfit_4475");
  assert.equal(cell("disponibilidade_horario"), "Manhãs");
  // pós-parto-only columns present but empty for a gestação submission
  for (const empty of [
    "tipo_parto",
    "complicacoes_parto",
    "acomp_exercicio_gravidez",
    "acomp_fisio_gravidez",
    "tempo_posparto",
    "primeira_consulta_posparto",
  ]) {
    assert.equal(cell(empty), "", `${empty} should be blank`);
  }
  assert.equal(row.length, headers.length);
});

test("a submission still succeeds when no sendNotification dep is wired", async () => {
  const appended = [];
  const handler = createHandler({
    appendRow: async (args) => {
      appended.push(args);
    },
    // sendNotification omitted — defaults to a no-op
  });
  const res = await handler(post(validAnswers));
  assert.equal(res.statusCode, 200);
  assert.equal(JSON.parse(res.body).ok, true);
  assert.equal(appended.length, 1);
});

test("sends one notification email after a successful write", async () => {
  const { handler, emails } = makeHandler();
  await handler(post(validAnswers));
  assert.equal(emails.length, 1);
  assert.equal(emails[0].flow, "geral");
  // the enriched answers (with submitted_at) are handed to the email
  assert.equal(emails[0].answers.nome, "Ana");
  assert.match(emails[0].answers.submitted_at, /^\d{4}-\d{2}-\d{2}T/);
});

test("a failing notification email does not break a successful submission", async () => {
  const appended = [];
  const handler = createHandler({
    appendRow: async (args) => {
      appended.push(args);
    },
    sendNotification: async () => {
      throw new Error("resend down");
    },
  });
  const res = await handler(post(validAnswers));
  assert.equal(res.statusCode, 200);
  assert.equal(JSON.parse(res.body).ok, true);
  assert.equal(appended.length, 1);
});

test("does not send an email when the Sheets write fails", async () => {
  const emails = [];
  const handler = createHandler({
    appendRow: async () => {
      const err = new Error("Sheets API POST 500");
      err.stage = "sheets";
      throw err;
    },
    sendNotification: async (args) => {
      emails.push(args);
    },
  });
  const res = await handler(post(validAnswers));
  assert.equal(res.statusCode, 502);
  assert.equal(emails.length, 0);
});

test("returns 502 sheets_write_failed when the Sheets write throws", async () => {
  const handler = createHandler({
    appendRow: async () => {
      const err = new Error("Sheets API POST 500");
      err.stage = "sheets";
      throw err;
    },
  });
  const res = await handler(post(validAnswers));
  assert.equal(res.statusCode, 502);
  assert.equal(JSON.parse(res.body).error, "sheets_write_failed");
});

test("returns 500 internal on an unexpected error", async () => {
  const handler = createHandler({
    appendRow: async () => {
      throw new Error("kaboom");
    },
  });
  const res = await handler(post(validAnswers));
  assert.equal(res.statusCode, 500);
  assert.equal(JSON.parse(res.body).error, "internal");
});
