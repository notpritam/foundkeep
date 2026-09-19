import { afterEach, beforeEach, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { openDb } from "../src/db.ts";
import {
  createPreservationService,
  enqueuePreservation,
  preservationDetails,
} from "../src/customer-preservation.ts";
import { normalizeSocialContext } from "../src/customer-twitter.ts";
import { createRemoteFileSweeper } from "../src/customer-remote-cleanup.ts";
let db: ReturnType<typeof openDb>, root: string;
const owner = "owner",
  capture = "capture",
  url = "https://x.com/mina/status/12345";
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aEwoAAAAASUVORK5CYII=",
  "base64",
);
const manifest = {
  text: "The exact post",
  author: "Mina",
  publishedAt: null,
  metadataAvailable: true,
  media: [{ kind: "image" as const, url: "https://pbs.twimg.com/media/a.jpg" }],
  links: ["https://blog.example.org/story"],
};
beforeEach(async () => {
  db = openDb(":memory:");
  root = await mkdtemp("/tmp/foundkeep-preservation-");
  db.query(
    "INSERT INTO customer_accounts(id,email,name,password_hash,recovery_hash,created_at) VALUES(?,'owner@example.test','Owner','','',0)",
  ).run(owner);
  db.query(
    "INSERT INTO customer_captures(id,account_id,client_id,type,status,source_url,selection_text,storage_bytes,captured_at,created_at,updated_at) VALUES(?,?,?,'tweet','done',?,'Captured original',100,1,1,1)",
  ).run(capture, owner, capture, url);
});
afterEach(async () => {
  db.close();
  await rm(root, { recursive: true, force: true });
});
const service = (extra = {}) =>
  createPreservationService(db, {
    root,
    resolve: async () => manifest,
    read: async (url) => ({ url, mime: "image/png", data: png, status: 200 }),
    source: async (url) => ({
      url,
      requestedUrl: url,
      text: "A full readable blog",
      title: "Blog",
      author: "Mina",
      description: null,
      imageUrl: null,
      publishedAt: null,
      siteName: null,
      extractionStatus: "readable" as const,
      contentHash: "hash",
      fetchedAt: 1,
    }),
    ...extra,
  });
test("Free saves preserve independent assets without AI, account settings or processing credits", async () => {
  enqueuePreservation(db, owner, capture, url);
  enqueuePreservation(db, owner, capture, url);
  expect(
    (db.query("SELECT COUNT(*) n FROM customer_preservation_jobs").get() as any)
      .n,
  ).toBe(1);
  await service().tick();
  const result = preservationDetails(db, owner, capture)!;
  expect(result.status).toBe("ready");
  expect(result.assets.map((x) => x.kind)).toEqual([
    "post",
    "image",
    "article",
  ]);
  expect(result.assets[2]!.text).toContain("A full readable blog");
  expect(
    (db.query("SELECT selection_text FROM customer_captures").get() as any)
      .selection_text,
  ).toBe("Captured original");
  expect(preservationDetails(db, "other", capture)).toBeNull();
  const file = (
    db
      .query("SELECT file_path FROM customer_media_assets WHERE kind='image'")
      .get() as any
  ).file_path;
  expect(await Bun.file(root + "/" + file).exists()).toBe(true);
  const sweeper = createRemoteFileSweeper(db, root);
  sweeper.sweep(Date.now() + 7200_000);
  sweeper.close();
  expect(await Bun.file(root + "/" + file).exists()).toBe(true);
});
test("partial failure keeps committed files, and a retry does not store them twice", async () => {
  enqueuePreservation(db, owner, capture, url);
  await service({
    source: async () => {
      throw Error("unavailable");
    },
  }).tick();
  expect(preservationDetails(db, owner, capture)?.status).toBe("partial");
  const bytes = (
    db.query("SELECT storage_bytes FROM customer_captures").get() as any
  ).storage_bytes;
  db.query("UPDATE customer_preservation_jobs SET status='pending'").run();
  await service().tick();
  expect(preservationDetails(db, owner, capture)?.assets.length).toBe(3);
  expect(
    (db.query("SELECT storage_bytes FROM customer_captures").get() as any)
      .storage_bytes,
  ).toBeGreaterThan(bytes);
  db.query("UPDATE customer_preservation_jobs SET status='pending'").run();
  await service().tick();
  expect(preservationDetails(db, owner, capture)?.assets.length).toBe(3);
});
test("source edits and deletion while resolving cannot attach files to a different save", async () => {
  enqueuePreservation(db, owner, capture, url, normalizeSocialContext(null));
  await service({
    resolve: async () => {
      db.query(
        "UPDATE customer_captures SET source_url='https://x.com/other/status/999'",
      ).run();
      return manifest;
    },
  }).tick();
  expect(
    (db.query("SELECT COUNT(*) n FROM customer_media_assets").get() as any).n,
  ).toBe(0);
  db.query("UPDATE customer_captures SET source_url=?").run(url);
  db.query(
    "UPDATE customer_preservation_jobs SET status='pending',next_attempt_at=0",
  ).run();
  await service({
    resolve: async () => {
      db.query("DELETE FROM customer_captures").run();
      return manifest;
    },
  }).tick();
  expect(preservationDetails(db, owner, capture)).toBeNull();
});
test("storage quota is rechecked during incremental commits and existing content stays intact", async () => {
  enqueuePreservation(db, owner, capture, url);
  await service({ globalMaxBytes: 180 }).tick();
  const result = preservationDetails(db, owner, capture)!;
  expect(result.status).toBe("partial");
  expect(result.assets.every((x) => x.kind !== "image")).toBe(true);
  expect(
    (db.query("SELECT storage_bytes FROM customer_captures").get() as any)
      .storage_bytes,
  ).toBeLessThanOrEqual(180);
});

test('expired leases resume missing work, and unavailable metadata never downloads a quoted video by guessing',async()=>{
 enqueuePreservation(db,owner,capture,url);
 db.query("UPDATE customer_preservation_jobs SET status='running',attempts=1,lease_token='old',lease_until=1").run();
 let downloads=0;
 const worker=service({resolve:async()=>({...manifest,metadataAvailable:false,media:[],links:[]}),remote:async()=>{downloads++;throw Error('Must not guess media ownership');}});
 await worker.tick();worker.close();
 expect(preservationDetails(db,owner,capture)?.status).toBe('partial');expect(preservationDetails(db,owner,capture)?.attempts).toBe(2);expect(downloads).toBe(0);
 expect(preservationDetails(db,owner,capture)?.assets.map(asset=>asset.kind)).toEqual(['post']);
});
test('any recognised social post is preserved with platform-aware notes', async () => {
  const reddit = 'https://www.reddit.com/r/space/comments/1abc2d/';
  db.query("INSERT INTO customer_captures(id,account_id,client_id,type,status,source_url,selection_text,storage_bytes,captured_at,created_at,updated_at) VALUES('r',?,'r','page','done',?,'',100,1,1,1)").run(owner, reddit);
  enqueuePreservation(db, owner, 'r', 'https://old.reddit.com/r/space/comments/1abc2d/some_title/?utm_source=share');
  expect((db.query("SELECT source_url FROM customer_preservation_jobs WHERE capture_id='r'").get() as any).source_url).toBe(reddit);
  const seen: any[] = [];
  const sessionSites: string[] = [], consumed: string[] = [];
  const s = createPreservationService(db, {
    root,
    resolve: async () => ({ text: 'Title\n\nBody', author: 'u/mina', publishedAt: '2026-09-01T00:00:00.000Z', metadataAvailable: false, restricted: true, media: [{ kind: 'video' as const, url: 'https://v.redd.it/abc/DASH_720.mp4', audioUrls: ['https://v.redd.it/abc/DASH_AUDIO_128.mp4'] }], links: [] }),
    read: async (url) => ({ url, mime: 'image/png', data: png, status: 200 }),
    remote: async (url, options) => { seen.push({ url, cookieFile: options.cookieFile, audioUrls: options.audioUrls }); return { status: 'unavailable' as const, reason: 'x' }; },
    // The pipeline reads the jar path without spending the 2 s authenticated-call
    // slot the resolvers need, so session() must never be reached from here.
    sessions: { session: () => { consumed.push('session'); return null; }, cookieFileFor: (site: string) => { sessionSites.push(site); return '/tmp/reddit.txt'; }, describe: () => '' },
  });
  await s.tick();
  const result = preservationDetails(db, owner, 'r')!;
  expect(result.status).toBe('partial');
  // A restricted server is why the post was not exposed; saying both would read
  // as two separate faults.
  expect(result.error).not.toContain('did not expose');
  expect(result.error).toContain('Reddit restricted server access');
  expect(result.error).not.toContain('X did not');
  expect(seen).toEqual([{ url: 'https://v.redd.it/abc/DASH_720.mp4', cookieFile: '/tmp/reddit.txt', audioUrls: ['https://v.redd.it/abc/DASH_AUDIO_128.mp4'] }]);
  expect(sessionSites).toEqual(['reddit']);
  expect(consumed).toEqual([]);
});
test('a post the platform simply did not expose says so, without the restricted note', async () => {
  const url = 'https://www.reddit.com/r/space/comments/1nope2/';
  db.query("INSERT INTO customer_captures(id,account_id,client_id,type,status,source_url,selection_text,storage_bytes,captured_at,created_at,updated_at) VALUES('n',?,'n','page','done',?,'',100,1,1,1)").run(owner, url);
  enqueuePreservation(db, owner, 'n', url);
  const s = createPreservationService(db, {
    root,
    // Not restricted: the resolver reached the platform and it returned nothing.
    resolve: async () => ({ text: '', author: '', publishedAt: null, metadataAvailable: false, media: [], links: [] }),
    read: async (u: string) => ({ url: u, mime: 'image/png', data: png, status: 200 }),
  });
  await s.tick();
  const result = preservationDetails(db, owner, 'n')!;
  expect(result.status).toBe('partial');
  expect(result.error).toContain('Reddit did not expose the full public post.');
  expect(result.error).not.toContain('restricted server access');
});
test('the visible-article asset title names the platform, or "the page" for a generic source', async () => {
  const context = normalizeSocialContext({ version: 1, images: [], links: [], articleText: 'Visible on-page article text' });
  const tiktokUrl = 'https://www.tiktok.com/@u/video/7300000000000000000';
  db.query("INSERT INTO customer_captures(id,account_id,client_id,type,status,source_url,selection_text,storage_bytes,captured_at,created_at,updated_at) VALUES('t',?,'t','page','done',?,'',100,1,1,1)").run(owner, tiktokUrl);
  enqueuePreservation(db, owner, 't', tiktokUrl, context);
  await createPreservationService(db, {
    root,
    resolve: async () => ({ text: 'Body', author: '', publishedAt: null, metadataAvailable: true, media: [], links: [] }),
  }).tick();
  const tiktokArticle = preservationDetails(db, owner, 't')!.assets.find((a) => a.kind === 'article');
  expect(tiktokArticle?.title).toBe('Article captured from the page');

  enqueuePreservation(db, owner, capture, url, context);
  await service({ resolve: async () => ({ ...manifest, links: [] }) }).tick();
  const xArticle = preservationDetails(db, owner, capture)!.assets.find((a) => a.kind === 'article');
  expect(xArticle?.title).toBe('Article captured from X');
});
test('video subtitles and description become a transcript asset', async () => {
  const clip = join(root, 'clip.bin');
  // A minimal ISO-BMFF "ftyp" box header so customer-files.ts's magic-byte sniffer
  // detects video/mp4 — a plain placeholder string does not satisfy the sniffer.
  const clipBytes = Buffer.from([0, 0, 0, 12, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d]);
  await writeFile(clip, clipBytes);
  const s = service({
    resolve: async () => ({ ...manifest, media: [{ kind: 'video' as const, url: 'https://video.twimg.com/a.mp4' }] }),
    remote: async () => ({ status: 'downloaded' as const, absolutePath: clip, sourceUrl: 'https://video.twimg.com/a.mp4', mime: 'video/mp4' as const, bytes: clipBytes.length, sha256: createHash('sha256').update(clipBytes).digest('base64url'), durationSeconds: 1, title: 'Clip', description: 'About the clip', author: 'Mina', subtitles: [{ language: 'en', automatic: true, text: 'WEBVTT\n\nhello' }], dispose: async () => {} }),
  });
  enqueuePreservation(db, owner, capture, url);
  await s.tick();
  const kinds = preservationDetails(db, owner, capture)!.assets.map(a => a.kind);
  expect(kinds).toContain('transcript');
});
