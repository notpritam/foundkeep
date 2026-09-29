// Functions injected into pages and extension frames with page.evaluate().
// Playwright sends each function's source, so every one of them must stay
// self-contained: no imports and no references to module scope.

/**
 * A static copy of the current document: body markup with form state
 * reflected into attributes and hover/focus marked as data-fk-* (a copy
 * cannot carry :hover or :focus), the raw text of every stylesheet, and what
 * the root looks like. Scripts, links and the extension's own page elements
 * (the dock and the screenshot selector) are left out.
 */
export async function snapshotDocument({ exclude = ['foundkeep-dock', 'foundkeep-capture'] } = {}) {
  const doc = document, rootEl = doc.documentElement;
  const live = [rootEl, ...rootEl.querySelectorAll('*')];
  const clone = rootEl.cloneNode(true);
  const copies = [clone, ...clone.querySelectorAll('*')];
  const active = doc.activeElement && doc.activeElement !== doc.body ? doc.activeElement : null;
  live.forEach((el, i) => {
    const copy = copies[i];
    if (el !== rootEl && el !== doc.body && el.matches(':hover')) copy.setAttribute('data-fk-hover', '');
    if (active && el === active) {
      copy.setAttribute('data-fk-focus', '');
      if (el.matches(':focus-visible')) copy.setAttribute('data-fk-focus-visible', '');
    } else if (active && el.contains(active)) copy.setAttribute('data-fk-focus-within', '');
    if (el instanceof HTMLInputElement) {
      if (el.type === 'checkbox' || el.type === 'radio') el.checked ? copy.setAttribute('checked', '') : copy.removeAttribute('checked');
      else if (el.type !== 'file') copy.setAttribute('value', el.value);
    } else if (el instanceof HTMLTextAreaElement) copy.textContent = el.value;
    else if (el instanceof HTMLOptionElement) el.selected ? copy.setAttribute('selected', '') : copy.removeAttribute('selected');
  });
  for (const el of clone.querySelectorAll(['script', 'link', 'meta', 'title', 'noscript', 'base', 'style', ...exclude].join(','))) el.remove();
  const rebase = (text, href) => text.replace(/url\((['"]?)(?!data:|https?:|chrome-extension:|#)([^'")]+)\1\)/g, (_, _q, url) => `url("${new URL(url, href).href}")`);
  const css = [];
  for (const sheet of doc.styleSheets) {
    if (sheet.href) css.push(rebase(await (await fetch(sheet.href)).text(), sheet.href));
    else if (sheet.ownerNode?.textContent) css.push(sheet.ownerNode.textContent);
  }
  const attrs = el => [...el.attributes].map(a => [a.name, a.value]);
  const transparent = value => value === 'rgba(0, 0, 0, 0)' || value === 'transparent';
  const rootBg = getComputedStyle(rootEl).backgroundColor, bodyBg = getComputedStyle(doc.body).backgroundColor;
  return {
    css,
    html: clone.querySelector('body').innerHTML.trim(),
    htmlAttrs: attrs(rootEl),
    bodyAttrs: attrs(doc.body),
    canvas: transparent(rootBg) ? (transparent(bodyBg) ? '' : bodyBg) : rootBg,
    viewport: { width: innerWidth, height: innerHeight },
    scroll: { x: scrollX, y: scrollY },
    dark: matchMedia('(prefers-color-scheme: dark)').matches,
  };
}

/**
 * Rewrites a stylesheet so it applies inside one gallery tile and nowhere
 * else. Media queries and @supports are resolved here, against this page's
 * own viewport and preferences, so the copy keeps the look it had when
 * captured wherever it is shown. :hover / :focus / :focus-visible /
 * :focus-within also match the data-fk-* marks, so a captured hover or focus
 * shows while live hover and focus keep working. vh/vw become the captured
 * document's own viewport (--fk-vh / --fk-vw on the tile's root).
 *
 * mode 'shadow': `:host` is the root, everything else lives under it.
 * mode 'document': `:root`/`html` are the root, `body` is `${root}-b`, and
 * everything else lives under the body.
 */
export function scopeCss({ css, root, mode }) {
  const sheet = new CSSStyleSheet();
  sheet.replaceSync(css.replace(/@import[^;]+;/g, ''));
  const body = `${root}-b`;
  const splitTop = text => {
    const parts = []; let depth = 0, quote = '', current = '';
    for (const ch of text) {
      if (quote) { current += ch; if (ch === quote) quote = ''; continue; }
      if (ch === '"' || ch === "'") { quote = ch; current += ch; continue; }
      if (ch === '(' || ch === '[') depth++;
      if (ch === ')' || ch === ']') depth--;
      if (ch === ',' && depth === 0) { parts.push(current.trim()); current = ''; continue; }
      current += ch;
    }
    if (current.trim()) parts.push(current.trim());
    return parts;
  };
  const marks = selector => selector
    .replace(/:hover(?![\w-])/g, ':is(:hover,[data-fk-hover])')
    .replace(/:focus-visible(?![\w-])/g, ':is(:focus-visible,[data-fk-focus-visible])')
    .replace(/:focus-within(?![\w-])/g, ':is(:focus-within,[data-fk-focus-within],[data-fk-focus])')
    .replace(/:focus(?![\w-])/g, ':is(:focus,[data-fk-focus])');
  const scopeSelector = text => splitTop(text).map(part => {
    part = marks(part);
    let match;
    if (mode === 'shadow') return (match = part.match(/^:host(?![\w-])/)) ? root + part.slice(match[0].length) : `${root} ${part}`;
    if (part === '*') return `${root}, ${root} *`;
    if ((match = part.match(/^(?::root|html)(?![\w-])/))) return root + part.slice(match[0].length);
    if ((match = part.match(/^body(?![\w-])/))) return body + part.slice(match[0].length);
    return `${body} ${part}`;
  }).join(', ');
  const units = text => text.replace(/(-?\d*\.?\d+)(vh|vw)\b/g, (_, n, unit) => `calc(${n} * var(--fk-${unit}, 1${unit}))`);
  const rules = [], fonts = [], keyframes = [];
  const walk = list => {
    for (const rule of list) {
      if (rule instanceof CSSStyleRule) rules.push(`${scopeSelector(rule.selectorText)}{${units(rule.style.cssText)}}`);
      else if (rule instanceof CSSMediaRule) { if (matchMedia(rule.conditionText).matches) walk(rule.cssRules); }
      else if (rule instanceof CSSSupportsRule) { if (CSS.supports(rule.conditionText)) walk(rule.cssRules); }
      else if (rule instanceof CSSFontFaceRule) fonts.push(rule.cssText);
      else if (rule instanceof CSSKeyframesRule) keyframes.push(rule.cssText);
      else rules.push(rule.cssText);
    }
  };
  walk(sheet.cssRules);
  return { css: rules.join('\n'), fonts, keyframes };
}

/**
 * Every declaration in a stylesheet as { selector, property, value, media },
 * longhands and shorthands as written — the raw material for foundations.
 */
export function cssInventory({ css }) {
  const sheet = new CSSStyleSheet();
  sheet.replaceSync(css.replace(/@import[^;]+;/g, ''));
  const out = [];
  const walk = (list, media) => {
    for (const rule of list) {
      if (rule instanceof CSSStyleRule) {
        const text = rule.style.cssText;
        for (const decl of text.split(/;(?![^(]*\))/)) {
          const at = decl.indexOf(':');
          if (at < 0) continue;
          out.push({ selector: rule.selectorText, property: decl.slice(0, at).trim(), value: decl.slice(at + 1).trim(), media });
        }
      } else if (rule instanceof CSSMediaRule) walk(rule.cssRules, rule.conditionText);
      else if (rule instanceof CSSKeyframesRule) out.push({ selector: `@keyframes ${rule.name}`, property: 'keyframes', value: rule.cssText, media });
    }
  };
  walk(sheet.cssRules, '');
  return out;
}

/** PNG (base64) → WebP (base64) at the given quality, in the browser. */
export async function toWebp({ png, quality }) {
  const blob = await (await fetch(`data:image/png;base64,${png}`)).blob();
  const bitmap = await createImageBitmap(blob);
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  canvas.getContext('2d').drawImage(bitmap, 0, 0);
  const out = await canvas.convertToBlob({ type: 'image/webp', quality });
  const bytes = new Uint8Array(await out.arrayBuffer());
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return { webp: btoa(binary), width: bitmap.width, height: bitmap.height };
}
