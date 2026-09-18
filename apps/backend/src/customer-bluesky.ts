import { previewSourceUrl } from './customer-preview.ts';
import { EMPTY_MANIFEST, mediaHost, type SocialManifest, type SocialMedia, type SocialResolver } from './customer-social.ts';
const CDN = ['cdn.bsky.app', 'video.bsky.app', 'video.cdn.bsky.app'];
const API = 'https://public.api.bsky.app/xrpc';
export function parseBlueskyThread(json: unknown, rkey: string): SocialManifest {
  const post = (json as any)?.thread?.post;
  if (!post?.record || typeof post.uri !== 'string' || !post.uri.endsWith('/' + rkey)) throw Error('The public post is unavailable.');
  const media: SocialMedia[] = []; let incomplete = false;
  const embed = post.embed?.$type === 'app.bsky.embed.recordWithMedia#view' ? post.embed.media : post.embed;
  if (embed?.$type === 'app.bsky.embed.images#view') for (const image of (embed.images ?? []).slice(0, 8)) { const url = mediaHost(image?.fullsize, CDN); if (url) media.push({ kind: 'image', url }); else incomplete = true; }
  else if (embed?.$type === 'app.bsky.embed.video#view') { const thumb = mediaHost(embed.thumbnail, CDN); if (thumb) media.push({ kind: 'image', url: thumb }); incomplete = true; }
  const links: string[] = [];
  for (const facet of post.record.facets ?? []) for (const feature of facet?.features ?? []) if (feature?.$type === 'app.bsky.richtext.facet#link') { const u = previewSourceUrl(feature.uri); if (u && !/(^|\.)bsky\.app$/.test(u.hostname)) links.push(u.href); }
  const external = embed?.$type === 'app.bsky.embed.external#view' ? previewSourceUrl(embed.external?.uri) : null; if (external) links.push(external.href);
  const name = typeof post.author?.displayName === 'string' ? post.author.displayName.trim().slice(0, 200) : '', handle = typeof post.author?.handle === 'string' ? post.author.handle.slice(0, 253) : '';
  return { text: String(post.record.text ?? '').slice(0, 50_000), author: name ? `${name} (@${handle})` : `@${handle}`, publishedAt: typeof post.record.createdAt === 'string' ? post.record.createdAt.slice(0, 100) : null, media, links: [...new Set(links)].slice(0, 3), metadataAvailable: true, incomplete };
}
export const resolveBluesky: SocialResolver = async (post, hints, signal, deps) => {
  const [actor, rkey] = post.id.split('/') as [string, string];
  try {
    let did = actor;
    if (!did.startsWith('did:')) { const r = await deps.read(`${API}/com.atproto.identity.resolveHandle?handle=${encodeURIComponent(actor)}`, { maxBytes: 64 * 1024, signal, accept: 'application/json' }); did = String(JSON.parse(r.data.toString('utf8')).did ?? ''); if (!/^did:[a-z]+:[\w.:%-]+$/.test(did)) throw Error('Unknown handle.'); }
    const uri = `at://${did}/app.bsky.feed.post/${rkey}`;
    const thread = await deps.read(`${API}/app.bsky.feed.getPostThread?uri=${encodeURIComponent(uri)}&depth=0&parentHeight=0`, { maxBytes: 2 * 1024 * 1024, signal, accept: 'application/json' });
    const manifest = parseBlueskyThread(JSON.parse(thread.data.toString('utf8')), rkey);
    manifest.links = [...new Set([...manifest.links, ...hints.links])].slice(0, 3);
    return manifest;
  } catch { signal.throwIfAborted(); return { ...EMPTY_MANIFEST(), links: hints.links }; }
};
