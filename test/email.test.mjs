import test from "node:test";
import assert from "node:assert/strict";

import { renderEmail, sendNotification } from "../netlify/functions/lib/email.mjs";

function fakeDeps(responses, overrides = {}) {
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    calls.push({ url: String(url), method: init.method || "GET", headers: init.headers || {}, body: init.body });
    const next = responses.shift() || {};
    return {
      ok: next.ok ?? true,
      status: next.status ?? 200,
      json: async () => next.json ?? {},
      text: async () => next.text ?? "",
    };
  };
  return {
    calls,
    deps: { apiKey: "re_test", to: "company@example.com", from: "no-reply@ignite.pt", context: "production", fetchImpl, ...overrides },
  };
}

const geralAnswers = {
  nome: "Ana Silva",
  contacto_telefonico: "+351 912345678",
  email: "ana@example.com",
  como_chegou: ["redes_sociais"],
  objetivo_treino: ["ganho_massa"],
  onde_treina: "casa",
  dificuldade_atual: "Falta de tempo",
  frequencia_treino: "2_3x",
  orientacao_nutricional: "nao",
  comprometimento: "sim",
  submitted_at: "2026-09-08T10:00:00.000Z",
};

const gestacaoAnswers = {
  nome: "Rita Costa",
  contacto_telefonico: "+351 900000000",
  email: "rita@example.com",
  como_chegou: ["redes_sociais"],
  objetivo_treino: ["gestacao_posparto"],
  fase: "gestacao",
  fisio_pelvica: "sim",
  semanas_gravidez: "22",
  historial_risco: "Nenhum",
  preferencia_local: "crossfit_4475",
  disponibilidade_horario: "Manhãs",
  submitted_at: "2026-09-08T10:00:00.000Z",
};

test("renderEmail: geral template shows only general-branch questions", () => {
  const { subject, html, text } = renderEmail({ flow: "geral", answers: geralAnswers });

  assert.match(subject, /Geral/);
  assert.match(html, /Onde treinas\?/);
  assert.match(html, /Casa/);
  assert.match(text, /Onde treinas\?/);
  // gestação-only field must not appear
  assert.doesNotMatch(html, /De quantas semanas estás/);
});

test("renderEmail: gestacao_posparto template shows that branch's questions and resolved values", () => {
  const { subject, html } = renderEmail({ flow: "gestacao_posparto", answers: gestacaoAnswers });

  assert.match(subject, /Gestação/);
  assert.match(html, /Em que fase te encontras/);
  assert.match(html, /Gestação/);
  assert.match(html, /De quantas semanas estás/);
  assert.doesNotMatch(html, /Onde treinas\?/);
});

test("renderEmail: escapes HTML in free-text answer values", () => {
  const { html } = renderEmail({
    flow: "geral",
    answers: { ...geralAnswers, dificuldade_atual: "<script>alert(1)</script>" },
  });
  assert.doesNotMatch(html, /<script>alert/);
  assert.match(html, /&lt;script&gt;/);
});

test("sendNotification: POSTs the rendered email to the Resend API", async () => {
  const { calls, deps } = fakeDeps([{ json: { id: "abc" } }]);

  await sendNotification({ flow: "geral", answers: geralAnswers }, deps);

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://api.resend.com/emails");
  assert.equal(calls[0].method, "POST");
  assert.equal(calls[0].headers.Authorization, "Bearer re_test");
  const body = JSON.parse(calls[0].body);
  assert.equal(body.from, "no-reply@ignite.pt");
  assert.equal(body.to, "company@example.com");
  assert.match(body.subject, /Geral/);
  assert.match(body.html, /Onde treinas\?/);
  assert.ok(typeof body.text === "string" && body.text.length > 0);
});

test("sendNotification: throws an email-stage error on a non-2xx response", async () => {
  const { deps } = fakeDeps([{ ok: false, status: 422, text: "bad from" }]);

  await assert.rejects(
    sendNotification({ flow: "geral", answers: geralAnswers }, deps),
    (err) => {
      assert.equal(err.stage, "email");
      assert.match(err.message, /422/);
      return true;
    },
  );
});

test("sendNotification: skips silently when not configured", async () => {
  const { calls, deps } = fakeDeps([], { apiKey: "" });

  const result = await sendNotification({ flow: "geral", answers: geralAnswers }, deps);

  assert.equal(result, undefined);
  assert.equal(calls.length, 0);
});

test("sendNotification: skips outside the production context", async () => {
  const { calls, deps } = fakeDeps([], { context: "dev" });

  const result = await sendNotification({ flow: "geral", answers: geralAnswers }, deps);

  assert.equal(result, undefined);
  assert.equal(calls.length, 0);
});

test("sendNotification: EMAIL_FORCE overrides a non-production context", async () => {
  const { calls, deps } = fakeDeps([{ json: { id: "abc" } }], { context: "dev", force: true });

  await sendNotification({ flow: "geral", answers: geralAnswers }, deps);

  assert.equal(calls.length, 1);
});
