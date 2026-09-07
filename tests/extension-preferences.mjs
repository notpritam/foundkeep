import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright-core";

let browser;
const runtimePolicy = JSON.parse(await readFile("apps/web/extension-policy.json", "utf8"));
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
  await page.evaluate((runtimePolicy) => {
    const values = {};
    window.__values = values;
    window.__requests = [];
    window.__preferenceResponses = new Map();
    window.__offline = false;
    window.__runtimePolicy = runtimePolicy;
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
      if (url.endsWith("/extension-policy.json"))
        return new Response(JSON.stringify(__runtimePolicy), { status: 200 });
      const accountId = values.atlasCustomer?.account?.id;
      const envelope = __preferenceResponses.get(accountId);
      return new Response(JSON.stringify(envelope), { status: envelope ? 200 : 500 });
    };
  }, runtimePolicy);
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
  assert.equal(await page.evaluate(() => __requests.filter((request) => request.url.endsWith("/api/preferences")).length), 0);
});

test("a cold runtime-policy refresh never blocks an offline local capture", async (t) => {
  const page = await fixture(t);
  const elapsed = await page.evaluate(async () => {
    window.fetch = () => new Promise(() => {});
    const started = performance.now();
    const result = await preferencesModule.getEffectivePreferences({ now: 1000 });
    return { milliseconds: performance.now() - started, source: result.policySource };
  });
  assert.equal(elapsed.source, "default");
  assert.ok(elapsed.milliseconds < 250, `policy lookup took ${elapsed.milliseconds}ms`);
});

test("keeps the last account settings while a connected browser needs reconnection", async (t) => {
  const page = await fixture(t);
  const result = await page.evaluate((changed) => {
    __values.atlasCustomer = { account: { id: "account-a" }, connection: { id: "connection-a" }, token: null, status: "reconnect" };
    __values.atlasPreferenceCache = { accountId: "account-a", preferences: changed, revision: 4, updatedAt: 900, fetchedAt: 900 };
    return preferencesModule.getEffectivePreferences({ now: 500_000 });
  }, changed);
  assert.equal(result.source, "stale-cache");
  assert.equal(result.preferences.capture.region, false);
  assert.equal(result.preferences.sync.automatic, false);
  assert.deepEqual(result.preferences.organization, { ocr: false, summaries: true, tags: false });
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
  assert.equal(await page.evaluate(() => __requests.filter((request) => request.url.endsWith("/api/preferences")).length), 1);

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

test("a forced refresh rejects instead of reporting stale settings as applied", async (t) => {
  const page = await fixture(t);
  await page.evaluate((changed) => {
    __values.atlasCustomer = { account: { id: "account-a" }, connection: { id: "connection-a" }, token: "token-a", status: "connected" };
    __values.atlasPreferenceCache = { accountId: "account-a", preferences: changed, revision: 4, updatedAt: 900, fetchedAt: 900 };
    __offline = true;
  }, changed);
  await assert.rejects(
    page.evaluate(() => preferencesModule.refreshPreferences({ now: 1000 })),
    /Preference refresh failed|offline/,
  );
  assert.equal(await page.evaluate(() => __values.atlasPreferenceCache.revision), 4);
});

test("serializes refreshes and prevents stale or superseded responses from replacing a newer revision", async (t) => {
  const page = await fixture(t);
  await page.evaluate(() => {
    __deferredPreferences = [];
    __values.atlasCustomer = { account: { id: "account-a" }, connection: { id: "connection-a" }, token: "token-a", status: "connected" };
    window.fetch = (url, options) => {
      __requests.push({ url, authorization: options?.headers?.Authorization });
      if (url.endsWith("/extension-policy.json"))
        return Promise.resolve(new Response(JSON.stringify(__runtimePolicy), { status: 200 }));
      return new Promise(resolve => {
      __deferredPreferences.push(envelope => resolve(new Response(JSON.stringify(envelope), { status: 200 })));
      });
    };
    __sameConnection = Promise.all([
      preferencesModule.refreshPreferences({ now: 1000 }),
      preferencesModule.refreshPreferences({ now: 1001 }),
    ]);
  });
  await page.waitForFunction(() => __deferredPreferences.length === 1);
  await page.evaluate((changed) => __deferredPreferences[0]({ preferences: changed, revision: 4, updatedAt: 900 }), changed);
  const same = await page.evaluate(() => __sameConnection);
  assert.deepEqual(same.map(item => item.revision), [4, 4]);
  assert.equal(await page.evaluate(() => __requests.filter((request) => request.url.endsWith("/api/preferences")).length), 1);

  await page.evaluate(() => {
    __deferredPreferences = [];
    __requests = [];
    __values.atlasPreferenceCache.revision = 6;
    __values.atlasPreferenceCache.fetchedAt = 1500;
    __staleServer = preferencesModule.refreshPreferences({ now: 1600 });
  });
  await page.waitForFunction(() => __deferredPreferences.length === 1);
  await page.evaluate((changed) => __deferredPreferences[0]({ preferences: changed, revision: 5, updatedAt: 1400 }), changed);
  const staleServer = await page.evaluate(() => __staleServer);
  assert.equal(staleServer.revision, 6);
  assert.equal(staleServer.source, "newer-cache");
  assert.equal(await page.evaluate(() => __values.atlasPreferenceCache.revision), 6);

  await page.evaluate(() => {
    __deferredPreferences = [];
    __requests = [];
    __olderConnection = preferencesModule.refreshPreferences({ now: 2000 }).then(
      value => ({ value }), error => ({ error: error.message }),
    );
  });
  await page.waitForFunction(() => __deferredPreferences.length === 1);
  await page.evaluate(() => {
    __values.atlasCustomer = { account: { id: "account-a" }, connection: { id: "connection-b" }, token: "token-b", status: "connected" };
    __newerConnection = preferencesModule.refreshPreferences({ now: 2001 });
  });
  await new Promise(resolve => setTimeout(resolve, 25));
  assert.equal(await page.evaluate(() => __deferredPreferences.length), 1);
  await page.evaluate((changed) => __deferredPreferences[0]({ preferences: changed, revision: 7, updatedAt: 1800 }), changed);
  assert.match((await page.evaluate(() => __olderConnection)).error, /connection changed/i);
  await page.waitForFunction(() => __deferredPreferences.length === 2);
  await page.evaluate((changed) => {
    const newer = structuredClone(changed); newer.capture.region = true;
    __deferredPreferences[1]({ preferences: newer, revision: 8, updatedAt: 1900 });
  }, changed);
  assert.equal((await page.evaluate(() => __newerConnection)).revision, 8);
  assert.equal(await page.evaluate(() => __values.atlasPreferenceCache.revision), 8);
  assert.equal(await page.evaluate(() => __values.atlasPreferenceCache.preferences.capture.region), true);
});
