import type { Capture } from '../api/types.ts';

// The folders and tags your saves went into, most recently used first (Pritam, 2026-10-03:
// "Jump back in", locked) — so the Library shows where you've been keeping things, kept live,
// not a fixed list of kinds.
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
