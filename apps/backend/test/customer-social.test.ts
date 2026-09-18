import { expect, test } from 'bun:test';
import { socialPost, platformLabel, resolveSocialPost, mediaHost } from '../src/customer-social.ts';
test('canonicalises supported post links and rejects lookalikes and non-posts', () => {
  expect(socialPost('https://twitter.com/nasa/status/12345/photo/1')).toEqual({ platform: 'x', site: 'x', id: '12345', url: 'https://x.com/nasa/status/12345' });
  expect(socialPost('https://old.reddit.com/r/space/comments/1abc2d/title_here/?utm_source=share')).toEqual({ platform: 'reddit', site: 'reddit', id: '1abc2d', url: 'https://www.reddit.com/r/space/comments/1abc2d/' });
  expect(socialPost('https://www.reddit.com/r/space/s/AbCdEf123')).toEqual({ platform: 'reddit', site: 'reddit', id: 's:AbCdEf123', url: 'https://www.reddit.com/r/space/s/AbCdEf123' });
  expect(socialPost('https://redd.it/1abc2d')).toEqual({ platform: 'reddit', site: 'reddit', id: '1abc2d', url: 'https://www.reddit.com/comments/1abc2d/' });
  expect(socialPost('https://www.instagram.com/reel/C0dE_f-1/?igsh=x')).toEqual({ platform: 'instagram', site: 'instagram', id: 'C0dE_f-1', url: 'https://www.instagram.com/p/C0dE_f-1/' });
  expect(socialPost('https://www.linkedin.com/posts/jane-doe_ai-activity-7123456789012345678-AbCd?utm=1')).toEqual({ platform: 'linkedin', site: 'linkedin', id: '7123456789012345678', url: 'https://www.linkedin.com/feed/update/urn:li:activity:7123456789012345678/' });
  expect(socialPost('https://www.linkedin.com/feed/update/urn:li:activity:7123456789012345678/')).toEqual({ platform: 'linkedin', site: 'linkedin', id: '7123456789012345678', url: 'https://www.linkedin.com/feed/update/urn:li:activity:7123456789012345678/' });
  expect(socialPost('https://bsky.app/profile/alice.bsky.social/post/3kabc')).toEqual({ platform: 'bluesky', site: 'bluesky', id: 'alice.bsky.social/3kabc', url: 'https://bsky.app/profile/alice.bsky.social/post/3kabc' });
  expect(socialPost('https://youtu.be/dQw4w9WgXcQ?si=abc')).toEqual({ platform: 'youtube', site: 'youtube', id: 'dQw4w9WgXcQ', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' });
  expect(socialPost('https://www.youtube.com/shorts/dQw4w9WgXcQ')).toEqual({ platform: 'youtube', site: 'youtube', id: 'dQw4w9WgXcQ', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' });
  expect(socialPost('https://www.tiktok.com/@user/video/7300000000000000000?is_from_webapp=1')).toEqual({ platform: 'generic', site: 'tiktok', id: 'https://www.tiktok.com/@user/video/7300000000000000000', url: 'https://www.tiktok.com/@user/video/7300000000000000000' });
  expect(socialPost('https://www.threads.net/@user/post/Cabc123')).toMatchObject({ platform: 'generic', site: 'threads' });
  for (const url of ['https://x.com.evil.test/a/status/1', 'https://www.reddit.com/r/space/', 'https://www.instagram.com/someuser/', 'https://www.linkedin.com/in/jane/', 'https://example.com/post/1', 'https://user@bsky.app/profile/a/post/b', 'file:///tmp/a'])
    expect(socialPost(url)).toBeNull();
});
test('labels are user-facing platform names', () => {
  expect(platformLabel('x')).toBe('X'); expect(platformLabel('linkedin')).toBe('LinkedIn'); expect(platformLabel('generic')).toBe('This site');
});
test('media host allow-list accepts subdomains only', () => {
  expect(mediaHost('https://i.redd.it/a.jpg', ['redd.it'])).toBe('https://i.redd.it/a.jpg');
  expect(mediaHost('https://redd.it.evil.test/a.jpg', ['redd.it'])).toBeNull();
  expect(mediaHost('http://i.redd.it/a.jpg', ['redd.it'])).toBeNull();
});
test('generic resolver turns page metadata into a manifest and flags login walls', async () => {
  const snapshot = (over: Partial<import('../src/customer-source.ts').SourceSnapshot>) => async (url: string) => ({ url, requestedUrl: url, fetchedAt: 1, contentHash: 'h', text: '', title: null, description: null, imageUrl: null, author: null, publishedAt: null, siteName: null, ...over });
  const ok = await resolveSocialPost('https://www.tiktok.com/@user/video/7300000000000000000', { version: 1, images: [], links: [], articleText: '' }, new AbortController().signal, {
    source: snapshot({ title: 'A clip', description: 'What it shows', text: 'What it shows', author: 'user', imageUrl: 'https://p16-sign.tiktokcdn.com/a.jpg', contentKind: 'video', extractionStatus: 'metadata-only' }),
    session: () => null,
  });
  expect(ok).toMatchObject({ text: 'A clip\n\nWhat it shows', author: 'user', metadataAvailable: true });
  expect(ok.media).toEqual([{ kind: 'video', url: 'https://www.tiktok.com/@user/video/7300000000000000000' }, { kind: 'image', url: 'https://p16-sign.tiktokcdn.com/a.jpg' }]);
  const walled = await resolveSocialPost('https://www.facebook.com/reel/123', { version: 1, images: [], links: [], articleText: '' }, new AbortController().signal, {
    source: snapshot({ url: 'https://www.facebook.com/login/?next=x', extractionStatus: 'unavailable' }), session: () => null,
  });
  expect(walled).toMatchObject({ metadataAvailable: false, restricted: true });
});
