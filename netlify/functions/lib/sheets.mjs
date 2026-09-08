// Minimal Google Sheets v4 client: JWT auth + append a row to a tab.
//
// Only what issue #14 needs — no batching, no read-back beyond the header
// probe. The service-account credentials come from env:
//   GOOGLE_SHEETS_CLIENT_EMAIL
//   GOOGLE_SHEETS_PRIVATE_KEY      (newlines stored escaped as "\n")
//   GOOGLE_SHEETS_SPREADSHEET_ID

import { JWT } from "google-auth-library";

const SCOPE = "https://www.googleapis.com/auth/spreadsheets";
const API = "https://sheets.googleapis.com/v4/spreadsheets";

/** Build the default deps from environment — overridable in tests. */
export function defaultDeps() {
  const jwt = new JWT({
    email: process.env.GOOGLE_SHEETS_CLIENT_EMAIL,
    key: (process.env.GOOGLE_SHEETS_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
    scopes: [SCOPE],
  });
  return {
    spreadsheetId: process.env.GOOGLE_SHEETS_SPREADSHEET_ID,
    getAccessToken: async () => (await jwt.getAccessToken()).token,
    fetchImpl: fetch,
  };
}

function sheetsError(message) {
  const err = new Error(message);
  err.stage = "sheets";
  return err;
}

async function call(deps, token, url, init = {}) {
  const res = await deps.fetchImpl(url, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init.headers || {}) },
  });
  if (!res.ok) {
    const detail = res.text ? await res.text().catch(() => "") : "";
    throw sheetsError(`Sheets API ${init.method || "GET"} ${res.status} ${detail}`.trim());
  }
  return res.json();
}

/**
 * Append `row` to `tab`, writing `headers` first when the tab has no row 1.
 * @param {{tab: string, headers: string[], row: string[]}} args
 * @param {object} [deps] - { spreadsheetId, getAccessToken, fetchImpl }
 */
export async function appendRow({ tab, headers, row }, deps = defaultDeps()) {
  const { spreadsheetId } = deps;
  if (!spreadsheetId) throw sheetsError("missing GOOGLE_SHEETS_SPREADSHEET_ID");

  const token = await deps.getAccessToken();
  const range = (r) => `${API}/${spreadsheetId}/values/${encodeURIComponent(`${tab}!${r}`)}`;

  const probe = await call(deps, token, `${range("1:1")}`);
  if (!probe.values || probe.values.length === 0) {
    await call(deps, token, `${range("1:1")}?valueInputOption=RAW`, {
      method: "PUT",
      body: JSON.stringify({ values: [headers] }),
    });
  }

  await call(
    deps,
    token,
    `${range("A:A")}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
    { method: "POST", body: JSON.stringify({ values: [row] }) },
  );
}
