// Deploy-time asset stamping. Appends `?v=<hash>` to the static asset URLs the
// browser caches (the CSS link, the JS module entry point, and the relative
// imports in the module graph) so every deploy is self-invalidating.
//
// Rewrites the checked-out working copy in place — run in CI just before the
// Netlify deploy, never committed. Idempotent: an existing `?v=...` is replaced.

import { readFileSync, writeFileSync } from "node:fs";
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

// Append (or replace) `?v=<hash>` on a relative asset specifier.
function stamp(spec) {
  return `${spec.replace(/\?v=[^"'\s]*/, "")}?v=${V}`;
}

function patch(relPath, replacers) {
  const file = join(root, relPath);
  let src = readFileSync(file, "utf8");
  for (const [find, build] of replacers) {
    if (!find.test(src)) throw new Error(`stamp-assets: pattern not found in ${relPath}: ${find}`);
    src = src.replace(find, build);
  }
  writeFileSync(file, src);
  console.log(`stamped ${relPath} @ ${V}`);
}

patch("index.html", [
  [/href="(css\/main\.css(?:\?v=[^"]*)?)"/, (_m, p) => `href="${stamp(p)}"`],
  [/from "(\.\/js\/formEngine\.js(?:\?v=[^"]*)?)"/, (_m, p) => `from "${stamp(p)}"`],
]);

patch("js/formEngine.js", [
  [/from "(\.\/(?:i18n|formSchema|countries|submit)\.js(?:\?v=[^"]*)?)"/g, (_m, p) => `from "${stamp(p)}"`],
]);
