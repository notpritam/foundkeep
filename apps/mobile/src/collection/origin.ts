import type { Capture } from '../api/types.ts';
import { sourcePlatform } from '../../../../packages/shared/src/collection-presentation.ts';

/** Platforms with a mark of their own (Ionicons); color null means the ink colour. */
const MARKS: Record<string, { icon: string; color: string | null }> = {
  X: { icon: 'logo-x', color: null }, Instagram: { icon: 'logo-instagram', color: '#E1306C' }, YouTube: { icon: 'logo-youtube', color: '#FF0033' },
  TikTok: { icon: 'logo-tiktok', color: null }, Pinterest: { icon: 'logo-pinterest', color: '#E60023' }, Reddit: { icon: 'logo-reddit', color: '#FF4500' },
  LinkedIn: { icon: 'logo-linkedin', color: '#0A66C2' }, GitHub: { icon: 'logo-github', color: null }, Medium: { icon: 'logo-medium', color: null }, Threads: { icon: 'logo-threads', color: null },
};

/** Where a save came from, as a card shows it (2026-10-02): a platform's own mark — a post by
 * who wrote it — a website as a globe and its name, and otherwise what it is. color: null is
 * the ink colour, 'muted' the muted one. */
export function origin(capture: Capture): { name: string; icon: string; color?: string | null } {
  if (capture.type === 'note') return { name: 'Note', icon: 'create-outline' };
  const platform = sourcePlatform(capture);
  if (platform && MARKS[platform]) return { name: capture.type === 'tweet' && capture.provenance?.authors?.[0] ? capture.provenance.authors[0] : platform, ...MARKS[platform] };
  const site = capture.provenance?.siteName || platform;
  if (site) return { name: site, icon: 'globe-outline', color: 'muted' };
  if (capture.type === 'audio') return { name: 'Voice memo', icon: 'mic-outline' };
  if (capture.type === 'document' || capture.type === 'file') return { name: capture.fileMime?.includes('pdf') ? 'PDF' : 'File', icon: 'document-outline' };
  return capture.savedVia === 'iphone' ? { name: 'From your iPhone', icon: 'phone-portrait-outline' } : { name: 'Saved', icon: 'bookmark-outline' };
}
