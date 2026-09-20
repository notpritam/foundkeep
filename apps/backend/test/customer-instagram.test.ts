import { expect, test } from 'bun:test';
import { parseInstagramEmbed, parseInstagramMediaInfo, resolveInstagram, shortcodeToMediaId } from '../src/customer-instagram.ts';
import { PublicResourceError } from '../src/customer-public-resource.ts';
const text = (name: string) => Bun.file(new URL(`./fixtures/social/${name}`, import.meta.url)).text();
const json = (name: string) => Bun.file(new URL(`./fixtures/social/${name}`, import.meta.url)).json();
const hints = { version: 1 as const, images: [], links: [], articleText: '' };
const post = { platform: 'instagram' as const, site: 'instagram', id: 'C0dE_f-1', url: 'https://www.instagram.com/p/C0dE_f-1/' };
test('shortcodes decode to media ids the way Instagram does', () => {
  expect(shortcodeToMediaId('B')).toBe('1'); expect(shortcodeToMediaId('C0dE_f-1abc')).toBe(shortcodeToMediaId('C0dE_f-1abcdefg'));
  expect(shortcodeToMediaId('CqZ_2lSLWJt')).toBe('3069765448845058669');
});
test('embed page yields caption, author, carousel images and video', async () => {
  const m = parseInstagramEmbed(await text('instagram-embed.html'), 'C0dE_f-1');
  expect(m).toMatchObject({ text: 'Rooftop eclipse', author: 'Mina K (@mina)', publishedAt: '2025-09-01T00:00:00.000Z', metadataAvailable: true });
  expect(m.media).toEqual([{ kind: 'image', url: 'https://scontent.cdninstagram.com/v/t51/1.jpg' }, { kind: 'video', url: 'https://scontent.cdninstagram.com/v/t66/2.mp4' }, { kind: 'image', url: 'https://scontent.cdninstagram.com/v/t51/2.jpg', previewOf: 'https://scontent.cdninstagram.com/v/t66/2.mp4' }]);
});
test('embed page without the JSON blob falls back to the caption markup', () => {
  const m = parseInstagramEmbed('<div class="Caption"><a class="CaptionUsername">mina</a> Plain caption</div><img class="EmbeddedMediaImage" src="https://scontent.cdninstagram.com/v/t51/x.jpg">', 'C0dE_f-1');
  expect(m).toMatchObject({ text: 'Plain caption', author: '@mina', media: [{ kind: 'image', url: 'https://scontent.cdninstagram.com/v/t51/x.jpg' }], metadataAvailable: true, incomplete: true });
});
test('media info API yields the full carousel with videos first per slide', async () => {
  const m = parseInstagramMediaInfo(await json('instagram-media-info.json'), 'C0dE_f-1');
  expect(m.media).toEqual([{ kind: 'image', url: 'https://scontent.cdninstagram.com/v/t51/1.jpg' }, { kind: 'video', url: 'https://scontent.cdninstagram.com/v/t66/2.mp4' }, { kind: 'image', url: 'https://scontent.cdninstagram.com/v/t51/2.jpg', previewOf: 'https://scontent.cdninstagram.com/v/t66/2.mp4' }]);
  expect(m.author).toBe('Mina K (@mina)');
  expect(() => parseInstagramMediaInfo({ items: [{ code: 'other' }] }, 'C0dE_f-1')).toThrow();
});
test('resolver uses the embed page anonymously, then the media API with the session, with the right headers', async () => {
  const info = await json('instagram-media-info.json');
  const calls: any[] = [];
  const read = async (url: string, options: any) => {
    calls.push({ url, headers: options.headers, cookie: options.cookies?.('www.instagram.com') ?? null });
    if (url.includes('/embed/captioned/')) return { url: 'https://www.instagram.com/accounts/login/?next=/p/C0dE_f-1/embed/captioned/', mime: 'text/html', data: Buffer.from('<html>Log in</html>'), status: 200 };
    return { url, mime: 'application/json', data: Buffer.from(JSON.stringify(info)), status: 200 };
  };
  const reports: string[] = [];
  const session = () => ({ site: 'instagram', cookieFile: '/tmp/instagram.txt', cookieHeader: (h: string) => (h.endsWith('instagram.com') ? 'sessionid=s1; csrftoken=c1' : null), cookie: (n: string) => (n === 'csrftoken' ? 'c1' : null), report: (o: string) => reports.push(o) });
  const m = await resolveInstagram(post, hints, new AbortController().signal, { read, session, source: async () => { throw Error('unused'); } });
  expect(m.media).toHaveLength(3); expect(m.metadataAvailable).toBe(true); expect(reports).toEqual(['ok']);
  expect(calls[0].url).toBe('https://www.instagram.com/p/C0dE_f-1/embed/captioned/');
  expect(calls[1].url).toBe(`https://www.instagram.com/api/v1/media/${shortcodeToMediaId('C0dE_f-1')}/info/`);
  expect(calls[1].headers).toMatchObject({ 'x-ig-app-id': '936619743392459', 'x-csrftoken': 'c1', 'x-requested-with': 'XMLHttpRequest', referer: 'https://www.instagram.com/p/C0dE_f-1/' });
  expect(calls[1].cookie).toBe('sessionid=s1; csrftoken=c1');
  const walled = await resolveInstagram(post, hints, new AbortController().signal, { read, session: () => null, source: async () => { throw Error('unused'); } });
  expect(walled).toMatchObject({ metadataAvailable: false, restricted: true });
  const denied = await resolveInstagram(post, hints, new AbortController().signal, { read: async (url: string, o: any) => { if (url.includes('/api/v1/')) throw new PublicResourceError(401, url); return read(url, o); }, session, source: async () => { throw Error('unused'); } });
  expect(denied.restricted).toBe(true); expect(reports.at(-1)).toBe('denied');
});
test('embed page that works anonymously does not touch the session', async () => {
  const embed = await text('instagram-embed.html'); let sessionCalls = 0;
  const m = await resolveInstagram(post, hints, new AbortController().signal, { read: async (url: string) => ({ url, mime: 'text/html', data: Buffer.from(embed), status: 200 }), session: () => { sessionCalls++; return null; }, source: async () => { throw Error('unused'); } });
  expect(m.media).toHaveLength(3); expect(sessionCalls).toBe(0);
});
