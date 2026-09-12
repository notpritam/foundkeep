// Browser exports are parsed as text: no DOM, resource loads, or executable HTML.
export const IMPORT_MAX_BYTES = 8 * 1024 * 1024;
export const IMPORT_MAX_ENTRIES = 10_000;
const MAX_DEPTH = 20;
const entities = { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', nbsp: ' ' };
function decode(value) {
  return value.replace(/&(#x[0-9a-f]+|#\d+|amp|quot|apos|lt|gt|nbsp);/gi, (all, key) => {
    if (key[0] !== '#') return entities[key.toLowerCase()] || all;
    const point = key[1].toLowerCase() === 'x' ? parseInt(key.slice(2), 16) : parseInt(key.slice(1), 10);
    return point > 0 && point <= 0x10ffff && !(point >= 0xd800 && point <= 0xdfff) ? String.fromCodePoint(point) : '\ufffd';
  });
}
const clean = (value, max = 500) => String(value || '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
function bookmarkUrl(value) {
  try { const url = new URL(String(value || '').trim()); return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password && url.href.length <= 4096 ? url.href : null; } catch { return null; }
}
function collector() {
  const entries = []; let skipped = 0;
  return {
    entries,
    add(input) {
      const url = bookmarkUrl(input.url);
      if (!url) { skipped++; return; }
      if (entries.length >= IMPORT_MAX_ENTRIES) throw new Error('Import up to 10,000 bookmarks at a time. Split this export into smaller files.');
      const entry = { url, title: clean(input.title) || new URL(url).hostname, folderPath: input.folderPath.map(name => clean(name, 80)).filter(Boolean) };
      if (input.sourceId) entry.sourceId = String(input.sourceId).slice(0, 100);
      if (Number.isSafeInteger(input.addedAt) && input.addedAt >= 0 && input.addedAt <= Date.now() + 86_400_000) entry.addedAt = input.addedAt;
      if (input.tags?.length) entry.tags = [...new Set(input.tags.map(tag => clean(tag, 40)).filter(Boolean))].slice(0, 20);
      entries.push(entry);
      return entry;
    },
    result() { return { entries, skipped, warnings: skipped ? [`${skipped} unsupported or invalid bookmark URLs were skipped.`] : [] }; },
  };
}
export function flattenBookmarkTree(nodes) {
  if (!Array.isArray(nodes)) throw new Error('Choose a valid browser bookmark tree.');
  const result = collector(); let visited = 0;
  const walk = (items, folderPath, depth) => {
    if (depth > MAX_DEPTH) throw new Error('These bookmark folders are too deeply nested (maximum 20 levels).');
    for (const node of items) {
      if (++visited > 30_000) throw new Error('This bookmark tree is too large. Import a smaller export.');
      if (!node || typeof node !== 'object') continue;
      if (node.url) result.add({ url: node.url, title: node.title, folderPath, addedAt: node.dateAdded, sourceId: node.id });
      else if (Array.isArray(node.children)) walk(node.children, node.title ? [...folderPath, node.title] : folderPath, depth + 1);
    }
  };
  walk(nodes, [], 0);
  return result.result();
}
function attributes(tag) {
  const values = {};
  for (const match of tag.matchAll(/([\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)) values[match[1].toLowerCase()] = decode(match[2] ?? match[3] ?? match[4]);
  return values;
}
export function parseBookmarkHtml(html) {
  if (typeof html !== 'string' || html.length > IMPORT_MAX_BYTES || new TextEncoder().encode(html).length > IMPORT_MAX_BYTES) throw new Error('This bookmark file is too large. Use a file smaller than 8 MiB.');
  if (!/<dl\b/i.test(html)) throw new Error('Choose a browser bookmark HTML export.');
  const result = collector(); const stack = []; let folderPath = []; let pendingFolder = ''; let reading = ''; let text = ''; let attrs = {}; let lastEntry;
  const flush = () => {
    if (reading === 'h3') pendingFolder = clean(decode(text), 80);
    if (reading === 'a') lastEntry = result.add({ url: attrs.href, title: decode(text), folderPath: [...folderPath], addedAt: /^\d+$/.test(attrs.add_date || '') ? Number(attrs.add_date) * 1000 : undefined, tags: attrs.tags ? attrs.tags.split(',') : undefined });
    if (reading === 'dd' && lastEntry && clean(decode(text), 2000)) lastEntry.description = clean(decode(text), 2000);
    reading = ''; text = ''; attrs = {};
  };
  let position = 0;
  while (position < html.length) {
    if (html[position] !== '<') {
      const next = html.indexOf('<', position); const end = next < 0 ? html.length : next;
      if (reading) text += html.slice(position, end);
      position = end; continue;
    }
    if (html.startsWith('<!--', position)) { const end = html.indexOf('-->', position + 4); position = end < 0 ? html.length : end + 3; continue; }
    let end = position + 1; let quote = '';
    for (; end < html.length; end++) {
      const char = html[end];
      if (quote) { if (char === quote) quote = ''; }
      else if (char === '"' || char === "'") quote = char;
      else if (char === '>') break;
    }
    const tag = html.slice(position, end + 1); position = end + 1;
    const match = /^<\s*(\/?)\s*([a-z][\w-]*)/i.exec(tag); if (!match) continue;
    const closing = !!match[1]; const name = match[2].toLowerCase();
    if (!closing && ['script', 'style', 'iframe'].includes(name)) {
      const close = new RegExp(`</${name}\\s*>`, 'ig'); close.lastIndex = position;
      const found = close.exec(html); position = found ? close.lastIndex : html.length; continue;
    }
    if (name === 'dl') {
      flush(); lastEntry = undefined;
      if (closing) { folderPath = stack.pop() || []; pendingFolder = ''; }
      else {
        if (stack.length >= MAX_DEPTH) throw new Error('These bookmark folders are too deeply nested (maximum 20 levels).');
        stack.push(folderPath); if (pendingFolder) folderPath = [...folderPath, pendingFolder]; pendingFolder = '';
      }
    } else if (['h3', 'a', 'dd'].includes(name)) {
      if (closing) { if (reading === name) flush(); }
      else { flush(); if(name==='h3')lastEntry=undefined; reading = name; attrs = attributes(tag); }
    } else if (!closing && name === 'dt') flush();
    else if (reading && ['br', 'p'].includes(name)) text += ' ';
  }
  flush(); return result.result();
}

// Limit encoded bytes as well as entry count: Unicode folder paths and metadata
// can make a valid HTML export much larger after conversion to JSON.
export function importChunk(entries,offset=0,maxBytes=700*1024) {
  const encoder=new TextEncoder();const chunk=[];let bytes=2048;
  for(const item of entries.slice(offset,offset+100)) {
    const size=encoder.encode(JSON.stringify(item)).byteLength+1;
    if(bytes+size>maxBytes){if(!chunk.length)throw new Error('A bookmark is too large to import.');break;}
    chunk.push(item);bytes+=size;
  }
  return chunk;
}
