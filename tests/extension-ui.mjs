// Run with PLAYWRIGHT_MODULE and CHROMIUM_PATH overrides when using an existing browser install.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE || "playwright-core"
);
const root = path.resolve("apps/extension");
let browser;
before(async () => {
  browser = await chromium.launch({
    headless: true,
    executablePath: process.env.CHROMIUM_PATH || undefined,
    args: ["--no-sandbox"],
  });
});
after(async () => {
  await browser?.close();
});
async function pageWithExtension(t, { saveFails = false } = {}) {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
  });
  t.after(() => context.close());
  await context.route("**/*", async (route) => {
    const u = new URL(route.request().url());
    if (u.hostname !== "atlas.test") return route.abort();
    const file = path.join(root, decodeURIComponent(u.pathname));
    const contentType =
      {
        ".html": "text/html",
        ".js": "text/javascript",
        ".css": "text/css",
        ".svg": "image/svg+xml",
        ".png": "image/png",
        ".woff2": "font/woff2",
      }[path.extname(file)] || "application/octet-stream";
    try {
      await route.fulfill({ contentType, body: await readFile(file) });
    } catch {
      await route.fulfill({ status: 404, body: "Not found" });
    }
  });
  await context.addInitScript(
    ({ saveFails }) => {
      let settings = {
        enrichEnabled: false,
        relayUrl: "",
        relayToken: "",
        agentUrl: "http://127.0.0.1:8791",
      };
      window.close = () => {};
      window.chrome = {
        storage: {
          local: {
            get: async () => settings,
            set: async (p) => {
              Object.assign(settings, p);
            },
          },
          onChanged: { addListener: () => {} },
        },
        runtime: {
          getURL: (p) => "http://atlas.test/" + p,
          onMessage: { addListener: () => {}, removeListener: () => {} },
          sendMessage: async (m) => {
            if (m.kind === "saveNote") {
              if (saveFails) return { ok: false, error: "Disk full" };
              const db = await import("/src/db.js");
              await db.addCapture({
                type: "note",
                noteText: m.text,
                sourceTitle: "Sample article",
                sourceUrl: "https://example.com/article",
              });
              return { ok: true };
            }
            return { relay: false, connected: false };
          },
        },
        tabs: {
          query: async () => [
            {
              id: 1,
              title: "Sample article",
              url: "https://example.com/article",
            },
          ],
          create: async (p) => {
            window.__opened = p.url;
          },
        },
      };
    },
    { saveFails },
  );
  return context.newPage();
}
test("library opens without hidden settings covering saved content", async (t) => {
  const page = await pageWithExtension(t);
  await page.goto("http://atlas.test/src/dashboard.html");
  await page.waitForTimeout(100);
  assert.equal(
    await page.locator("#settings").isVisible(),
    false,
    "Settings must not cover the library on first load",
  );
});
test("failed note save retains the draft for retry", async (t) => {
  const page = await pageWithExtension(t, { saveFails: true });
  await page.goto("http://atlas.test/src/popup.html");
  await page.locator("#note").fill("This draft must survive a failed save.");
  await page.locator("#save").click();
  await page.waitForTimeout(100);
  assert.equal(
    await page.locator("#note").inputValue(),
    "This draft must survive a failed save.",
  );
});
async function seed(page, records) {
  return page.evaluate(async (records) => {
    const db = await import("/src/db.js");
    const ids = [];
    for (const record of records) {
      const c = await db.addCapture(record);
      await db.updateCapture(c.id, {
        tags: record.tags || [],
        category: record.category || null,
        createdAt: record.createdAt || Date.now(),
      });
      ids.push(c.id);
    }
    return ids;
  }, records);
}
test("successful note save persists locally, clears only the saved draft, and links to its detail", async (t) => {
  const page = await pageWithExtension(t);
  await page.goto("http://atlas.test/src/popup.html");
  await page.locator("#note").fill("A useful thought");
  await page.locator("#save").click();
  await page.waitForFunction(() =>
    document.querySelector("#saveFeedback").textContent.includes("Saved"),
  );
  assert.equal(await page.locator("#note").inputValue(), "");
  const notes = await page.evaluate(async () => {
    const db = await import("/src/db.js");
    return db.listCaptures();
  });
  assert.equal(notes.length, 1);
  assert.equal(notes[0].noteText, "A useful thought");
  await page.locator(".recent-item").click();
  assert.equal(
    await page.evaluate(() => window.__opened),
    `http://atlas.test/src/dashboard.html#capture=${notes[0].id}`,
  );
});
test("keyword search, type/tag filters and sort preserve actual capture records", async (t) => {
  const page = await pageWithExtension(t);
  await page.goto("http://atlas.test/src/dashboard.html");
  await seed(page, [
    {
      type: "note",
      noteText: "Remember the copper door",
      tags: ["architecture"],
      category: "Design",
      createdAt: 1000,
    },
    {
      type: "highlight",
      selectionText: "The meaning of a quiet space",
      sourceTitle: "Quiet spaces",
      tags: ["reading"],
      createdAt: 2000,
    },
    { type: "bookmark", sourceTitle: "Copper colour study", createdAt: 3000 },
  ]);
  await page.reload();
  await page.waitForSelector(".capture-card");
  assert.equal(await page.locator(".capture-card").count(), 3);
  await page.locator("#q").fill("copper");
  await page.waitForFunction(
    () => document.querySelectorAll(".capture-card").length === 2,
  );
  await page.locator('#typeFilters [data-type="note"]').click();
  await page.waitForFunction(
    () => document.querySelectorAll(".capture-card").length === 1,
  );
  assert.match(await page.locator(".card-title").textContent(), /copper door/);
  await page.locator("#resetFilters").click();
  await page.waitForFunction(
    () => document.querySelectorAll(".capture-card").length === 3,
  );
  await page.locator("#sort").selectOption("oldest");
  await page.waitForFunction(() =>
    document.querySelector(".card-title").textContent.includes("copper door"),
  );
  await page
    .locator("#tagFilters button")
    .filter({ hasText: "reading" })
    .click();
  await page.waitForFunction(
    () => document.querySelectorAll(".capture-card").length === 1,
  );
  assert.match(await page.locator(".card-title").textContent(), /quiet space/);
});
test("captured markup remains text and unsafe source URLs are not navigable", async (t) => {
  const page = await pageWithExtension(t);
  await page.goto("http://atlas.test/src/dashboard.html");
  await seed(page, [
    {
      type: "note",
      noteText: "Safe note",
      sourceUrl: "javascript:window.compromised=true",
      tags: ["<img src=x onerror=window.compromised=true>"],
      category: "<svg onload=window.compromised=true>",
    },
  ]);
  await page.reload();
  await page.waitForSelector(".capture-card");
  assert.equal(
    await page.locator("#tagFilters img, #facetFilters svg").count(),
    0,
  );
  await page.locator(".capture-card").click();
  assert.equal(await page.locator("#sourceLink").isVisible(), false);
  assert.equal(await page.evaluate(() => window.compromised), undefined);
});
test("keyboard focus survives filtering, refreshing an open detail, and closing settings", async (t) => {
  const page = await pageWithExtension(t);
  await page.goto("http://atlas.test/src/dashboard.html");
  await seed(page, [{ type: "highlight", selectionText: "Keep this line" }]);
  await page.reload();
  await page.waitForSelector(".capture-card");
  const filter = page.locator('#typeFilters [data-type="highlight"]');
  await filter.focus();
  await page.keyboard.press("Enter");
  await page.waitForFunction(
    () => document.querySelector("#libraryTitle").textContent === "Highlights.",
  );
  assert.equal(
    await page.evaluate(() => document.activeElement.dataset.focusKey),
    "type:highlight",
  );
  const key = await page
    .locator(".capture-card")
    .getAttribute("data-focus-key");
  await page.locator(".capture-card").focus();
  await page.keyboard.press("Enter");
  await page.waitForSelector("#overlay[open]");
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await page.waitForTimeout(100);
  await page.keyboard.press("Escape");
  assert.equal(
    await page.evaluate(() => document.activeElement.dataset.focusKey),
    key,
  );
  await page.locator("#settingsBtn").click();
  await page.locator("#settingsClose").click();
  assert.equal(
    await page.evaluate(() => document.activeElement.id),
    "settingsBtn",
  );
});
test("settings changes persist and browser-control remains under advanced setup", async (t) => {
  const page = await pageWithExtension(t);
  await page.goto("http://atlas.test/src/dashboard.html");
  await page.locator("#settingsBtn").click();
  await page.waitForFunction(() =>
    document.querySelector("#agentBox").textContent.includes("off"),
  );
  assert.equal(await page.locator("#relayUrl").isVisible(), false);
  await page.getByText("Set up the companion", { exact: true }).click();
  await page.locator("#agentUrl").fill("https://example.com/companion");
  await page.locator("#saveSettings").click();
  await page.waitForFunction(
    () =>
      document.querySelector("#settingsFeedback").textContent ===
      "Settings saved.",
  );
  await page.locator("#settingsClose").click();
  await page.locator("#settingsBtn").click();
  assert.equal(
    await page.locator("#agentUrl").inputValue(),
    "https://example.com/companion",
  );
  assert.equal(await page.locator("#enrichEnabled").isChecked(), false);
});
test("mobile retains tag filtering and popup keeps Open library within Chrome height limit", async (t) => {
  const page = await pageWithExtension(t);
  await page.goto("http://atlas.test/src/dashboard.html");
  await seed(page, [
    { type: "note", noteText: "Mobile note", tags: ["mobile"] },
  ]);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await page.waitForSelector(".capture-card");
  assert.equal(await page.locator("#tagFilters button").isVisible(), true);
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
  );
  await page.goto("http://atlas.test/src/popup.html");
  await page.waitForSelector(".recent-item");
  const b = await page.locator("#openLib").boundingBox();
  assert.ok(
    b.y + b.height <= 600,
    "Library shortcut must remain within the 600px Chrome action popup",
  );
});
test("new library note saves and deletion requires confirmation", async (t) => {
  const page = await pageWithExtension(t);
  await page.goto("http://atlas.test/src/dashboard.html");
  await page.locator("#newNote").click();
  await page.locator("#libraryNote").fill("A library thought");
  await page.locator("#saveLibraryNote").click();
  await page.waitForSelector(".capture-card");
  assert.match(
    await page.locator(".card-title").textContent(),
    /A library thought/,
  );
  await page.locator(".capture-card").click();
  page.once("dialog", (d) => d.dismiss());
  await page.locator("#deleteCapture").click();
  assert.equal(await page.locator("#overlay").isVisible(), true);
  page.once("dialog", (d) => d.accept());
  await page.locator("#deleteCapture").click();
  await page.waitForSelector("#empty", { state: "visible" });
  assert.equal(await page.locator(".capture-card").count(), 0);
});
