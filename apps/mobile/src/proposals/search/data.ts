// What the search and agent proposals know (2026-10-03): the folders and tags your saves went
// into, most recently used first — so the Library shows where you've been keeping things, not
// a fixed list of kinds — and Kit, finding saves from a sentence. Kit here is a stand-in that
// reads your library on the phone; the real one answers through FoundKeep's agent.
import type { Capture } from '../../api/types.ts';
import { captureTitle } from '../../collection/model.ts';
import { origin } from '../../collection/origin.ts';
import { savedAge } from '../../../../../packages/shared/src/collection-presentation.ts';

export type Place = { name: string; count: number; latest: number };
export type FolderPlace = Place & { id: string; saves: Capture[] };

/** The folders and tags saves went into, most recently used first, with how many. */
export function recentPlaces(captures: Capture[], limit = 8) {
  const folders = new Map<string, FolderPlace>(), tags = new Map<string, Place>();
  for (const capture of [...captures].sort((a, b) => b.capturedAt - a.capturedAt)) {
    if (capture.folder) {
      const folder = folders.get(capture.folder.id) ?? { id: capture.folder.id, name: capture.folder.name, count: 0, latest: capture.capturedAt, saves: [] };
      folder.count++; folder.saves.push(capture); folders.set(folder.id, folder);
    }
    for (const name of capture.userTags ?? []) {
      const tag = tags.get(name) ?? { name, count: 0, latest: capture.capturedAt };
      tag.count++; tags.set(name, tag);
    }
  }
  return { folders: [...folders.values()].slice(0, limit), tags: [...tags.values()].slice(0, limit) };
}

const QUIET = new Set(['a', 'an', 'the', 'that', 'this', 'those', 'these', 'i', 'me', 'my', 'mine', 'saved', 'save', 'kept', 'about', 'from', 'in', 'on', 'of', 'for', 'with', 'to', 'find', 'show', 'where', 'what', 'was', 'is', 'it', 'one', 'things', 'stuff', 'folder', 'tag', 'any', 'all', 'last', 'week', 'some']);
const KINDS: Record<string, Capture['type'][]> = {
  video: ['video'], videos: ['video'], reel: ['video'], reels: ['video'], short: ['video'], shorts: ['video'],
  post: ['tweet'], posts: ['tweet'], tweet: ['tweet'], photo: ['image', 'screenshot'], photos: ['image', 'screenshot'], picture: ['image', 'screenshot'], image: ['image', 'screenshot'],
  note: ['note'], notes: ['note'], highlight: ['selection'], quote: ['selection'], article: ['bookmark'], link: ['bookmark'], page: ['bookmark'], recipe: ['bookmark', 'video'],
  pdf: ['document'], document: ['document'], memo: ['audio'], voice: ['audio'],
};

/** Kit, finding saves from a sentence: what kind of thing (a video, a post…) and what it was about,
 * across titles, words, tags, folders, sites and authors. The best matches first, then the newest. */
export function askKit(question: string, captures: Capture[]) {
  const words = question.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
  const kinds = new Set(words.flatMap(word => KINDS[word] ?? []));
  const topic = words.filter(word => !QUIET.has(word) && !KINDS[word]);
  const scored = captures.map(capture => {
    const text = [captureTitle(capture), capture.summary, capture.selectionText, capture.noteText, capture.folder?.name, capture.provenance?.siteName, ...(capture.provenance?.authors ?? []), ...(capture.userTags ?? [])].filter(Boolean).join(' ').toLowerCase();
    const score = topic.filter(word => text.includes(word)).length;
    return { capture, score };
  }).filter(({ capture, score }) => (topic.length ? score > 0 : kinds.size > 0) && (!kinds.size || kinds.has(capture.type)));
  const items = scored.sort((a, b) => b.score - a.score || b.capture.capturedAt - a.capture.capturedAt).map(({ capture }) => capture);
  const about = topic.join(' ') || [...kinds].join(' ') || 'that';
  if (!items.length) return { reply: `I couldn’t find anything about “${about}”. Try a word from its title, a tag or a folder.`, items };
  const first = items[0], where = `${origin(first).name}, saved ${savedAge(first)}${first.folder ? ` in ${first.folder.name}` : ''}`;
  return { reply: items.length === 1 ? `Found it: “${captureTitle(first)}” — ${where}.` : `I found ${items.length} saves about “${about}”. The newest is “${captureTitle(first)}” — ${where}.`, items };
}
