// Types and small pure helpers shared between customer-social.ts and the platform resolver
// modules (customer-reddit.ts, customer-instagram.ts, customer-linkedin.ts, customer-bluesky.ts,
// customer-youtube.ts). Split out from customer-social.ts so the resolvers can import these
// without importing customer-social.ts itself: customer-social.ts imports the resolvers, so a
// resolver importing back from customer-social.ts creates a load-order-dependent cycle (Bun
// throws "Cannot access '<resolver>' before initialization" when a resolver's own test file is
// the entry point). This module has no dependency on customer-social.ts or the resolvers, so it
// is a safe leaf for both sides.
import type { SocialContext, TwitterManifest } from './customer-twitter.ts';
import type { PublicReader } from './customer-public-resource.ts';
import type { SourceSnapshot } from './customer-source.ts';
import type { PlatformSession } from './customer-social-sessions.ts';

export type SocialPlatform = 'x' | 'reddit' | 'instagram' | 'linkedin' | 'bluesky' | 'youtube' | 'generic';
export type SocialPost = { platform: SocialPlatform; site: string; id: string; url: string };
export type SocialMedia = { kind: 'image' | 'video'; url: string; audioUrls?: string[] };
export type SocialManifest = TwitterManifest & { restricted?: boolean };
export type SocialResolverDeps = { read: PublicReader; session: (site: string) => PlatformSession | null; source: (url: string) => Promise<SourceSnapshot> };
export type SocialResolver = (post: SocialPost, hints: SocialContext, signal: AbortSignal, deps: SocialResolverDeps) => Promise<SocialManifest>;

export function parse(raw: unknown): URL | null {
  if (typeof raw !== 'string' || raw.length > 4096) return null;
  try { const u = new URL(raw); return ['http:', 'https:'].includes(u.protocol) && !u.username && !u.password && !u.port ? u : null; } catch { return null; }
}
export const host = (u: URL, domain: string) => u.hostname === domain || u.hostname.endsWith('.' + domain);
export function mediaHost(url: unknown, allowed: string[]): string | null {
  const u = parse(url);
  return u && u.protocol === 'https:' && allowed.some(domain => host(u, domain)) ? u.href : null;
}
export const isoDate = (seconds: unknown) => typeof seconds === 'number' && Number.isFinite(seconds) && seconds > 0 ? new Date(seconds * 1000).toISOString() : null;
export const isRestrictedStatus = (status: number) => status === 401 || status === 403 || status === 429;
export const EMPTY_MANIFEST = (): SocialManifest => ({ text: '', author: '', publishedAt: null, media: [], links: [], metadataAvailable: false });
