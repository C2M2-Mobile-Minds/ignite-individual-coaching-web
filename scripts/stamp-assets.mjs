// Deploy-time asset stamping. Appends `?v=<hash>` to the static asset URLs the
// browser caches (the CSS link, the JS module entry point, and every relative
// import in the module graph) so every deploy is self-invalidating.
//
// Rewrites the checked-out working copy in place — run in CI just before the
// Netlify deploy, never committed. Idempotent: an existing `?v=...` is replaced.
//
// Safe by design: a file or pattern that does not match is warned about and
// skipped, never fatal. Worst case an asset ships unstamped (stale-cache, self-
// heals next deploy) — it can never ship with the SAME module imported under two
// different specifiers, which would fork it into two module instances.

import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function hash() {
  try {
    return execSync("git rev-parse --short HEAD", { cwd: root }).toString().trim();
  } catch {
    return String(Date.now());
  }
}

const V = hash();
let totalStamped = 0;

// Append (or replace) `?v=<hash>` on a relative asset specifier.
function stamp(spec) {
  return `${spec.replace(/\?v=[^"'\s]*/, "")}?v=${V}`;
}

// Stamp `index.html` — the CSS link and the module entry point. A missing
// pattern warns and is skipped rather than throwing.
function patchIndexHtml() {
  const rel = "index.html";
  const file = join(root, rel);
  let src = readFileSync(file, "utf8");
  const patterns = [
    [/href="(css\/main\.css(?:\?v=[^"]*)?)"/, (_m, p) => `href="${stamp(p)}"`],
    [/from "(\.\/js\/formEngine\.js(?:\?v=[^"]*)?)"/, (_m, p) => `from "${stamp(p)}"`],
  ];
  let count = 0;
  for (const [find, build] of patterns) {
    if (!find.test(src)) {
      console.warn(`stamp-assets: pattern not found in ${rel}: ${find}`);
      continue;
    }
    src = src.replace(find, build);
    count += 1;
  }
  if (count) writeFileSync(file, src);
  totalStamped += count;
  console.log(`stamped ${rel}: ${count} ref(s) @ ${V}`);
}

// Stamp every relative local module import in every js/*.js file. Generic —
// picks up new files and new imports automatically, so the same module is never
// imported under both a stamped and an unstamped specifier.
function patchJsModules() {
  const jsDir = join(root, "js");
  const importRe = /from "(\.\/[\w-]+\.js)(?:\?v=[^"]*)?"/g;
  const dynImportRe = /import\("(\.\/[\w-]+\.js)(?:\?v=[^"]*)?"\)/g;

  for (const name of readdirSync(jsDir)) {
    if (!name.endsWith(".js")) continue;
    const rel = `js/${name}`;
    const file = join(jsDir, name);
    const src = readFileSync(file, "utf8");
    let count = 0;
    const next = src
      .replace(importRe, (_m, p) => (count++, `from "${stamp(p)}"`))
      .replace(dynImportRe, (_m, p) => (count++, `import("${stamp(p)}")`));
    if (!count) {
      console.warn(`stamp-assets: no relative imports in ${rel} — left unstamped`);
      continue;
    }
    writeFileSync(file, next);
    totalStamped += count;
    console.log(`stamped ${rel}: ${count} import(s) @ ${V}`);
  }
}

patchIndexHtml();
patchJsModules();

console.log(`stamp-assets: ${totalStamped} ref(s) stamped @ ${V}`);
if (totalStamped === 0) console.warn("stamp-assets: nothing was stamped — check patterns");
