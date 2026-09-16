// Validate a post-login `next` return target so it can never become an
// open redirect. Accepts either a same-origin relative path (a single leading
// slash, no protocol-relative `//host` or backslash `/\host` trick) or an
// absolute URL that points back at one of our own origins — in which case the
// relative portion is returned. Anything else yields null (fall back to
// /dashboard). Isomorphic: pass window.location.origin as an extra origin on
// the client so dev/preview hosts validate without hardcoding.
const OWN_ORIGINS = ['https://foundkeep.app', 'https://dev.foundkeep.app', 'https://atlas.notpritam.in'];

export function safeNextTarget(raw: unknown, extraOrigins: string[] = []): string | null {
  if (typeof raw !== 'string' || !raw || raw.length > 2048) return null;
  if (raw[0] === '/' && raw[1] !== '/' && raw[1] !== '\\') return raw;
  try {
    const url = new URL(raw);
    if ([...OWN_ORIGINS, ...extraOrigins].includes(url.origin)) return url.pathname + url.search + url.hash;
  } catch {
    // Not an absolute URL — reject.
  }
  return null;
}
