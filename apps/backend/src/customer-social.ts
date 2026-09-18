import { twitterPost, resolveTwitterPost, type SocialContext } from './customer-twitter.ts';
import { readPublicResource } from './customer-public-resource.ts';
import { fetchCustomerSource, blockedRoute, type SourceSnapshot } from './customer-source.ts';
import { remoteVideoCandidate } from './customer-remote-preservation.ts';
import { socialSessions } from './customer-social-sessions.ts';
import { resolveReddit } from './customer-reddit.ts';
import { resolveInstagram } from './customer-instagram.ts';
import { resolveLinkedIn } from './customer-linkedin.ts';
import { resolveBluesky } from './customer-bluesky.ts';
import { resolveYouTube } from './customer-youtube.ts';
import {
  parse, host, mediaHost, isoDate, isRestrictedStatus, EMPTY_MANIFEST,
  type SocialPlatform, type SocialPost, type SocialMedia, type SocialManifest, type SocialResolverDeps, type SocialResolver,
} from './customer-social-types.ts';

// Re-exported so existing importers of these symbols from customer-social.ts keep working; the
// definitions themselves now live in customer-social-types.ts (see the comment there for why).
export {
  mediaHost, isoDate, isRestrictedStatus, EMPTY_MANIFEST,
  type SocialPlatform, type SocialPost, type SocialMedia, type SocialManifest, type SocialResolverDeps, type SocialResolver,
};

const LABELS: Record<SocialPlatform, string> = { x: 'X', reddit: 'Reddit', instagram: 'Instagram', linkedin: 'LinkedIn', bluesky: 'Bluesky', youtube: 'YouTube', generic: 'This site' };
export const platformLabel = (platform: SocialPlatform) => LABELS[platform];

const GENERIC_SITES: [string, string, RegExp][] = [
  // vm./vt. short-link hosts must be listed before the generic tiktok.com entry so they win: host() treats
  // 'tiktok.com' as a match for any subdomain, including vm./vt., but only these two accept a bare short code.
  ['tiktok', 'vm.tiktok.com', /^\/[\w-]{6,}\/?$/], ['tiktok', 'vt.tiktok.com', /^\/[\w-]{6,}\/?$/],
  ['tiktok', 'tiktok.com', /^\/(?:@[^/]+\/(?:video|photo)\/\d+|t\/[\w-]+)\/?$/],
  ['threads', 'threads.net', /^\/@[^/]+\/post\/[\w-]+\/?$/], ['threads', 'threads.com', /^\/@[^/]+\/post\/[\w-]+\/?$/],
  ['facebook', 'facebook.com', /^\/(?:reel\/\d+|share\/[rv]\/[\w-]+|[^/]+\/(?:videos|posts)\/[\w.-]+|watch|photo)\/?$/], ['facebook', 'fb.watch', /^\/[\w-]+\/?$/],
  ['pinterest', 'pinterest.com', /^\/pin\/\d+\/?$/], ['pinterest', 'pin.it', /^\/[\w-]+\/?$/], ['tumblr', 'tumblr.com', /^\/(?:[^/]+\/)?(?:post\/)?(\d+)(?:\/[\w%-]*)?\/?$/], ['vimeo', 'vimeo.com', /^\/(?:\d+|[^/]+\/\d+)\/?$/],
  ['twitch', 'twitch.tv', /^\/[^/]+\/clip\/[\w-]+\/?$/], ['twitch', 'clips.twitch.tv', /^\/[\w-]+\/?$/], ['dailymotion', 'dailymotion.com', /^\/video\/[\w-]+\/?$/],
];
const TRACKING = /^(utm_|igsh$|igshid$|si$|is_from_webapp$|sender_device$|share_id$|ref$|s$|t$|fbclid$|rdt$)/;
export function socialPost(raw: string | null | undefined): SocialPost | null {
  const u = parse(raw);
  if (!u) return null;
  const x = twitterPost(raw);
  if (x) return { platform: 'x', site: 'x', id: x.id, url: x.url };
  if (host(u, 'youtube.com') || host(u, 'youtu.be')) {
    const id = host(u, 'youtu.be') ? u.pathname.slice(1).split('/')[0] : u.pathname === '/watch' ? u.searchParams.get('v') : u.pathname.match(/^\/(?:shorts|embed|live|v)\/([\w-]{11})/)?.[1];
    return id && /^[\w-]{11}$/.test(id) ? { platform: 'youtube', site: 'youtube', id, url: `https://www.youtube.com/watch?v=${id}` } : null;
  }
  if (host(u, 'reddit.com') || host(u, 'redd.it')) {
    if (host(u, 'redd.it')) { const id = u.pathname.match(/^\/([a-z0-9]{2,10})\/?$/i)?.[1]; return id ? { platform: 'reddit', site: 'reddit', id, url: `https://www.reddit.com/comments/${id}/` } : null; }
    const share = u.pathname.match(/^\/r\/([\w]+)\/s\/([\w]+)\/?$/);
    if (share) return { platform: 'reddit', site: 'reddit', id: `s:${share[2]}`, url: `https://www.reddit.com/r/${share[1]}/s/${share[2]}` };
    const post = u.pathname.match(/^\/(?:r\/(\w+)\/|user\/\w+\/)?comments\/([a-z0-9]{2,10})(?:\/|$)/i);
    return post ? { platform: 'reddit', site: 'reddit', id: post[2]!, url: post[1] ? `https://www.reddit.com/r/${post[1]}/comments/${post[2]}/` : `https://www.reddit.com/comments/${post[2]}/` } : null;
  }
  if (host(u, 'instagram.com')) { const id = u.pathname.match(/^\/(?:[^/]+\/)?(?:p|reel|reels|tv)\/([\w-]{5,40})\/?$/)?.[1]; return id ? { platform: 'instagram', site: 'instagram', id, url: `https://www.instagram.com/p/${id}/` } : null; }
  if (host(u, 'linkedin.com')) {
    const postsId = u.pathname.match(/^\/posts\/[^/]*?-(\d{15,25})-[\w-]{4}\/?$/)?.[1];
    if (postsId) return { platform: 'linkedin', site: 'linkedin', id: postsId, url: `https://www.linkedin.com/feed/update/urn:li:activity:${postsId}/` };
    // ugcPost/share are distinct URN id spaces from activity and must not be rewritten to activity.
    const feed = u.pathname.match(/^\/feed\/update\/urn:li:(activity|ugcPost|share):(\d{15,25})\/?$/);
    if (!feed) return null;
    const [, type, digits] = feed;
    const id = type === 'activity' ? digits : `${type}:${digits}`;
    return { platform: 'linkedin', site: 'linkedin', id, url: `https://www.linkedin.com/feed/update/urn:li:${type}:${digits}/` };
  }
  if (host(u, 'bsky.app')) { const m = u.pathname.match(/^\/profile\/([\w.:-]+)\/post\/([\w]+)\/?$/); return m ? { platform: 'bluesky', site: 'bluesky', id: `${m[1]}/${m[2]}`, url: `https://bsky.app/profile/${m[1]}/post/${m[2]}` } : null; }
  for (const [site, domain, pattern] of GENERIC_SITES) if (host(u, domain) && pattern.test(u.pathname)) {
    const clean = new URL(u.href); clean.hash = '';
    for (const key of [...clean.searchParams.keys()]) if (TRACKING.test(key)) clean.searchParams.delete(key);
    // Facebook's `watch`/`photo` forms carry their id in v=/fbid=; once tracking params are stripped, every
    // other remaining query key is noise, so keep only those two.
    if (site === 'facebook') for (const key of [...clean.searchParams.keys()]) if (key !== 'v' && key !== 'fbid') clean.searchParams.delete(key);
    return { platform: 'generic', site, id: clean.href, url: clean.href };
  }
  return null;
}

export const resolveGeneric: SocialResolver = async (post, hints, signal, deps) => {
  let snapshot: SourceSnapshot | null = null;
  try { snapshot = await deps.source(post.url); } catch { /* unavailable page */ }
  signal.throwIfAborted();
  const restricted = !!snapshot && blockedRoute(snapshot.url);
  const media: SocialMedia[] = [];
  if (remoteVideoCandidate(post.url, snapshot)) media.push({ kind: 'video', url: post.url });
  if (snapshot?.imageUrl && !restricted) media.push({ kind: 'image', url: snapshot.imageUrl });
  const text = [snapshot?.title, snapshot?.text || snapshot?.description].filter((x, i, a) => x && a.indexOf(x) === i).join('\n\n');
  return { text: restricted ? '' : text, author: snapshot?.author || '', publishedAt: snapshot?.publishedAt || null, media, links: hints.links.slice(0, 3),
    metadataAvailable: !!snapshot && !restricted && snapshot.extractionStatus !== 'unavailable', restricted, incomplete: media.length === 0 };
};
const resolvers: Partial<Record<SocialPlatform, SocialResolver>> = {
  x: async (post, hints, signal, deps) => resolveTwitterPost(post.url, hints, signal, deps.read),
  reddit: resolveReddit,
  instagram: resolveInstagram,
  linkedin: resolveLinkedIn,
  bluesky: resolveBluesky,
  youtube: resolveYouTube,
  generic: resolveGeneric,
};
export async function resolveSocialPost(url: string, hints: SocialContext, signal: AbortSignal, deps: Partial<SocialResolverDeps> = {}): Promise<SocialManifest> {
  const post = socialPost(url);
  if (!post) throw Error('Use a public social post link.');
  const resolver = resolvers[post.platform] ?? resolveGeneric;
  return resolver(post, hints, signal, { read: deps.read ?? readPublicResource, session: deps.session ?? (site => socialSessions.session(site)), source: deps.source ?? fetchCustomerSource });
}
