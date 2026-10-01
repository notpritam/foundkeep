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
  assert.equal(manifest.version, "1.8.2");
  // The details card (review.html) is still framed by the dock, so it stays a
  // dynamic-URL web-accessible resource; the before-save drafts are gone.
  // The note field (note.html) is framed the same way, so the page never sees
  // what is typed into it.
  assert.deepEqual(manifest.web_accessible_resources, [{ resources: ["src/review.html", "src/note.html"], matches: ["http://*/*", "https://*/*"], use_dynamic_url: true }]);
  // Both screenshot shortcuts open the corner toolbar (region or full page).
  assert.equal(manifest.commands["full-page-screenshot"].description, "Screenshot to FoundKeep (full page or a region)");
  assert.equal(manifest.commands["region-screenshot"].description, "Screenshot a region to FoundKeep");
  const shipped = JSON.parse(await readFile("deploy/extension-files.json", "utf8"));
  assert.equal(shipped.includes("src/save-review.js"), false);
  for (const file of ["src/capture-actions.js", "src/capture-details.js", "src/screenshot-overlay.js", "src/note.html", "src/note.js", "src/note.css", "src/image-access.html", "src/image-access.js", "src/badge.js"]) assert.ok(shipped.includes(file), file);
  const background = await readFile("apps/extension/src/background.js", "utf8");
  assert.doesNotMatch(background, /save-review-(?:get|confirm|cancel|update)/, "the before-save review messages are gone");

  for (const file of ["src/review.html", "src/dock-settings.html", "src/import.html", "src/note.html", "src/image-access.html"]) {
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

// Real MV3-worker + IndexedDB coverage of every capture lives in the dock
// suites: tests/extension-dock-flow.mjs (instant saves from the dock, the
// right-click menu and keyboard), tests/extension-dock-screenshot.mjs (the
// corner-toolbar screenshot flow), tests/extension-dock-x.mjs (the X button)
// and tests/extension-review.mjs (the after-save "Add details" card).
