import { expect, test } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Point the store at a throwaway dir BEFORE the modules that read config load.
process.env.ATLAS_DATA_DIR = mkdtempSync(join(tmpdir(), "atlas-test-"));

const { openDb } = await import("../src/db.ts");
const { createApp } = await import("../src/app.ts");
const { mintDevice } = await import("../src/devices.ts");

// Another test file may have imported config already. Always select this test's
// own DB explicitly so repeated runs cannot read an earlier run's captures.
const db = openDb(join(process.env.ATLAS_DATA_DIR!, "atlas.db"));
const app = createApp(db);
const full = mintDevice(db, {
  name: "test-all",
  kind: "test",
  scopes: ["ingest", "read", "enrich"],
}).token;
const readOnly = mintDevice(db, {
  name: "reader",
  kind: "test",
  scopes: ["read"],
}).token;

function call(
  method: string,
  path: string,
  opts: { token?: string; json?: unknown; body?: RequestInit['body'] } = {},
) {
  const headers = new Headers();
  if (opts.token) headers.set("authorization", `Bearer ${opts.token}`);
  let body = opts.body;
  if (opts.json !== undefined) {
    headers.set("content-type", "application/json");
    body = JSON.stringify(opts.json);
  }
  return app.fetch(new Request(`http://x${path}`, { method, headers, body }));
}

test("rejects requests with no token", async () => {
  const res = await call("GET", "/v1/health");
  expect(res.status).toBe(401);
});

test("rejects query-string tokens", async () => {
  const res = await call("GET", `/v1/health?token=${encodeURIComponent(full)}`);
  expect(res.status).toBe(401);
});

test("health works with a valid token", async () => {
  const res = await call("GET", "/v1/health", { token: full });
  expect(res.status).toBe(200);
  expect(res.headers.get("strict-transport-security")).toBe("max-age=31536000");
  const body = await res.json() as Record<string, any>;
  expect(body.ok).toBe(true);
  expect(body.service).toBe("atlas");
});

test("mobile web links stay allowlisted and universal-link metadata requires the Apple team", async () => {
  const open = await call("GET", "/open?path=https://evil.example");
  expect(open.status).toBe(302);
  expect(open.headers.get("location")).toBe("/open.html?path=collection");
  const before = process.env.ATLAS_APPLE_TEAM_ID;
  delete process.env.ATLAS_APPLE_TEAM_ID;
  expect((await call("GET", "/.well-known/apple-app-site-association")).status).toBe(404);
  process.env.ATLAS_APPLE_TEAM_ID = "A1B2C3D4E5";
  const association = await call("GET", "/.well-known/apple-app-site-association");
  expect(association.status).toBe(200);
  expect(association.headers.get("content-type")).toContain("application/json");
  expect(await association.json()).toMatchObject({ applinks: { details: [{ appIDs: ["A1B2C3D4E5.app.foundkeep.ios"] }] } });
  if (before === undefined) delete process.env.ATLAS_APPLE_TEAM_ID;
  else process.env.ATLAS_APPLE_TEAM_ID = before;
});

test("scope is enforced — read-only token cannot ingest", async () => {
  const res = await call("POST", "/v1/captures", {
    token: readOnly,
    json: { type: "note", noteText: "nope" },
  });
  expect(res.status).toBe(403);
});

test("ingest a note, then list it back", async () => {
  const created = await call("POST", "/v1/captures", {
    token: full,
    json: { type: "note", noteText: "buy oat milk", sourceTitle: "errand" },
  });
  expect(created.status).toBe(201);
  const capture = await created.json() as Record<string, any>;
  expect(capture.type).toBe("note");
  expect(capture.status).toBe("pending");

  const list = await call("GET", "/v1/captures?type=note", { token: full });
  const body = await list.json() as Record<string, any>;
  expect(body.captures.some((x: { id: string }) => x.id === capture.id)).toBe(true);
});

test("FTS search finds a highlight by content", async () => {
  await call("POST", "/v1/captures", {
    token: full,
    json: {
      type: "highlight",
      selectionText: "the mitochondria is the powerhouse of the cell",
      sourceUrl: "https://bio.example/cell",
    },
  });
  const res = await call("GET", "/v1/captures?q=mitochondria", { token: full });
  const body = await res.json() as Record<string, any>;
  expect(body.captures.length).toBeGreaterThan(0);
  expect(body.captures[0].selectionText).toContain("mitochondria");
});

test("multipart image capture stores and serves a blob", async () => {
  // 1x1 PNG
  const png = Uint8Array.from(
    atob(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQBM2nvOAAAAAElFTkSuQmCC",
    ),
    (ch) => ch.charCodeAt(0),
  );
  const fd = new FormData();
  fd.set("meta", JSON.stringify({ type: "image", sourceTitle: "dot" }));
  fd.set("blob", new File([png], "dot.png", { type: "image/png" }));
  const created = await call("POST", "/v1/captures", { token: full, body: fd });
  expect(created.status).toBe(201);
  const capture = await created.json() as Record<string, any>;
  expect(capture.hasBlob).toBe(true);

  const blob = await call("GET", `/v1/captures/${capture.id}/blob`, {
    token: full,
  });
  expect(blob.status).toBe(200);
  expect(blob.headers.get("content-type")).toBe("image/png");
  expect(blob.headers.get("content-security-policy")).toContain("sandbox");
  expect(blob.headers.get("cross-origin-resource-policy")).toBe("same-origin");
  expect(blob.headers.get("x-content-type-options")).toBe("nosniff");
  expect((await blob.arrayBuffer()).byteLength).toBe(png.byteLength);
});

test("rejects executable and mislabeled multipart blobs", async () => {
  for (const [name, type, contents] of [
    ["capture.html", "text/html", "<script>parent.postMessage(document.cookie,'*')</script>"],
    ["capture.svg", "image/svg+xml", "<svg xmlns='http://www.w3.org/2000/svg'><script>alert(1)</script></svg>"],
    ["fake.png", "image/png", "not a png"],
  ] as const) {
    const fd = new FormData();
    fd.set("meta", JSON.stringify({ type: "image", sourceTitle: name }));
    fd.set("blob", new File([contents], name, { type }));
    const response = await call("POST", "/v1/captures", { token: full, body: fd });
    expect(response.status).toBe(415);
  }
});

test("claim → enrichment queue lifecycle", async () => {
  const created = await call("POST", "/v1/captures", {
    token: full,
    json: { type: "bookmark", sourceUrl: "https://ex.com", sourceTitle: "Ex" },
  });
  const capture = await created.json() as Record<string, any>;

  const claimed = await call("POST", "/v1/captures/claim", {
    token: full,
    json: { owner: "worker-1", limit: 5 },
  });
  const claimBody = await claimed.json() as Record<string, any>;
  const mine = claimBody.captures.find((x: { id: string }) => x.id === capture.id);
  expect(mine).toBeDefined();
  expect(mine.status).toBe("processing");

  const enriched = await call(
    "PATCH",
    `/v1/captures/${capture.id}/enrichment`,
    {
      token: full,
      json: {
        summary: "An example site",
        category: "reference",
        tags: ["example", "web"],
        status: "done",
      },
    },
  );
  const done = await enriched.json() as Record<string, any>;
  expect(done.status).toBe("done");
  expect(done.tags).toEqual(["example", "web"]);
  expect(done.category).toBe("reference");

  const byTag = await call("GET", "/v1/captures?tag=example", { token: full });
  const tagged = await byTag.json() as Record<string, any>;
  expect(tagged.captures.some((x: { id: string }) => x.id === capture.id)).toBe(true);
});
