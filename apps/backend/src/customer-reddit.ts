import { PublicResourceError, type PublicReader } from './customer-public-resource.ts';
import { EMPTY_MANIFEST, isoDate, isRestrictedStatus, mediaHost, type SocialManifest, type SocialMedia, type SocialResolver } from './customer-social-types.ts';
import { previewSourceUrl } from './customer-preview.ts';
const IMAGE_HOSTS = ['redd.it', 'i.imgur.com'], VIDEO_HOSTS = ['v.redd.it'];
const UA = { 'User-Agent': 'FoundKeep/1.0 (+https://foundkeep.app)' };
const outbound = (raw: unknown) => { const u = previewSourceUrl(raw); return u && !/(^|\.)(reddit\.com|redd\.it)$/.test(u.hostname) ? u.href : null; };
export function parseRedditListing(json: unknown, id: string): SocialManifest {
  const post = (json as any)?.[0]?.data?.children?.find((c: any) => c?.data?.id === id)?.data;
  if (!post) throw Error('The public post is unavailable.');
  const source = Array.isArray(post.crosspost_parent_list) && post.crosspost_parent_list[0] ? post.crosspost_parent_list[0] : post;
  const media: SocialMedia[] = []; let incomplete = false;
  const image = (raw: unknown) => { const url = mediaHost(raw, IMAGE_HOSTS); if (url && new URL(url).hostname !== 'v.redd.it') media.push({ kind: 'image', url }); else incomplete = true; };
  if (source.is_gallery) {
    const items = Array.isArray(source.gallery_data?.items) ? source.gallery_data.items : [];
    const metadata = source.media_metadata && typeof source.media_metadata === 'object' ? source.media_metadata : {};
    if (!items.length) incomplete = true;
    for (const item of items.slice(0, 8)) { const meta = metadata[item?.media_id]; if (meta?.status === 'valid' && (meta.s?.u || meta.s?.gif)) image(meta.s.u || meta.s.gif); else incomplete = true; }
  }
  const video = source.secure_media?.reddit_video ?? source.media?.reddit_video;
  if (video?.fallback_url) {
    const fallback = mediaHost(String(video.fallback_url).split('?')[0], VIDEO_HOSTS);
    if (fallback) { const base = fallback.replace(/\/[^/]+$/, ''); media.push({ kind: 'video', url: fallback, ...(video.has_audio === false ? {} : { audioUrls: [`${base}/DASH_AUDIO_128.mp4`, `${base}/DASH_AUDIO_64.mp4`, `${base}/DASH_audio.mp4`] }) }); } else incomplete = true;
    const thumb = source.preview?.images?.[0]?.source?.url; if (thumb) image(thumb);
  } else if (!media.length) {
    const direct = mediaHost(source.url_overridden_by_dest ?? source.url, IMAGE_HOSTS);
    if (direct && /\.(jpe?g|png|webp|gif)$/i.test(new URL(direct).pathname)) media.push({ kind: 'image', url: direct });
    else if (source.post_hint === 'image') { const thumb = source.preview?.images?.[0]?.source?.url; if (thumb) image(thumb); }
  }
  const links: string[] = [];
  if (!source.is_self && !media.length) { const link = outbound(source.url_overridden_by_dest ?? source.url); if (link) links.push(link); else incomplete = true; }
  const title = typeof post.title === 'string' ? post.title.trim() : '', body = typeof source.selftext === 'string' ? source.selftext.trim() : '';
  return { text: [title, body].filter(Boolean).join('\n\n').slice(0, 50_000), author: [typeof post.author === 'string' ? `u/${post.author.slice(0, 50)}` : '', typeof post.subreddit === 'string' ? `r/${post.subreddit.slice(0, 50)}` : ''].filter(Boolean).join(' · '),
    publishedAt: isoDate(post.created_utc), media: media.slice(0, 8), links: links.slice(0, 3), metadataAvailable: true, incomplete: incomplete || (!media.length && !links.length && !body) };
}
async function fetchListing(url: string, read: PublicReader, signal: AbortSignal, cookies?: (host: string) => string | null) {
  const resource = await read(url, { maxBytes: 2 * 1024 * 1024, signal, accept: 'application/json', headers: UA, cookies });
  return JSON.parse(resource.data.toString('utf8'));
}
export const resolveReddit: SocialResolver = async (post, hints, signal, deps) => {
  let canonical = post.url, id = post.id;
  if (id.startsWith('s:')) {
    const landing = await deps.read(post.url, { maxBytes: 512 * 1024, signal, accept: 'text/html', headers: UA }).catch(() => null);
    const match = landing?.url.match(/\/r\/(\w+)\/comments\/([a-z0-9]{2,10})/i);
    if (!match) return { ...EMPTY_MANIFEST(), links: hints.links };
    canonical = `https://www.reddit.com/r/${match[1]}/comments/${match[2]}/`; id = match[2]!;
  }
  // limit=1 keeps the listing to the post itself; the comment tree is never used
  // and an unbounded one can be megabytes.
  const endpoint = `${canonical}.json?raw_json=1&limit=1`;
  const attempt = async (session: ReturnType<typeof deps.session>) => {
    try { const manifest = parseRedditListing(await fetchListing(endpoint, deps.read, signal, session ? h => session.cookieHeader(h) : undefined), id); session?.report('ok'); return manifest; }
    catch (error) {
      signal.throwIfAborted();
      const status = error instanceof PublicResourceError ? error.status : 0;
      if (session) session.report(status === 429 ? 'ratelimited' : isRestrictedStatus(status) ? 'denied' : 'ok');
      return isRestrictedStatus(status) ? 'restricted' as const : null;
    }
  };
  let result = await attempt(null);
  if (result === 'restricted') { const session = deps.session('reddit'); const retry = session ? await attempt(session) : 'restricted'; result = retry; }
  if (result === 'restricted') return { ...EMPTY_MANIFEST(), restricted: true, links: hints.links };
  if (!result) return { ...EMPTY_MANIFEST(), links: hints.links };
  result.links = [...new Set([...result.links, ...hints.links])].slice(0, 3);
  return result;
};
