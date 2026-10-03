// How a save reads when it's opened (2026-10-03), shaped by an audit of real saves. A post shared
// from the iPhone arrived as a bare link with the person's note, while the post itself was kept on
// the server; a link shared from YouTube or LinkedIn arrived as text; notes typed into a post's
// title replaced it; summaries were often a copy of the note or of the page's first lines. So:
// the person's note is theirs and never the title; a post's words come from the save or from the
// copy kept on the server; a link shared as text is the link it is; a summary leads only when it
// says something the page doesn't already.
import type { Capture, Preservation } from '../api/types.ts';
import { sourcePlatform } from '../../../../packages/shared/src/collection-presentation.ts';

export type Reading = {
  /** The headline: a page's or a file's title, or whose post it is; null when the words lead (a post, a note). */
  title: string | null;
  /** A post's words and who wrote them — from the save, or the copy kept on the server. */
  post: { author: string | null; text: string } | null;
  /** The person's own words about the save. */
  note: string | null;
  /** Where it opens, without share-tracking parameters. */
  link: string | null;
  /** The summary, when it says something the save doesn't already. */
  lead: string | null;
  /** A link shared from another app as text (YouTube, LinkedIn). */
  sharedAsText: boolean;
  /** A post whose words weren't kept. */
  missingPost: boolean;
};

const TRACKING = /^(s|t|si|igsh|igshid|stkn|ref_src|ref_url|utm_\w+)$/i;
function cleanLink(raw: string | null | undefined): string | null {
  try {
    const url = new URL(raw ?? '');
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    for (const key of [...url.searchParams.keys()]) if (TRACKING.test(key)) url.searchParams.delete(key);
    return url.href;
  } catch { return null; }
}
const bare = (url: string) => { const u = new URL(url); return `${u.hostname.replace(/^www\./, '')}${u.pathname.replace(/\/$/, '')}`; };
/** A post's address: on X its author's handle; on Instagram its kind. */
function postAt(url: string | null): { site: 'X' | 'Instagram'; handle: string | null } | null {
  if (!url) return null;
  const u = new URL(url), host = u.hostname.replace(/^(www|mobile)\./, '');
  const x = (host === 'x.com' || host === 'twitter.com') && u.pathname.match(/^\/([^/]+)\/status\/\d+/);
  if (x) return { site: 'X', handle: x[1]! };
  if (host === 'instagram.com' && /^\/(?:[^/]+\/)?(p|reel|reels|tv)\//.test(u.pathname)) return { site: 'Instagram', handle: null };
  return null;
}
/** What a shared link is, in words: "A YouTube Short", "A LinkedIn post", or its address. */
function describeLink(url: string): string {
  const platform = sourcePlatform({ sourceUrl: url }), path = new URL(url).pathname;
  if (platform === 'YouTube') return /^\/shorts\//.test(path) ? 'A YouTube Short' : 'A YouTube video';
  if (platform === 'LinkedIn') return 'A LinkedIn post';
  if (platform === 'Instagram') return /^\/(reel|reels)\//.test(path) ? 'An Instagram reel' : 'An Instagram post';
  if (platform === 'X') return 'A post on X';
  if (platform === 'TikTok') return 'A TikTok video';
  return bare(url);
}
/** The copy kept on the server: "Name (@handle)", the date, the address, then the words. */
function archivedPost(preservation: Preservation | null | undefined): Reading['post'] {
  const text = preservation?.assets.find(asset => asset.kind === 'post' && asset.text?.trim())?.text?.trim();
  if (!text) return null;
  const [author, date, address, ...rest] = text.split('\n');
  if (author && /\(@[\w.]+\)$/.test(author) && /^\d{4}-\d\d-\d\d/.test(date ?? '') && /^https?:/.test(address ?? '')) return { author, text: rest.join('\n').trim() };
  return { author: null, text };
}
const same = (a: string | null | undefined, b: string | null | undefined) => !!a && !!b && a.replace(/\s+/g, ' ').trim().toLowerCase() === b.replace(/\s+/g, ' ').trim().toLowerCase();
const NAMED = { image: 'A photo', screenshot: 'A screenshot', video: 'A video', audio: 'A voice memo', document: 'A document', file: 'A file' } as Partial<Record<Capture['type'], string>>;

export function readSave(capture: Capture, preservation?: Preservation | null): Reading {
  const shared = capture.type === 'selection' && !capture.sourceUrl && /^https?:\/\/\S+$/.test(capture.selectionText?.trim() ?? '') ? cleanLink(capture.selectionText!.trim()) : null;
  const link = cleanLink(capture.provenance?.pageUrl || capture.sourceUrl) ?? shared;
  const at = postAt(link);
  const onX = capture.type === 'tweet' || at?.site === 'X';
  // An Instagram post with a title of its own (its caption) reads as a page does.
  const isPost = onX || (!!at && !capture.sourceTitle?.trim());
  // An X post's title is "Name (@handle) on X"; anything else typed there was the person's own words.
  const namedTitle = capture.sourceTitle?.match(/^(.*) on X$/)?.[1] ?? null;
  const titleIsNote = onX && !!capture.sourceTitle?.trim() && !namedTitle && !same(capture.sourceTitle, capture.selectionText);
  const author = capture.provenance?.authors?.[0] || namedTitle || (at?.handle ? `@${at.handle}` : null);
  const post = isPost && capture.selectionText?.trim() ? { author, text: capture.selectionText.trim() } : isPost ? archivedPost(preservation) : null;
  const notes = capture.type === 'note' ? [] : [titleIsNote ? capture.sourceTitle!.trim() : null, capture.noteText?.trim() || null].filter((value): value is string => !!value);
  const note = notes.filter((value, index) => notes.findIndex(other => same(other, value)) === index).join('\n') || null;
  const missingPost = isPost && !!at && !post;
  const title = capture.type === 'note' ? capture.sourceTitle?.trim() || null
    : post ? null
    : missingPost ? (at!.handle ? `A post by @${at!.handle} on ${at!.site}` : `A post on ${at!.site}`)
    : shared ? describeLink(shared)
    : (!titleIsNote && capture.sourceTitle?.trim()) || capture.fileName?.trim() || NAMED[capture.type] || (link ? describeLink(link) : 'A save');
  const summary = capture.summary?.trim() || null;
  const copied = (text: string | null | undefined) => !!text && !!summary && text.replace(/\s+/g, ' ').trim().startsWith(summary.replace(/…$/, '').trim());
  const lead = !summary || post || /^https?:\/\/\S+$/.test(summary) || same(summary, capture.noteText) || same(summary, note) || same(summary, title)
    || same(summary, capture.selectionText) || copied(capture.articleText) || copied(capture.noteText) ? null : summary;
  return { title, post, note, link, lead, sharedAsText: !!shared, missingPost };
}
