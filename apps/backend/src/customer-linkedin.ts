import { parseHTML } from 'linkedom';
import { PublicResourceError } from './customer-public-resource.ts';
import { blockedRoute } from './customer-source.ts';
import { EMPTY_MANIFEST, isRestrictedStatus, mediaHost, type SocialManifest, type SocialMedia, type SocialResolver } from './customer-social-types.ts';
// Post media only. static.licdn.com serves LinkedIn's own UI sprites (reaction icons, logos).
const CDN = ['media.licdn.com', 'dms.licdn.com'];
const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';
const clean = (v: unknown, max: number) => typeof v === 'string' ? v.replace(/\r/g, '').replace(/[ \t]+\n/g, '\n').trim().slice(0, max) : '';
function ld(document: any): Record<string, any> { for (const script of document.querySelectorAll('script[type="application/ld+json"]')) { try { const value = JSON.parse(script.textContent || ''); const list = Array.isArray(value) ? value : value?.['@graph'] ?? [value]; const posting = list.find((x: any) => x?.['@type'] === 'SocialMediaPosting'); if (posting) return posting; } catch {} } return {}; }
export function parseLinkedInGuest(html: string, id: string): SocialManifest {
  const { document } = parseHTML(html);
  const meta = (name: string) => document.querySelector(`meta[property="${name}"],meta[name="${name}"]`)?.getAttribute('content');
  const commentary = document.querySelector('p.attributed-text-segment-list__content, [data-test-id="main-feed-activity-card__commentary"]');
  commentary?.querySelectorAll('br').forEach((br: any) => br.replaceWith('\n'));
  const text = clean(commentary?.textContent, 50_000) || clean(meta('og:description'), 50_000);
  const data = ld(document);
  const ogTitle = clean(meta('og:title'), 300), author = clean(data.author?.name, 200) || (ogTitle.includes(' on LinkedIn: ') ? ogTitle.split(' on LinkedIn: ')[0]! : '');
  const publishedAt = clean(data.datePublished, 100) || document.querySelector('time[datetime]')?.getAttribute('datetime') || null;
  const media: SocialMedia[] = []; let incomplete = false;
  const video = document.querySelector('video[data-sources]');
  if (video) { try { const sources = JSON.parse(video.getAttribute('data-sources') || '[]').filter((s: any) => s?.type === 'video/mp4').sort((a: any, b: any) => (Number(b['data-bitrate']) || 0) - (Number(a['data-bitrate']) || 0)); const url = mediaHost(sources[0]?.src, CDN); if (url) media.push({ kind: 'video', url }); else incomplete = true; } catch { incomplete = true; } }
  const images = [...document.querySelectorAll('img[data-delayed-url]')].map((img: any) => mediaHost(img.getAttribute('data-delayed-url'), CDN)).filter((x): x is string => !!x && !/profile-displayphoto|company-logo/.test(x));
  const fallback = mediaHost(meta('og:image'), CDN);
  for (const url of (images.length ? images : fallback && !video ? [fallback] : []).slice(0, 8)) media.push({ kind: 'image', url });
  if (!text && !media.length) throw Error('The public post is unavailable.');
  return { text, author, publishedAt: publishedAt || null, media, links: [], metadataAvailable: true, incomplete: incomplete || (!commentary && !images.length && !video) };
}
// Depth bound guards against pathological/attacker-controlled JSON; 12 comfortably
// covers the real nesting (vectorImage sits 7 levels down: included[].content.images[].attributes[].vectorImage).
function* walk(value: unknown, depth = 0): Generator<Record<string, any>> { if (depth > 12 || !value || typeof value !== 'object') return; if (Array.isArray(value)) { for (const item of value.slice(0, 500)) yield* walk(item, depth + 1); return; } yield value as Record<string, any>; for (const child of Object.values(value as object)) yield* walk(child, depth + 1); }
export function parseLinkedInVoyager(json: unknown, id: string): SocialManifest {
  const nodes = [...walk(json)];
  const update = nodes.find(n => typeof n.commentary?.text?.text === 'string' && JSON.stringify(n.entityUrn ?? n.updateMetadata?.urn ?? '').includes(id)) ?? nodes.find(n => typeof n.commentary?.text?.text === 'string');
  if (!update) throw Error('The public post is unavailable.');
  const media: SocialMedia[] = []; let incomplete = false;
  for (const node of nodes) {
    if (node.vectorImage?.rootUrl && Array.isArray(node.vectorImage.artifacts)) { const best = [...node.vectorImage.artifacts].sort((a, b) => (Number(b.width) || 0) - (Number(a.width) || 0))[0]; const url = mediaHost(String(node.vectorImage.rootUrl) + String(best?.fileIdentifyingUrlPathSegment ?? ''), CDN); if (url && !/profile-displayphoto|company-logo/.test(url) && media.length < 8 && !media.some(m => m.url === url)) media.push({ kind: 'image', url }); else if (!url) incomplete = true; }
    if (Array.isArray(node.progressiveStreams)) { const best = [...node.progressiveStreams].sort((a, b) => (Number(b.width) || 0) - (Number(a.width) || 0))[0]; const url = mediaHost(best?.streamingLocations?.[0]?.url, CDN); if (url && !media.some(m => m.url === url)) media.push({ kind: 'video', url }); else if (!url) incomplete = true; }
  }
  return { text: clean(update.commentary.text.text, 50_000), author: clean(update.actor?.name?.text, 200), publishedAt: null, media: media.slice(0, 8), links: [], metadataAvailable: true, incomplete };
}
export const resolveLinkedIn: SocialResolver = async (post, hints, signal, deps) => {
  let restricted = false;
  try {
    const page = await deps.read(post.url, { maxBytes: 3 * 1024 * 1024, signal, accept: 'text/html', headers: { 'User-Agent': BROWSER_UA, 'Accept-Language': 'en-US,en;q=0.9' } });
    if (blockedRoute(page.url) || /\/authwall/.test(page.url)) restricted = true; else return withLinks(parseLinkedInGuest(page.data.toString('utf8'), post.id), hints);
  } catch (error) { signal.throwIfAborted(); restricted = error instanceof PublicResourceError && isRestrictedStatus(error.status); }
  const session = deps.session('linkedin');
  if (!session) return { ...EMPTY_MANIFEST(), restricted, links: hints.links };
  const csrf = (session.cookie('JSESSIONID') || '').replace(/^"|"$/g, '');
  try {
    const urn = `urn:li:${post.id.includes(':') ? post.id : 'activity:' + post.id}`;
    const response = await deps.read(`https://www.linkedin.com/voyager/api/feed/updates/${urn}`, { maxBytes: 4 * 1024 * 1024, signal, accept: 'application/vnd.linkedin.normalized+json+2.1',
      headers: { 'User-Agent': BROWSER_UA, 'csrf-token': csrf, 'x-restli-protocol-version': '2.0.0', 'x-li-lang': 'en_US', accept: 'application/vnd.linkedin.normalized+json+2.1', 'Accept-Language': 'en-US,en;q=0.9' }, cookies: host => session.cookieHeader(host) });
    if (blockedRoute(response.url) || /\/authwall|\/login/.test(response.url)) { session.report('login'); return { ...EMPTY_MANIFEST(), restricted: true, links: hints.links }; }
    const manifest = parseLinkedInVoyager(JSON.parse(response.data.toString('utf8')), post.id); session.report('ok'); return withLinks(manifest, hints);
  } catch (error) {
    signal.throwIfAborted();
    const status = error instanceof PublicResourceError ? error.status : 0;
    session.report(status === 429 ? 'ratelimited' : isRestrictedStatus(status) ? 'denied' : 'ok');
    return { ...EMPTY_MANIFEST(), restricted: restricted || isRestrictedStatus(status), links: hints.links };
  }
};
const withLinks = (m: SocialManifest, hints: { links: string[] }) => { m.links = [...new Set([...m.links, ...hints.links])].slice(0, 3); return m; };
