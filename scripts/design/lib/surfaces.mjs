// Turns raw snapshots (from the dock/selector handles or snapshotDocument)
// into "surfaces": markup plus a stylesheet scoped to one class, ready to be
// placed in a gallery tile. The class name is a hash of the scoped CSS, so
// identical styles are shared between tiles and re-captures are stable.
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { scopeCss, snapshotDocument } from './inpage.mjs';

const PLACEHOLDER = '.__fkscope__';
const hash = text => createHash('sha256').update(text).digest('hex').slice(0, 8);
export const escapeAttr = value => String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

function finish(scoped, prefix) {
  const cls = `${prefix}${hash(scoped.css + scoped.fonts.join('') + scoped.keyframes.join(''))}`;
  return { cls, css: scoped.css.split(PLACEHOLDER).join(`.${cls}`), fonts: scoped.fonts, keyframes: scoped.keyframes };
}

/** A document (a web page or an extension page/frame) as a surface. */
export async function documentSurface(frame, { exclude } = {}) {
  const raw = await frame.evaluate(snapshotDocument, exclude ? { exclude } : {});
  const scoped = await frame.evaluate(scopeCss, { css: raw.css.join('\n'), root: PLACEHOLDER, mode: 'document' });
  return { kind: 'document', ...finish(scoped, 'fkd'), html: raw.html, htmlAttrs: raw.htmlAttrs, bodyAttrs: raw.bodyAttrs, canvas: raw.canvas, viewport: raw.viewport, dark: raw.dark };
}

/**
 * A closed shadow root (the dock or the screenshot selector) from its
 * isolated-world snapshot(). Its styles are resolved in `page` (the page it
 * sits on shares its viewport and media). Framed extension pages (the
 * details card, the note field) are passed in `frames` keyed by src and
 * replace their <iframe> with the frame document's own markup.
 */
export async function shadowSurface(page, raw, frames = {}) {
  const scoped = await page.evaluate(scopeCss, { css: raw.css, root: PLACEHOLDER, mode: 'shadow' });
  const surface = { kind: 'shadow', ...finish(scoped, 'fks'), viewport: raw.viewport, boxes: raw.boxes || [], frameBoxes: raw.frames || [], embedded: [] };
  surface.html = raw.html.replace(/<iframe\b([^>]*)><\/iframe>/g, (_, attrs) => {
    const attr = name => attrs.match(new RegExp(`\\s${name}="([^"]*)"`))?.[1] ?? '';
    const src = attr('src').replace(/&amp;/g, '&');
    const doc = frames[src];
    const style = attr('style');
    const marks = ['data-fk-focus', 'data-fk-focus-visible', 'data-fk-hover'].filter(name => attrs.includes(` ${name}=`)).map(name => ` ${name}=""`).join('');
    if (!doc) return `<div class="${attr('class')}" data-fk-frame="missing" style="${style};overflow:hidden"${marks}></div>`;
    surface.embedded.push(doc);
    const height = Number(style.match(/height:\s*([\d.]+)px/)?.[1]) || doc.viewport.height;
    return `<div class="${attr('class')}" data-fk-frame="${escapeAttr(attr('title'))}" style="${style};overflow:hidden"${marks}>${documentMarkup(doc, { width: '100%', height: '100%', vh: height / 100, vw: doc.viewport.width / 100, position: 'relative' })}</div>`;
  });
  return surface;
}

/** The markup for a document surface: <html> and <body> become two divs. */
export function documentMarkup(doc, { width, height, vh, vw, position = 'absolute' }) {
  const attrs = (list, extraClass) => {
    const out = []; let cls = extraClass;
    for (const [name, value] of list) {
      if (name === 'class') cls += ' ' + value;
      else if (name !== 'style') out.push(`${name}="${escapeAttr(value)}"`);
    }
    return `class="${escapeAttr(cls)}"${out.length ? ' ' + out.join(' ') : ''}`;
  };
  const size = typeof width === 'number' ? `width:${width}px;min-height:${height}px;` : `width:${width};height:${height};`;
  const canvas = doc.canvas ? `background-color:${doc.canvas};` : '';
  return `<div ${attrs(doc.htmlAttrs, doc.cls)} style="position:${position};left:0;top:0;${size}--fk-vh:${vh}px;--fk-vw:${vw}px;${canvas}"><div ${attrs(doc.bodyAttrs, `${doc.cls}-b`)}>${doc.html}</div></div>`;
}

/** Font files referenced from extension CSS, inlined as data URIs. */
export async function inlineFonts(fontRules, repo) {
  const out = [];
  for (const rule of fontRules) {
    let text = rule;
    for (const [, url] of rule.matchAll(/url\("?([^")]+)"?\)/g)) {
      if (url.startsWith('data:')) continue;
      const file = url.match(/\/assets\/fonts\/([\w.-]+\.woff2)$/)?.[1];
      if (!file) { text = ''; break; }
      const data = (await readFile(path.join(repo, 'apps/extension/assets/fonts', file))).toString('base64');
      text = text.split(url).join(`data:font/woff2;base64,${data}`);
    }
    if (text) out.push(text);
  }
  return out;
}
