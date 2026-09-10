import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

import { stamp, stampIndexHtml, stampJsModule } from "../scripts/stamp-assets.mjs";

test("stamp: appends ?v= and replaces an existing one", () => {
  assert.equal(stamp("./i18n.js", "abc123"), "./i18n.js?v=abc123");
  assert.equal(stamp("./i18n.js?v=old", "abc123"), "./i18n.js?v=abc123");
});

test("stampJsModule: stamps every relative static import with the same version", () => {
  const src = [
    'import { a } from "./i18n.js";',
    'import { b } from "./landing.js?v=stale";',
    'import { c } from "./theme.js";',
    'import x from "https://cdn.example/x.js";', // external — untouched
  ].join("\n");
  const { text, count } = stampJsModule(src, "v1");
  assert.equal(count, 3);
  assert.match(text, /"\.\/i18n\.js\?v=v1"/);
  assert.match(text, /"\.\/landing\.js\?v=v1"/);
  assert.match(text, /"\.\/theme\.js\?v=v1"/);
  assert.match(text, /"https:\/\/cdn\.example\/x\.js"/);
});

test("stampJsModule: stamps dynamic import() too", () => {
  const { text, count } = stampJsModule('const m = await import("./submit.js");', "v2");
  assert.equal(count, 1);
  assert.match(text, /import\("\.\/submit\.js\?v=v2"\)/);
});

test("stampJsModule: a file with no relative imports is a no-op", () => {
  const src = 'export const DEFAULT_DIAL_CODE = "+351";\n';
  assert.deepEqual(stampJsModule(src, "v3"), { text: src, count: 0 });
});

test("fallback: stampIndexHtml on source missing both patterns is a no-op, no throw", () => {
  const src = "<!doctype html><html><head></head><body>no assets here</body></html>";
  let result;
  assert.doesNotThrow(() => {
    result = stampIndexHtml(src, "v9");
  });
  assert.deepEqual(result, { text: src, count: 0 });
});

test("fallback: stampIndexHtml stamps what it finds and skips what's absent", () => {
  const src = '<link rel="stylesheet" href="css/main.css" />\n<p>no script tag</p>';
  const { text, count } = stampIndexHtml(src, "v10");
  assert.equal(count, 1); // css stamped, missing entry-point import just skipped
  assert.match(text, /href="css\/main\.css\?v=v10"/);
});

test("fallback: stampJsModule never throws on odd input", () => {
  for (const src of ["", "// comment only", "import.meta.url", 'from "not-a-path"']) {
    assert.doesNotThrow(() => stampJsModule(src, "v11"));
    assert.equal(stampJsModule(src, "v11").count, 0);
  }
});

test("stampIndexHtml: stamps the css link and the module entry point", () => {
  const src = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  const { text, count } = stampIndexHtml(src, "deadbee");
  assert.equal(count, 2);
  assert.match(text, /href="css\/main\.css\?v=deadbee"/);
  assert.match(text, /from "\.\/js\/formEngine\.js\?v=deadbee"/);
});

// Regression guard for the prod bug: i18n.js was imported stamped by
// formEngine.js but unstamped by landing.js, forking it into two module
// instances (empty locale on the landing screen). After stamping, every
// relative import across js/*.js must carry the identical ?v=.
test("no split module instances: all js/*.js relative imports share one version", () => {
  const dir = new URL("../js/", import.meta.url);
  const versions = new Set();
  let seen = 0;
  for (const name of readdirSync(dir)) {
    if (!name.endsWith(".js")) continue;
    const { text, count } = stampJsModule(readFileSync(new URL(name, dir), "utf8"), "V");
    seen += count;
    for (const m of text.matchAll(/\.\/[\w-]+\.js\?v=([^"]*)/g)) versions.add(m[1]);
  }
  assert.ok(seen > 0, "expected at least one relative import to stamp");
  assert.deepEqual([...versions], ["V"]);
});
