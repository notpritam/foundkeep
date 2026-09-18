import { expect, test } from 'bun:test';
import { createPublicReader, PublicResourceError } from '../src/customer-public-resource.ts';
import { pinnedRequestHeaders } from '../src/customer-preview.ts';
const body = (text: string) => (async function* () { yield new TextEncoder().encode(text); })();
test('headers and per-hop cookies reach the transport, and cookies re-scope on redirect', async () => {
  const seen: { host: string; headers: Record<string, string> }[] = [];
  const read = createPublicReader({
    resolve: async () => [{ address: '1.1.1.1', family: 4 }],
    transport: async (target, _signal, _accept, headers) => {
      seen.push({ host: target.url.host, headers: headers ?? {} });
      if (target.url.host === 'www.reddit.com') return { status: 302, headers: new Headers({ location: 'https://cdn.example.net/file.json' }), body: body(''), cancel() {} };
      return { status: 200, headers: new Headers({ 'content-type': 'application/json' }), body: body('{"ok":true}'), cancel() {} };
    },
  });
  const result = await read('https://www.reddit.com/r/a/s/xyz', {
    maxBytes: 1024, signal: new AbortController().signal, accept: 'application/json',
    // COOKIE (any casing) must never survive alongside the per-hop cookie set below.
    headers: { 'User-Agent': 'FoundKeep/1.0 test', Host: 'evil.test', 'Accept-Encoding': 'gzip', COOKIE: 'x=1' },
    cookies: host => (host === 'www.reddit.com' ? 'reddit_session=r1' : null),
  });
  expect(result.status).toBe(200);
  expect(result.url).toBe('https://cdn.example.net/file.json');
  expect(seen[0]!.headers).toEqual({ 'User-Agent': 'FoundKeep/1.0 test', Cookie: 'reddit_session=r1' });
  expect(seen[1]!.headers).toEqual({ 'User-Agent': 'FoundKeep/1.0 test' });
});
test('pinnedRequestHeaders — the merge that actually runs in production — protects Host/Accept-Encoding in any case, drops invalid values, lets ordinary headers through, and the explicit accept wins over a caller Accept', () => {
  const headers = pinnedRequestHeaders(
    { address: '1.1.1.1', family: 4, url: new URL('https://example.com/img.png') },
    'application/json',
    {
      'User-Agent': 'FoundKeep/1.0 test',
      Cookie: 'session=abc',
      'x-ig-app-id': '12345',
      Host: 'evil.test',
      HOST: 'evil2.test',
      'Accept-Encoding': 'gzip',
      'accept-encoding': 'br',
      Accept: 'text/html',
      'X-Bad': 'bad\nvalue',
      'X-Too-Long': 'a'.repeat(8193),
    },
  );
  expect(headers).toEqual({
    Host: 'example.com',
    'User-Agent': 'FoundKeep/1.0 test',
    'Accept-Encoding': 'identity',
    Cookie: 'session=abc',
    'x-ig-app-id': '12345',
    Accept: 'application/json',
  });
});
test('non-200 responses throw a typed error carrying status and final url', async () => {
  const read = createPublicReader({ resolve: async () => [{ address: '1.1.1.1', family: 4 }], transport: async () => ({ status: 403, headers: new Headers(), body: body('denied'), cancel() {} }) });
  const error = await read('https://www.instagram.com/p/abc/', { maxBytes: 10, signal: new AbortController().signal }).catch(e => e);
  expect(error).toBeInstanceOf(PublicResourceError);
  expect(error.status).toBe(403);
  expect(error.url).toBe('https://www.instagram.com/p/abc/');
  expect(error.message).not.toContain('denied');
});
