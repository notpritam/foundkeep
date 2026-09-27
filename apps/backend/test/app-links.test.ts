import { expect, test } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Point the store at a throwaway dir BEFORE the modules that read config load.
process.env.ATLAS_DATA_DIR = mkdtempSync(join(tmpdir(), "foundkeep-app-links-test-"));

const { openDb } = await import("../src/db.ts");
const { createApp } = await import("../src/app.ts");

const app = createApp(openDb(join(process.env.ATLAS_DATA_DIR!, "atlas.db")));
const get = (path: string) => app.fetch(new Request(`http://x${path}`));

test("mobile web links stay allowlisted and universal-link metadata requires the Apple team", async () => {
  const open = await get("/open?path=https://evil.example");
  expect(open.status).toBe(302);
  expect(open.headers.get("location")).toBe("/open.html?path=collection");
  const before = process.env.ATLAS_APPLE_TEAM_ID;
  delete process.env.ATLAS_APPLE_TEAM_ID;
  expect((await get("/.well-known/apple-app-site-association")).status).toBe(404);
  process.env.ATLAS_APPLE_TEAM_ID = "A1B2C3D4E5";
  const association = await get("/.well-known/apple-app-site-association");
  expect(association.status).toBe(200);
  expect(association.headers.get("content-type")).toContain("application/json");
  expect(await association.json()).toMatchObject({ applinks: { details: [{ appIDs: ["A1B2C3D4E5.app.foundkeep.ios"] }] } });
  if (before === undefined) delete process.env.ATLAS_APPLE_TEAM_ID;
  else process.env.ATLAS_APPLE_TEAM_ID = before;
});
