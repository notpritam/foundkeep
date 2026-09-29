import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { CaptureCard } from '../../../apps/site/components/dashboard/capture-card';
import type { Capture } from '../../../apps/site/lib/dashboard';
import '../../../apps/site/components/dashboard/dashboard.css';

const now = Date.parse('2026-09-29T09:00:00Z');
const bookmark: Capture = { id: 'bookmark', type: 'bookmark', status: 'done', sourceTitle: 'The half-life of a good idea',
  sourceUrl: 'https://themargin.example/half-life', summary: 'Most of what we read is gone within a week. A small practice of keeping changes what stays.',
  userTags: ['Memory'], capturedAt: now, updatedAt: now, provenance: { siteName: 'The Margin' } as Capture['provenance'] };

const meta: Meta<typeof CaptureCard> = {
  title: 'Dashboard/Proof/Capture card',
  component: CaptureCard,
  args: { capture: bookmark, open: () => {} },
  decorators: [Story => <div style={{ width: 280 }}><Story /></div>],
};
export default meta;
export const Bookmark: StoryObj<typeof CaptureCard> = {};
