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
test("installation offers the public Store release and a working manual package", async (t) => {
  const page = await pageFor(t);
  const storeHref = await page
    .locator("[data-extension-install]").first()
    .getAttribute("href");
  assert.equal(
    storeHref,
    "https://chromewebstore.google.com/detail/cficnecbdbiddngllpfbacabgbcjinmk",
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
  assert.match(await robots.text(), /https:\/\/foundkeep.app\/sitemap.xml/);
  const sitemap = await page.request.get(base + "/sitemap.xml");
  assert.equal(sitemap.status(), 200);
  await page.locator('.site-footer a[href="privacy.html"]').click();
  assert.match(await page.title(), /Privacy/);
});
test("customer copy explains readable bookmarks, source records, controls and iPhone support", async (t) => {
  const page = await pageFor(t);
  const copy = await page.locator("body").textContent();
  assert.match(copy, /readable copy/i);
  assert.match(copy, /original source/i);
  assert.match(copy, /capture settings/i);
  assert.match(copy, /Chrome, Edge, Brave, Opera/i);
  assert.match(copy, /iPhone/i);
});

test("mobile navigation opens, closes on Escape and follows section links", async (t) => {
  const page = await pageFor(t, 390);
  const toggle = page.getByRole("button", { name: "Open navigation" });
  await toggle.click();
  assert.equal(await page.locator("#mobile-nav").isVisible(), true);
  await page.keyboard.press("Escape");
  assert.equal(await page.locator("#mobile-nav").isVisible(), false);
  assert.equal(
    await page
      .locator(".menu-toggle")
      .evaluate((button) => button === document.activeElement),
    true,
  );
  await toggle.click();
  await page.locator('#mobile-nav a[href="#library"]').click();
  assert.equal(new URL(page.url()).hash, "#library");
  assert.equal(await page.locator("#mobile-nav").isVisible(), false);
  await page.setViewportSize({ width: 1440, height: 1000 });
  assert.equal(await page.locator(".menu-toggle").isVisible(), false);
});

test("mobile handoff page creates only allowlisted Foundkeep links", async (t) => {
  const page = await pageFor(t);
  await page.goto(base + "/open.html?path=settings");
  assert.equal(
    await page.locator("#open-app").getAttribute("href"),
    "foundkeep://settings",
  );
  await page.goto(base + "/open.html?path=https%3A%2F%2Fevil.example");
  assert.equal(
    await page.locator("#open-app").getAttribute("href"),
    "foundkeep://collection",
  );
  assert.match(
    await page.locator(".open-private").textContent(),
    /never includes your password/i,
  );
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

test("customer support is hosted on Foundkeep and covers the full capture path", async (t) => {
  const page = await pageFor(t, 390);
  await page.goto(base + "/support.html");
  assert.equal(
    await page.locator('link[rel="canonical"]').getAttribute("href"),
    "https://foundkeep.app/support.html",
  );
  const copy = await page.locator("body").textContent();
  assert.match(copy, /installation/i);
  assert.match(copy, /Connect Foundkeep/i);
  assert.match(copy, /local library/i);
  assert.match(copy, /Pending uploads retry automatically/i);
  assert.match(copy, /recovery code/i);
  assert.match(copy, /version 1\.0\.0/i);
  assert.match(copy, /notpritamsharma@gmail\.com/i);
  assert.equal((await page.locator('a[href="terms.html"]').count()) > 0, true);
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
  );
});

test("terms state customer content rights and expose a real support contact", async (t) => {
  const page = await pageFor(t, 390);
  await page.goto(base + "/terms.html");
  assert.equal(
    await page.locator('link[rel="canonical"]').getAttribute("href"),
    "https://foundkeep.app/terms.html",
  );
  const copy = await page.locator("body").textContent();
  assert.match(copy, /You keep ownership/i);
  assert.match(copy, /have permission/i);
  assert.match(copy, /notpritamsharma@gmail\.com/i);
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
  );
});

test("landing page presents Foundkeep and its branded extension download", async (t) => {
  const page = await pageFor(t);
  assert.match(await page.title(), /Foundkeep/);
  const copy = await page.locator("body").textContent();
  assert.match(copy, /Foundkeep/);
  assert.doesNotMatch(copy, /\bAtlas\b/);
  assert.match(
    await page
      .locator('a[download="foundkeep-extension.zip"]')
      .getAttribute("href"),
    /^foundkeep-extension\.zip\?build=\d+\.\d+\.\d+$/,
  );
  assert.equal(
    await page.locator('meta[property="og:image"]').getAttribute("content"),
    "https://foundkeep.app/assets/foundkeep-scenic-social.png",
  );
});

test("legacy website redirects while extension compatibility routes stay live", async () => {
  const caddy = await readFile(path.resolve("deploy/Caddyfile"), "utf8");
  assert.match(caddy, /foundkeep\.app\s*\{[^}]*reverse_proxy localhost:8790/s);
  assert.match(caddy, /atlas\.notpritam\.in\s*\{/);
  assert.match(caddy, /@extension_compat path .*\/api\/\*/);
  assert.match(
    caddy,
    /handle @extension_compat\s*\{\s*reverse_proxy localhost:8790/s,
  );
  assert.match(caddy, /redir https:\/\/foundkeep\.app\{uri\} permanent/);
});

test('landing recognizes an installed browser and updates every Store call to action', async t => {
  const context = await browser.newContext(); t.after(() => context.close());
  await context.addInitScript(() => {
    window.chrome = { runtime: { sendMessage(id, message, callback) {
      callback(id === 'cficnecbdbiddngllpfbacabgbcjinmk' && message.kind === 'atlas-ping' ? { ok: true, version: '1.0.0', account: null } : undefined);
    } } };
  });
  const page = await context.newPage(); await page.goto(base + '/');
  await page.waitForFunction(() => /installed/i.test(document.querySelector('.download-note').textContent), null, { timeout: 3000 });
  assert.equal(await page.locator('[data-extension-install][href*="chromewebstore.google.com/detail/"]').count(), 0, 'Installed users should not be asked to install again');
  const links = page.locator('[data-extension-install]');
  assert.equal(await links.count(), 3);
  for (const link of await links.all()) {
    assert.match(await link.textContent(), /Connect extension/);
    assert.equal(await link.getAttribute('href'), 'dashboard.html');
    assert.equal(await link.getAttribute('target'), null);
  }
});

test('landing rechecks installation when returning and recovers from config failure', async t => {
  const context = await browser.newContext(); t.after(() => context.close());
  await context.route('**/customer-config.json', route => route.fulfill({ status: 503, body: 'Temporarily unavailable' }));
  await context.addInitScript(() => {
    window.__extensionInstalled = false;
    window.chrome = { runtime: { sendMessage(id, message, callback) {
      callback(window.__extensionInstalled && id === 'cficnecbdbiddngllpfbacabgbcjinmk' && message.kind === 'atlas-ping' ? { ok: true, version: '1.0.0', account: { id: 'paired-account' } } : undefined);
    } } };
  });
  const page = await context.newPage(); await page.goto(base + '/');
  assert.match(await page.locator('[data-extension-install]').first().getAttribute('href'), /chromewebstore.google.com/);
  await page.evaluate(() => { window.__extensionInstalled = true; window.dispatchEvent(new Event('focus')); });
  await page.waitForFunction(() => document.querySelector('[data-extension-install]').textContent.includes('Open dashboard'), null, { timeout: 3000 });
  assert.match(await page.locator('.download-note').textContent(), /connected/i);
  await page.evaluate(() => { window.__extensionInstalled = false; window.dispatchEvent(new Event('focus')); });
  await page.waitForFunction(() => document.querySelector('[data-extension-install]').textContent.includes('Add to Chrome'), null, { timeout: 3000 });
});

test('returning from an explicit Store visit reloads a page without messaging only once', async t => {
  const context = await browser.newContext(); t.after(() => context.close());
  await context.addInitScript(() => {
    const key = '__test_page_loads';
    sessionStorage.setItem(key, String(Number(sessionStorage.getItem(key) || 0) + 1));
  });
  const page = await context.newPage(); await page.goto(base + '/');
  // Wait for the module that binds installation events without opening the Store.
  await page.waitForFunction(() => document.querySelector('.download-note').textContent.includes('Automatic updates'));
  await page.evaluate(() => {
    const install = document.querySelector('[data-extension-install]');
    install.addEventListener('click', event => event.preventDefault(), { once: true });
    install.click();
  });
  await Promise.all([
    page.waitForEvent('load'),
    page.evaluate(() => window.dispatchEvent(new Event('focus'))),
  ]);
  await page.waitForFunction(() => document.querySelector('.download-note').textContent.includes('Automatic updates'));
  assert.equal(await page.evaluate(() => sessionStorage.getItem('__test_page_loads')), '2');
  assert.equal(await page.evaluate(() => sessionStorage.getItem('foundkeep-install-return')), null);
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  // Allow a complete frame after the synchronous focus handler to detect a reload loop.
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  assert.equal(await page.evaluate(() => sessionStorage.getItem('__test_page_loads')), '2');
});
