import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import type { Database } from "bun:sqlite";
import { openDb } from "../src/db.ts";
import { createApp } from "../src/app.ts";
import { processCustomerQueue } from "../src/customer-enrichment.ts";

const ORIGIN = "https://foundkeep.app";
const PASSWORD = "a correct horse battery staple";
let db: Database;
let app: ReturnType<typeof createApp>;
beforeEach(() => { db = openDb(":memory:"); app = createApp(db); });
afterEach(() => db.close());
async function request(path: string, method = "GET", body?: unknown, token?: string) {
  return app.request(`${ORIGIN}/api${path}`, {
    method, headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...(body !== undefined ? { "content-type": "application/json" } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  }) as Promise<Omit<Response, "json"> & { json(): Promise<any> }>;
}
async function owner() {
  const response = await request("/mobile/register", "POST", { email: `${crypto.randomUUID()}@example.com`, name: "Owner", password: PASSWORD });
  expect(response.status).toBe(201);
  return response.json();
}
async function folder(token: string, name = "Reading") {
  const response = await request("/mobile/folders", "POST", { name }, token);
  expect([200, 201]).toContain(response.status);
  return (await response.json()).folder;
}
async function save(token: string, extra: Record<string, unknown> = {}) {
  const response = await request("/captures", "POST", { clientId: crypto.randomUUID(), type: "note", noteText: "Saved content", ...extra }, token);
  expect(response.status).toBe(201);
  return (await response.json()).capture;
}
async function edit(token: string, capture: any, extra: Record<string, unknown>) {
  return request(`/mobile/captures/${capture.id}`, "PUT", {
    sourceTitle: capture.sourceTitle, noteText: capture.noteText, expectedUpdatedAt: capture.updatedAt, ...extra,
  }, token);
}

describe("customer folders and personal tags", () => {
  test("organization suggestions stay virtual and folders are owner-scoped and case-insensitively idempotent", async () => {
    const a = await owner();
    const b = await owner();
    expect((await request("/mobile/organization")).status).toBe(401);
    expect(await (await request("/mobile/organization", "GET", undefined, a.token)).json()).toEqual({
      folders: [], tags: [], suggestedTags: ["Read later", "Inspiration", "Work", "Personal"],
      suggestedFolders: ["Reading", "Projects", "Inspiration"],
    });
    const first = await folder(a.token, "  École  ");
    expect(first).toEqual({ id: first.id, name: "École", count: 0 });
    expect(await folder(a.token, "éCOLE")).toEqual(first);
    const separate = await folder(b.token, "École");
    expect(separate.id).not.toBe(first.id);
    const attempts = await Promise.all([folder(a.token, "Projects"), folder(a.token, "projects")]);
    expect(attempts[0].id).toBe(attempts[1].id);
    expect((await (await request("/mobile/organization", "GET", undefined, a.token)).json()).folders).toHaveLength(2);
    expect((await (await request("/mobile/organization", "GET", undefined, b.token)).json()).folders).toEqual([separate]);
  });

  test("folder and tag validation bounds account metadata without creating partial captures", async () => {
    const a = await owner();
    for (const name of ["", "   ", "a".repeat(81), "bad\nname", 1, null]) {
      expect((await request("/mobile/folders", "POST", { name }, a.token)).status).toBe(400);
    }
    for (const userTags of [null, "Work", [1], [""], ["  "], ["a".repeat(41)], Array(21).fill("tag"), ["bad\ntag"]]) {
      expect((await request("/captures", "POST", { clientId: crypto.randomUUID(), type: "note", userTags }, a.token)).status).toBe(400);
    }
    const b = await owner();
    const foreign = await folder(b.token);
    expect((await request("/captures", "POST", { clientId: "foreign", type: "note", folderId: foreign.id }, a.token)).status).toBe(404);
    expect((await request("/captures", "POST", { clientId: "invalid", type: "note", folderId: "../bad" }, a.token)).status).toBe(400);
    expect((db.query("SELECT COUNT(*) n FROM customer_captures").get() as any).n).toBe(0);
    for (let index = 0; index < 100; index++) await folder(a.token, `Folder ${index}`);
    const full = await request("/mobile/folders", "POST", { name: "Overflow" }, a.token);
    expect(full.status).toBe(409);
    expect((await full.json()).error).toBe("folder_limit");
    expect((await folder(a.token, "Folder 0")).name).toBe("Folder 0");
  });

  test("capture upload and edit persist personal organization separately from derived tags", async () => {
    const a = await owner();
    const reading = await folder(a.token);
    const saved = await save(a.token, { folderId: reading.id, userTags: ["  Work ", "work", "École", "éCOLE"], processingOptions: { ocr: false, summaries: false, tags: true } });
    expect(saved).toMatchObject({ folderId: reading.id, folder: { id: reading.id, name: "Reading" }, userTags: ["Work", "École"], tags: [] });
    await processCustomerQueue(db);
    const enriched = (await (await request(`/mobile/captures/${saved.id}`, "GET", undefined, a.token)).json()).capture;
    expect(enriched.userTags).toEqual(["Work", "École"]);
    expect(enriched.tags).toContain("saved");
    const renamed = await edit(a.token, enriched, { sourceTitle: "Personal title" });
    expect(renamed.status).toBe(200);
    const current = (await renamed.json()).capture;
    expect(current.userTags).toEqual(["Work", "École"]);
    expect(current.folderId).toBe(reading.id);
    const cleared = await edit(a.token, current, { folderId: null, userTags: [] });
    expect(cleared.status).toBe(200);
    expect((await cleared.json()).capture).toMatchObject({ folder: null, folderId: null, userTags: [], tags: enriched.tags });
    const stale = await edit(a.token, current, { folderId: reading.id, userTags: ["Stale"] });
    expect(stale.status).toBe(409);
    expect((await stale.json()).error).toBe("capture_changed");
  });

  test("file uploads save organization atomically and retries keep the original assignment", async () => {
    const a = await owner();
    const b = await owner();
    const reading = await folder(a.token);
    const foreign = await folder(b.token);
    const pdf = Buffer.from("%PDF-1.7\n1 0 obj\n<<>>\nendobj\n%%EOF\n");
    const metadata = { clientId: "organized-file", type: "document", fileName: "reading.pdf", folderId: reading.id, userTags: ["Work"] };
    const upload = (extra: Record<string, unknown> = {}) => app.request(`${ORIGIN}/api/mobile/captures/file`, {
      method: "POST", headers: { authorization: `Bearer ${a.token}`, "content-type": "application/pdf", "content-length": String(pdf.length), "x-foundkeep-capture": Buffer.from(JSON.stringify({ ...metadata, ...extra })).toString("base64url") }, body: pdf,
    });
    const rejected = await upload({ clientId: "foreign-file", folderId: foreign.id });
    expect(rejected.status).toBe(404);
    expect((db.query("SELECT COUNT(*) n FROM customer_captures").get() as any).n).toBe(0);
    const response = await upload();
    expect(response.status).toBe(201);
    const saved = (await response.json() as any).capture;
    expect(saved).toMatchObject({ folderId: reading.id, folder: { id: reading.id, name: reading.name }, userTags: ["Work"] });
    const retry = await upload({ folderId: null, userTags: ["Different"] });
    expect(retry.status).toBe(200);
    expect((await retry.json() as any).capture).toEqual(saved);
    expect((await request(`/mobile/captures/${saved.id}/file`, "GET", undefined, a.token)).status).toBe(200);
    expect((await request(`/mobile/captures/${saved.id}`, "DELETE", undefined, a.token)).status).toBe(200);
  });

  test("organization counts and exact tag/folder filters combine with account scope, batch search and cursor", async () => {
    const a = await owner();
    const b = await owner();
    const reading = await folder(a.token);
    const batchId = crypto.randomUUID();
    for (let index = 0; index < 51; index++) await save(a.token, { folderId: reading.id, userTags: ["Work", "École"], batchId, noteText: "Needle", capturedAt: 1000 });
    const derived = await save(a.token, { folderId: reading.id, noteText: "Needle", batchId, capturedAt: 1000 });
    db.query("UPDATE customer_captures SET tags='[\"work\"]' WHERE id=?").run(derived.id);
    const unfiled = await save(a.token, { userTags: ["Workplace"], noteText: "Needle" });
    await save(b.token, { userTags: ["Work"], noteText: "Needle", batchId });
    const query = `/mobile/captures?folderId=${reading.id}&tag=WORK&batchId=${batchId}&q=needle&type=note&view=cards`;
    const first = await (await request(query, "GET", undefined, a.token)).json();
    expect(first.total).toBe(52);
    expect(first.captures).toHaveLength(50);
    const second = await (await request(`${query}&cursor=${first.nextCursor}`, "GET", undefined, a.token)).json();
    expect(second.total).toBe(52);
    expect(second.captures).toHaveLength(2);
    expect(second.nextCursor).toBeNull();
    expect(new Set([...first.captures, ...second.captures].map(item => item.id)).size).toBe(52);
    expect((await (await request("/mobile/captures?tag=%C3%A9COLE", "GET", undefined, a.token)).json()).total).toBe(51);
    expect((await (await request("/mobile/captures?q=Workplace", "GET", undefined, a.token)).json()).captures.map((item: any) => item.id)).toEqual([unfiled.id]);
    expect((await (await request("/mobile/captures?folderId=unfiled", "GET", undefined, a.token)).json()).captures.map((item: any) => item.id)).toEqual([unfiled.id]);
    expect((await request(`/mobile/captures?folderId=${reading.id}`, "GET", undefined, b.token)).status).toBe(404);
    const organization = await (await request("/mobile/organization", "GET", undefined, a.token)).json();
    expect(organization.folders).toEqual([{ ...reading, count: 52 }]);
    expect(organization.tags).toEqual(expect.arrayContaining([{ name: "Work", count: 52 }, { name: "École", count: 51 }, { name: "Workplace", count: 1 }]));
  });

  test("renaming and deleting folders keep captures, advance revisions and reject foreign authority", async () => {
    const a = await owner();
    const b = await owner();
    const reading = await folder(a.token);
    const occupied = await folder(a.token, "Work");
    const saved = await save(a.token, { folderId: reading.id, userTags: ["Keep"] });
    const bytes = (db.query("SELECT storage_bytes FROM customer_captures WHERE id=?").get(saved.id) as any).storage_bytes;
    expect((await request(`/mobile/folders/${reading.id}`, "PUT", { name: "Foreign" }, b.token)).status).toBe(404);
    expect((await request(`/mobile/folders/${reading.id}`, "DELETE", undefined, b.token)).status).toBe(404);
    expect((await request(`/mobile/folders/${reading.id}`, "PUT", { name: occupied.name.toLowerCase() }, a.token)).status).toBe(409);
    const rename = await request(`/mobile/folders/${reading.id}`, "PUT", { name: "Books" }, a.token);
    expect(rename.status).toBe(200);
    expect((await rename.json()).folder).toEqual({ id: reading.id, name: "Books", count: 1 });
    const renamed = (await (await request(`/mobile/captures/${saved.id}`, "GET", undefined, a.token)).json()).capture;
    expect(renamed.folder).toEqual({ id: reading.id, name: "Books" });
    expect(renamed.updatedAt).toBeGreaterThan(saved.updatedAt);
    expect((await request(`/mobile/folders/${reading.id}`, "DELETE", undefined, a.token)).status).toBe(200);
    const unfiled = (await (await request(`/mobile/captures/${saved.id}`, "GET", undefined, a.token)).json()).capture;
    expect(unfiled.folder).toBeNull();
    expect(unfiled.folderId).toBeNull();
    expect(unfiled.userTags).toEqual(["Keep"]);
    expect(unfiled.updatedAt).toBeGreaterThan(renamed.updatedAt);
    expect((db.query("SELECT storage_bytes FROM customer_captures WHERE id=?").get(saved.id) as any).storage_bytes).toBe(bytes - 36);
    expect((await edit(a.token, renamed, { folderId: reading.id })).status).toBe(409);
    expect((await request("/mobile/account", "DELETE", { password: PASSWORD }, a.token)).status).toBe(200);
    expect((db.query("SELECT COUNT(*) n FROM customer_folders WHERE account_id=?").get(a.account.id) as any).n).toBe(0);
  });

  test("organization edits count UTF-8 bytes and preserve assignments on quota failure", async () => {
    const a = await owner();
    const b = await owner();
    const reading = await folder(a.token);
    const saved = await save(a.token);
    const other = await save(b.token);
    db.query("UPDATE customer_captures SET storage_bytes=209715200 WHERE id=?").run(saved.id);
    const full = await edit(a.token, saved, { folderId: reading.id, userTags: ["é"] });
    expect(full.status).toBe(409);
    expect((await full.json()).error).toBe("quota_exceeded");
    db.query("UPDATE customer_captures SET storage_bytes=209715158 WHERE id=?").run(saved.id);
    const exact = await edit(a.token, saved, { folderId: reading.id, userTags: ["é"] });
    expect(exact.status).toBe(200);
    const current = (await exact.json()).capture;
    expect((db.query("SELECT storage_bytes FROM customer_captures WHERE id=?").get(saved.id) as any).storage_bytes).toBe(209715200);
    db.query("UPDATE customer_captures SET storage_bytes=1937768448 WHERE id=?").run(other.id);
    const cleared = await edit(a.token, current, { folderId: null, userTags: [] });
    expect(cleared.status).toBe(200);
    const shrunk = (await cleared.json()).capture;
    db.query("UPDATE customer_captures SET storage_bytes=1937768490 WHERE id=?").run(other.id);
    const globalFull = await edit(a.token, shrunk, { userTags: ["é"] });
    expect(globalFull.status).toBe(503);
    expect((await globalFull.json()).error).toBe("storage_unavailable");
  });

  test("folder deletion during an upload and logout during folder creation cannot commit stale organization", async () => {
    const a = await owner();
    const reading = await folder(a.token);
    let controller!: ReadableStreamDefaultController<Uint8Array>;
    const body = new ReadableStream<Uint8Array>({ start(value) { controller = value; } });
    const pending = app.request(`${ORIGIN}/api/captures`, { method: "POST", headers: { authorization: `Bearer ${a.token}`, "content-type": "application/json" }, body });
    expect((await request(`/mobile/folders/${reading.id}`, "DELETE", undefined, a.token)).status).toBe(200);
    controller.enqueue(new TextEncoder().encode(JSON.stringify({ clientId: "late-folder", type: "note", folderId: reading.id })));
    controller.close();
    expect((await pending).status).toBe(404);
    const folderBody = new ReadableStream<Uint8Array>({ start(value) { controller = value; } });
    const pendingFolder = app.request(`${ORIGIN}/api/mobile/folders`, { method: "POST", headers: { authorization: `Bearer ${a.token}`, "content-type": "application/json" }, body: folderBody });
    expect((await request("/mobile/logout", "POST", undefined, a.token)).status).toBe(200);
    controller.enqueue(new TextEncoder().encode(JSON.stringify({ name: "Revoked" })));
    controller.close();
    expect((await pendingFolder).status).toBe(401);
    expect((db.query("SELECT COUNT(*) n FROM customer_folders").get() as any).n).toBe(0);
  });
});
