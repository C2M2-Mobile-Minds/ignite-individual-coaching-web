// Sends the final answers to the backend.
//
// Phase 1 stub: this resolves (or rejects) locally so the confirmation / error
// screens can be built and tested without the serverless function. The real
// implementation will POST `payload` to `/.netlify/functions/submit` and land
// with the backend issue.
//
// Test / manual hook: set `globalThis.__MOCK_SUBMIT_FAIL = true` to force the
// rejection path.

/**
 * @param {Record<string, unknown>} payload - the flat `answers` object for now.
 * @returns {Promise<{ ok: true }>} resolves on a successful submission.
 */
export async function submitForm(payload) {
  await new Promise((resolve) => setTimeout(resolve, 0));
  if (globalThis.__MOCK_SUBMIT_FAIL) {
    throw new Error("submit failed (mock)");
  }
  return { ok: true };
}
