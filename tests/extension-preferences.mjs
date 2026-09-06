import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright-core";

let browser;
before(async () => { browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] }); });
after(async () => browser?.close());

const changed = {
  version: 1,
  capture: { region: false, fullPage: true, highlight: true, bookmark: true, image: false, tweet: true, note: true },
  bookmark: { readableText: true, extendedMetadata: false, headings: false },
  notes: { attachSource: false },
  popup: { actionOrder: ["bookmark", "highlight", "fullPage", "region"], showRecent: false, recentCount: 0 },
  sync: { automatic: false },
  organization: { ocr: false, summaries: true, tags: false },
  feedback: { success: false },
  contextMenus: false,
};

async function fixture(t) {
  const context = await browser.newContext();
  t.after(() => context.close());
  await context.route("http://atlas.test/**", async (route) => {
    const name = new URL(route.request().url()).pathname;
    if (name === "/") return route.fulfill({ contentType: "text/html", body: "<!doctype html><title>Preferences</title>" });
    try {
      return route.fulfill({ contentType: "text/javascript", body: await readFile(path.resolve("apps/extension", "." + name)) });
    } catch { return route.fulfill({ status: 404, body: "missing" }); }
  });
  const page = await context.newPage();
  await page.goto("http://atlas.test/");
  await page.evaluate(() => {
    const values = {};
    window.__values = values;
    window.__requests = [];
    window.__preferenceResponses = new Map();
    window.__offline = false;
    window.chrome = {
      storage: { local: {
        get: async (key) => Object.fromEntries(
          (Array.isArray(key) ? key : [key]).map((name) => [name, structuredClone(values[name])]),
        ),
        set: async (patch) => Object.assign(values, structuredClone(patch)),
        remove: async (key) => { delete values[key]; },
      } },
      runtime: { sendMessage: async () => {} },
    };
    window.fetch = async (url, options) => {
      __requests.push({ url, authorization: options?.headers?.Authorization });
      if (__offline) throw new TypeError("offline");
      const accountId = values.atlasCustomer?.account?.id;
      const envelope = __preferenceResponses.get(accountId);
      return new Response(JSON.stringify(envelope), { status: envelope ? 200 : 500 });
    };
  });
  await page.evaluate(async () => { window.preferencesModule = await import("/src/preferences.js"); });
  return page;
}

test("uses built-in preferences before an account is connected", async (t) => {
  const page = await fixture(t);
  const result = await page.evaluate(() => preferencesModule.getEffectivePreferences({ now: 1000 }));
  assert.equal(result.source, "default");
  assert.equal(result.preferences.capture.bookmark, true);
  assert.equal(result.preferences.bookmark.readableText, true);
  assert.equal(result.preferences.sync.automatic, true);
  assert.equal(await page.evaluate(() => __requests.length), 0);
});

test("caches only the connected account and refreshes stale revisions", async (t) => {
  const page = await fixture(t);
  await page.evaluate((changed) => {
    __values.atlasCustomer = { account: { id: "account-a" }, token: "token-a", status: "connected" };
    __preferenceResponses.set("account-a", { preferences: changed, revision: 4, updatedAt: 900 });
  }, changed);
  const fresh = await page.evaluate(() => preferencesModule.getEffectivePreferences({ now: 1000 }));
  assert.equal(fresh.source, "remote");
  assert.equal(fresh.revision, 4);
  assert.deepEqual(fresh.preferences, changed);
  const cached = await page.evaluate(() => preferencesModule.getEffectivePreferences({ now: 2000 }));
  assert.equal(cached.source, "cache");
  assert.equal(await page.evaluate(() => __requests.length), 1);

  await page.evaluate(() => { __offline = true; });
  const stale = await page.evaluate(() => preferencesModule.getEffectivePreferences({ now: 400_001 }));
  assert.equal(stale.source, "stale-cache");
  assert.deepEqual(stale.preferences, changed);

  const switched = await page.evaluate(() => {
    __values.atlasCustomer = { account: { id: "account-b" }, token: "token-b", status: "connected" };
    return preferencesModule.getEffectivePreferences({ now: 400_002 });
  });
  assert.equal(switched.source, "default");
  assert.equal(switched.preferences.capture.region, true);
  assert.notDeepEqual(switched.preferences, changed);
});

test("rejects malformed remote documents and never installs them as cache", async (t) => {
  const page = await fixture(t);
  const result = await page.evaluate(() => {
    __values.atlasCustomer = { account: { id: "account-a" }, token: "token-a", status: "connected" };
    __preferenceResponses.set("account-a", { preferences: { version: 1, capture: { bookmark: false } }, revision: 2, updatedAt: 1 });
    return preferencesModule.getEffectivePreferences({ now: 1000 });
  });
  assert.equal(result.source, "default");
  assert.equal(result.preferences.capture.bookmark, true);
  assert.equal(await page.evaluate(() => __values.atlasPreferenceCache), undefined);
});
