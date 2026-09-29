// Builds the HTML Launchpad previews: a labelled gallery of states for each
// component (every state a framed tile of real captured markup + scoped CSS,
// so hover and focus still work), and a full-bleed page for each screen.
//
// A tile places captured surfaces in a "viewport" box the size of the page
// they were captured on. The box is transformed, which makes it the
// containing block for the extension's position:fixed elements, so they land
// exactly where they were; the tile then crops (and optionally scales) the
// region worth looking at.
import { documentMarkup } from './surfaces.mjs';

const esc = value => String(value ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

export function union(boxes, pad, viewport) {
  const live = boxes.filter(b => b && b.width > 0 && b.height > 0);
  if (!live.length) return { x: 0, y: 0, width: viewport.width, height: viewport.height };
  let x0 = Math.min(...live.map(b => b.x)) - pad, y0 = Math.min(...live.map(b => b.y)) - pad;
  let x1 = Math.max(...live.map(b => b.x + b.width)) + pad, y1 = Math.max(...live.map(b => b.y + b.height)) + pad;
  x0 = Math.max(0, x0); y0 = Math.max(0, y0); x1 = Math.min(viewport.width, x1); y1 = Math.min(viewport.height, y1);
  return { x: Math.floor(x0), y: Math.floor(y0), width: Math.ceil(x1 - x0), height: Math.ceil(y1 - y0) };
}

function surfaceMarkup(surface) {
  if (surface.kind === 'shadow') return `<div class="${surface.cls}">${surface.html}</div>`;
  const { width, height } = surface.viewport;
  return documentMarkup(surface, { width, height, vh: height / 100, vw: width / 100 });
}

/** One framed state. `tile.image` (a real screenshot) replaces layers where
 *  a state only exists mid-animation. */
function tileMarkup(tile) {
  const scale = tile.scale || 1;
  if (tile.image) {
    const w = Math.round(tile.image.cssWidth * scale), h = Math.round(tile.image.cssHeight * scale);
    return `<div class="lp-tile" style="--fit:${Math.min(1, 340 / w).toFixed(3)}"><div class="lp-stage lp-shot" style="width:${w}px;height:${h}px"><img alt="${esc(tile.title)}" src="data:image/webp;base64,${tile.image.webp}" width="${w}" height="${h}"></div>${caption(tile)}</div>`;
  }
  const clip = tile.clip, viewport = tile.viewport;
  const w = Math.round(clip.width * scale), h = Math.round(clip.height * scale);
  const layers = tile.layers.map(surfaceMarkup).join('');
  return `<div class="lp-tile${tile.freeze ? ' lp-freeze' : ''}${tile.backdrop === 'page' ? ' lp-on-page' : ''}" style="--fit:${Math.min(1, 340 / w).toFixed(3)}"><div class="lp-stage" style="width:${w}px;height:${h}px"><div class="lp-vp" style="width:${viewport.width}px;height:${viewport.height}px;transform:scale(${scale}) translate(${-clip.x}px,${-clip.y}px)">${layers}</div></div>${caption(tile)}</div>`;
}
const caption = tile => `<div class="lp-cap"><strong>${esc(tile.title)}</strong>${tile.caption ? `<p>${esc(tile.caption)}</p>` : ''}</div>`;

const CHROME = `
html{background:#f4f4f5}
body.lp{margin:0;padding:28px 28px 56px;background:#f4f4f5;color:#18181b;font:14px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif;-webkit-font-smoothing:antialiased}
.lp-head{max-width:980px}
.lp-head h1{margin:0 0 6px;font-size:22px;line-height:1.25;letter-spacing:-.01em}
.lp-head p{margin:0;color:#52525b}
.lp-meta{margin-top:8px!important;font-size:12px;color:#71717a!important}
.lp-group>h2{margin:30px 0 12px;font-size:12px;font-weight:650;letter-spacing:.08em;text-transform:uppercase;color:#71717a}
.lp-grid{display:flex;flex-wrap:wrap;gap:20px;align-items:flex-start}
.lp-tile{display:flex;flex-direction:column;width:min-content;background:#fff;border:1px solid #e4e4e7;border-radius:14px;overflow:hidden;box-shadow:0 1px 2px rgba(0,0,0,.04)}
.lp-stage{position:relative;overflow:hidden;background-color:#fafafa;background-image:radial-gradient(#e4e4e7 1px,transparent 1px);background-size:16px 16px}
.lp-on-page .lp-stage{background:#fff}
.lp-shot img{display:block}
.lp-vp{position:absolute;left:0;top:0;transform-origin:0 0}
.lp-cap{padding:10px 14px 12px;border-top:1px solid #f0f0f1}
.lp-cap strong{display:block;font-size:13px;font-weight:600}
.lp-cap p{margin:2px 0 0;color:#71717a;font-size:12px;line-height:1.45}
.lp-freeze .flash{animation-play-state:paused!important}
@media (max-width:720px){body.lp{padding:16px 12px 40px}.lp-stage{zoom:var(--fit,1)}}`;

/** Base rules for each captured surface class, placed before its own CSS:
 *  a fresh root (the gallery's styles must not leak in) and UA box sizing
 *  (Launchpad's preview adds a global border-box). */
function baseRules(surface) {
  const c = `.${surface.cls}`;
  const sizing = `${c},${c} :where(:not(button,select,meter,progress,input:is([type=button],[type=submit],[type=reset],[type=checkbox],[type=radio],[type=search],[type=color],[type=image],[type=file]))),${c} :where(*)::before,${c} :where(*)::after{box-sizing:content-box}`;
  if (surface.kind === 'shadow') return sizing;
  return `${c}{all:initial;display:block}${c}-b{display:block;margin:8px}${sizing}`;
}

function collectStyles(tiles) {
  const surfaces = new Map(), fonts = new Set(), keyframes = new Set();
  const add = surface => {
    if (!surfaces.has(surface.cls)) surfaces.set(surface.cls, surface);
    for (const f of surface.fontsInline || []) fonts.add(f);
    for (const k of surface.keyframes) keyframes.add(k);
    for (const inner of surface.embedded || []) add(inner);
  };
  for (const tile of tiles) for (const layer of tile.layers || []) add(layer);
  const css = [...surfaces.values()].map(s => `${baseRules(s)}\n${s.css}`).join('\n');
  return { fonts: [...fonts].join('\n'), keyframes: [...keyframes].join('\n'), css };
}

/** The component's gallery page. `groups`: [{ title, tiles }]. */
export function galleryPage({ title, summary, meta, groups }) {
  const tiles = groups.flatMap(g => g.tiles);
  const styles = collectStyles(tiles);
  const body = groups.map(g => `<div class="lp-group"><h2>${esc(g.title)}</h2><div class="lp-grid">${g.tiles.map(tileMarkup).join('')}</div></div>`).join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${esc(title)}</title>
<style>${CHROME}</style>
${styles.fonts ? `<style>${styles.fonts}</style>` : ''}
<style>${styles.keyframes}\n${styles.css}</style></head>
<body class="lp"><div class="lp-head"><h1>${esc(title)}</h1><p>${esc(summary)}</p><p class="lp-meta">${esc(meta)}</p></div>${body}</body></html>`;
}

/** A full-bleed screenshot page, with optional hotspots (data-screen links
 *  Launchpad's prototype follows). Hotspots are placeholders `{{screen:key}}`
 *  until publish knows the screen artifact ids. */
export function screenPage({ title, image, viewport, hotspots = [] }) {
  const pct = (v, total) => `${((v / total) * 100).toFixed(3)}%`;
  const spots = hotspots.map(h => `<a class="hot" data-screen="{{screen:${h.to}}}" aria-label="${esc(h.label)}" title="${esc(h.label)}" style="left:${pct(h.rect.x, viewport.width)};top:${pct(h.rect.y, viewport.height)};width:${pct(h.rect.width, viewport.width)};height:${pct(h.rect.height, viewport.height)}"></a>`).join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${esc(title)}</title><style>
html,body{margin:0;background:#fff}
.screen{position:relative}
.screen img{display:block;width:100%;height:auto}
.hot{position:absolute;display:block;border-radius:10px}
.hot:hover{background:rgba(76,195,138,.14);box-shadow:0 0 0 2px rgba(76,195,138,.9)}
</style></head><body><div class="screen"><img alt="${esc(title)}" src="data:image/webp;base64,${image.webp}" width="${viewport.width}" height="${viewport.height}">${spots}</div></body></html>`;
}
