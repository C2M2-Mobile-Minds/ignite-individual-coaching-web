import test from "node:test";
import assert from "node:assert/strict";

import { createHandler } from "../netlify/functions/submit.mjs";

const validAnswers = {
  nome: "Ana",
  email: "ana@example.com",
  contacto_telefonico: "+351 912345678",
  objetivo_treino: ["perda_peso"],
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
