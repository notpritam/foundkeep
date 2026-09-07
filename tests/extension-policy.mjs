import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  DEFAULT_RUNTIME_POLICY,
  applyRuntimePolicy,
  normalizeRuntimePolicy,
} from "../apps/extension/src/runtime-policy.js";

test("the published runtime policy is valid and can only narrow account controls", async () => {
  const published = JSON.parse(await readFile("apps/web/extension-policy.json", "utf8"));
  const policy = normalizeRuntimePolicy(published);
  assert.deepEqual(policy, published);
  const preferences = {
    version: 1,
    capture: { region: true, fullPage: true, highlight: true, bookmark: true, image: true, tweet: true, note: true },
    bookmark: { readableText: true, extendedMetadata: true, headings: true },
    notes: { attachSource: true },
    popup: { actionOrder: ["bookmark", "highlight", "region", "fullPage"], showRecent: true, recentCount: 3 },
    sync: { automatic: true },
    organization: { ocr: true, summaries: true, tags: true },
    feedback: { success: true },
    contextMenus: true,
  };
  const restricted = structuredClone(policy);
  restricted.capture.image = false;
  restricted.capture.tweet = false;
  restricted.sync = false;
  restricted.contextMenus = false;
  const effective = applyRuntimePolicy(preferences, restricted);
  assert.equal(effective.capture.image, false);
  assert.equal(effective.capture.tweet, false);
  assert.equal(effective.sync.automatic, false);
  assert.equal(effective.contextMenus, false);
  assert.equal(effective.capture.bookmark, true);
  assert.equal(preferences.capture.image, true, "account preferences must not be mutated");
});

test("runtime policy rejects unknown fields, unsafe limits, and stale schema versions", () => {
  for (const mutation of [
    (value) => { value.remoteCode = "https://example.test/plugin.js"; },
    (value) => { value.schemaVersion = 2; },
    (value) => { value.limits.imageBytes = 20 * 1024 * 1024; },
    (value) => { value.capture.image = "yes"; },
  ]) {
    const value = structuredClone(DEFAULT_RUNTIME_POLICY);
    mutation(value);
    assert.equal(normalizeRuntimePolicy(value), null);
  }
});
