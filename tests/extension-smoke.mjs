// Exercise the real MV3 background worker and IndexedDB in a temporary profile.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE || "playwright-core"
);
test(
  "installed extension captures selected text, a link, screenshots, and a note into its shared library",
  { timeout: 30000 },
  async () => {
    const profile = await mkdtemp(
      path.join(os.tmpdir(), "atlas-extension-test-"),
    );
    const extension = path.resolve("apps/extension");
    const server = http.createServer((req, res) => {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(
        '<!doctype html><html lang="en"><head><title>Capture fixture</title><link rel="canonical" href="/original"/><meta name="author" content="Mina Rao"/><meta name="description" content="A fixture worth preserving."/><style>body{margin:40px;background:#f3f3f0;font:24px system-ui}article{height:400px}</style></head><body><article><h1>Good things worth keeping</h1><p id="selection">A good collection starts with noticing.</p></article></body></html>',
      );
    });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const source = `http://127.0.0.1:${server.address().port}/`;
    let context;
    try {
      context = await chromium.launchPersistentContext(profile, {
        channel: "chromium",
        headless: true,
        executablePath: process.env.CHROMIUM_PATH || undefined,
        args: [
          "--no-sandbox",
          `--disable-extensions-except=${extension}`,
          `--load-extension=${extension}`,
        ],
      });
      const worker =
        context.serviceWorkers()[0] ||
        (await context.waitForEvent("serviceworker"));
      const id = new URL(worker.url()).host;
      await worker.evaluate(() =>
        chrome.storage.local.set({
          enrichEnabled: false,
          relayUrl: "",
          relayToken: "",
        }),
      );
      const web = await context.newPage();
      await web.goto(source);
      await web.evaluate(() => {
        const range = document.createRange();
        range.selectNodeContents(document.querySelector("#selection"));
        getSelection().removeAllRanges();
        getSelection().addRange(range);
      });
      const popup = await context.newPage();
      await popup.goto(`chrome-extension://${id}/src/popup.html`);
      await web.bringToFront();
      await popup.evaluate(() => {
        window.close = () => {};
      });
      // This test opens the popup as a tab; capture messages target the active fixture tab.
      const count = async (n) =>
        popup.waitForFunction(
          (n) =>
            document.querySelector("#savedCount").textContent === `${n} saved`,
          n,
        );
      await count(0);
      await popup.evaluate(() =>
        chrome.runtime.sendMessage({ kind: "capture", action: "highlight" }),
      );
      await count(1);
      let captures = await popup.evaluate(async () => {
        const db = await import("./db.js");
        return db.listCaptures();
      });
      assert.equal(
        captures[0].selectionText,
        "A good collection starts with noticing.",
      );
      assert.equal(captures[0].sourceUrl, source);
      await popup.evaluate(() =>
        chrome.runtime.sendMessage({ kind: "capture", action: "savepage" }),
      );
      await count(2);
      captures = await popup.evaluate(async () => {
        const db = await import("./db.js");
        return db.listCaptures();
      });
      const bookmark = captures.find((capture) => capture.type === "bookmark");
      assert.match(bookmark.articleText, /Good things worth keeping/);
      assert.equal(bookmark.provenance.pageUrl, source);
      assert.equal(bookmark.provenance.canonicalUrl, source + "original");
      assert.deepEqual(bookmark.provenance.authors, ["Mina Rao"]);
      assert.match(bookmark.provenance.contentHash, /^[A-Za-z0-9_-]{43}$/);
      const highlight = captures.find((capture) => capture.type === "highlight");
      assert.equal(highlight.provenance.pageUrl, source);
      assert.equal(highlight.provenance.captureMethod, "popup-highlight");
      await popup.evaluate(() =>
        chrome.runtime.sendMessage({ kind: "capture", action: "fullpage" }),
      );
      await count(3);
      // Chrome limits captureVisibleTab to two calls per second.
      await web.waitForTimeout(600);
      await popup.evaluate(() =>
        chrome.runtime.sendMessage({ kind: "capture", action: "region" }),
      );
      await web.getByText("Drag to capture · Esc to cancel").waitFor();
      await web.mouse.move(50, 70);
      await web.mouse.down();
      await web.mouse.move(250, 210);
      await web.mouse.up();
      await count(4);
      const shots = await popup.evaluate(async () => {
        const db = await import("./db.js");
        return (await db.listCaptures())
          .filter((c) => c.type === "screenshot")
          .map((c) => ({
            width: c.width,
            height: c.height,
            bytes: c.blob.size,
          }));
      });
      assert.equal(shots.length, 2);
      assert.ok(shots.every((c) => c.bytes > 0));
      assert.ok(shots.some((c) => c.width === 200 && c.height === 140));
      await popup.locator("#note").fill("Actual extension note");
      await popup.locator("#save").click();
      await count(5);
      const lib = await context.newPage();
      await lib.goto(`chrome-extension://${id}/src/dashboard.html`);
      await lib.waitForSelector(".capture-card");
      assert.equal(await lib.locator(".capture-card").count(), 5);
      assert.equal(await lib.locator("#settings").isVisible(), false);
      const finalCaptures = await popup.evaluate(async () => {
        const db = await import("./db.js");
        return db.listCaptures();
      });
      assert.ok(finalCaptures.every((capture) => capture.provenance?.schemaVersion === 1));
      assert.ok(finalCaptures.every((capture) => capture.provenance?.pageUrl === source));
    } finally {
      await context?.close();
      await new Promise((resolve) => server.close(resolve));
      await rm(profile, { recursive: true, force: true });
    }
  },
);
