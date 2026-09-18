import { parseHTML } from 'linkedom';
import { PublicResourceError } from './customer-public-resource.ts';
import { blockedRoute } from './customer-source.ts';
import { EMPTY_MANIFEST, isoDate, isRestrictedStatus, mediaHost, type SocialManifest, type SocialMedia, type SocialResolver } from './customer-social-types.ts';
const CDN = ['cdninstagram.com', 'fbcdn.net'];
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';
export function shortcodeToMediaId(code: string): string {
  let id = 0n;
  for (const char of code.slice(0, 11)) { const index = ALPHABET.indexOf(char); if (index < 0) throw Error('Invalid shortcode.'); id = id * 64n + BigInt(index); }
  return id.toString();
}
const author = (name: unknown, handle: unknown) => { const n = typeof name === 'string' ? name.trim().slice(0, 200) : '', h = typeof handle === 'string' ? handle.trim().slice(0, 50) : ''; return n && h ? `${n} (@${h})` : h ? `@${h}` : n; };
function pushNode(media: SocialMedia[], node: any, flags: { incomplete: boolean }) {
  const video = node?.is_video ? mediaHost(node.video_url, CDN) : null, image = mediaHost(node?.display_url, CDN);
  if (node?.is_video) { if (video) media.push({ kind: 'video', url: video }); else flags.incomplete = true; }
  if (image) media.push({ kind: 'image', url: image }); else if (!node?.is_video) flags.incomplete = true;
}
export function parseInstagramEmbed(html: string, code: string): SocialManifest {
  const flags = { incomplete: false }; const media: SocialMedia[] = [];
  const blob = html.match(/"init",\[\],\[(.*?)\]\],/s)?.[1];
  if (blob) {
    try {
      const context = JSON.parse(JSON.parse(blob).contextJSON);
      const node = context?.gql_data?.shortcode_media ?? context?.gql_data?.xdt_shortcode_media;
      if (node && (!node.shortcode || node.shortcode === code)) {
        const children = node.edge_sidecar_to_children?.edges?.map((e: any) => e?.node).filter(Boolean) ?? [];
        for (const child of (children.length ? children : [node]).slice(0, 8)) pushNode(media, child, flags);
        return { text: String(node.edge_media_to_caption?.edges?.[0]?.node?.text ?? '').slice(0, 50_000), author: author(node.owner?.full_name, node.owner?.username), publishedAt: isoDate(node.taken_at_timestamp), media: media.slice(0, 8), links: [], metadataAvailable: true, incomplete: flags.incomplete };
      }
    } catch { /* fall through to markup */ }
  }
  const { document } = parseHTML(html);
  const caption = document.querySelector('.Caption'), user = caption?.querySelector('.CaptionUsername')?.textContent?.trim() || '';
  caption?.querySelector('.CaptionUsername')?.remove();
  const image = mediaHost(document.querySelector('img.EmbeddedMediaImage')?.getAttribute('src'), CDN);
  if (image) media.push({ kind: 'image', url: image });
  const text = (caption?.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 50_000);
  if (!text && !image) throw Error('The public post is unavailable.');
  return { text, author: author('', user), publishedAt: null, media, links: [], metadataAvailable: true, incomplete: true };
}
export function parseInstagramMediaInfo(json: unknown, code: string): SocialManifest {
  const item = (json as any)?.items?.[0];
  if (!item || item.code !== code) throw Error('The public post is unavailable.');
  const flags = { incomplete: false }; const media: SocialMedia[] = [];
  for (const slide of (Array.isArray(item.carousel_media) && item.carousel_media.length ? item.carousel_media : [item]).slice(0, 8)) {
    const video = mediaHost(slide?.video_versions?.[0]?.url, CDN), image = mediaHost(slide?.image_versions2?.candidates?.[0]?.url, CDN);
    if (slide?.video_versions?.length) { if (video) media.push({ kind: 'video', url: video }); else flags.incomplete = true; }
    if (image) media.push({ kind: 'image', url: image }); else if (!slide?.video_versions?.length) flags.incomplete = true;
  }
  return { text: String(item.caption?.text ?? '').slice(0, 50_000), author: author(item.user?.full_name, item.user?.username), publishedAt: isoDate(item.taken_at), media: media.slice(0, 8), links: [], metadataAvailable: true, incomplete: flags.incomplete };
}
export const resolveInstagram: SocialResolver = async (post, hints, signal, deps) => {
  let restricted = false;
  try {
    const page = await deps.read(`https://www.instagram.com/p/${post.id}/embed/captioned/`, { maxBytes: 2 * 1024 * 1024, signal, accept: 'text/html', headers: { 'User-Agent': BROWSER_UA, 'Accept-Language': 'en-US,en;q=0.9' } });
    if (blockedRoute(page.url)) restricted = true; else return withHints(parseInstagramEmbed(page.data.toString('utf8'), post.id), hints);
  } catch (error) { signal.throwIfAborted(); restricted = error instanceof PublicResourceError && isRestrictedStatus(error.status); }
  const session = deps.session('instagram');
  if (!session) return { ...EMPTY_MANIFEST(), restricted, links: hints.links };
  try {
    const info = await deps.read(`https://www.instagram.com/api/v1/media/${shortcodeToMediaId(post.id)}/info/`, { maxBytes: 4 * 1024 * 1024, signal, accept: 'application/json',
      headers: { 'User-Agent': BROWSER_UA, 'x-ig-app-id': '936619743392459', 'x-asbd-id': '359341', 'x-ig-www-claim': '0', 'x-requested-with': 'XMLHttpRequest', ...(session.cookie('csrftoken') ? { 'x-csrftoken': session.cookie('csrftoken')! } : {}), referer: `https://www.instagram.com/p/${post.id}/`, origin: 'https://www.instagram.com', 'Accept-Language': 'en-US,en;q=0.9' },
      cookies: host => session.cookieHeader(host) });
    if (blockedRoute(info.url)) { session.report('login'); return { ...EMPTY_MANIFEST(), restricted: true, links: hints.links }; }
    const manifest = parseInstagramMediaInfo(JSON.parse(info.data.toString('utf8')), post.id); session.report('ok'); return withHints(manifest, hints);
  } catch (error) {
    signal.throwIfAborted();
    const status = error instanceof PublicResourceError ? error.status : 0;
    session.report(status === 429 ? 'ratelimited' : isRestrictedStatus(status) ? 'denied' : 'ok');
    return { ...EMPTY_MANIFEST(), restricted: restricted || isRestrictedStatus(status), links: hints.links };
  }
};
const withHints = (m: SocialManifest, hints: { images: string[]; links: string[] }) => { const seen = new Set(m.media.map(x => x.url)); for (const url of hints.images) { const ok = mediaHost(url, CDN); if (ok && !seen.has(ok) && m.media.length < 8) { m.media.push({ kind: 'image', url: ok }); seen.add(ok); } } m.links = [...new Set([...m.links, ...hints.links])].slice(0, 3); return m; };
