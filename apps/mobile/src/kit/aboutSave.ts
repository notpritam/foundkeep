// Asking Kit about one save (2026-10-03, for the save's detail): sum it up, find more like it, or
// say where it came from — each answered in one short line, as Kit answers in Ask Kit. A typed
// question goes to the closest of the three. A stand-in on the phone; the real Kit answers on
// the backend.
import type { Capture, RelatedSave } from '../api/types.ts';
import { origin } from '../collection/origin.ts';
import { savedTimestamp, savedVia, sourcePlatform, type SavedVia } from '../../../../packages/shared/src/collection-presentation.ts';

export const SAVE_PROMPTS = ['Sum it up', 'More like it', 'Where is it from?'] as const;
export type SaveAnswer = { reply: string; items: Capture[] };

const VIA: Record<SavedVia, string> = { iphone: 'on your iPhone', android: 'on your phone', browser: 'in your browser', dashboard: 'on the web' };
const WORDLESS: Partial<Record<Capture['type'], string>> = { image: 'A photo', screenshot: 'A screenshot', video: 'A video', audio: 'A voice memo', document: 'A document', file: 'A file', bookmark: 'A link' };

/** The first sentence, kept short. */
function first(text: string) {
  const sentence = (text.trim().match(/^[\s\S]*?[.!?](?=\s|$)/)?.[0] ?? text.trim()).replace(/\s+/g, ' ');
  return sentence.length <= 110 ? sentence : `${sentence.slice(0, 108).replace(/\s+\S*$/, '')}…`;
}
function ago(at: number, now: number) {
  const minutes = Math.max(0, Math.floor((now - at) / 60_000)), hours = Math.floor(minutes / 60), days = Math.floor(hours / 24);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return minutes === 1 ? 'a minute ago' : `${minutes} minutes ago`;
  if (hours < 24) return hours === 1 ? 'an hour ago' : `${hours} hours ago`;
  if (days < 7) return days === 1 ? 'yesterday' : `${days} days ago`;
  return `on ${new Date(at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
}

function sumUp(capture: Capture): string {
  if (capture.status === 'pending' || capture.status === 'processing') return 'It’s still being read — ask again in a minute.';
  if (capture.summary) return first(capture.summary);
  if (capture.type === 'note' && capture.noteText) return `Your note: “${first(capture.noteText)}”`;
  if (capture.type === 'tweet' && capture.selectionText) return `A post: “${first(capture.selectionText)}”`;
  if (capture.selectionText) return `A highlight: “${first(capture.selectionText)}”`;
  if (capture.articleText) return first(capture.articleText);
  if (capture.status === 'failed') return 'The page couldn’t be read, so there’s nothing to sum up.';
  return `${WORDLESS[capture.type] ?? 'A save'} — there are no words in it to sum up.`;
}

function moreLikeIt(related: RelatedSave[]): SaveAnswer {
  if (!related.length) return { reply: 'Nothing like it yet.', items: [] };
  const counts = new Map<string, { kind: RelatedSave['reasons'][number]['kind']; label: string; count: number }>();
  for (const reason of related.flatMap(item => item.reasons)) {
    const key = `${reason.kind}:${reason.label}`;
    counts.set(key, { ...reason, count: (counts.get(key)?.count ?? 0) + 1 });
  }
  const top = [...counts.values()].sort((a, b) => b.count - a.count)[0];
  const one = related.length === 1;
  const why = !top ? '' : top.kind === 'tag' ? (one ? `it shares ${top.label}` : `most share ${top.label}`)
    : top.kind === 'folder' ? (one ? `it’s in ${top.label} too` : `most are in ${top.label}`)
    : top.kind === 'source' ? (one ? `it’s from ${top.label} too` : `most are from ${top.label}`)
    : top.kind === 'batch' ? 'saved together with it' : top.label;
  return { reply: `${related.length} ${one ? 'save' : 'saves'} like it${why ? ` — ${why}` : ''}.`, items: related.map(item => item.capture) };
}

function whereFrom(capture: Capture, now: number): string {
  const via = savedVia(capture), when = ago(savedTimestamp(capture), now);
  const how = [via ? VIA[via] : '', when].filter(Boolean).join(' ');
  if (capture.type === 'note') return `Your own note, written ${how}.`;
  const from = origin(capture), platform = sourcePlatform(capture);
  const author = capture.type === 'tweet' ? capture.provenance?.authors?.[0] : undefined;
  const placed = from.icon !== 'globe-outline' && !from.icon.startsWith('logo-') ? null : author && platform ? `${author} on ${platform}` : from.name;
  return placed ? `From ${placed}, saved ${how}.` : `Saved ${how}.`;
}

/** Kit's answer to `question` about `capture`: one short line, and the saves it means (if any). */
export function aboutSave(question: string, capture: Capture, related: RelatedSave[], now = Date.now()): SaveAnswer {
  const words = question.toLowerCase();
  if (/\b(like|similar|more|related|other|others)\b/.test(words)) return moreLikeIt(related);
  if (/\b(where|when|from|source|saved|who)\b/.test(words)) return { reply: whereFrom(capture, now), items: [] };
  return { reply: sumUp(capture), items: [] };
}
