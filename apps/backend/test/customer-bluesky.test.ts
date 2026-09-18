import { expect, test } from 'bun:test';
import { parseBlueskyThread, resolveBluesky } from '../src/customer-bluesky.ts';
const json = (name: string) => Bun.file(new URL(`./fixtures/social/${name}`, import.meta.url)).json();
const hints = { version: 1 as const, images: [], links: [], articleText: '' };
test('thread view yields text, author, images and facet links', async () => {
  const m = parseBlueskyThread(await json('bluesky-thread.json'), '3kabc');
  expect(m).toMatchObject({ text: 'Two photos from the ridge', author: 'Alice (@alice.bsky.social)', publishedAt: '2026-09-01T10:00:00.000Z', links: ['https://example.org/ridge'], metadataAvailable: true });
  expect(m.media).toEqual([{ kind: 'image', url: 'https://cdn.bsky.app/img/feed_fullsize/plain/did:plc:abc/bafy1@jpeg' }, { kind: 'image', url: 'https://cdn.bsky.app/img/feed_fullsize/plain/did:plc:abc/bafy2@jpeg' }]);
});
test('video embeds keep the thumbnail and mark the post incomplete; record-with-media unwraps', () => {
  const m = parseBlueskyThread({ thread: { post: { uri: 'at://did:plc:abc/app.bsky.feed.post/3kv', author: { handle: 'a.b' }, record: { text: 'clip', createdAt: '2026-09-01T00:00:00Z' }, embed: { $type: 'app.bsky.embed.recordWithMedia#view', media: { $type: 'app.bsky.embed.video#view', playlist: 'https://video.bsky.app/watch/did/cid/playlist.m3u8', thumbnail: 'https://video.bsky.app/watch/did/cid/thumbnail.jpg' } } } } }, '3kv');
  expect(m.media).toEqual([{ kind: 'image', url: 'https://video.bsky.app/watch/did/cid/thumbnail.jpg' }]); expect(m.incomplete).toBe(true);
  expect(() => parseBlueskyThread({ thread: { $type: 'app.bsky.feed.defs#notFoundPost' } }, '3kv')).toThrow();
});
test('resolver resolves handles to DIDs and fetches the thread from the public API', async () => {
  const thread = await json('bluesky-thread.json'); const calls: string[] = [];
  const read = async (url: string) => { calls.push(url); if (url.includes('resolveHandle')) return { url, mime: 'application/json', data: Buffer.from('{"did":"did:plc:abc"}'), status: 200 }; return { url, mime: 'application/json', data: Buffer.from(JSON.stringify(thread)), status: 200 }; };
  const m = await resolveBluesky({ platform: 'bluesky', site: 'bluesky', id: 'alice.bsky.social/3kabc', url: 'https://bsky.app/profile/alice.bsky.social/post/3kabc' }, hints, new AbortController().signal, { read, session: () => null, source: async () => { throw Error('unused'); } });
  expect(m.media).toHaveLength(2);
  expect(calls).toEqual(['https://public.api.bsky.app/xrpc/com.atproto.identity.resolveHandle?handle=alice.bsky.social', 'https://public.api.bsky.app/xrpc/app.bsky.feed.getPostThread?uri=at%3A%2F%2Fdid%3Aplc%3Aabc%2Fapp.bsky.feed.post%2F3kabc&depth=0&parentHeight=0']);
  const direct = await resolveBluesky({ platform: 'bluesky', site: 'bluesky', id: 'did:plc:abc/3kabc', url: 'https://bsky.app/profile/did:plc:abc/post/3kabc' }, hints, new AbortController().signal, { read, session: () => null, source: async () => { throw Error('unused'); } });
  expect(direct.metadataAvailable).toBe(true); expect(calls).toHaveLength(3);
});
