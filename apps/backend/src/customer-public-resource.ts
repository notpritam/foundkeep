import { isIP } from "node:net";
import {
  previewSourceUrl,
  isPublicPreviewAddress,
  resolvePublicHost,
  requestPinned,
  sanitizeExtraHeaders,
  type PreviewAddress,
  type PreviewTarget,
  type PreviewUpstream,
} from "./customer-preview.ts";
export type PublicReadOptions = {
  maxBytes: number;
  signal: AbortSignal;
  accept?: string;
  headers?: Record<string, string>;
  cookies?: (host: string) => string | null;
};
export type PublicResource = { url: string; mime: string; data: Buffer; status: number };
export class PublicResourceError extends Error {
  constructor(readonly status: number, readonly url: string) {
    super("The public source is unavailable.");
  }
}
/** True when `host` stays inside `origin`'s own site: the same hostname, or one
 * sharing its last two DNS labels (`www.instagram.com` and `i.instagram.com`,
 * never `consent.facebook.com`). IP literals only ever match themselves, since
 * their trailing octets are not DNS labels. */
function sameSite(host: string, origin: string): boolean {
  const a = host.toLowerCase(), b = origin.toLowerCase();
  if (a === b) return true;
  if (isIP(a) || isIP(b)) return false;
  const site = (value: string) => value.split('.').slice(-2).join('.');
  return a.includes('.') && b.includes('.') && site(a) === site(b);
}
export type PublicReader = (
  url: string,
  options: PublicReadOptions,
) => Promise<PublicResource>;
/** Pinned DNS on every redirect, bounded body and wall time. Caller headers and
 * a per-host cookie are re-scoped on every redirect hop. Caller headers may
 * carry session-derived secrets (an Instagram `x-csrftoken`, a LinkedIn
 * `csrf-token`), so they are sent only to hops that stay inside the original
 * request's own site — the same hostname, or one sharing its last two DNS
 * labels. Every other hop gets the default headers only. The cookie is asked
 * for per hop hostname and is sent only over `https:`. */
export function createPublicReader(
  deps: {
    resolve?: (host: string, signal: AbortSignal) => Promise<PreviewAddress[]>;
    transport?: (
      target: PreviewTarget,
      signal: AbortSignal,
      accept?: string,
      headers?: Record<string, string>,
    ) => Promise<PreviewUpstream>;
  } = {},
): PublicReader {
  return async (raw, options) => {
    const signal = AbortSignal.any([
      options.signal,
      AbortSignal.timeout(15_000),
    ]);
    let response: PreviewUpstream | undefined;
    let cancel: () => void = () => {};
    const aborted = new Promise<never>((_, reject) => {
      cancel = () => {
        response?.cancel();
        reject(new Error("Source request cancelled or timed out."));
      };
      signal.addEventListener("abort", cancel, { once: true });
    });
    try {
      let url = previewSourceUrl(raw);
      if (!url) throw Error("This is not a public source.");
      const origin = url.hostname.replace(/^\[|\]$/g, "");
      for (let hop = 0; hop < 4; hop++) {
        signal.throwIfAborted();
        const host = url.hostname.replace(/^\[|\]$/g, ""),
          family = isIP(host);
        const addresses = family
          ? [{ address: host, family: family as 4 | 6 }]
          : await Promise.race([
              (deps.resolve || resolvePublicHost)(host, signal),
              aborted,
            ]);
        if (
          !addresses.length ||
          addresses.some((x) => !isPublicPreviewAddress(x.address))
        )
          throw Error("This is not a public source.");
        // Headers and cookie are rebuilt from options on every hop: a header or
        // cookie issued for the original host must never follow a redirect to
        // a different one. Caller headers survive only inside the original
        // site; the cookie is per-hop and plaintext hops get none.
        const cookie =
          url.protocol === "https:" ? options.cookies?.(host) : null;
        const hopHeaders: Record<string, string> = sameSite(host, origin)
          ? sanitizeExtraHeaders(options.headers)
          : {};
        // Any casing of a caller-supplied Cookie is removed, not just the two
        // literal spellings, so it can never bypass the per-host cookie below.
        for (const key of Object.keys(hopHeaders))
          if (key.toLowerCase() === "cookie") delete hopHeaders[key];
        if (cookie) hopHeaders.Cookie = cookie;
        response = await Promise.race([
          (deps.transport || requestPinned)(
            { ...addresses[0]!, url },
            signal,
            options.accept || "*/*",
            hopHeaders,
          ),
          aborted,
        ]);
        if ([301, 302, 303, 307, 308].includes(response.status)) {
          const next = response.headers.get("location");
          response.cancel();
          if (!next) throw Error("Invalid source redirect.");
          url = previewSourceUrl(new URL(next, url).href);
          if (!url) throw Error("This is not a public source.");
          continue;
        }
        if (response.status !== 200)
          throw new PublicResourceError(response.status, url.href);
        if (
          !["", "identity"].includes(
            response.headers.get("content-encoding") || "",
          )
        )
          throw Error("The public source is unavailable.");
        if (
          Number(response.headers.get("content-length") || 0) > options.maxBytes
        )
          throw Error("Source exceeds the size limit.");
        const chunks: Uint8Array[] = [];
        let bytes = 0;
        const iterator = response.body[Symbol.asyncIterator]();
        while (true) {
          signal.throwIfAborted();
          const item = await Promise.race([iterator.next(), aborted]);
          if (item.done) break;
          bytes += item.value.byteLength;
          if (bytes > options.maxBytes)
            throw Error("Source exceeds the size limit.");
          chunks.push(item.value);
        }
        return {
          url: url.href,
          mime: (response.headers.get("content-type") || "")
            .split(";")[0]!
            .trim()
            .toLowerCase(),
          data: Buffer.concat(chunks),
          status: response.status,
        };
      }
      throw Error("Too many source redirects.");
    } finally {
      signal.removeEventListener("abort", cancel);
      response?.cancel();
    }
  };
}
export const readPublicResource = createPublicReader();
