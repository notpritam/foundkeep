import { expect, test } from 'bun:test';
import { parseRedditListing, resolveReddit } from '../src/customer-reddit.ts';
import { PublicResourceError } from '../src/customer-public-resource.ts';
const load = (name: string) => Bun.file(new URL(`./fixtures/social/${name}`, import.meta.url)).json();
const hints = { version: 1 as const, images: [], links: [], articleText: '' };
const deps = (read: any, session: any = () => null) => ({ read, session, source: async () => { throw Error('unused'); } });
test('galleries become ordered images with title and body text', async () => {
  const m = parseRedditListing(await load('reddit-gallery.json'), '1abc2d');
  expect(m).toMatchObject({ text: 'Three views of the eclipse\n\nTaken from the roof.\n\nMore in comments.', author: 'u/mina · r/space', publishedAt: '2025-09-01T00:00:00.000Z', metadataAvailable: true });
  expect(m.media).toEqual([{ kind: 'image', url: 'https://preview.redd.it/m1.jpg?width=1000&format=pjpg&auto=webp&s=sig' }, { kind: 'image', url: 'https://preview.redd.it/m2.png?s=sig' }]);
});
test('reddit-hosted video carries audio track candidates on the same host', async () => {
  const m = parseRedditListing(await load('reddit-video.json'), '1vid3o');
  expect(m.media[0]).toEqual({ kind: 'video', url: 'https://v.redd.it/xyz789/DASH_720.mp4', audioUrls: ['https://v.redd.it/xyz789/DASH_AUDIO_128.mp4', 'https://v.redd.it/xyz789/DASH_AUDIO_64.mp4', 'https://v.redd.it/xyz789/DASH_audio.mp4'] });
  expect(m.media[1]).toEqual({ kind: 'image', url: 'https://external-preview.redd.it/thumb.jpg?s=sig' });
});
test('link posts expose the outbound article and never off-platform media', () => {
  const m = parseRedditListing([{ data: { children: [{ data: { id: 'l1', subreddit: 'news', author: 'a', title: 'Story', selftext: '', created_utc: 1, post_hint: 'link', url: 'https://example.org/story', preview: { images: [{ source: { url: 'https://evil.test/x.jpg' } }] } } }] } }], 'l1');
  expect(m.links).toEqual(['https://example.org/story']); expect(m.media).toEqual([]); expect(m.incomplete).toBeFalsy();
});
test('wrong id, removed or empty listings are unavailable', () => {
  expect(() => parseRedditListing([{ data: { children: [{ data: { id: 'other' } }] } }], 'l1')).toThrow();
  expect(() => parseRedditListing({}, 'l1')).toThrow();
});
test('malformed gallery data degrades instead of throwing', () => {
  const m = parseRedditListing([{ data: { children: [{ data: { id: 'g1', title: 'Broken gallery', is_gallery: true, gallery_data: { items: 'oops' }, media_metadata: {} } }] } }], 'g1');
  expect(m.media).toEqual([]);
  expect(m.incomplete).toBe(true);
});
test('resolver fetches .json with raw_json, resolves share links, and retries with the session on IP blocks', async () => {
  const calls: any[] = [];
  const listing = await load('reddit-gallery.json');
  let denied = true;
  const read = async (url: string, options: any) => {
    calls.push({ url, cookie: options.cookies?.('www.reddit.com') ?? null, accept: options.accept });
    if (url.endsWith('/s/AbC')) return { url: 'https://www.reddit.com/r/space/comments/1abc2d/three_views/?share_id=AbC', mime: 'text/html', data: Buffer.from('<html></html>'), status: 200 };
    if (denied && !options.cookies?.('www.reddit.com')) throw new PublicResourceError(403, url);
    return { url, mime: 'application/json', data: Buffer.from(JSON.stringify(listing)), status: 200 };
  };
  const reports: string[] = [];
  const session = () => ({ site: 'reddit', cookieFile: null, cookieHeader: () => 'reddit_session=r1', cookie: () => null, report: (o: string) => reports.push(o) });
  const m = await resolveReddit({ platform: 'reddit', site: 'reddit', id: 's:AbC', url: 'https://www.reddit.com/r/space/s/AbC' }, hints, new AbortController().signal, deps(read, session));
  expect(m.metadataAvailable).toBe(true);
  expect(calls[0]).toMatchObject({ url: 'https://www.reddit.com/r/space/s/AbC', cookie: null });
  expect(calls[1]).toMatchObject({ url: 'https://www.reddit.com/r/space/comments/1abc2d/.json?raw_json=1', cookie: null, accept: 'application/json' });
  expect(calls[2]).toMatchObject({ url: 'https://www.reddit.com/r/space/comments/1abc2d/.json?raw_json=1', cookie: 'reddit_session=r1' });
  expect(reports).toEqual(['ok']);
  denied = true;
  const noSession = await resolveReddit({ platform: 'reddit', site: 'reddit', id: '1abc2d', url: 'https://www.reddit.com/r/space/comments/1abc2d/' }, hints, new AbortController().signal, deps(read));
  expect(noSession).toMatchObject({ metadataAvailable: false, restricted: true });
});
