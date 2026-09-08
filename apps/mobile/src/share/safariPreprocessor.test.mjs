import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('../../share-extension/SafariPreprocessor.js', import.meta.url), 'utf8');

function runPreprocessor({ selected = '', lead = 'https://images.example.test/cover.jpg', pageTitle = 'A field guide', siteName = 'Example Journal', author = 'Mina Vale', language = 'en', pageUrl = 'https://example.test/article?from=share' } = {}) {
  const nodes = {
    'link[rel="canonical"]': { href: 'https://example.test/article' },
    'link[rel~="icon"]': { href: 'https://example.test/favicon.ico' },
    'meta[property="og:image"]': { content: lead },
    'meta[property="og:site_name"]': { content: siteName },
    'meta[name="description"]': { content: 'A readable article.' },
    'meta[name="author"]': { content: author },
  };
  const context = {
    URL, Date, isNaN,
    location: { href: pageUrl },
    window: { getSelection: () => selected },
    document: {
      title: pageTitle, documentElement: { lang: language }, body: { innerText: 'Useful page text.' },
      querySelector: selector => nodes[selector] || null,
      querySelectorAll: () => [{ innerText: 'Look closely' }],
    },
  };
  vm.runInNewContext(source, context);
  let result;
  context.ExtensionPreprocessingJS.run({ completionFunction: value => { result = value; } });
  return result;
}

test('Safari preprocessor keeps readable text and source metadata bounded', () => {
  const result = runPreprocessor();
  assert.equal(result.pageUrl, 'https://example.test/article?from=share');
  assert.equal(result.canonicalUrl, 'https://example.test/article');
  assert.equal(result.readableText, 'Useful page text.');
  assert.deepEqual([...result.headings], ['Look closely']);
});

test('malformed optional image metadata cannot prevent an otherwise valid capture', () => {
  const result = runPreprocessor({ lead: 'http://[' });
  assert.equal(result.pageUrl, 'https://example.test/article?from=share');
  assert.equal(result.leadImageUrl, null);
});

test('page fields are bounded to the server provenance contract', () => {
  const result = runPreprocessor({ pageTitle: 't'.repeat(1200), siteName: 's'.repeat(500), author: 'a'.repeat(300), language: 'invalid_language' });
  assert.equal(result.pageTitle.length, 1000);
  assert.equal(result.siteName.length, 300);
  assert.equal(result.authors[0].length, 200);
  assert.equal(result.language, null);
});
