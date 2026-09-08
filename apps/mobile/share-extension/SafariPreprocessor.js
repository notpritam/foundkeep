var FoundkeepPreprocessor = function () {};
FoundkeepPreprocessor.prototype = {
  run: function (arguments) {
    var text = function (value, length) {
      var normalized = String(value || '').trim();
      return normalized ? normalized.slice(0, length) : null;
    };
    var meta = function (selector, length) {
      var node = document.querySelector(selector);
      return node ? text(node.content || node.textContent, length || 2000) : null;
    };
    var canonical = document.querySelector('link[rel="canonical"]');
    var lead = meta('meta[property="og:image"]', 4096);
    var favicon = document.querySelector('link[rel~="icon"]');
    var absoluteURL = function (value) {
      if (!value) return null;
      try {
        var parsed = new URL(String(value), location.href);
        return (parsed.protocol === 'http:' || parsed.protocol === 'https:') && parsed.href.length <= 4096 ? parsed.href : null;
      } catch (_) { return null; }
    };
    var selected = String(window.getSelection ? window.getSelection() : '').trim().slice(0, 50000);
    var headings = Array.prototype.slice.call(document.querySelectorAll('h1,h2,h3'), 0, 20).map(function (node) { return String(node.innerText || '').trim().slice(0, 500); }).filter(Boolean);
    var isoDate = function (value) {
      if (!value) return null;
      var parsed = new Date(value);
      return isNaN(parsed.getTime()) ? null : parsed.toISOString();
    };
    var language = text(document.documentElement.lang, 35);
    if (language && !/^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/.test(language)) language = null;
    var result = {
      pageUrl: absoluteURL(location.href),
      canonicalUrl: absoluteURL(canonical ? canonical.href : null),
      pageTitle: text(document.title, 1000),
      siteName: meta('meta[property="og:site_name"]', 300),
      description: meta('meta[name="description"]', 2000) || meta('meta[property="og:description"]', 2000),
      authors: [meta('meta[name="author"]', 200)].filter(Boolean),
      publishedAt: isoDate(meta('meta[property="article:published_time"]')),
      modifiedAt: isoDate(meta('meta[property="article:modified_time"]')),
      language: language,
      leadImageUrl: absoluteURL(lead),
      faviconUrl: absoluteURL(favicon ? favicon.href : null),
      headings: headings,
      selectedText: selected || null,
      readableText: selected ? null : String(document.body ? document.body.innerText : '').replace(/\s+/g, ' ').trim().slice(0, 500000)
    };
    // Safari delivers this object as an Apple property list, which cannot
    // represent null. Missing optional metadata must be omitted entirely.
    Object.keys(result).forEach(function (key) {
      if (result[key] === null) delete result[key];
    });
    arguments.completionFunction(result);
  },
  finalize: function () {}
};
var ExtensionPreprocessingJS = new FoundkeepPreprocessor();
