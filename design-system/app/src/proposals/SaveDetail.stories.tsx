import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { SaveDetail, type DetailLook } from '../../../../apps/mobile/src/proposals/detail/Detail.tsx';
import { realShapes, saves } from '../../../fixtures/world.ts';

// A save, opened (2026-10-03): the four shapes for the detail screen, each for every kind of save.
// With Kit was picked and cleaned into Final/6 Save detail; these stay as they were. Board:
// Decided/Save detail. Today's screen: In the app today/Save detail.
const KINDS = {
  article: saves.bookmark.id, recipe: saves.recipe.id, post: saves.post.id, photoPost: saves.photoPost.id, reel: saves.reel.id, video: saves.video.id,
  photo: saves.desk.id, screenshot: saves.region.id, fullPage: saves.fullpage.id, note: saves.note.id, highlight: saves.highlight.id, pdf: saves.document.id,
  voiceMemo: saves.audio.id, preparing: saves.processing.id, failed: saves.failed.id,
  sharedPost: realShapes.sharedPost.id, postNotKept: realShapes.postNotKept.id, sharedLink: realShapes.sharedLink.id,
} as const;
const LABELS: Record<keyof typeof KINDS, string> = {
  article: 'An article', recipe: 'A recipe', post: 'A post on X', photoPost: 'A post with a photo', reel: 'A reel', video: 'A video', photo: 'A photo', screenshot: 'A screenshot',
  fullPage: 'A full page', note: 'A note', highlight: 'A highlight', pdf: 'A PDF', voiceMemo: 'A voice memo', preparing: 'Still being read', failed: 'Couldn’t be read',
  sharedPost: 'A post shared from the iPhone', postNotKept: 'A post whose words weren’t kept', sharedLink: 'A link shared as text',
};
type Args = { kind: keyof typeof KINDS };
const meta: Meta<Args> = {
  title: 'Tried/Save detail',
  args: { kind: 'article' },
  argTypes: { kind: { options: Object.keys(KINDS), control: { type: 'select', labels: LABELS } } },
  parameters: { simulator: true, layout: 'fullscreen', route: { pathname: '/capture/' + saves.bookmark.id, params: { id: saves.bookmark.id } } },
};
export default meta;
type Story = StoryObj<Args>;
const look = (name: string, value: DetailLook): Story => ({ name, render: ({ kind }) => <SaveDetail id={KINDS[kind] ?? KINDS.article} look={value} /> });
export const PictureFirst = look('Picture first, actions by the thumb', 'picture');
export const Reader = look('Reader: the words first', 'reader');
export const Sheet = look('A sheet over the Library', 'sheet');
export const WithKit = look('With Kit, always there (picked; cleaned into the final)', 'kit');
