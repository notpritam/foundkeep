import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE || "playwright-core"
);
const root = path.resolve("apps/web");
let server, browser, base;
before(async () => {
  base = process.env.ATLAS_SITE_URL;
  if (!base) {
    server = http.createServer(async (req, res) => {
      try {
        let pathname = decodeURIComponent(
          new URL(req.url, "http://localhost").pathname,
        );
        if (pathname.endsWith("/")) pathname += "index.html";
        const file = path.resolve(root, "." + pathname);
        if (!file.startsWith(root + path.sep)) throw new Error("Outside site");
        const body = await readFile(file);
        const mime = {
          ".html": "text/html",
          ".js": "text/javascript",
          ".css": "text/css",
          ".svg": "image/svg+xml",
          ".png": "image/png",
          ".webp": "image/webp",
          ".woff2": "font/woff2",
          ".zip": "application/zip",
          ".xml": "application/xml",
        };
        res.writeHead(200, {
          "Content-Type": mime[path.extname(file)] || "text/plain",
        });
        res.end(body);
      } catch {
        res.writeHead(404);
        res.end("Not found");
      }
    });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    base = `http://127.0.0.1:${server.address().port}`;
  }
  browser = await chromium.launch({
    headless: true,
    executablePath: process.env.CHROMIUM_PATH || undefined,
    args: ["--no-sandbox"],
  });
});
after(async () => {
  await browser?.close();
  if (server) await new Promise((resolve) => server.close(resolve));
});
async function pageFor(t, width = 1440) {
  const context = await browser.newContext({
    viewport: { width, height: 1000 },
    reducedMotion: "reduce",
  });
  t.after(() => context.close());
  const page = await context.newPage();
  await page.goto(base + "/");
  return page;
}
test("capture demo saves and resets without requiring an account", async (t) => {
  const page = await pageFor(t);
  await page.locator("#demoSave").click();
  assert.equal(await page.locator("#demoSaved").isVisible(), true);
  assert.equal(await page.locator("#demoEmpty").isVisible(), false);
  await page.locator("#demoReset").click();
  assert.equal(await page.locator("#demoEmpty").isVisible(), true);
  assert.equal(
    await page.evaluate(() => document.activeElement.id),
    "demoSave",
  );
});
test("installation remains usable when clipboard permission is denied", async (t) => {
  const page = await pageFor(t);
  await page.evaluate(() => {
    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: async () => {
          throw new Error("Denied");
        },
      },
      configurable: true,
    });
  });
  await page.locator("#copyExtensions").click();
  assert.match(
    await page.locator("#copyStatus").textContent(),
    /chrome:\/\/extensions/,
  );
  const href = await page.locator("a[download]").first().getAttribute("href");
  const response = await page.request.get(new URL(href, base + "/").href);
  assert.equal(response.status(), 200);
  assert.equal(
    (await response.body()).subarray(0, 4).toString("hex"),
    "504b0304",
  );
});
test("site artwork and layout remain usable from phone to desktop", async (t) => {
  const page = await pageFor(t);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.reload();
    await page.evaluate(() => document.fonts.ready);
    // Load below-the-fold product imagery before checking its actual response.
    await page.locator(".library-product").scrollIntoViewIfNeeded();
    await page.waitForFunction(() =>
      [...document.images].every((img) => img.complete),
    );
    assert.deepEqual(
      await page
        .locator("img")
        .evaluateAll((imgs) =>
          imgs.filter((img) => !img.naturalWidth).map((img) => img.src),
        ),
      [],
    );
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
      `Overflow at ${width}px`,
    );
    const frame = await page.locator(".architecture").boundingBox(),
      photo = await page.locator(".architecture img").boundingBox();
    assert.ok(
      photo.y + photo.height <= frame.y + frame.height + 1,
      `Hero image escapes its frame at ${width}px`,
    );
  }
  assert.deepEqual(errors, []);
});
test("search and sharing metadata resolve to the production site and a real image", async (t) => {
  const page = await pageFor(t);
  assert.equal(
    await page
      .locator('link[rel="canonical"]')
      .evaluateAll((links) => links[0]?.href),
    "https://foundkeep.app/",
  );
  const preview = await page
    .locator('meta[property="og:image"]')
    .getAttribute("content");
  const response = await page.request.get(
    new URL(new URL(preview).pathname, base).href,
  );
  assert.equal(response.status(), 200);
  assert.match(response.headers()["content-type"], /image\/(png|jpeg)/);
  const robots = await page.request.get(base + "/robots.txt");
  assert.equal(robots.status(), 200);
  assert.match(
    await robots.text(),
    /https:\/\/foundkeep.app\/sitemap.xml/,
  );
  const sitemap = await page.request.get(base + "/sitemap.xml");
  assert.equal(sitemap.status(), 200);
  await page.locator('a[href="privacy.html"]').first().click();
  assert.match(await page.title(), /Privacy/);
});
test("customer copy explains readable bookmarks, source records, controls and Chromium support", async (t) => {
  const page = await pageFor(t);
  const copy = await page.locator('body').textContent();
  assert.match(copy, /readable copy/i);
  assert.match(copy, /original source/i);
  assert.match(copy, /capture settings/i);
  assert.match(copy, /Chrome, Edge, Brave, Opera/i);
});

test("privacy policy discloses capture data and Chrome Web Store Limited Use", async (t) => {
  const page = await pageFor(t);
  await page.goto(base + "/privacy.html");
  const copy = await page.locator("body").textContent();
  assert.match(copy, /readable copy/i);
  assert.match(copy, /visited and canonical URLs/i);
  assert.match(copy, /Chrome Web Store Limited Use/i);
  assert.match(copy, /does not sell this data/i);
  assert.match(copy, /User Data Policy/i);
});

test("landing page presents Foundkeep and its branded extension download", async (t) => {
  const page = await pageFor(t);
  assert.match(await page.title(), /Foundkeep/);
  const copy = await page.locator("body").textContent();
  assert.match(copy, /Foundkeep/);
  assert.doesNotMatch(copy, /\bAtlas\b/);
  assert.equal(
    await page.locator('a[download="foundkeep-extension.zip"]').getAttribute("href"),
    "foundkeep-extension.zip",
  );
  assert.equal(
    await page.locator('meta[property="og:image"]').getAttribute("content"),
    "https://foundkeep.app/assets/foundkeep-social.png",
  );
});

test("legacy website redirects while extension compatibility routes stay live", async () => {
  const caddy = await readFile(path.resolve("deploy/Caddyfile"), "utf8");
  assert.match(caddy, /foundkeep\.app\s*\{[^}]*reverse_proxy localhost:8790/s);
  assert.match(caddy, /atlas\.notpritam\.in\s*\{/);
  assert.match(caddy, /@extension_compat path .*\/api\/\*/);
  assert.match(caddy, /handle @extension_compat\s*\{\s*reverse_proxy localhost:8790/s);
  assert.match(caddy, /redir https:\/\/foundkeep\.app\{uri\} permanent/);
});
