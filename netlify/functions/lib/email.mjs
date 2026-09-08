// Notification email for the company, one per submission.
//
// Best-effort: submit.mjs calls this after the Sheets write and only logs on
// failure — a broken email never fails a submission (README: Sheets is the
// source of truth). Provider is Resend (POST https://api.resend.com/emails,
// Bearer EMAIL_API_KEY). Env:
//   EMAIL_API_KEY      Resend API key
//   COMPANY_EMAIL_TO   recipient inbox
//   EMAIL_FROM         verified sender address

import { notePairs } from "./labels.mjs";

const RESEND_ENDPOINT = "https://api.resend.com/emails";

const FLOW_TITLES = {
  geral: "Geral",
  gestacao_posparto: "Gestação/Pós-parto",
};

/** Build the default deps from environment — overridable in tests. */
export function defaultDeps() {
  return {
    apiKey: process.env.EMAIL_API_KEY,
    to: process.env.COMPANY_EMAIL_TO,
    from: process.env.EMAIL_FROM,
    fetchImpl: fetch,
  };
}

function emailError(message) {
  const err = new Error(message);
  err.stage = "email";
  return err;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Render the notification email for a submission.
 * @param {{ flow: string, answers: object }} args
 * @returns {{ subject: string, html: string, text: string }}
 */
export function renderEmail({ flow, answers }) {
  const title = FLOW_TITLES[flow] || flow;
  const subject = `Nova inscrição — ${title}`;
  const pairs = notePairs(flow, answers);
  const submittedAt = answers.submitted_at || "";

  const rows = pairs
    .map(
      (p) =>
        `<tr><td style="padding:4px 12px 4px 0;vertical-align:top;color:#555">${escapeHtml(
          p.label,
        )}</td><td style="padding:4px 0;vertical-align:top">${escapeHtml(p.value)}</td></tr>`,
    )
    .join("");

  const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#222">
<h2 style="margin:0 0 4px">Nova inscrição — ${escapeHtml(title)}</h2>
<p style="margin:0 0 16px;color:#777">Recebida em ${escapeHtml(submittedAt)}</p>
<table style="border-collapse:collapse">${rows}</table>
</div>`;

  const textLines = [
    `Nova inscrição — ${title}`,
    `Recebida em ${submittedAt}`,
    "",
    ...pairs.map((p) => `${p.label}: ${p.value}`),
  ];

  return { subject, html, text: textLines.join("\n") };
}

/**
 * Send the notification email. Resolves without sending when EMAIL_API_KEY /
 * COMPANY_EMAIL_TO / EMAIL_FROM are not all set. Throws an `email`-stage error
 * on a non-2xx provider response.
 * @param {{ flow: string, answers: object }} args
 * @param {object} [deps] - { apiKey, to, from, fetchImpl }
 */
export async function sendNotification({ flow, answers }, deps = defaultDeps()) {
  const { apiKey, to, from, fetchImpl } = deps;
  if (!apiKey || !to || !from) {
    console.warn("[email] not configured, skipping notification");
    return;
  }

  const { subject, html, text } = renderEmail({ flow, answers });

  const res = await fetchImpl(RESEND_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to, subject, html, text }),
  });

  if (!res.ok) {
    const detail = res.text ? await res.text().catch(() => "") : "";
    throw emailError(`Resend API ${res.status} ${detail}`.trim());
  }
}
