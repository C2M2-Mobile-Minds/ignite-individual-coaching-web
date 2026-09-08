# Deployment runbook — Netlify production

Production is served from Netlify. Deploys are driven by GitHub Actions
(`.github/workflows/deploy.yml`), not by Netlify's own Git integration.

- **Production URL:** <https://ignite-coaching.netlify.app>
- **Deploy trigger:** push to `main` → Actions runs `npm test` then
  `netlify-cli deploy --prod`.
- **Rollback:** Netlify → Deploys → pick a previous successful deploy →
  **Publish deploy**. No code change or revert needed for an emergency rollback.

## One-time setup

### 1. Create the Netlify site

1. Netlify → **Add new site → Import an existing project** is *not* used here
   (we deploy from CI). Instead: **Add new site → Deploy manually**, drag the
   repo folder once to create the site, or create an empty site via
   `netlify sites:create`.
2. Netlify → Site → **Site configuration → Build & deploy → Continuous
   deployment**: if a Git connection was created, set **Build settings →
   Stop builds** (or disconnect the repo) so Actions is the only deploy path.
   Two deploy paths race and publish inconsistent builds.
3. Note the **Site ID** (Site configuration → General → Site details → Site ID)
   and the site's default name (`<name>.netlify.app`).

### 2. GitHub repo secrets

Repo → Settings → Secrets and variables → Actions:

| Secret | Where to get it |
| --- | --- |
| `NETLIFY_AUTH_TOKEN` | Netlify → User settings → Applications → **New access token** (personal access token) |
| `NETLIFY_SITE_ID` | Site ID from step 1.3 |

### 3. Production environment variables

Netlify → Site configuration → **Environment variables**. Set every key from
`.env.example`, scoped to **Production** (and Deploy Previews if previews should
also submit for real):

| Key | Notes |
| --- | --- |
| `GOOGLE_SHEETS_CLIENT_EMAIL` | Service-account email |
| `GOOGLE_SHEETS_PRIVATE_KEY` | Paste the full key **with literal `\n`** — `lib/sheets.mjs` un-escapes them |
| `GOOGLE_SHEETS_SPREADSHEET_ID` | From the sheet URL |
| `EMAIL_API_KEY` | Resend API key |
| `COMPANY_EMAIL_TO` | Recipient of the notification email |
| `EMAIL_FROM` | Must be a verified Resend sender/domain |

The service account (`GOOGLE_SHEETS_CLIENT_EMAIL`) must have **Editor** access to
the spreadsheet. The Resend domain for `EMAIL_FROM` must be verified or every
send returns a non-2xx (submission still succeeds — email is best-effort).

`NODE_VERSION` is pinned to `22` in `netlify.toml`; no need to set it in the
dashboard.

### 4. HTTPS

Netlify provisions a Let's Encrypt certificate automatically for
`*.netlify.app`. Verify: Site configuration → **Domain management → HTTPS**
shows *Your site has HTTPS enabled*. Enable **Force HTTPS redirect**.

### 5. Custom domain (deferred)

Launching on the default `*.netlify.app` subdomain. When a domain is chosen:
Domain management → **Add a domain** → follow the DNS records Netlify shows
(either delegate the domain to Netlify DNS, or add the `CNAME`/`A`/`ALIAS`
records at the current registrar), then wait for the certificate to reissue.

## Post-deploy verification

Run after the first production deploy and after any change touching
`netlify/functions/` or the env vars.

1. **Site loads:** open the production URL, form renders, no console errors.
2. **HTTPS:** padlock present, `http://` redirects to `https://`.
3. **Function reachable:**
   ```
   curl -i https://ignite-coaching.netlify.app/.netlify/functions/submit
   ```
   Expect **405** `method_not_allowed` (GET is rejected) — confirms the function
   is deployed, not a 404.
4. **Real end-to-end submission:** complete the form in a browser (a `geral`
   flow is enough) with `nome` starting `QA TEST`. Expect the success screen.
5. **Sheets:** the `Geral` tab has a new row; header row equals
   `columnsFor("geral")`; values in column order.
6. **Email:** the `COMPANY_EMAIL_TO` inbox has the notification.
7. **No secret leakage:** `view-source` on the page and every file under
   `js/` — no keys. The frontend is unbundled vanilla JS; secrets only ever
   exist in the function's runtime env.
8. Delete the `QA TEST` row from the sheet unless keeping it as a marker.

## Acceptance criteria (issue #18)

Verified 2026-09-08:

- [x] Production URL is live and publicly reachable —
  <https://ignite-coaching.netlify.app> returns 200; `http://` → 301 → HTTPS;
  HSTS header present; `GET /.netlify/functions/submit` → 405 (function
  deployed).
- [x] A real end-to-end submission on production writes to Sheets and sends an
  email — `POST /.netlify/functions/submit` with a `QA TEST Deploy 18` geral
  payload → `200 {"ok":true,"flow":"geral"}`. Confirmed: the row landed in the
  `Geral` tab in `columnsFor("geral")` order, and the notification email
  reached `COMPANY_EMAIL_TO` with the pt-PT question labels resolved.
- [x] Environment variables are not exposed in any client-side bundle or public
  repo — `/`, `index.html`, and every file under `js/` served from production
  contain no key/secret markers; frontend is unbundled vanilla JS, secrets only
  in the function runtime env; `.env` is gitignored.
