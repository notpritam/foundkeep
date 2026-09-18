import { expect, test } from 'bun:test';
import { createPublicReader, PublicResourceError } from '../src/customer-public-resource.ts';
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
    headers: { 'User-Agent': 'FoundKeep/1.0 test', Host: 'evil.test', 'Accept-Encoding': 'gzip' },
    cookies: host => (host === 'www.reddit.com' ? 'reddit_session=r1' : null),
  });
  expect(result.status).toBe(200);
  expect(result.url).toBe('https://cdn.example.net/file.json');
  expect(seen[0]!.headers).toEqual({ 'User-Agent': 'FoundKeep/1.0 test', Cookie: 'reddit_session=r1' });
  expect(seen[1]!.headers).toEqual({ 'User-Agent': 'FoundKeep/1.0 test' });
});
test('non-200 responses throw a typed error carrying status and final url', async () => {
  const read = createPublicReader({ resolve: async () => [{ address: '1.1.1.1', family: 4 }], transport: async () => ({ status: 403, headers: new Headers(), body: body('denied'), cancel() {} }) });
  const error = await read('https://www.instagram.com/p/abc/', { maxBytes: 10, signal: new AbortController().signal }).catch(e => e);
  expect(error).toBeInstanceOf(PublicResourceError);
  expect(error.status).toBe(403);
  expect(error.url).toBe('https://www.instagram.com/p/abc/');
  expect(error.message).not.toContain('denied');
});
