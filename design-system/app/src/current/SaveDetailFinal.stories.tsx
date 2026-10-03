import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { SaveDetailFinal } from '../../../../apps/mobile/src/proposals/detail/Final.tsx';
import { realShapes, saves } from '../../../fixtures/world.ts';

// A save, opened — locked 2026-10-03: With Kit, cleaned (proposals/detail/Final.tsx). A story per
// kind of save, including three shaped like real ones from the audit of saves. The shapes it was
// picked from: Tried/Save detail. Board: Decided/Save detail.
const KINDS = {
  article: saves.bookmark.id, post: saves.post.id, sharedPost: realShapes.sharedPost.id, postNotKept: realShapes.postNotKept.id, sharedLink: realShapes.sharedLink.id,
  photoPost: saves.photoPost.id, reel: saves.reel.id, recipe: saves.recipe.id, video: saves.video.id, photo: saves.desk.id, screenshot: saves.region.id, fullPage: saves.fullpage.id,
  note: saves.note.id, highlight: saves.highlight.id, pdf: saves.document.id, voiceMemo: saves.audio.id, preparing: saves.processing.id, failed: saves.failed.id,
} as const;
type Args = { kind: keyof typeof KINDS };
const meta: Meta<Args> = {
  title: 'Final/6 Save detail',
  args: { kind: 'article' },
  argTypes: { kind: { options: Object.keys(KINDS), control: { type: 'select' } } },
  parameters: { simulator: true, layout: 'fullscreen', route: { pathname: '/capture/' + saves.bookmark.id, params: { id: saves.bookmark.id } } },
  render: ({ kind }) => <SaveDetailFinal id={KINDS[kind] ?? KINDS.article} />,
};
export default meta;
type Story = StoryObj<Args>;
const kind = (name: string, value: keyof typeof KINDS): Story => ({ name, args: { kind: value } });
export const Article = kind('An article', 'article');
export const Post = kind('A post on X', 'post');
export const SharedPost = kind('A post shared from the iPhone (its words kept on the server)', 'sharedPost');
export const PostNotKept = kind('A post whose words weren’t kept', 'postNotKept');
export const SharedLink = kind('A link shared as text (YouTube)', 'sharedLink');
export const PhotoPost = kind('A post with a photo', 'photoPost');
export const Reel = kind('A reel', 'reel');
export const Recipe = kind('A recipe', 'recipe');
export const Video = kind('A video', 'video');
export const Photo = kind('A photo', 'photo');
export const Screenshot = kind('A screenshot', 'screenshot');
export const FullPage = kind('A full page', 'fullPage');
export const Note = kind('A note', 'note');
export const Highlight = kind('A highlight', 'highlight');
export const Pdf = kind('A PDF', 'pdf');
export const VoiceMemo = kind('A voice memo', 'voiceMemo');
export const StillBeingRead = kind('Still being read', 'preparing');
export const CouldNotBeRead = kind('Couldn’t be read', 'failed');
