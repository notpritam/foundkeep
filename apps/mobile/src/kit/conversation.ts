// Talking to Kit (2026-10-03). Pritam: "currently I can't go back and forth — I asked for the
// recent post I saved from Twitter, then told it 'about cats', and it didn't follow". Each turn
// is read for what kind of thing, from where, about what, and how recent; a follow-up ("about
// cats", "from Instagram", "only the newest") keeps what was asked before and changes only what
// it says. When nothing fits the narrowed question, Kit says so and offers what it found
// elsewhere. A stand-in reading the library on the phone; the real Kit answers on the backend.
import type { Capture } from '../api/types.ts';
import { captureTitle } from '../collection/model.ts';
import { sourcePlatform } from '../../../../packages/shared/src/collection-presentation.ts';

export type Ask = { kinds: Capture['type'][]; platforms: string[]; topic: string[]; recent: boolean };
export type Turn = { question: string; context: Ask; items: Capture[]; reply: string; followUp: boolean; elsewhere: boolean };

const KINDS: Record<string, Capture['type'][]> = {
  post: ['tweet', 'image', 'video'], posts: ['tweet', 'image', 'video'], tweet: ['tweet'], tweets: ['tweet'],
  video: ['video'], videos: ['video'], reel: ['video'], reels: ['video'], short: ['video'], shorts: ['video'], clip: ['video'],
  photo: ['image', 'screenshot'], photos: ['image', 'screenshot'], picture: ['image', 'screenshot'], pictures: ['image', 'screenshot'], screenshot: ['screenshot'], screenshots: ['screenshot'],
  article: ['bookmark'], articles: ['bookmark'], link: ['bookmark'], links: ['bookmark'], page: ['bookmark'], recipe: ['bookmark', 'video'], recipes: ['bookmark', 'video'],
  note: ['note'], notes: ['note'], highlight: ['selection'], highlights: ['selection'], quote: ['selection'], pdf: ['document'], document: ['document'], memo: ['audio'], voice: ['audio'],
};
const PLATFORMS: Record<string, string> = { twitter: 'X', x: 'X', instagram: 'Instagram', insta: 'Instagram', ig: 'Instagram', youtube: 'YouTube', tiktok: 'TikTok', pinterest: 'Pinterest', reddit: 'Reddit' };
const RECENT = new Set(['recent', 'recently', 'latest', 'newest', 'last', 'new']);
const LEADS = new Set(['about', 'and', 'also', 'only', 'just', 'what', 'how', 'with', 'from', 'instead', 'but', 'any', 'or', 'now']);
const QUIET = new Set([...LEADS, 'a', 'an', 'the', 'that', 'this', 'those', 'these', 'i', 'me', 'my', 'mine', 'saved', 'save', 'kept', 'on', 'of', 'for', 'to', 'in', 'find', 'show', 'where', 'was', 'were', 'is', 'are', 'it', 'one', 'ones', 'things', 'stuff', 'some', 'week', 'which', 'did', 'do', 'have', 'got', 'there', 'please', 'can', 'you', 'all', 'one']);

/** What a question asks: kinds of save, platforms, words for the topic, and whether newest matters. */
export function readAsk(question: string): Ask {
  const words = question.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
  const kinds = [...new Set(words.flatMap(word => KINDS[word] ?? []))];
  const platforms = [...new Set(words.flatMap(word => (PLATFORMS[word] ? [PLATFORMS[word]] : [])))];
  const topic = words.filter(word => !QUIET.has(word) && !KINDS[word] && !PLATFORMS[word] && !RECENT.has(word));
  return { kinds, platforms, topic, recent: words.some(word => RECENT.has(word)) };
}

const KIND_NAMES: [Capture['type'][], string][] = [[['tweet', 'image', 'video'], 'posts'], [['tweet'], 'posts'], [['video'], 'videos'], [['image', 'screenshot'], 'photos'], [['bookmark'], 'links'], [['bookmark', 'video'], 'recipes'], [['note'], 'notes'], [['selection'], 'highlights'], [['document'], 'PDFs'], [['audio'], 'voice memos'], [['screenshot'], 'screenshots']];
const same = (a: string[], b: string[]) => a.length === b.length && a.every(item => b.includes(item));
const ONE: Record<string, string> = { posts: 'post', videos: 'video', photos: 'photo', links: 'link', recipes: 'recipe', notes: 'note', highlights: 'highlight', PDFs: 'PDF', 'voice memos': 'voice memo', screenshots: 'screenshot', saves: 'save' };
/** "posts from X", "videos about cooking", "saves" — what a context covers, in words (`count` 1: "a post"…). */
export function describe(ask: Pick<Ask, 'kinds' | 'platforms'> & { topic?: string[] }, count = 2) {
  const many = ask.kinds.length ? KIND_NAMES.find(([kinds]) => same(kinds, ask.kinds))?.[1] ?? 'saves' : 'saves';
  const kind = count === 1 ? ONE[many] ?? many : many;
  return [kind, ask.platforms.length ? `from ${ask.platforms.join(' or ')}` : '', ask.topic?.length ? `about ${ask.topic.join(' ')}` : ''].filter(Boolean).join(' ');
}

const stem = (word: string) => (word.length > 3 && word.endsWith('s') ? word.slice(0, -1) : word);
function find(ask: Ask, captures: Capture[]) {
  const scored = captures.map(capture => {
    const text = [captureTitle(capture), capture.summary, capture.selectionText, capture.noteText, capture.folder?.name, capture.provenance?.siteName, ...(capture.provenance?.authors ?? []), ...(capture.userTags ?? [])].filter(Boolean).join(' ').toLowerCase();
    return { capture, score: ask.topic.filter(word => text.includes(stem(word))).length };
  }).filter(({ capture, score }) => (!ask.kinds.length || ask.kinds.includes(capture.type))
    && (!ask.platforms.length || ask.platforms.includes(sourcePlatform(capture) ?? ''))
    && (!ask.topic.length || score > 0));
  // Newest first; with a topic, the best matches first unless the newest was asked for.
  return scored.sort((a, b) => (ask.topic.length && !ask.recent ? b.score - a.score : 0) || b.capture.capturedAt - a.capture.capturedAt).map(({ capture }) => capture);
}

/** A few words of a save — a long post cut at a word, so Kit's line stays short. */
export function short(text: string, max = 56) {
  const clean = text.trim().replace(/\s+/g, ' ');
  if (clean.length <= max) return clean.replace(/[.!?]$/, '');
  return `${clean.slice(0, max).replace(/\s+\S*$/, '').replace(/[,;:.]$/, '')}…`;
}
/** A conversation: each question read in the light of the ones before it. */
export function converse(questions: string[], captures: Capture[], now = Date.now()): Turn[] {
  const turns: Turn[] = [];
  for (const question of questions) {
    const ask = readAsk(question), previous = turns[turns.length - 1]?.context;
    const first = (question.toLowerCase().match(/[\p{L}]+/u) ?? [''])[0];
    const followUp = Boolean(previous) && (!ask.kinds.length || LEADS.has(first));
    const context: Ask = followUp && previous ? {
      kinds: ask.kinds.length ? ask.kinds : previous.kinds, platforms: ask.platforms.length ? ask.platforms : previous.platforms,
      topic: ask.topic.length ? ask.topic : previous.topic, recent: ask.recent || previous.recent,
    } : ask;
    // One short line (Pritam: no clutter) — the cards underneath show the saves themselves.
    let items = find(context, captures), elsewhere = false, reply: string;
    const n = items.length;
    if (n) {
      reply = followUp && ask.topic.length ? `${n} of them ${n === 1 ? 'is' : 'are'} about ${context.topic.join(' ')}.`
        : context.topic.length ? `${n} ${describe(context, n)}.`
        : `${n} ${describe({ kinds: context.kinds, platforms: context.platforms }, n)}, newest first.`;
    } else {
      const wider = context.topic.length ? find({ kinds: [], platforms: [], topic: context.topic, recent: context.recent }, captures) : [];
      if (wider.length) { items = wider; elsewhere = true; reply = `No ${describe(context)} — ${wider.length} elsewhere.`; }
      else reply = `No ${describe(context)} yet.`;
    }
    turns.push({ question, context, items, reply, followUp, elsewhere });
  }
  return turns;
}

/** The saves a context covers (for a context with something taken out of it). */
export function savesFor(ask: Ask, captures: Capture[]) { return find(ask, captures); }

/** What to ask next, from where the conversation is: a topic from your tags, another place, one kind. */
export function followUps(context: Ask | null, tags: string[]): string[] {
  if (!context) return ['recent post I saved from twitter', `videos about ${(tags[0] ?? 'cooking').toLowerCase()}`, 'what did I save this week?'];
  const next: string[] = [];
  if (!context.topic.length) next.push(...tags.slice(0, 2).map(tag => `about ${tag.toLowerCase()}`));
  next.push(context.platforms.includes('Instagram') ? 'from twitter' : 'from instagram');
  if (!context.recent) next.push('only the newest');
  if (!same(context.kinds, ['video'])) next.push('only videos');
  return next.slice(0, 4);
}
