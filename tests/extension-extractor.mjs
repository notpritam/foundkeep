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
  assert.equal(result.provenance.contentHash, null, "the extension worker hashes extracted text after leaving the page context");
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
  assert.ok(result.articleText.length <= 500_000);
});

test("marks an intentionally bounded article copy as partial instead of silently complete", async (t) => {
  const result = await extract(t, `<article><h1>Long reference</h1><p>${"useful text ".repeat(1500)}</p></article>`, "/long", {
    maxArticleCharacters: 10_000,
  });
  assert.equal(result.articleText.length, 10_000);
  assert.equal(result.provenance.extractionStatus, "partial");
  assert.match(result.provenance.extractionError, /truncated/i);
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

// Seen in a real save (2026-10-03): a Framer page came back as "NewA calmer way to build
// habitsBuild habits…Start tracking for freeStart tracking for free", one line, its headings one
// word each. Pages built from many small elements must keep their words and paragraphs apart.
test("keeps words and paragraphs apart when a page builds them from separate elements", async (t) => {
  const result = await extract(t, `<!doctype html><html><head><title>Habitline</title></head><body><main>
    <div style="display:flex;flex-direction:column"><p>New</p><h1>A calmer way to build habits</h1></div>
    <div><h2 style="display:inline-block">Build</h2><h2 style="display:inline-block">steady</h2><h2 style="display:inline-block">daily</h2><h2 style="display:inline-block">habits</h2></div>
    <div style="display:flex;flex-wrap:wrap;gap:6px"><span>with</span><span>a</span><span>layout</span><span>that</span><span>keeps</span><span>focus</span></div>
    <div style="display:flex;gap:8px"><span>Revenue</span><span>48</span></div>
    <a href="/start" style="display:block;overflow:hidden;height:20px"><div>Start tracking for free</div><div>Start tracking for free</div></a>
    <p>You see the right habits at the right time.</p><p>Stay consistent with a system that fits into real life.</p>
    <ul><li>Morning walk</li><li>Focus session</li></ul>
    <div class="sponsors"><a href="https://fonts.example">Fontbase Too many fonts to handle?</a></div>
  </main></body></html>`, "/habits");

  assert.match(result.articleText, /New\n\nA calmer way to build habits/);
  assert.match(result.articleText, /Build steady daily habits/);
  assert.match(result.articleText, /with a layout that keeps focus/, "words laid out in a flex row stay one line");
  assert.match(result.articleText, /Revenue 48/);
  assert.equal(result.articleText.match(/Start tracking for free/g)?.length, 1, "a label drawn twice for a hover effect is kept once");
  assert.match(result.articleText, /You see the right habits at the right time\.\n\nStay consistent/);
  assert.doesNotMatch(result.articleText, /habitsBuild|walkFocus|freeYou/);
  assert.doesNotMatch(result.articleText, /Fontbase/, "sponsor blocks are left out");
  assert.ok(result.provenance.headings.includes("Build steady daily habits"));
  assert.ok(!result.provenance.headings.includes("Build"), "a heading drawn one word per element stays one heading");
});

// Framer and Webflow pages fade sections in as they scroll into view; until then they sit at
// opacity 0 below the fold. Saved without scrolling, those sections must still be kept — while
// something transparent in plain view stays out (the first test).
test("keeps sections that wait below the fold to fade in, and reads headings as laid out", async (t) => {
  const result = await extract(t, `<!doctype html><html><head><title>Commit History</title></head><body><main>
    <h1>A calmer way to build habits</h1><p>The opening paragraph is in view.</p>
    <div style="height:2400px"></div>
    <section style="opacity:0;transform:translateY(40px)"><h2>Habits with structure</h2><p>A layout that keeps your day clear, revealed on scroll.</p></section>
    <h2><span>All-time</span><span style="display:inline-block">Commit</span><span style="display:inline-block">leaderboard</span></h2>
    <div style="display:flex;flex-wrap:wrap;gap:10px">${["Build", "steady", "daily", "habits"].map(word => `<div style="display:contents"><div style="display:flex;flex-direction:column"><h2>${word}</h2></div></div>`).join("")}</div>
    <div style="display:flex;gap:12px"><div><h3>Habits with structure</h3><p>Clean cards and realistic progress.</p></div><div><h3>Flexible streaks</h3><p>Miss a day without losing the streak.</p></div></div>
    <p><a href="/u/felix">felixonmars</a><span style="margin-left:6px">Felix Yan</span></p>
  </main></body></html>`, "/reveal");

  assert.match(result.articleText, /A layout that keeps your day clear, revealed on scroll\./);
  assert.ok(result.provenance.headings.includes("Habits with structure"));
  assert.ok(result.provenance.headings.includes("All-time Commit leaderboard"));
  // Framer draws a sentence one word per heading, each wrapped (display: contents, a column) in a flex row.
  assert.match(result.articleText, /Build steady daily habits/);
  assert.ok(result.provenance.headings.includes("Build steady daily habits"));
  // Cards side by side in a row keep their own paragraphs.
  assert.match(result.articleText, /Habits with structure\n\nClean cards and realistic progress\./);
  assert.match(result.articleText, /felixonmars Felix Yan/, "an inline name set apart by a margin is a separate word");
});
