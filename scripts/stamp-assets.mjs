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

// --- Pure helpers (no I/O — unit-tested in test/stamp-assets.test.mjs) --------

// Append (or replace) `?v=<v>` on a relative asset specifier.
export function stamp(spec, v) {
  return `${spec.replace(/\?v=[^"'\s]*/, "")}?v=${v}`;
}

// Stamp the CSS link + module entry point in index.html source.
// Returns `{ text, count }`; an absent pattern is left as-is (not counted).
export function stampIndexHtml(src, v) {
  let count = 0;
  const text = src
    .replace(/href="(css\/main\.css(?:\?v=[^"]*)?)"/, (_m, p) => (count++, `href="${stamp(p, v)}"`))
    .replace(
      /from "(\.\/js\/formEngine\.js(?:\?v=[^"]*)?)"/,
      (_m, p) => (count++, `from "${stamp(p, v)}"`),
    );
  return { text, count };
}

// Stamp every relative local module import (static + dynamic) in a JS source.
// Generic: picks up new files and new imports automatically, so the same module
// is never imported under both a stamped and an unstamped specifier.
// Returns `{ text, count }`.
export function stampJsModule(src, v) {
  let count = 0;
  const text = src
    .replace(
      /from "(\.\/[\w-]+\.js)(?:\?v=[^"]*)?"/g,
      (_m, p) => (count++, `from "${stamp(p, v)}"`),
    )
    .replace(
      /import\("(\.\/[\w-]+\.js)(?:\?v=[^"]*)?"\)/g,
      (_m, p) => (count++, `import("${stamp(p, v)}")`),
    );
  return { text, count };
}

// --- CLI (in-place rewrite of the working copy) ------------------------------

function hash(root) {
  try {
    return execSync("git rev-parse --short HEAD", { cwd: root }).toString().trim();
  } catch {
    return String(Date.now());
  }
}

function main() {
  const root = join(dirname(fileURLToPath(import.meta.url)), "..");
  const v = hash(root);
  let total = 0;

  const indexPath = join(root, "index.html");
  const { text: html, count: htmlCount } = stampIndexHtml(readFileSync(indexPath, "utf8"), v);
  if (htmlCount) writeFileSync(indexPath, html);
  else console.warn("stamp-assets: no known refs found in index.html");
  total += htmlCount;
  console.log(`stamped index.html: ${htmlCount} ref(s) @ ${v}`);

  const jsDir = join(root, "js");
  for (const name of readdirSync(jsDir)) {
    if (!name.endsWith(".js")) continue;
    const file = join(jsDir, name);
    const { text, count } = stampJsModule(readFileSync(file, "utf8"), v);
    if (!count) {
      console.warn(`stamp-assets: no relative imports in js/${name} — left unstamped`);
      continue;
    }
    writeFileSync(file, text);
    total += count;
    console.log(`stamped js/${name}: ${count} import(s) @ ${v}`);
  }

  console.log(`stamp-assets: ${total} ref(s) stamped @ ${v}`);
  if (total === 0) console.warn("stamp-assets: nothing was stamped — check patterns");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
