import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import type { Database } from "bun:sqlite";
import { openDb } from "../src/db.ts";
import { createApp } from "../src/app.ts";

const ORIGIN = process.env.ATLAS_CUSTOMER_ORIGIN || "https://atlas.notpritam.in";
const EXTENSION = "chrome-extension://mjfcgmboaijfcaanepdipbgmipnccnpn";
const PASSWORD = "a correct horse battery staple";
const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j1ioAAAAASUVORK5CYII=";
let db: Database;
let app: ReturnType<typeof createApp>;
let sequence = 0;
type TestResponse = Omit<Response, "json"> & { json(): Promise<any> };
beforeEach(() => { db = openDb(":memory:"); app = createApp(db); });
afterEach(() => db.close());

async function request(path: string, method = "GET", data?: unknown, credential?: string, origin: string | null = ORIGIN) {
  const headers = new Headers();
  if (origin) headers.set("origin", origin);
  if (credential) headers.set(credential.startsWith("Bearer ") ? "authorization" : "cookie", credential);
  if (data !== undefined) headers.set("content-type", "application/json");
  return await app.request(`${ORIGIN}/api${path}`, { method, headers, body: data === undefined ? undefined : JSON.stringify(data) }) as TestResponse;
}
async function register(email = `person${++sequence}@example.com`) {
  const response = await request("/auth/register", "POST", { email, name: "Person", password: PASSWORD });
  expect(response.status).toBe(201);
  const body = await response.json();
  return { ...body, email, cookie: response.headers.get("set-cookie")!.split(";")[0]!, response };
}
async function connect(cookie: string) {
  const pairing = await (await request("/pairing", "POST", {}, cookie)).json();
  const response = await request("/pairing/claim", "POST", { code: pairing.code, name: "Test browser" }, undefined, EXTENSION);
  expect(response.status).toBe(201);
  const body = await response.json();
  return { ...body, bearer: `Bearer ${body.token}`, code: pairing.code };
}
async function capture(credential: string, extra: Record<string, unknown> = {}) {
  return request("/captures", "POST", { clientId: crypto.randomUUID(), type: "note", noteText: "Private note", ...extra }, credential);
}
function heldUpload(cookie: string, target = app) {
  let controller!: ReadableStreamDefaultController<Uint8Array>;
  let cancelled = false;
  const signal = new AbortController();
  const body = new ReadableStream<Uint8Array>({
    start(value) { controller = value; controller.enqueue(new TextEncoder().encode('{"noteText":"')); },
    cancel() { cancelled = true; },
  });
  const response = target.request(`${ORIGIN}/api/captures`, { method: "POST", headers: { origin: ORIGIN, cookie, "content-type": "application/json" }, body, signal: signal.signal });
  return { response, signal, controller, isCancelled: () => cancelled, close() { try { controller.close(); } catch {} } };
}

describe("customer account security", () => {
  test("register hashes secrets, sets a protected cookie and persists a private account", async () => {
    const a = await register("Case@EXAMPLE.COM");
    expect(a.account.email).toBe("case@example.com");
    expect(a.recoveryCode.length).toBeGreaterThanOrEqual(32);
    expect(a.response.headers.get("set-cookie")).toContain("HttpOnly");
    expect(a.response.headers.get("set-cookie")).toContain("SameSite=Lax");
    if (ORIGIN.startsWith("https:")) expect(a.response.headers.get("set-cookie")).toContain("Secure");
    const stored = db.query("SELECT * FROM customer_accounts").get() as any;
    expect(stored.password_hash).toStartWith("$argon2id$");
    expect(JSON.stringify(stored)).not.toContain(a.recoveryCode);
    const me = await (await request("/me", "GET", undefined, a.cookie)).json();
    expect(me.account).toEqual(a.account);
    expect(me.usage).toEqual({ captures: 0, bytes: 0, maxCaptures: 1000, maxBytes: 209715200 });
    expect(JSON.stringify(me)).not.toContain("hash");
    expect((await request("/me")).status).toBe(401);
  });

  test("login, logout, expired sessions and recovery revoke the right credentials", async () => {
    const a = await register();
    const device = await connect(a.cookie);
    expect((await request("/auth/login", "POST", { email: a.email, password: "wrong password here" })).status).toBe(401);
    const login = await request("/auth/login", "POST", { email: a.email, password: PASSWORD });
    expect(login.status).toBe(200);
    const secondCookie = login.headers.get("set-cookie")!.split(";")[0]!;
    expect((await request("/auth/logout", "POST", {}, secondCookie)).status).toBe(200);
    expect((await request("/me", "GET", undefined, secondCookie)).status).toBe(401);
    const recovered = await request("/auth/recover", "POST", { email: a.email, recoveryCode: a.recoveryCode, password: "new secure password here" });
    expect(recovered.status).toBe(200);
    const recovery = await recovered.json();
    expect(recovery.recoveryCode).not.toBe(a.recoveryCode);
    expect((await request("/me", "GET", undefined, a.cookie)).status).toBe(401);
    expect((await request("/me", "GET", undefined, device.bearer)).status).toBe(401);
    expect((await request("/auth/recover", "POST", { email: a.email, recoveryCode: a.recoveryCode, password: PASSWORD })).status).toBe(401);
    db.query("UPDATE customer_sessions SET expires_at = 0").run();
    expect((await request("/me", "GET", undefined, recovered.headers.get("set-cookie")!.split(";")[0]!)).status).toBe(401);
  });

  test("rejects CSRF, missing origins and unsafe extension origins", async () => {
    const a = await register();
    for (const origin of ["https://evil.example", null, "null", `${ORIGIN}.evil.example`]) {
      expect((await request("/auth/login", "POST", { email: a.email, password: PASSWORD }, undefined, origin)).status).toBe(403);
      expect((await request("/captures", "POST", { type: "note", clientId: "csrf" }, a.cookie, origin)).status).toBe(403);
    }
    const device = await connect(a.cookie);
    expect((await request("/captures", "POST", { clientId: "ext", type: "note" }, device.bearer, EXTENSION)).status).toBe(201);
    expect((await request("/captures", "POST", { clientId: "evil", type: "note" }, device.bearer, "chrome-extension://other")).status).toBe(403);
    expect((await request("/captures", "OPTIONS", undefined, undefined, "https://evil.example")).headers.get("access-control-allow-origin")).toBeNull();
  });

  test("pairing is one use, expiring and cookie-only; owner can revoke devices", async () => {
    const a = await register();
    const b = await register();
    const device = await connect(a.cookie);
    expect((await request("/pairing/claim", "POST", { code: device.code, name: "Reuse" }, undefined, EXTENSION)).status).toBe(401);
    expect((await request("/pairing", "POST", {}, device.bearer)).status).toBe(403);
    expect((await request(`/connections/${device.connection.id}`, "DELETE", {}, b.cookie)).status).toBe(404);
    const pair = await (await request("/pairing", "POST", {}, a.cookie)).json();
    db.query("UPDATE customer_pairings SET expires_at = 0").run();
    expect((await request("/pairing/claim", "POST", { code: pair.code, name: "Expired" }, undefined, EXTENSION)).status).toBe(401);
    expect((await request(`/connections/${device.connection.id}`, "DELETE", {}, a.cookie)).status).toBe(200);
    expect((await request("/me", "GET", undefined, device.bearer)).status).toBe(401);
  });

  test("changing password keeps current session, revokes other access, and deleting removes all owned data", async () => {
    const a = await register();
    const b = await register();
    const device = await connect(a.cookie);
    await capture(a.cookie);
    await capture(b.cookie);
    const login = await request("/auth/login", "POST", { email: a.email, password: PASSWORD });
    const otherCookie = login.headers.get("set-cookie")!.split(";")[0]!;
    const change = await request("/auth/password", "POST", { currentPassword: PASSWORD, password: "replacement password 123" }, a.cookie);
    expect(change.status).toBe(200);
    expect((await change.json()).recoveryCode).toBeTruthy();
    expect((await request("/me", "GET", undefined, a.cookie)).status).toBe(200);
    expect((await request("/me", "GET", undefined, otherCookie)).status).toBe(401);
    expect((await request("/me", "GET", undefined, device.bearer)).status).toBe(401);
    expect((await request("/account", "DELETE", { password: PASSWORD }, a.cookie)).status).toBe(401);
    expect((await request("/account", "DELETE", { password: "replacement password 123" }, a.cookie)).status).toBe(200);
    expect((await request("/me", "GET", undefined, a.cookie)).status).toBe(401);
    expect((db.query("SELECT COUNT(*) n FROM customer_captures").get() as any).n).toBe(1);
    expect((await request("/me", "GET", undefined, b.cookie)).status).toBe(200);
  });

  test("bounds public auth attempts and validates passwords", async () => {
    expect((await request("/auth/register", "POST", { email: "ok@example.com", name: "A", password: "short" })).status).toBe(400);
    let response: Response;
    for (let i = 0; i < 22; i++) response = await request("/auth/login", "POST", { email: "missing@example.com", password: PASSWORD });
    expect(response!.status).toBe(429);
    expect(response!.headers.get("retry-after")).toBeTruthy();
  });

  test("parallel recovery cannot reuse a code or restore revoked browser access", async () => {
    const a = await register();
    const device = await connect(a.cookie);
    const attempts = await Promise.all([1, 2].map(() => request("/auth/recover", "POST", { email: a.email, recoveryCode: a.recoveryCode, password: "new password for recovery" })));
    expect(attempts.map((r) => r.status).sort()).toEqual([200, 401]);
    expect((await request("/me", "GET", undefined, device.bearer)).status).toBe(401);
    expect((db.query("SELECT COUNT(*) n FROM customer_sessions WHERE account_id = ?").get(a.account.id) as any).n).toBe(1);
  });

  test("expired connection credentials and credentials in URLs cannot authenticate", async () => {
    const a = await register();
    const device = await connect(a.cookie);
    expect((await request(`/me?token=${encodeURIComponent(device.token)}`)).status).toBe(401);
    db.query("UPDATE customer_connections SET expires_at = 0").run();
    expect((await request("/me", "GET", undefined, device.bearer)).status).toBe(401);
    expect((await (await request("/me", "GET", undefined, a.cookie)).json()).connections).toEqual([]);
  });

  test("an in-flight upload cannot save after its session is revoked", async () => {
    const a = await register();
    let controller!: ReadableStreamDefaultController<Uint8Array>;
    const stream = new ReadableStream<Uint8Array>({ start(value) { controller = value; } });
    const pending = app.request(`${ORIGIN}/api/captures`, {
      method: "POST", headers: { origin: ORIGIN, cookie: a.cookie, "content-type": "application/json" }, body: stream,
    });
    await request("/auth/logout", "POST", {}, a.cookie);
    controller.enqueue(new TextEncoder().encode(JSON.stringify({ clientId: "late-upload", type: "note", noteText: "Saved after logout?" })));
    controller.close();
    expect((await pending).status).toBe(401);
    expect((db.query("SELECT COUNT(*) n FROM customer_captures").get() as any).n).toBe(0);
  });

  test("browser disconnect revokes only its own bearer and rejects cookie authority", async () => {
    const a = await register();
    const first = await connect(a.cookie);
    const second = await connect(a.cookie);
    expect((await request("/connections/disconnect", "POST", {}, a.cookie)).status).toBe(403);
    const response = await request("/connections/disconnect", "POST", { id: second.connection.id }, first.bearer, EXTENSION);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect((await request("/me", "GET", undefined, first.bearer)).status).toBe(401);
    expect((await request("/connections/disconnect", "POST", {}, first.bearer, EXTENSION)).status).toBe(401);
    expect((await request("/me", "GET", undefined, second.bearer)).status).toBe(200);
    expect((await request("/me", "GET", undefined, a.cookie)).status).toBe(200);
  });

  test("browser disconnect prevents an in-flight upload from committing afterwards", async () => {
    const a = await register();
    const browser = await connect(a.cookie);
    let controller!: ReadableStreamDefaultController<Uint8Array>;
    const stream = new ReadableStream<Uint8Array>({ start(value) { controller = value; } });
    const pending = app.request(`${ORIGIN}/api/captures`, {
      method: "POST", headers: { origin: EXTENSION, authorization: browser.bearer, "content-type": "application/json" }, body: stream,
    });
    expect((await request("/connections/disconnect", "POST", undefined, browser.bearer, EXTENSION)).status).toBe(200);
    controller.enqueue(new TextEncoder().encode(JSON.stringify({ clientId: "late-browser-upload", type: "note" })));
    controller.close();
    expect((await pending).status).toBe(401);
    expect((db.query("SELECT COUNT(*) n FROM customer_captures").get() as any).n).toBe(0);
  });

  test("a stale dashboard account header rejects a changed cookie owner for reads, writes and logout", async () => {
    const a = await register();
    const b = await register();
    for (const [path, method, body] of [
      ["/me", "GET", undefined],
      ["/captures", "POST", JSON.stringify({ clientId: "wrong-account", type: "note", noteText: "Intended for A" })],
      ["/auth/logout", "POST", undefined],
    ] as const) {
      const response = await app.request(`${ORIGIN}/api${path}`, { method, headers: { origin: ORIGIN, cookie: b.cookie, "content-type": "application/json", "X-Atlas-Account": a.account.id }, body });
      expect(response.status).toBe(409);
      expect(await response.json()).toEqual({ error: "account_changed", message: "Your signed-in account changed. Reload Atlas to continue." });
    }
    expect((await request("/me", "GET", undefined, b.cookie)).status).toBe(200);
    expect((db.query("SELECT COUNT(*) n FROM customer_captures").get() as any).n).toBe(0);
    const own = await app.request(`${ORIGIN}/api/captures`, { method: "POST", headers: { origin: ORIGIN, cookie: b.cookie, "content-type": "application/json", "X-Atlas-Account": b.account.id }, body: JSON.stringify({ clientId: "correct-account", type: "note" }) });
    expect(own.status).toBe(201);
    const browser = await connect(b.cookie);
    const bearer = await app.request(`${ORIGIN}/api/me`, { headers: { authorization: browser.bearer, "X-Atlas-Account": a.account.id } });
    expect(bearer.status).toBe(200);
    expect((await bearer.json() as any).account.id).toBe(b.account.id);
    db.query("UPDATE customer_sessions SET expires_at=0 WHERE account_id=?").run(b.account.id);
    const expired = await app.request(`${ORIGIN}/api/auth/logout`, { method: "POST", headers: { origin: ORIGIN, cookie: b.cookie, "X-Atlas-Account": a.account.id } });
    expect(expired.status).toBe(200);
    expect(expired.headers.get("set-cookie")).toContain("Max-Age=0");
  });
});

describe("customer extension preferences", () => {
  const changed = {
    version: 1,
    capture: {
      region: false,
      fullPage: true,
      highlight: true,
      bookmark: true,
      image: false,
      tweet: true,
      note: true,
    },
    bookmark: { readableText: true, extendedMetadata: true, headings: false },
    notes: { attachSource: false },
    popup: {
      actionOrder: ["bookmark", "highlight", "fullPage", "region"],
      showRecent: true,
      recentCount: 5,
    },
    sync: { automatic: false },
    organization: { ocr: false, summaries: true, tags: false },
    feedback: { success: true },
    contextMenus: false,
  };

  test("preferences are customer-owned, validated, and shared with connected browsers", async () => {
    const owner = await register();
    const other = await register();
    const firstBrowser = await connect(owner.cookie);
    const secondBrowser = await connect(owner.cookie);

    const defaults = await (await request("/preferences", "GET", undefined, owner.cookie)).json();
    expect(defaults.revision).toBe(0);
    expect(defaults.preferences).toEqual({
      version: 1,
      capture: { region: true, fullPage: true, highlight: true, bookmark: true, image: true, tweet: true, note: true },
      bookmark: { readableText: true, extendedMetadata: true, headings: true },
      notes: { attachSource: true },
      popup: { actionOrder: ["bookmark", "highlight", "region", "fullPage"], showRecent: true, recentCount: 3 },
      sync: { automatic: true },
      organization: { ocr: true, summaries: true, tags: true },
      feedback: { success: true },
      contextMenus: true,
    });

    expect((await request("/preferences", "PUT", changed, firstBrowser.bearer, EXTENSION)).status).toBe(403);
    const unknown = await app.request(`${ORIGIN}/api/preferences`, {
      method: "PUT",
      headers: { origin: ORIGIN, cookie: owner.cookie, "content-type": "application/json", "X-Atlas-Account": owner.account.id },
      body: JSON.stringify({ ...changed, operatorOverride: true }),
    });
    expect(unknown.status).toBe(400);
    const invalid = await app.request(`${ORIGIN}/api/preferences`, {
      method: "PUT",
      headers: { origin: ORIGIN, cookie: owner.cookie, "content-type": "application/json", "X-Atlas-Account": owner.account.id },
      body: JSON.stringify({ ...changed, popup: { ...changed.popup, recentCount: 9 } }),
    });
    expect(invalid.status).toBe(400);

    const savedResponse = await app.request(`${ORIGIN}/api/preferences`, {
      method: "PUT",
      headers: { origin: ORIGIN, cookie: owner.cookie, "content-type": "application/json", "X-Atlas-Account": owner.account.id },
      body: JSON.stringify(changed),
    });
    expect(savedResponse.status).toBe(200);
    const saved = await savedResponse.json() as any;
    expect(saved.preferences).toEqual(changed);
    expect(saved.revision).toBe(1);
    expect(saved.updatedAt).toBeGreaterThan(0);
    const exported = await (await request("/account/export", "GET", undefined, owner.cookie)).json() as any;
    expect(exported.preferences).toEqual(changed);

    for (const browser of [firstBrowser, secondBrowser]) {
      const shared = await (await request("/preferences", "GET", undefined, browser.bearer, EXTENSION)).json();
      expect(shared.preferences).toEqual(changed);
      expect(shared.revision).toBe(1);
    }
    const isolated = await (await request("/preferences", "GET", undefined, other.cookie)).json();
    expect(isolated.preferences.capture.region).toBe(true);
    expect(isolated.revision).toBe(0);
  });
});

describe("private customer captures", () => {
  test("preserves bounded provenance and processing choices without trusting unsafe origins", async () => {
    const owner = await register();
    const other = await register();
    const provenance = {
      schemaVersion: 1,
      captureMethod: "popup-save-page",
      pageUrl: "https://visited.example/story?from=feed",
      canonicalUrl: "https://visited.example/story",
      pageTitle: "A useful article",
      siteName: "The Example",
      description: "A precise description.",
      authors: ["Mina Rao", "Eli Stone"],
      publishedAt: "2026-08-14T09:30:00.000Z",
      modifiedAt: "2026-08-15T11:00:00.000Z",
      language: "en",
      leadImageUrl: "https://visited.example/media/lead.jpg",
      faviconUrl: "https://visited.example/favicon.ico",
      targetUrl: null,
      headings: ["The first section", "What changed"],
      capturedAt: 1_786_013_400_000,
      extractedAt: 1_786_013_400_123,
      extractorVersion: 1,
      contentHash: "a".repeat(43),
      extractionStatus: "complete",
      extractionError: null,
    };
    const processingOptions = { ocr: false, summaries: true, tags: false };
    const response = await capture(owner.cookie, {
      clientId: "rich-bookmark",
      type: "bookmark",
      sourceUrl: provenance.pageUrl,
      sourceTitle: provenance.pageTitle,
      articleText: "Readable body text from the saved article.",
      capturedAt: provenance.capturedAt,
      provenance,
      processingOptions,
    });
    expect(response.status).toBe(201);
    const saved = (await response.json()).capture;
    expect(saved.provenance).toEqual(provenance);
    expect(saved.processingOptions).toEqual(processingOptions);
    expect(saved.articleText).toContain("Readable body text");
    expect((await request(`/captures/${saved.id}`, "GET", undefined, other.cookie)).status).toBe(404);
    const exported = await (await request("/account/export", "GET", undefined, owner.cookie)).json();
    expect(exported.captures[0].provenance).toEqual(provenance);
    const stored = db.query("SELECT storage_bytes,provenance_json,processing_options_json FROM customer_captures WHERE id=?").get(saved.id) as any;
    expect(stored.provenance_json).toBe(JSON.stringify(provenance));
    expect(stored.processing_options_json).toBe(JSON.stringify(processingOptions));
    expect(stored.storage_bytes).toBeGreaterThan(Buffer.byteLength("Readable body text from the saved article.", "utf8"));

    for (const invalid of [
      { ...provenance, canonicalUrl: "javascript:alert(1)" },
      { ...provenance, pageUrl: "https://name:secret@visited.example/story" },
      { ...provenance, authors: Array(9).fill("Writer") },
      { ...provenance, headings: Array(21).fill("Heading") },
      { ...provenance, publishedAt: "last Thursday" },
      { ...provenance, contentHash: "not-a-hash" },
      { ...provenance, unexpected: "field" },
    ]) {
      expect((await capture(owner.cookie, { type: "bookmark", provenance: invalid })).status).toBe(400);
    }
    expect((await capture(owner.cookie, { processingOptions: { ocr: true, summaries: true, tags: true, execute: true } })).status).toBe(400);
  });

  test("only two uploads per account can retain request bodies, with slots released after invalid bodies", async () => {
    const a = await register();
    const held = [heldUpload(a.cookie), heldUpload(a.cookie)];
    try {
      const response = await capture(a.cookie);
      expect(response.status).toBe(429);
      expect(Number(response.headers.get("retry-after"))).toBeLessThanOrEqual(5);
    } finally { held.forEach((value) => value.close()); await Promise.all(held.map((value) => value.response)); }
    expect((await capture(a.cookie, { type: "invalid" })).status).toBe(400);
    expect((await capture(a.cookie)).status).toBe(201);
  });

  test("eight retained upload bodies exhaust the process-wide limit across app instances and accounts", async () => {
    const owners = [];
    for (let index = 0; index < 5; index++) owners.push(await register());
    const held = owners.slice(0,4).flatMap((owner) => [heldUpload(owner.cookie), heldUpload(owner.cookie)]);
    try {
      const response = await createApp(db).request(`${ORIGIN}/api/captures`, { method: "POST", headers: { origin: ORIGIN, cookie: owners[4].cookie, "content-type": "application/json" }, body: JSON.stringify({ clientId: "extra-process-upload", type: "note" }) });
      expect(response.status).toBe(503);
      expect(Number(response.headers.get("retry-after"))).toBeLessThanOrEqual(5);
      held[0]!.close();
      await held[0]!.response;
      expect((await capture(owners[4].cookie)).status).toBe(201);
    } finally { held.forEach((value) => value.close()); await Promise.all(held.map((value) => value.response)); }
  });

  test("an aborted streamed upload releases its slot without saving partial data", async () => {
    const a = await register();
    const held = [heldUpload(a.cookie), heldUpload(a.cookie)];
    try {
      held[0]!.signal.abort();
      expect((await held[0]!.response).status).toBe(400);
      expect(held[0]!.isCancelled()).toBe(true);
      expect((await capture(a.cookie)).status).toBe(201);
      expect((db.query("SELECT COUNT(*) n FROM customer_captures").get() as any).n).toBe(1);
    } finally { held.forEach((value) => value.close()); await Promise.all(held.map((value) => value.response)); }
  });

  test("a slow body has an absolute thirty-second deadline even when another chunk arrives", async () => {
    const a = await register();
    const held = heldUpload(a.cookie);
    const extra = setTimeout(() => held.controller.enqueue(new TextEncoder().encode("still sending")), 15_000);
    const started = performance.now();
    try {
      const response = await held.response;
      expect(response.status).toBe(503);
      expect(response.headers.get("retry-after")).toBe("3");
      expect(performance.now() - started).toBeLessThan(34_000);
      expect(held.isCancelled()).toBe(true);
      expect((await capture(a.cookie)).status).toBe(201);
    } finally { clearTimeout(extra); held.close(); await held.response; }
  }, 35_000);

  test("tenant-scopes list, search, detail, blobs, delete, exports and ignores submitted ownership/enrichment", async () => {
    const a = await register();
    const b = await register();
    const device = await connect(a.cookie);
    const saved = await capture(device.bearer, { dataUrl: PNG, accountId: b.account.id, status: "done", summary: "injected", noteText: "Secret keyword" });
    expect(saved.status).toBe(201);
    const item = (await saved.json()).capture;
    expect(item.status).toBe("pending");
    expect(item.summary).toBeNull();
    expect(item.blobUrl).toBe(`/api/captures/${item.id}/blob`);
    expect(JSON.stringify(item)).not.toContain("base64");
    for (const path of ["/captures", "/captures?q=keyword", "/account/export"]) {
      const result = await (await request(path, "GET", undefined, b.cookie)).json();
      expect(result.captures).toEqual([]);
    }
    for (const path of [`/captures/${item.id}`, `/captures/${item.id}/blob`]) expect((await request(path, "GET", undefined, b.cookie)).status).toBe(404);
    expect((await request(`/captures/${item.id}`, "DELETE", {}, b.cookie)).status).toBe(404);
    const blob = await request(`/captures/${item.id}/blob`, "GET", undefined, device.bearer);
    expect(blob.status).toBe(200);
    expect(blob.headers.get("content-type")).toBe("image/png");
    expect(blob.headers.get("cache-control")).toContain("no-store");
    expect(blob.headers.get("x-content-type-options")).toBe("nosniff");
    const exported = await (await request("/account/export", "GET", undefined, a.cookie)).json();
    expect(exported.captures[0].dataUrl).toBe(PNG);
    expect((await app.request(`${ORIGIN}/v1/captures`, { headers: { authorization: device.bearer } })).status).toBe(401);
    expect((db.query("SELECT COUNT(*) n FROM captures").get() as any).n).toBe(0);
    expect((await request(`/captures/${item.id}`, "DELETE", {}, a.cookie)).status).toBe(200);
    expect((await request(`/captures/${item.id}/blob`, "GET", undefined, a.cookie)).status).toBe(404);
  });

  test("upload idempotency is per account and pagination/search are stable", async () => {
    const a = await register();
    const b = await register();
    const first = await (await capture(a.cookie, { clientId: "same", capturedAt: 1000, noteText: "Alpha" })).json();
    const duplicate = await (await capture(a.cookie, { clientId: "same", noteText: "Overwrite" })).json();
    expect(duplicate.duplicate).toBe(true);
    expect(duplicate.capture.id).toBe(first.capture.id);
    expect(duplicate.capture.noteText).toBe("Alpha");
    const separate = await (await capture(b.cookie, { clientId: "same" })).json();
    expect(separate.capture.id).not.toBe(first.capture.id);
    await capture(a.cookie, { clientId: "second", capturedAt: 2000, noteText: "Beta" });
    const page = await (await request("/captures?limit=1", "GET", undefined, a.cookie)).json();
    expect(page.captures[0].clientId).toBe("second");
    expect(page.total).toBe(2);
    const next = await (await request(`/captures?limit=1&cursor=${encodeURIComponent(page.nextCursor)}`, "GET", undefined, a.cookie)).json();
    expect(next.captures[0].id).toBe(first.capture.id);
    expect(next.nextCursor).toBeNull();
    const search = await (await request("/captures?q=Alpha&type=note", "GET", undefined, a.cookie)).json();
    expect(search.captures.map((x: any) => x.id)).toEqual([first.capture.id]);
    expect((await request("/captures?cursor=garbage", "GET", undefined, a.cookie)).status).toBe(400);
  });

  test("validates content and images, bounds bodies, and enforces account quotas atomically", async () => {
    const a = await register();
    for (const invalid of [
      { type: "script" }, { sourceUrl: "javascript:alert(1)" },
      { noteText: "a".repeat(50001) }, { selectionText: "a".repeat(50001) }, { articleText: "a".repeat(100001) },
      { dataUrl: "data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=" }, { dataUrl: "data:image/png;base64,PHNjcmlwdD4=" },
      { dataUrl: PNG.replace("image/png", "image/jpeg") }, { capturedAt: "yesterday" },
    ]) expect((await capture(a.cookie, invalid)).status).toBe(400);
    expect((await capture(a.cookie, { dataUrl: "data:image/png;base64," + Buffer.alloc(8 * 1024 * 1024 + 1).toString("base64") })).status).toBe(413);
    const large = await app.request(`${ORIGIN}/api/captures`, { method: "POST", headers: { origin: ORIGIN, cookie: a.cookie, "content-type": "application/json", "content-length": "20000000" }, body: "{}" });
    expect(large.status).toBe(413);
    const first = await (await capture(a.cookie, { clientId: "original" })).json();
    db.query("UPDATE customer_captures SET storage_bytes = 209715200 WHERE id = ?").run(first.capture.id);
    expect((await capture(a.cookie)).status).toBe(409);
    expect((await (await capture(a.cookie, { clientId: "original" })).json()).duplicate).toBe(true);
    await request(`/captures/${first.capture.id}`, "DELETE", {}, a.cookie);
    expect((await capture(a.cookie)).status).toBe(201);
  });

  test("bounds image dimensions from the encoded bytes rather than trusting caller dimensions", async () => {
    const a = await register();
    const data = Buffer.from(PNG.split(",")[1]!, "base64");
    data.writeUInt32BE(100_000, 16);
    expect((await capture(a.cookie, { dataUrl: `data:image/png;base64,${data.toString("base64")}`, width: 1, height: 1 })).status).toBe(400);
    const valid = await (await capture(a.cookie, { dataUrl: PNG, width: 200, height: 200 })).json();
    expect(valid.capture.width).toBe(1);
    expect(valid.capture.height).toBe(1);
  });

  test("a full 1000 capture export completes and concurrent last-slot uploads obey quota", async () => {
    const a = await register();
    db.transaction(() => {
      const insert = db.query("INSERT INTO customer_captures(id,account_id,client_id,type,storage_bytes,captured_at,created_at,updated_at) VALUES(?,?,?,'note',1,1,1,1)");
      for (let i = 0; i < 999; i++) insert.run(`seed-${i}`, a.account.id, `seed-${i}`);
    })();
    const attempts = await Promise.all([capture(a.cookie), capture(a.cookie)]);
    expect(attempts.map((r) => r.status).sort()).toEqual([201, 409]);
    const exported = await (await request("/account/export", "GET", undefined, a.cookie)).json();
    expect(exported.captures.length).toBe(1000);
  });

  test("global storage ceiling rejects a new owner without blocking deletion or duplicate retries", async () => {
    const a = await register();
    const b = await register();
    const item = (await (await capture(a.cookie, { clientId: "global" })).json()).capture;
    db.query("UPDATE customer_captures SET storage_bytes = 2147483648 WHERE id = ?").run(item.id);
    expect((await capture(b.cookie)).status).toBe(503);
    expect((await (await capture(a.cookie, { clientId: "global" })).json()).duplicate).toBe(true);
    expect((await request(`/captures/${item.id}`, "DELETE", {}, a.cookie)).status).toBe(200);
    expect((await capture(b.cookie)).status).toBe(201);
  });

  test("chunked requests cannot evade the body limit and API errors remain JSON", async () => {
    const a = await register();
    const chunk = new Uint8Array(1024 * 1024);
    const stream = new ReadableStream<Uint8Array>({ start(controller) {
      for (let i = 0; i < 13; i++) controller.enqueue(chunk);
      controller.close();
    } });
    const response = await app.request(`${ORIGIN}/api/captures`, {
      method: "POST", headers: { origin: ORIGIN, cookie: a.cookie, "content-type": "application/json" }, body: stream,
    });
    expect(response.status).toBe(413);
    const unknown = await request("/no-such-route");
    expect(unknown.status).toBe(404);
    expect((await unknown.json()).message).toBeTruthy();
  });
});
