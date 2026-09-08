import type { Capture, CaptureType } from '../api/types.ts';

const LABELS: Record<CaptureType, string> = {
  screenshot: 'screenshot', selection: 'highlight', bookmark: 'bookmark', image: 'image',
  note: 'note', tweet: 'post', video: 'video', audio: 'audio', document: 'document', file: 'file',
};

export function captureTitle(capture: Partial<Capture>): string {
  return capture.sourceTitle?.trim()
    || capture.fileName?.trim()
    || capture.noteText?.trim().slice(0, 120)
    || capture.selectionText?.trim().slice(0, 120)
    || `Untitled ${capture.type ? LABELS[capture.type] : 'capture'}`;
}

export function filterCaptures(captures: Capture[], query: string, type: CaptureType | null): Capture[] {
  const needle = query.trim().toLocaleLowerCase();
  return captures.filter((capture) => {
    if (type && capture.type !== type) return false;
    if (!needle) return true;
    return [captureTitle(capture), capture.fileName, capture.noteText, capture.selectionText, capture.summary, capture.articleText, capture.sourceUrl, ...(capture.tags || [])]
      .some(value => value?.toLocaleLowerCase().includes(needle));
  });
}

export type CaptureGroup = { key: string; batchId: string | null; items: Capture[] };
export function groupCaptures(captures: Capture[]): CaptureGroup[] {
  const groups: CaptureGroup[] = [];
  const batches = new Map<string, CaptureGroup>();
  for (const capture of captures) {
    if (!capture.batchId) {
      groups.push({ key: capture.id, batchId: null, items: [capture] });
      continue;
    }
    let group = batches.get(capture.batchId);
    if (!group) {
      group = { key: capture.batchId, batchId: capture.batchId, items: [] };
      batches.set(capture.batchId, group);
      groups.push(group);
    }
    group.items.push(capture);
  }
  return groups;
}
