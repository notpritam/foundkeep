// Real IndexedDB and extension modules; only Chrome storage and the remote API
// are replaced, so retries can deterministically model offline/ambiguous results.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright-core";
const PRIMARY_ORIGIN = "https://foundkeep.app";
const LEGACY_ORIGIN = "https://atlas.notpritam.in";
let browser;
before(async () => {
  browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
});
after(async () => {
  await browser?.close();
});
async function fixture(t) {
  const context = await browser.newContext();
  t.after(() => context.close());
  await context.route("http://atlas.test/**", async (route) => {
    const name = new URL(route.request().url()).pathname;
    if (name === "/")
      return route.fulfill({
        contentType: "text/html",
        body: "<!doctype html><title>Cloud test</title>",
      });
    try {
      await route.fulfill({
        contentType: "text/javascript",
        body: await readFile(path.resolve("apps/extension", "." + name)),
      });
    } catch {
      await route.fulfill({ status: 404, body: "Missing extension module" });
    }
  });
  const page = await context.newPage();
  await page.goto("http://atlas.test/");
  await page.evaluate(() => {
    const values = {};
    window.chrome = {
      storage: {
        local: {
          get: async (keys) =>
            Object.fromEntries(
              (Array.isArray(keys) ? keys : [keys]).map((k) => [
                k,
                structuredClone(values[k]),
              ]),
            ),
          set: async (patch) => Object.assign(values, structuredClone(patch)),
          setAccessLevel: async () => {},
        },
      },
      runtime: {
        getManifest: () => ({ version: "1.3.0" }),
        sendMessage: async () => {},
      },
    };
    window.requests = [];
    window.uploads = new Map();
    window.mode = "online";
    window.preferenceEnvelope = {
      preferences: {
        version: 1,
        capture: { region: true, fullPage: true, highlight: true, bookmark: true, image: true, tweet: true, note: true },
        bookmark: { readableText: true, extendedMetadata: true, headings: true },
        notes: { attachSource: true },
        popup: { actionOrder: ["bookmark", "highlight", "region", "fullPage"], showRecent: true, recentCount: 3 },
        sync: { automatic: true },
        organization: { ocr: true, summaries: true, tags: true },
        feedback: { success: true },
        contextMenus: true,
      },
      revision: 1,
      updatedAt: 1,
    };
    const claims = {};
    window.fetch = async (url, options = {}) => {
      const body = JSON.parse(options.body || "{}");
      requests.push({
        url,
        body,
        authorization: options.headers?.Authorization,
      });
      if (url.endsWith("/api/preferences"))
        return new Response(JSON.stringify(preferenceEnvelope), { status: 200 });
      if (url.endsWith("/api/pairing/claim")) {
        const id = body.code.startsWith("b") ? "account-b" : "account-a";
        claims[id] = (claims[id] || 0) + 1;
        const suffix = claims[id] > 1 ? ":" + claims[id] : "";
        return new Response(
          JSON.stringify({
            account: {
              id,
              email: id + "@example.test",
              name: id,
              createdAt: 1,
            },
            connection: {
              id: "connection-" + body.code[0] + suffix,
              name: "Chrome",
              createdAt: 1,
              lastSeenAt: 1,
            },
            token: "credential-" + id + suffix,
          }),
          { status: 200 },
        );
      }
      if (mode === "offline") throw new TypeError("Failed to fetch");
      if (url.endsWith("/api/connections/disconnect"))
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      if (mode === "revoked")
        return new Response(
          JSON.stringify({
            error: "unauthorized",
            message: "Reconnect this browser.",
          }),
          { status: 401 },
        );
      if (mode === "quota")
        return new Response(
          JSON.stringify({
            error: "quota_exceeded",
            message: "Your account is full. Delete captures before retrying.",
          }),
          { status: 409 },
        );
      if (mode === "hold-revoked") {
        await new Promise((resolve) => {
          window.releaseUpload = resolve;
        });
        return new Response(
          JSON.stringify({
            error: "unauthorized",
            message: "Old connection revoked.",
          }),
          { status: 401 },
        );
      }
      if (mode === "hold")
        await new Promise((resolve) => {
          window.releaseUpload = resolve;
        });
      const key =
        options.headers.Authorization.split(":")[0] + ":" + body.clientId;
      const duplicate = uploads.has(key);
      const capture = uploads.get(key) || {
        id: "remote-" + uploads.size,
        clientId: body.clientId,
        status: "pending",
      };
      uploads.set(key, capture);
      if (mode === "ambiguous") {
        mode = "online";
        throw new TypeError("Response lost after server committed");
      }
      return new Response(JSON.stringify({ capture, duplicate }), {
        status: 200,
      });
    };
  });
  await page.evaluate(async () => {
    window.cloud = await import("/src/cloud.js");
    window.db = await import("/src/db.js");
    window.preferenceClient = await import("/src/preferences.js");
  });
  return page;
}
const codeA = "a".repeat(43),
  codeB = "b".repeat(43);
async function pair(page, code = codeA, origin = PRIMARY_ORIGIN) {
  return page.evaluate(
    ({ code, origin }) =>
      cloud.handleExternalMessage(
        { kind: "atlas-connect", code },
        {
          url: origin + "/dashboard.html",
          origin,
          frameId: 0,
        },
      ),
    { code, origin },
  );
}
async function save(page, text = "A new capture") {
  return page.evaluate(
    async (text) =>
      db.addCapture({
        type: "note",
        noteText: text,
        ...(await cloud.captureBinding()),
      }),
    text,
  );
}
test("pairing rejects other origins, nested frames and caller-supplied credentials", async (t) => {
  const page = await fixture(t);
  const results = await page.evaluate(async (code) => {
    const senders = [
      { url: "https://foundkeep.app.evil.test/dashboard" },
      { url: "http://foundkeep.app/dashboard" },
      { url: "https://foundkeep.app:444/dashboard" },
      { url: "https://foundkeep.app/dashboard", origin: "null" },
      { url: "https://foundkeep.app/dashboard", frameId: 1 },
      { url: "https://foundkeep.app/dashboard", id: "another-extension" },
      { url: "https://atlas.notpritam.in.evil.test/dashboard" },
      { url: "http://atlas.notpritam.in/dashboard" },
      { url: "https://atlas.notpritam.in:444/dashboard" },
      { url: "https://atlas.notpritam.in/dashboard", origin: "null" },
      { url: "https://atlas.notpritam.in/dashboard", frameId: 1 },
      { url: "https://atlas.notpritam.in/dashboard", id: "another-extension" },
    ];
    const results = await Promise.all(
      senders.map((s) =>
        cloud.handleExternalMessage({ kind: "atlas-connect", code }, s),
      ),
    );
    results.push(
      await cloud.handleExternalMessage(
        {
          kind: "atlas-connect",
          code,
          backend: "https://evil.test",
          token: "caller-token",
        },
        { url: "https://foundkeep.app/dashboard" },
      ),
    );
    return { results, requests: requests.length };
  }, codeA);
  assert.ok(results.results.every((r) => r.ok === false));
  assert.equal(results.requests, 0);
  const connected = await pair(page);
  assert.equal(connected.account.id, "account-a");
  const legacyConnected = await pair(page, codeB, LEGACY_ORIGIN);
  assert.equal(legacyConnected.account.id, "account-b");
  const ping = await page.evaluate(() =>
    cloud.handleExternalMessage(
      { kind: "atlas-ping" },
      { url: "https://foundkeep.app/dashboard" },
    ),
  );
  assert.equal(ping.version, "1.3.0");
  assert.equal(ping.account.id, "account-b");
  assert.equal(
    JSON.stringify([connected, legacyConnected, ping]).includes("credential-"),
    false,
  );
});
test("pairing leaves historical records local until confirmed account-specific import", async (t) => {
  const page = await fixture(t);
  await save(page, "Historical private note");
  await pair(page);
  await save(page);
  await page.evaluate(() => cloud.drainCloudQueue());
  assert.deepEqual(await page.evaluate(() => [...uploads.values()].length), 1);
  const refused = await page.evaluate(async () => {
    try {
      await cloud.importLocalCaptures({ accountId: "account-a" });
      return false;
    } catch {
      return true;
    }
  });
  assert.equal(refused, true);
  await page.evaluate(() =>
    cloud.importLocalCaptures({ confirmed: true, accountId: "account-a" }),
  );
  await page.evaluate(() => cloud.drainCloudQueue());
  assert.equal(await page.evaluate(() => uploads.size), 2);
});

test("automatic upload and organization choices follow the connected account preferences", async (t) => {
  const page = await fixture(t);
  await pair(page);
  const record = await page.evaluate(async () => {
    preferenceEnvelope.preferences.sync.automatic = false;
    preferenceEnvelope.preferences.organization = { ocr: false, summaries: true, tags: false };
    await preferenceClient.clearPreferenceCache();
    return db.addCapture({
      type: "note",
      noteText: "Stay queued by customer choice",
      ...(await cloud.captureBinding()),
    });
  });
  assert.deepEqual(record.processingOptions, { ocr: false, summaries: true, tags: false });
  await page.evaluate(() => cloud.drainCloudQueue());
  assert.equal(await page.evaluate(() => uploads.size), 0);
  assert.equal((await page.evaluate((id) => db.getCapture(id), record.id)).cloudStatus, "queued");

  await page.evaluate(async () => {
    preferenceEnvelope.preferences.sync.automatic = true;
    preferenceEnvelope.revision++;
    await preferenceClient.refreshPreferences();
    await cloud.drainCloudQueue();
  });
  assert.equal(await page.evaluate(() => uploads.size), 1);
});
test("offline and ambiguous uploads survive module restart without duplicates", async (t) => {
  const page = await fixture(t);
  await pair(page);
  const record = await save(page);
  await page.evaluate(async () => {
    mode = "offline";
    await cloud.drainCloudQueue();
  });
  assert.equal(
    (await page.evaluate((id) => db.getCapture(id), record.id)).cloudStatus,
    "queued",
  );
  await page.evaluate(async () => {
    window.cloud = await import("/src/cloud.js?restart");
    mode = "ambiguous";
    await cloud.retryCloudSync();
  });
  assert.equal(await page.evaluate(() => uploads.size), 1);
  await page.evaluate(() => cloud.retryCloudSync());
  assert.equal(await page.evaluate(() => uploads.size), 1);
  assert.equal(
    (await page.evaluate((id) => db.getCapture(id), record.id)).cloudStatus,
    "synced",
  );
  const ids = await page.evaluate(() =>
    requests
      .filter((r) => r.url.endsWith("/api/captures"))
      .map((r) => r.body.clientId),
  );
  assert.equal(new Set(ids).size, 1);
});
test("switching accounts during upload never rebinds old records", async (t) => {
  const page = await fixture(t);
  await pair(page);
  const old = await save(page, "Old account note");
  await page.evaluate(() => {
    mode = "hold";
    window.drain = cloud.drainCloudQueue();
  });
  await page.waitForFunction(() => typeof releaseUpload === "function");
  await pair(page, codeB);
  const current = await save(page, "New account note");
  await page.evaluate(async () => {
    mode = "online";
    releaseUpload();
    await drain;
    await cloud.drainCloudQueue();
  });
  const sent = await page.evaluate(() =>
    requests
      .filter((r) => r.url.endsWith("/api/captures"))
      .map((r) => ({ text: r.body.noteText, auth: r.authorization })),
  );
  assert.ok(
    sent.some(
      (r) =>
        r.text === "Old account note" &&
        r.auth === "Bearer credential-account-a",
    ),
  );
  assert.ok(
    sent.some(
      (r) =>
        r.text === "New account note" &&
        r.auth === "Bearer credential-account-b",
    ),
  );
  assert.equal(
    sent.some(
      (r) =>
        r.text === "Old account note" &&
        r.auth === "Bearer credential-account-b",
    ),
    false,
  );
  assert.equal(
    (await page.evaluate((id) => db.getCapture(id), old.id)).cloudAccountId,
    "account-a",
  );
  assert.equal(
    (await page.evaluate((id) => db.getCapture(id), current.id)).cloudAccountId,
    "account-b",
  );
});
test("an old connection returning 401 cannot disconnect the newly selected account", async (t) => {
  const page = await fixture(t);
  await pair(page);
  await save(page, "Old account");
  await page.evaluate(() => {
    mode = "hold-revoked";
    window.drain = cloud.drainCloudQueue();
  });
  await page.waitForFunction(() => typeof releaseUpload === "function");
  await pair(page, codeB);
  await save(page, "Current account");
  await page.evaluate(async () => {
    mode = "online";
    releaseUpload();
    await drain;
    await cloud.drainCloudQueue();
  });
  const state = await page.evaluate(() => cloud.getCloudStatus());
  assert.equal(state.account.id, "account-b");
  assert.equal(state.status, "connected");
  assert.equal(state.error, null);
  assert.equal(state.synced, 1);
  assert.equal(
    await page.evaluate(() =>
      requests.some(
        (r) =>
          r.body.noteText === "Old account" &&
          r.authorization === "Bearer credential-account-b",
      ),
    ),
    false,
  );
});
test("an import confirmation for the previous account cannot upload to a newly selected account", async (t) => {
  const page = await fixture(t);
  await save(page, "Historical private note");
  await pair(page);
  await pair(page, codeB);
  const error = await page.evaluate(async () => {
    try {
      await cloud.importLocalCaptures({
        confirmed: true,
        accountId: "account-a",
      });
      return null;
    } catch (error) {
      return error.message;
    }
  });
  assert.match(error, /account changed/);
  await page.evaluate(() => cloud.drainCloudQueue());
  assert.equal(await page.evaluate(() => uploads.size), 0);
  assert.equal(
    (await page.evaluate(() => db.listCaptures()))[0].cloudAccountId,
    null,
  );
});
test("revocation stops retries, keeps new saves bound, and reconnect resumes the same account", async (t) => {
  const page = await fixture(t);
  await pair(page);
  await save(page);
  await page.evaluate(async () => {
    mode = "revoked";
    await cloud.drainCloudQueue();
  });
  const state = await page.evaluate(() => cloud.getCloudStatus());
  assert.equal(state.status, "reconnect");
  assert.equal(state.account.id, "account-a");
  const later = await save(page, "While revoked");
  assert.equal(later.cloudAccountId, "account-a");
  const before = await page.evaluate(() => requests.length);
  await page.evaluate(() => cloud.retryCloudSync());
  assert.equal(await page.evaluate(() => requests.length), before);
  await pair(page);
  await page.evaluate(async () => {
    mode = "online";
    await cloud.retryCloudSync();
  });
  assert.equal(await page.evaluate(() => uploads.size), 2);
});
test("disconnected and other-account queues remain local; quota errors are recoverable", async (t) => {
  const page = await fixture(t);
  await pair(page);
  const old = await save(page);
  await page.evaluate(async () => {
    mode = "offline";
    await cloud.drainCloudQueue();
    await cloud.disconnectCloud();
  });
  const local = await save(page, "Disconnected note");
  assert.equal(local.cloudAccountId, null);
  assert.equal(local.cloudStatus, "local");
  assert.equal(local.status, "done");
  await pair(page, codeB);
  await page.evaluate(() => cloud.drainCloudQueue());
  assert.equal(await page.evaluate(() => uploads.size), 0);
  await page.evaluate(() =>
    cloud.importLocalCaptures({ confirmed: true, accountId: "account-b" }),
  );
  await page.evaluate(async () => {
    mode = "quota";
    await cloud.retryCloudSync();
  });
  const status = await page.evaluate(() => cloud.getCloudStatus());
  assert.equal(status.failed, 1);
  assert.match(status.error, /full/);
  await page.evaluate(async () => {
    mode = "online";
    await cloud.retryCloudSync();
  });
  assert.equal(await page.evaluate(() => uploads.size), 1);
  assert.equal(
    (await page.evaluate((id) => db.getCapture(id), old.id)).cloudAccountId,
    "account-a",
  );
});
test("notes on browser pages sync without an unsupported source URL; highlights keep the API type", async (t) => {
  const page = await fixture(t);
  await pair(page);
  await page.evaluate(async () => {
    await db.addCapture({
      type: "note",
      noteText: "Browser-page thought",
      sourceUrl: "chrome://newtab/",
      ...(await cloud.captureBinding()),
    });
    await db.addCapture({
      type: "highlight",
      selectionText: "Saved words",
      sourceUrl: "https://example.test/article",
      ...(await cloud.captureBinding()),
    });
    await cloud.drainCloudQueue();
  });
  const bodies = await page.evaluate(() =>
    requests.filter((r) => r.url.endsWith("/api/captures")).map((r) => r.body),
  );
  assert.equal(bodies.find((b) => b.noteText).sourceUrl, null);
  assert.equal(bodies.find((b) => b.selectionText).type, "selection");
  assert.equal(
    bodies.find((b) => b.selectionText).sourceUrl,
    "https://example.test/article",
  );
});

test("an aborted IndexedDB save rejects instead of claiming a durable capture", async (t) => {
  const page = await fixture(t);
  const result = await page.evaluate(async () => {
    const add = IDBObjectStore.prototype.add;
    IDBObjectStore.prototype.add = function (value) {
      const r = add.call(this, value);
      r.addEventListener("success", () => this.transaction.abort());
      return r;
    };
    let resolved = false;
    try {
      await db.addCapture({
        type: "note",
        noteText: "Must survive the commit",
      });
      resolved = true;
    } catch {}
    IDBObjectStore.prototype.add = add;
    return { resolved, records: await db.listCaptures() };
  });
  assert.equal(result.resolved, false);
  assert.equal(result.records.length, 0);
});
test("aborted IndexedDB updates and deletes leave their existing capture intact and report failure", async (t) => {
  const page = await fixture(t);
  const record = await save(page, "Original");
  const result = await page.evaluate(async (id) => {
    const results = [];
    for (const [method, operation] of [
      ["put", () => db.updateCapture(id, { noteText: "Lost update" })],
      ["delete", () => db.deleteCapture(id)],
    ]) {
      const original = IDBObjectStore.prototype[method];
      IDBObjectStore.prototype[method] = function (value) {
        const r = original.call(this, value);
        r.addEventListener("success", () => this.transaction.abort());
        return r;
      };
      let resolved = false;
      try {
        await operation();
        resolved = true;
      } catch {}
      IDBObjectStore.prototype[method] = original;
      results.push({ resolved, record: await db.getCapture(id) });
    }
    return results;
  }, record.id);
  assert.ok(
    result.every((r) => !r.resolved && r.record.noteText === "Original"),
  );
});
test("disconnect clears local credentials before revocation and reports offline revocation failure", async (t) => {
  const page = await fixture(t);
  await pair(page);
  const result = await page.evaluate(async () => {
    mode = "offline";
    const result = await cloud.disconnectCloud();
    return { result, state: await cloud.getCloudStatus() };
  });
  assert.equal(result.state.account, null);
  assert.equal(result.state.status, "disconnected");
  assert.equal(result.result.revoked, false);
  assert.match(result.result.warning, /dashboard/);
});
test("replacing a connection revokes only the captured old credential", async (t) => {
  const page = await fixture(t);
  await pair(page);
  await pair(page, codeB);
  const revoked = await page.evaluate(() =>
    requests
      .filter((r) => r.url.endsWith("/api/connections/disconnect"))
      .map((r) => r.authorization),
  );
  assert.deepEqual(revoked, ["Bearer credential-account-a"]);
  assert.equal(
    (await page.evaluate(() => cloud.getCloudStatus())).account.id,
    "account-b",
  );
});

test("reconnecting the same account preserves idempotency across credential rotation", async (t) => {
  const page = await fixture(t);
  await pair(page);
  await save(page);
  await page.evaluate(async () => {
    mode = "ambiguous";
    await cloud.drainCloudQueue();
  });
  await pair(page);
  await page.evaluate(() => cloud.retryCloudSync());
  assert.equal(await page.evaluate(() => uploads.size), 1);
  assert.equal((await page.evaluate(() => cloud.getCloudStatus())).synced, 1);
  assert.deepEqual(
    await page.evaluate(() =>
      requests
        .filter((r) => r.url.endsWith("/api/connections/disconnect"))
        .map((r) => r.authorization),
    ),
    ["Bearer credential-account-a"],
  );
});
