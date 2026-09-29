import { el, specimens, frame } from './lib.js';
import { renderPreview, renderSyncStatus } from '../../../apps/extension/src/save-preview.js';
import { PREVIEWS } from '../card.js';

const KINDS = ['region', 'fullpage', 'image', 'post', 'highlight', 'page', 'page-text'];
const LABELS = { region: 'Region screenshot', fullpage: 'Full-page screenshot', image: 'Image', post: 'Post on X', highlight: 'Highlight', page: 'Page with a cover', 'page-text': 'Page without a cover' };
const preview = ({ kind = 'region', sync = 'none' }) => {
  const figure = renderPreview(PREVIEWS[kind]);
  if (sync !== 'none') { const b = document.createElement('button'); b.dataset.overlay = 'true'; figure.append(renderSyncStatus(sync, b)); }
  return frame(figure, 348);
};
export default {
  title: 'Components/Save preview',
  render: args => preview(args),
  args: { kind: 'region', sync: 'none' },
  argTypes: { kind: { control: 'inline-radio', options: KINDS }, sync: { control: 'inline-radio', options: ['none', 'queued', 'failed', 'local', 'synced'] } },
  parameters: { layout: 'centered', docs: { description: { component: '`.fk-preview` (save-preview.js) — what was saved, framed: a screenshot or image cropped from the top (a full page fades out), a post with its first photo, a highlight as a quote, or a page (its cover image, or its site and description). A label names the kind and size. The extension draws it from a small WebP the background makes — never the capture itself. A **Sync status** can sit in its corner. Notes have no preview.' } } },
};
export const Playground = {};
export const EveryKind = { name: 'Every kind', render: () => specimens(KINDS.map(kind => [LABELS[kind], preview({ kind })])), parameters: { layout: 'padded', controls: { disable: true } } };
export const WithSyncStatus = { name: 'With its sync status', render: () => specimens(['queued', 'failed', 'local', 'synced'].map(sync => [sync, preview({ kind: 'region', sync })])), parameters: { layout: 'padded', controls: { disable: true } } };
