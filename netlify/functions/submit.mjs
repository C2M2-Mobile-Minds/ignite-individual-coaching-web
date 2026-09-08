// POST /.netlify/functions/submit
//
// Writes one row per form submission into the Google Sheet, choosing the tab
// from the branch the user completed. The Sheets write is the blocking step:
// if it fails the client gets a non-200 and shows the retry screen.
// (Notification email is a separate issue and does not gate this response.)

import { appendRow as realAppendRow } from "./lib/sheets.mjs";
import { sendNotification as realSendNotification } from "./lib/email.mjs";
import { flowFor, columnsFor, tabFor, rowFor, TIMESTAMP_COLUMN } from "./lib/columns.mjs";

const REQUIRED_IDENTITY_FIELDS = ["nome", "email", "contacto_telefonico"];

const json = (statusCode, payload) => ({
  statusCode,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(payload),
});

export function createHandler({ appendRow, sendNotification = async () => {} }) {
  return async function handler(event) {
    if (event.httpMethod !== "POST") {
      return json(405, { ok: false, error: "method_not_allowed" });
    }

    let answers;
    try {
      answers = JSON.parse(event.body || "");
    } catch {
      return json(400, { ok: false, error: "bad_request" });
    }
    if (!answers || typeof answers !== "object") {
      return json(400, { ok: false, error: "bad_request" });
    }

    const missing = REQUIRED_IDENTITY_FIELDS.filter(
      (id) => typeof answers[id] !== "string" || answers[id].trim() === "",
    );
    if (missing.length > 0) {
      return json(400, { ok: false, error: "validation", fields: missing });
    }

    const flow = flowFor(answers);
    const enriched = { ...answers, [TIMESTAMP_COLUMN]: new Date().toISOString() };

    try {
      await appendRow({
        tab: tabFor(flow),
        headers: columnsFor(flow),
        row: rowFor(flow, enriched),
      });
    } catch (err) {
      if (err && err.stage === "sheets") {
        console.error("[submit] sheets write failed", err.message);
        return json(502, { ok: false, error: "sheets_write_failed" });
      }
      console.error("[submit] unexpected error", err);
      return json(500, { ok: false, error: "internal" });
    }

    // Best-effort notification — never gates the response (Sheets is the
    // source of truth; a broken email must not fail a submission).
    try {
      await sendNotification({ flow, answers: enriched });
    } catch (err) {
      console.error("[submit] notification email failed", err && err.message);
    }

    return json(200, { ok: true, flow });
  };
}

export const handler = createHandler({
  appendRow: realAppendRow,
  sendNotification: realSendNotification,
});
