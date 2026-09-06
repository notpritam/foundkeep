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
    const liveNodes = [root, ...root.querySelectorAll("*")];
    const clonedNodes = [clone, ...clone.querySelectorAll("*")];
    liveNodes.forEach((node, index) => {
      const style = getComputedStyle(node);
      if (style.display === "none" || style.visibility === "hidden" || style.visibility === "collapse" ||
          style.contentVisibility === "hidden" || Number(style.opacity) === 0) clonedNodes[index]?.remove();
    });
    const discard = [
      "script", "style", "noscript", "nav", "footer", "header", "aside", "form", "button",
      "input", "textarea", "select", "option", "dialog", "iframe", "canvas", "svg", "[hidden]",
      '[aria-hidden="true"]', "[inert]",
    ].join(",");
    clone.querySelectorAll(discard).forEach((node) => node.remove());
    clone.querySelectorAll("[class], [id]").forEach((node) => {
      const marker = `${node.id || ""} ${node.className || ""}`;
      if (/(^|[\s_-])(advert|ads?|newsletter|subscribe|cookie|promo|social|share|related)([\s_-]|$)/i.test(marker)) node.remove();
    });
  }
  const articleText = options.readableText === false
    ? null
    : normalize(clone?.innerText || clone?.textContent || "", 100_000);
  const headings = options.headings === false || !clone?.querySelectorAll
    ? []
    : [...clone.querySelectorAll("h1,h2,h3")]
        .map((node) => normalize(node.textContent, 500))
        .filter(Boolean)
        .filter((value, index, values) => values.indexOf(value) === index)
        .slice(0, 20);
  let contentHash = null;
  if (articleText) {
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(articleText));
    let binary = "";
    for (const byte of new Uint8Array(digest)) binary += String.fromCharCode(byte);
    contentHash = btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
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
    contentHash,
    extractionStatus: articleText ? "complete" : "partial",
    extractionError: articleText ? null : "Readable page text was not requested or unavailable.",
  };
  return { articleText, provenance };
}
