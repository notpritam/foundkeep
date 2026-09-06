import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { chromium } from "playwright-core";
import { extractPageDocument } from "../apps/extension/src/page-extractor.js";

let browser;
before(async () => {
  browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
});
after(async () => browser?.close());

async function extract(t, html, path = "/read?id=7", options = {}) {
  const context = await browser.newContext();
  t.after(() => context.close());
  await context.route("https://news.test/**", (route) => route.fulfill({ contentType: "text/html", body: html }));
  const page = await context.newPage();
  await page.goto(`https://news.test${path}`);
  return page.evaluate(extractPageDocument, {
    captureMethod: "popup-save-page",
    capturedAt: 1_786_013_400_000,
    readableText: true,
    extendedMetadata: true,
    headings: true,
    ...options,
  });
}

test("extracts readable article text and traceable structured provenance", async (t) => {
  const result = await extract(t, `<!doctype html><html lang="en-GB"><head>
    <title>Browser title</title>
    <link rel="canonical" href="/read" />
    <link rel="icon" href="/favicon.png" />
    <meta property="og:site_name" content="Field Notes" />
    <meta property="og:title" content="A useful article" />
    <meta property="og:description" content="A precise description." />
    <meta property="og:image" content="/lead.jpg" />
    <script type="application/ld+json">{
      "@type":"NewsArticle","headline":"A useful article",
      "author":[{"@type":"Person","name":"Mina Rao"},{"name":"Eli Stone"}],
      "datePublished":"2026-08-14T09:30:00Z","dateModified":"2026-08-15T11:00:00Z"
    }</script>
  </head><body>
    <nav>Subscribe now Navigation noise</nav>
    <style>.css-hidden { display: none; }.css-invisible { visibility: hidden; }.css-transparent { opacity: 0; }</style>
    <article><h1>A useful article</h1><p>The actual first paragraph explains the finding in detail.</p>
      <p class="css-hidden">Hidden subscriber identifier 78421</p>
      <section class="css-invisible"><h2>Invisible account details</h2><p>Private invisible text</p></section>
      <p class="css-transparent">Transparent tracking copy</p>
      <aside>Advertisement and unrelated links</aside><h2>What changed</h2><p>The second paragraph contains enough useful context to preserve.</p></article>
    <footer>Newsletter signup</footer>
  </body></html>`);

  assert.equal(result.provenance.pageUrl, "https://news.test/read?id=7");
  assert.equal(result.provenance.canonicalUrl, "https://news.test/read");
  assert.equal(result.provenance.pageTitle, "A useful article");
  assert.equal(result.provenance.siteName, "Field Notes");
  assert.equal(result.provenance.description, "A precise description.");
  assert.deepEqual(result.provenance.authors, ["Mina Rao", "Eli Stone"]);
  assert.equal(result.provenance.publishedAt, "2026-08-14T09:30:00.000Z");
  assert.equal(result.provenance.modifiedAt, "2026-08-15T11:00:00.000Z");
  assert.equal(result.provenance.language, "en-GB");
  assert.equal(result.provenance.leadImageUrl, "https://news.test/lead.jpg");
  assert.equal(result.provenance.faviconUrl, "https://news.test/favicon.png");
  assert.deepEqual(result.provenance.headings, ["A useful article", "What changed"]);
  assert.match(result.articleText, /The actual first paragraph/);
  assert.match(result.articleText, /The second paragraph/);
  assert.doesNotMatch(result.articleText, /Subscribe now|Advertisement|Newsletter/);
  assert.doesNotMatch(result.articleText, /subscriber identifier|account details|invisible text|tracking copy/i);
  assert.deepEqual(result.provenance.headings, ["A useful article", "What changed"]);
  assert.match(result.provenance.contentHash, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(result.provenance.extractionStatus, "complete");
});

test("falls back to visible page text and rejects unsafe source metadata", async (t) => {
  const result = await extract(t, `<!doctype html><html><head>
    <title>Reference board</title><link rel="canonical" href="javascript:alert(1)" />
    <meta property="og:image" content="data:image/svg+xml,bad" />
    <script type="application/ld+json">{not valid json</script>
  </head><body><header>Site header</header><main><h1>Reference board</h1>
    <p>This compact page still has useful visible content for the customer.</p>
    <form><label>Private value<input value="never collect this" /></label></form>
  </main></body></html>`);

  assert.equal(result.provenance.canonicalUrl, null);
  assert.equal(result.provenance.leadImageUrl, null);
  assert.match(result.articleText, /useful visible content/);
  assert.doesNotMatch(result.articleText, /never collect this/);
  assert.ok(result.articleText.length <= 100_000);
});

test("respects bookmark content preferences while retaining origin fields", async (t) => {
  const result = await extract(t, `<!doctype html><html><head><title>Minimal save</title>
    <meta name="author" content="Ada North" /><meta name="description" content="Should be omitted" />
  </head><body><article><h1>Minimal save</h1><p>Readable content should be optional.</p></article></body></html>`, "/minimal", {
    readableText: false,
    extendedMetadata: false,
    headings: false,
  });

  assert.equal(result.articleText, null);
  assert.equal(result.provenance.pageUrl, "https://news.test/minimal");
  assert.equal(result.provenance.pageTitle, "Minimal save");
  assert.equal(result.provenance.description, null);
  assert.deepEqual(result.provenance.authors, []);
  assert.deepEqual(result.provenance.headings, []);
  assert.equal(result.provenance.contentHash, null);
});
