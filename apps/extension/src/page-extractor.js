/**
 * Extract a bounded, readable archive and provenance from the current document.
 * This function is intentionally self-contained so Chrome can serialize it into
 * an active tab through chrome.scripting.executeScript({ func }).
 */
export async function extractPageDocument(options = {}) {
  const normalize = (value, max) => {
    if (typeof value !== "string") return null;
    const text = value.replace(/\s+/g, " ").trim();
    return text ? text.slice(0, max) : null;
  };
  const safeUrl = (value) => {
    const text = normalize(value, 4096);
    if (!text) return null;
    try {
      const url = new URL(text, location.href);
      if (!["http:", "https:"].includes(url.protocol) || url.username || url.password)
        return null;
      return url.href;
    } catch {
      return null;
    }
  };
  const meta = (...selectors) => {
    for (const selector of selectors) {
      const value = document.querySelector(selector)?.getAttribute("content");
      if (normalize(value, 4000)) return value;
    }
    return null;
  };
  const isoDate = (value) => {
    const text = normalize(value, 64);
    if (!text) return null;
    const date = new Date(text);
    return Number.isNaN(date.valueOf()) ? null : date.toISOString();
  };
  const jsonArticles = [];
  const visitJson = (value) => {
    if (Array.isArray(value)) return value.forEach(visitJson);
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value["@graph"])) value["@graph"].forEach(visitJson);
    const types = Array.isArray(value["@type"]) ? value["@type"] : [value["@type"]];
    if (types.some((type) => typeof type === "string" && /(?:News|BlogPosting|Article|Report)$/i.test(type)))
      jsonArticles.push(value);
  };
  for (const script of document.querySelectorAll('script[type="application/ld+json"]')) {
    try { visitJson(JSON.parse(script.textContent || "null")); }
    catch { /* Malformed publisher metadata must not prevent the save. */ }
  }
  const structured = jsonArticles[0] || {};
  const authorNames = [];
  const addAuthor = (author) => {
    const name = normalize(typeof author === "string" ? author : author?.name, 200);
    if (name && !authorNames.includes(name) && authorNames.length < 8) authorNames.push(name);
  };
  if (Array.isArray(structured.author)) structured.author.forEach(addAuthor);
  else addAuthor(structured.author);
  const domAuthor = meta('meta[name="author"]', 'meta[property="article:author"]');
  if (!authorNames.length && domAuthor) domAuthor.split(/\s*,\s*/).forEach(addAuthor);

  const candidates = [
    ...document.querySelectorAll("article, [itemprop='articleBody']"),
    ...document.querySelectorAll("main, [role='main']"),
  ];
  let root = candidates
    .filter((node, index) => candidates.indexOf(node) === index)
    .sort((a, b) => (b.innerText || "").length - (a.innerText || "").length)[0] || document.body;
  const clone = root?.cloneNode(true);
  if (clone?.querySelectorAll) {
    const liveNodes = [root];
    const clonedNodes = [clone];
    const liveDescendants = root.querySelectorAll("*");
    const clonedDescendants = clone.querySelectorAll("*");
    const styleCount = Math.min(25_000, liveDescendants.length, clonedDescendants.length);
    for (let index = 0; index < styleCount; index++) {
      liveNodes.push(liveDescendants[index]);
      clonedNodes.push(clonedDescendants[index]);
    }
    liveNodes.forEach((node, index) => {
      const style = getComputedStyle(node);
      const copy = clonedNodes[index];
      // Transparent below the fold is a section waiting to fade in as you scroll (Framer,
      // Webflow); transparent in plain view is hidden.
      const waiting = Number(style.opacity) === 0 && node.getBoundingClientRect().top >= innerHeight - 1;
      if (style.display === "none" || style.visibility === "hidden" || style.visibility === "collapse" ||
          style.contentVisibility === "hidden" || (Number(style.opacity) === 0 && !waiting)) return copy?.remove();
      // How the page lays each element out, so the text can be read the way it looks: blocks
      // as paragraphs, inline-blocks and the items of a flex row as words on one line.
      const apart = (side) => parseFloat(style[`margin${side}`]) + parseFloat(style[`padding${side}`]) >= 4;
      copy?.setAttribute("data-foundkeep-flow", style.display === "contents" ? "contents"
        : /^inline-(block|flex|grid|table)$/.test(style.display) ? "gap"
        : style.display === "inline" ? (apart("Left") || apart("Right") ? "gap" : "inline") : "block");
      if (/flex$/.test(style.display) && !/column/.test(style.flexDirection)) copy?.setAttribute("data-foundkeep-row", "");
    });
    const discard = [
      "script", "style", "noscript", "nav", "footer", "header", "aside", "form", "button",
      "input", "textarea", "select", "option", "dialog", "iframe", "canvas", "svg", "[hidden]",
      '[aria-hidden="true"]', "[inert]",
    ].join(",");
    clone.querySelectorAll(discard).forEach((node) => node.remove());
    clone.querySelectorAll("[class], [id]").forEach((node) => {
      const marker = `${node.id || ""} ${node.className || ""}`;
      if (/(^|[\s_-])(advert|ads?|newsletter|subscribe|cookie|promo|social|share|related|sponsors?|sponsored)([\s_-]|$)/i.test(marker)) node.remove();
    });
  }
  const articleLimit = Number.isSafeInteger(options.maxArticleCharacters)
    ? Math.max(10_000, Math.min(500_000, options.maxArticleCharacters))
    : 500_000;
  // A copy taken out of the page has no layout, so its innerText runs every element together
  // ("habitsBuild"). Read it as the page lays it out instead (data-foundkeep-flow, above; by
  // tag past the styled limit): a paragraph per block, a space between words drawn as separate
  // elements, and a label drawn twice for a hover effect kept once.
  const BLOCK_TAGS = /^(ADDRESS|ARTICLE|ASIDE|BLOCKQUOTE|CAPTION|DD|DETAILS|DIV|DL|DT|FIGCAPTION|FIGURE|FOOTER|H[1-6]|HEADER|HR|LI|MAIN|NAV|OL|P|PRE|SECTION|SUMMARY|TABLE|TBODY|TD|TFOOT|TH|THEAD|TR|UL)$/;
  const ownFlow = (node) => node.getAttribute("data-foundkeep-flow") || (BLOCK_TAGS.test(node.tagName) ? "block" : "inline");
  const parentOf = (node) => { let up = node.parentElement; while (up && ownFlow(up) === "contents") up = up.parentElement; return up; };
  // One line of words: a short item with at most one block that holds text.
  const oneLine = (node) => (node.textContent || "").trim().length <= 80 &&
    [node, ...node.querySelectorAll("*")].filter((each) => ownFlow(each) === "block" &&
      [...each.childNodes].some((child) => child.nodeType === 3 && child.data.trim())).length <= 1;
  // The items of a flex row sit side by side (seen through display: contents wrappers): a word or
  // a label each, unless they hold paragraphs of their own (cards side by side).
  const rowItem = (node) => Boolean(parentOf(node)?.hasAttribute("data-foundkeep-row")) && oneLine(node);
  const flowOf = (node) => {
    const own = ownFlow(node);
    return own === "block" && rowItem(node) ? "gap" : own;
  };
  const readable = (from) => {
    const lines = [];
    let line = "";
    const end = () => { const text = line.replace(/\s+/g, " ").trim(); if (text) lines.push(text); line = ""; };
    // Inside a word or label (`unit`), its own blocks don't break the line.
    const visit = (node, unit) => {
      if (node.nodeType === 3) { line += node.data; return; }
      if (node.nodeType !== 1) return;
      if (node.tagName === "BR") return unit ? void (line += " ") : end();
      const flow = flowOf(node);
      const breaks = flow === "block" && !unit;
      const spaced = !breaks && (flow === "gap" || flow === "block");
      if (breaks) end(); else if (spaced) line += " ";
      const inner = unit || (flow === "gap" && oneLine(node));
      node.childNodes.forEach((child) => visit(child, inner));
      if (breaks) end(); else if (spaced) line += " ";
    };
    visit(from, false);
    end();
    const kept = [];
    for (const each of lines) {
      // Only labels (a button, a link) are drawn twice; a long passage that repeats is the page's own.
      const text = each.length <= 160 ? each.replace(/^(.{6,}?) ?\1$/, "$1") : each;
      if (kept[kept.length - 1] !== text) kept.push(text);
    }
    return kept.join("\n\n");
  };
  // The flex row a heading sits in as one of its words, if it does.
  const wordRow = (node) => {
    for (let item = node; ;) {
      const up = parentOf(item);
      if (!up) return null;
      if (up.hasAttribute("data-foundkeep-row")) return rowItem(item) ? up : null;
      if (up.children.length !== 1) return null;
      item = up;
    }
  };
  const rawArticleText = options.readableText === false || !clone ? "" : readable(clone);
  const articleWasTruncated = rawArticleText.length > articleLimit;
  const articleText = rawArticleText ? rawArticleText.slice(0, articleLimit) : null;
  // A heading drawn one word per element (text effects) is one heading, not a heading per word.
  const headingTexts = [];
  if (options.headings !== false && clone?.querySelectorAll) {
    let previous = null;
    for (const node of clone.querySelectorAll("h1,h2,h3")) {
      const text = normalize(readable(node), 500);
      if (!text) continue;
      const row = wordRow(node);
      if (previous && ((previous.nextElementSibling === node && flowOf(node) !== "block" && flowOf(previous) !== "block") ||
          (row && row === wordRow(previous))))
        headingTexts[headingTexts.length - 1] = normalize(`${headingTexts[headingTexts.length - 1]} ${text}`, 500);
      else headingTexts.push(text);
      previous = node;
    }
  }
  const headings = headingTexts.filter((value, index, values) => values.indexOf(value) === index).slice(0, 20);
  const extended = options.extendedMetadata !== false;
  const pageTitle = normalize(
    structured.headline || meta('meta[property="og:title"]', 'meta[name="twitter:title"]') || document.title,
    1000,
  );
  const canonicalUrl = safeUrl(document.querySelector('link[rel~="canonical"]')?.getAttribute("href"));
  const leadImageValue = typeof structured.image === "string"
    ? structured.image
    : Array.isArray(structured.image)
      ? structured.image[0]?.url || structured.image[0]
      : structured.image?.url;
  const capturedAt = Number.isSafeInteger(options.capturedAt) ? options.capturedAt : Date.now();
  const provenance = {
    schemaVersion: 1,
    captureMethod: options.captureMethod || "popup-save-page",
    pageUrl: safeUrl(location.href),
    canonicalUrl,
    pageTitle,
    siteName: extended ? normalize(meta('meta[property="og:site_name"]') || structured.publisher?.name, 300) : null,
    description: extended ? normalize(meta('meta[property="og:description"]', 'meta[name="description"]', 'meta[name="twitter:description"]') || structured.description, 2000) : null,
    authors: extended ? authorNames : [],
    publishedAt: extended ? isoDate(structured.datePublished || meta('meta[property="article:published_time"]', 'meta[name="date"]')) : null,
    modifiedAt: extended ? isoDate(structured.dateModified || meta('meta[property="article:modified_time"]')) : null,
    language: normalize(document.documentElement.lang, 35),
    leadImageUrl: extended ? safeUrl(leadImageValue || meta('meta[property="og:image"]', 'meta[name="twitter:image"]')) : null,
    faviconUrl: extended ? safeUrl(document.querySelector('link[rel~="icon"]')?.getAttribute("href")) : null,
    targetUrl: null,
    headings,
    capturedAt,
    extractedAt: Date.now(),
    extractorVersion: 1,
    // The extension worker computes this after extraction. Web Crypto is not
    // available to injected functions on every ordinary HTTP page.
    contentHash: null,
    extractionStatus: articleText && !articleWasTruncated ? "complete" : "partial",
    extractionError: articleWasTruncated
      ? `Readable page text exceeded ${articleLimit.toLocaleString("en-US")} characters and was truncated.`
      : articleText
        ? null
        : "Readable page text was not requested or unavailable.",
  };
  return { articleText, provenance };
}
