// Sends the final answers to the backend.
//
// POSTs the flat `answers` object as JSON to the Netlify function, which
// derives the flow, injects the timestamp, writes the spreadsheet row, and
// returns { ok, flow }. A non-2xx response (e.g. a failed Sheets write -> 502)
// or a network error rejects, so the caller shows the error/retry screen.

const ENDPOINT = "/.netlify/functions/submit";

/**
 * @param {Record<string, unknown>} payload - the flat `answers` object.
 * @returns {Promise<{ ok: true, flow: string }>} resolves on a successful write.
 */
export async function submitForm(payload) {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    let detail = "";
    try {
      detail = (await res.json()).error || "";
    } catch {
      /* body not JSON */
    }
    throw new Error(`submit failed (${res.status}${detail ? ` ${detail}` : ""})`);
  }

  return res.json();
}
