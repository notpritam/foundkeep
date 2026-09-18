import { expect, test } from 'bun:test';
import { parseYouTubeOembed, resolveYouTube } from '../src/customer-youtube.ts';
const hints = { version: 1 as const, images: [], links: [], articleText: '' };
const post = { platform: 'youtube' as const, site: 'youtube', id: 'dQw4w9WgXcQ', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' };
test('oembed gives title, channel and thumbnail, and the video itself is the media item', () => {
  const m = parseYouTubeOembed({ title: 'A talk', author_name: 'Channel', thumbnail_url: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg' }, post.id);
  expect(m).toMatchObject({ text: 'A talk', author: 'Channel', metadataAvailable: true });
  expect(m.media).toEqual([{ kind: 'video', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' }, { kind: 'image', url: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg' }]);
  expect(() => parseYouTubeOembed({ error: 'x' }, post.id)).toThrow();
});
test('resolver calls the oembed endpoint and degrades to the video item alone on failure', async () => {
  const calls: string[] = [];
  const ok = await resolveYouTube(post, hints, new AbortController().signal, { read: async (url: string) => { calls.push(url); return { url, mime: 'application/json', data: Buffer.from(JSON.stringify({ title: 'T', author_name: 'C', thumbnail_url: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg' })), status: 200 }; }, session: () => null, source: async () => { throw Error('unused'); } });
  expect(calls).toEqual(['https://www.youtube.com/oembed?url=https%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv%3DdQw4w9WgXcQ&format=json']);
  expect(ok.metadataAvailable).toBe(true);
  const degraded = await resolveYouTube(post, hints, new AbortController().signal, { read: async () => { throw Error('down'); }, session: () => null, source: async () => { throw Error('unused'); } });
  expect(degraded).toMatchObject({ metadataAvailable: false, media: [{ kind: 'video', url: post.url }] });
});
