import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("extension presents the FoundKeep identity while preserving its signed ID", async () => {
  const manifest = JSON.parse(await readFile("apps/extension/manifest.json", "utf8"));
  assert.equal(manifest.name, "FoundKeep — Save what matters");
  assert.equal(manifest.action.default_title, "FoundKeep");
  assert.deepEqual(manifest.externally_connectable.matches, [
    "https://foundkeep.app/*",
    "https://atlas.notpritam.in/*",
  ]);
  assert.ok(Object.values(manifest.commands).every((command) => command.description.includes("FoundKeep")));
  assert.equal(manifest.key.startsWith("MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8A"), true);

  for (const file of ["src/review.html", "src/dock-settings.html", "src/import.html"]) {
    const source = await readFile(`apps/extension/${file}`, "utf8");
    assert.match(source, /FoundKeep/);
    assert.doesNotMatch(source, />\s*Atlas(?:\s|<)/);
  }
  for (const size of [16, 32, 48, 128]) {
    const png = await readFile(`apps/extension/icons/icon${size}.png`);
    assert.equal(png.subarray(1, 4).toString(), "PNG");
    assert.equal(png.readUInt32BE(16), size);
    assert.equal(png.readUInt32BE(20), size);
  }
});

// The former "installed extension captures selected text, a link,
// screenshots, and a note into its shared library" test drove all of this
// through src/popup.html's direct {kind:'capture'}/{kind:'saveNote'}
// messages and src/dashboard.html's local-library card list. Task 7 deletes
// both surfaces and the message handlers that only they used; the same real
// MV3-worker + IndexedDB coverage for savepage/highlight/region/fullpage now
// lives in tests/extension-dock-flow.mjs (dock capture through save-review)
// and tests/extension-review.mjs (review-card confirm/cancel/draft
// lifecycle), which exercise the current product surface instead.
