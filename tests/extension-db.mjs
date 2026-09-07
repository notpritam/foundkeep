import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright-core";

let browser;
before(async () => {
  browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
});
after(async () => browser?.close());

test("IndexedDB v1 upgrades without losing captures and adds indexed cloud status", async (t) => {
  const context = await browser.newContext();
  t.after(() => context.close());
  await context.route("http://atlas.test/**", async (route) => {
    const file = new URL(route.request().url()).pathname;
    if (file === "/") return route.fulfill({ contentType: "text/html", body: "<!doctype html><title>DB migration</title>" });
    try {
      return route.fulfill({
        contentType: "text/javascript",
        body: await readFile(path.resolve("apps/extension", "." + file)),
      });
    } catch {
      return route.fulfill({ status: 404, body: "missing" });
    }
  });
  const page = await context.newPage();
  await page.goto("http://atlas.test/");
  await page.evaluate(async () => {
    await new Promise((resolve, reject) => {
      const request = indexedDB.open("atlas", 1);
      request.onupgradeneeded = () => {
        const store = request.result.createObjectStore("captures", { keyPath: "id" });
        store.createIndex("by_status", "status");
        store.createIndex("by_type", "type");
        store.createIndex("by_created", "createdAt");
        store.add({ id: "local", type: "note", status: "done", cloudAccountId: null, cloudStatus: "local", createdAt: 1 });
        store.add({ id: "queued", type: "bookmark", status: "done", cloudAccountId: "account-a", cloudStatus: "queued", createdAt: 2 });
        store.add({ id: "failed", type: "image", status: "done", cloudAccountId: "account-a", cloudStatus: "failed", cloudError: "offline", createdAt: 3 });
        store.add({ id: "other", type: "note", status: "done", cloudAccountId: "account-b", cloudStatus: "synced", createdAt: 4 });
      };
      request.onsuccess = () => { request.result.close(); resolve(); };
      request.onerror = () => reject(request.error);
    });
  });
  const result = await page.evaluate(async () => {
    const db = await import("/src/db.js");
    return {
      recent: (await db.recentCaptures(2)).map((item) => item.id),
      queue: (await db.listCloudQueue("account-a", ["queued", "failed"])).map((item) => item.id),
      metrics: await db.cloudMetrics("account-a"),
      all: (await db.listCaptures({ limit: 10 })).map((item) => item.id),
    };
  });
  assert.deepEqual(result.recent, ["other", "failed"]);
  assert.deepEqual(result.queue, ["queued", "failed"]);
  assert.deepEqual(result.metrics, {
    pending: 1,
    failed: 1,
    synced: 0,
    localOnly: 1,
    otherAccount: 1,
    error: "offline",
  });
  assert.equal(result.all.length, 4);
});
