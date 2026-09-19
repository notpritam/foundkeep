import { getEnvironment } from '../environment.ts';
import type { Capture } from '../api/types.ts';

type PreviewSource = { uri: string; headers?: Record<string, string> };
const IMAGE_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif']);

export function capturePreviewSource(capture: Partial<Capture>, token: string | null, accountId: string | undefined): PreviewSource | null {
  const kind = capture.blobUrl ? 'blob' : capture.fileUrl && IMAGE_MIMES.has(capture.fileMime || '') ? 'file' : capture.previewUrl ? 'preview' : null;
  if (kind) {
    if (!token || !accountId || !capture.id) return null;
    const query = new URLSearchParams({ account: accountId, v: String(capture.updatedAt || 0) });
    // Never trust a returned URL with a bearer header. Construct the exact owned
    // endpoint, with a non-secret account/revision key for native image caches.
    return { uri: `${getEnvironment().origin}/api/mobile/captures/${encodeURIComponent(capture.id)}/${kind}?${query}`, headers: { Authorization: `Bearer ${token}` } };
  }
  const raw = capture.provenance?.leadImageUrl;
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:' || url.username || url.password || url.port ||
      url.hostname === 'localhost' || url.hostname.endsWith('.local') || !url.hostname.includes('.') ||
      /^[\d.]+$/.test(url.hostname) || url.hostname.includes(':')) return null;
    return { uri: url.href }; // Remote website images receive no account token.
  } catch { return null; }
}

const PRESERVED_HOSTS = ['x.com', 'twitter.com', 'reddit.com', 'redd.it', 'instagram.com', 'linkedin.com', 'bsky.app', 'youtube.com', 'youtu.be', 'tiktok.com', 'threads.net', 'threads.com', 'facebook.com', 'fb.watch', 'pinterest.com', 'pin.it', 'tumblr.com', 'vimeo.com', 'twitch.tv', 'dailymotion.com'];

// A host test, not a permalink test: the backend's socialPost() decides whether
// a given path is preservable. The panel just needs to know the source could
// carry a server-kept copy.
export function preservablePlatform(raw: string | null | undefined): boolean {
  if (!raw) return false;
  try {
    const url = new URL(raw);
    if (!['http:', 'https:'].includes(url.protocol)) return false;
    const host = url.hostname.toLowerCase();
    return PRESERVED_HOSTS.some(domain => host === domain || host.endsWith('.' + domain));
  } catch { return false; }
}

// Owned, authed source for a preserved media asset (image or video). Built the
// same way as capturePreviewSource: the exact mobile endpoint plus a bearer
// header, never a URL returned by the server.
export function preservedAssetSource(captureId: string, assetId: string, token: string | null, accountId: string | undefined, revision: number): PreviewSource | null {
  if (!token || !accountId || !captureId || !assetId) return null;
  const query = new URLSearchParams({ account: accountId, v: String(revision || 0) });
  return { uri: `${getEnvironment().origin}/api/mobile/captures/${encodeURIComponent(captureId)}/assets/${encodeURIComponent(assetId)}?${query}`, headers: { Authorization: `Bearer ${token}` } };
}

export function galleryColumns(width: number, fontScale: number): 1 | 2 {
  return width < 340 || fontScale >= 1.3 ? 1 : 2;
}
