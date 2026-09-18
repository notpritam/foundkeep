import { expect, test } from 'bun:test';
import { parseLinkedInGuest, parseLinkedInVoyager, resolveLinkedIn } from '../src/customer-linkedin.ts';
const text = (name: string) => Bun.file(new URL(`./fixtures/social/${name}`, import.meta.url)).text();
const json = (name: string) => Bun.file(new URL(`./fixtures/social/${name}`, import.meta.url)).json();
const hints = { version: 1 as const, images: [], links: [], articleText: '' };
const post = { platform: 'linkedin' as const, site: 'linkedin', id: '7123456789012345678', url: 'https://www.linkedin.com/feed/update/urn:li:activity:7123456789012345678/' };
test('guest page yields commentary, author, date, largest images and the best mp4', async () => {
  const m = parseLinkedInGuest(await text('linkedin-guest.html'), post.id);
  expect(m).toMatchObject({ text: 'Shipping the new agent runtime today.\nThree lessons: keep it small, measure, ship.', author: 'Jane Doe', publishedAt: '2026-09-01T10:00:00.000Z', metadataAvailable: true });
  expect(m.media).toEqual([{ kind: 'video', url: 'https://dms.licdn.com/playlist/vid/v2/D4D05AQ/mp4-720p-30fp-crf28/0/1?e=1&v=beta&t=vsig' }, { kind: 'image', url: 'https://media.licdn.com/dms/image/v2/D4D22AQ/feedshare-shrink_2048_1536/0/1?e=1&v=beta&t=sig2' }]);
});
test('guest page with only og tags is metadata-only but usable', () => {
  const m = parseLinkedInGuest('<meta property="og:title" content="A B on LinkedIn: hi"><meta property="og:description" content="hi there">', post.id);
  expect(m).toMatchObject({ text: 'hi there', author: 'A B', metadataAvailable: true, incomplete: true });
});
test('voyager update yields commentary, actor, largest image artifacts and video streams', async () => {
  const m = parseLinkedInVoyager(await json('linkedin-voyager.json'), post.id);
  expect(m).toMatchObject({ text: 'Shipping the new agent runtime today.\nThree lessons.', author: 'Jane Doe', metadataAvailable: true });
  expect(m.media).toEqual([{ kind: 'image', url: 'https://media.licdn.com/dms/image/v2/D4D22AQ/feedshare-shrink_2048_1536/0/1?e=1&v=beta&t=b' }, { kind: 'video', url: 'https://dms.licdn.com/playlist/vid/v2/D4D05AQ/mp4-720p-30fp-crf28/0/1?e=1&v=beta&t=v' }]);
  expect(() => parseLinkedInVoyager({ included: [] }, post.id)).toThrow();
});
test('resolver reads the guest page first, then Voyager with csrf and session cookies on an authwall', async () => {
  const guest = await text('linkedin-guest.html'), voyager = await json('linkedin-voyager.json');
  const calls: any[] = [];
  const read = async (url: string, options: any) => {
    calls.push({ url, headers: options.headers, cookie: options.cookies?.('www.linkedin.com') ?? null });
    if (url.startsWith('https://www.linkedin.com/feed/update/')) return { url: 'https://www.linkedin.com/authwall?trk=x', mime: 'text/html', data: Buffer.from('<html>Join</html>'), status: 200 };
    return { url, mime: 'application/json', data: Buffer.from(JSON.stringify(voyager)), status: 200 };
  };
  const reports: string[] = [];
  const session = () => ({ site: 'linkedin', cookieFile: null, cookieHeader: (h: string) => (h.endsWith('linkedin.com') ? 'li_at=t; JSESSIONID="ajax:42"' : null), cookie: (n: string) => (n === 'JSESSIONID' ? '"ajax:42"' : null), report: (o: string) => reports.push(o) });
  const m = await resolveLinkedIn(post, hints, new AbortController().signal, { read, session, source: async () => { throw Error('unused'); } });
  expect(m.metadataAvailable).toBe(true); expect(m.media).toHaveLength(2); expect(reports).toEqual(['ok']);
  expect(calls[0].url).toBe(post.url); expect(calls[0].headers['User-Agent']).toContain('Mozilla/5.0');
  expect(calls[1].url).toBe('https://www.linkedin.com/voyager/api/feed/updates/urn:li:activity:7123456789012345678');
  expect(calls[1].headers).toMatchObject({ 'csrf-token': 'ajax:42', 'x-restli-protocol-version': '2.0.0', accept: 'application/vnd.linkedin.normalized+json+2.1' });
  expect(calls[1].cookie).toBe('li_at=t; JSESSIONID="ajax:42"');
  const guestOk = await resolveLinkedIn(post, hints, new AbortController().signal, { read: async (url: string) => ({ url, mime: 'text/html', data: Buffer.from(guest), status: 200 }), session: () => { throw Error('must not be used'); }, source: async () => { throw Error('unused'); } });
  expect(guestOk.media).toHaveLength(2);
  const walled = await resolveLinkedIn(post, hints, new AbortController().signal, { read, session: () => null, source: async () => { throw Error('unused'); } });
  expect(walled).toMatchObject({ metadataAvailable: false, restricted: true });
});
