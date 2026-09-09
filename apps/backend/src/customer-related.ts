/** Explainable relationships, computed from owned metadata. No remote lookups. */
export type RelatedMetadata = {
  id: string; account_id: string; captured_at: number; batch_id: string | null;
  folder_id: string | null; source_url: string | null; canonical_url: string | null;
  page_url: string | null; manual_tags: string; tags: string;
};
export type RelatedReason = { kind: 'batch' | 'source' | 'tag' | 'folder'; label: string };

function tags(raw: string): Map<string, string> {
  try {
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value)) return new Map();
    return new Map(value.filter((tag): tag is string => typeof tag === 'string' && !!tag.trim())
      .map(tag => [tag.normalize('NFC').trim().toLowerCase(), tag.trim()]));
  } catch { return new Map(); }
}
function sources(item: RelatedMetadata) {
  return new Set([item.source_url, item.canonical_url, item.page_url].flatMap(value => {
    if (!value) return [];
    try {
      const url = new URL(value);
      if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) return [];
      // Keep query strings: many sites identify distinct content through them.
      url.hash = ''; return [url.href];
    } catch { return []; }
  }));
}
export function relatedCaptures(current: RelatedMetadata, candidates: RelatedMetadata[]) {
  const currentTags = new Map([...tags(current.tags), ...tags(current.manual_tags)]);
  const currentSources = sources(current);
  const seen = new Set([current.id]);
  return candidates.flatMap(item => {
    if (item.account_id !== current.account_id || seen.has(item.id)) return [];
    seen.add(item.id);
    const reasons: RelatedReason[] = [];
    let score = 0;
    if (current.batch_id && item.batch_id === current.batch_id) { reasons.push({ kind: 'batch', label: 'Saved together' }); score += 100; }
    if ([...sources(item)].some(url => currentSources.has(url))) { reasons.push({ kind: 'source', label: 'Same source' }); score += 80; }
    const itemTags = new Map([...tags(item.tags), ...tags(item.manual_tags)]);
    const shared = [...currentTags].filter(([key]) => itemTags.has(key)).map(([, name]) => name);
    if (shared.length) { reasons.push({ kind: 'tag', label: `Shared ${shared.length === 1 ? 'tag' : 'tags'}: ${shared.slice(0, 2).join(', ')}${shared.length > 2 ? ` +${shared.length - 2}` : ''}` }); score += Math.min(3, shared.length) * 20; }
    if (current.folder_id && item.folder_id === current.folder_id) { reasons.push({ kind: 'folder', label: 'Same folder' }); score += 10; }
    return score ? [{ id: item.id, reasons, score, capturedAt: item.captured_at }] : [];
  }).sort((a, b) => b.score - a.score || b.capturedAt - a.capturedAt || a.id.localeCompare(b.id)).slice(0, 6)
    .map(({ id, reasons }) => ({ id, reasons }));
}
