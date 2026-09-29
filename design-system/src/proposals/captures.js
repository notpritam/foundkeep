// Sample saves for the proposals, one per kind the extension makes
// (capture-actions.js): screenshots (region / full page), highlights, posts
// on X (a highlight with a social context), images, pages and notes. Images
// come from design-system/scripts-samples.mjs (the captures' article fixture).
const SITE = 'themargin.example';
export const CAPTURES = {
  region: { kind: 'Region screenshot', icon: 'screenshot', title: 'The half-life of a good idea', site: SITE, image: 'samples/region.jpg', width: 780, height: 400 },
  fullpage: { kind: 'Full-page screenshot', icon: 'screenshot', title: 'The half-life of a good idea — The Margin', site: SITE, image: 'samples/fullpage.jpg', width: 1280, height: 1787, tall: true },
  highlight: { kind: 'Highlight', icon: 'quote', title: 'The half-life of a good idea', site: SITE, text: 'Memory is built to discard; keeping everything would be its own kind of noise. The question is not how to remember more, but how to choose.' },
  post: { kind: 'Post on X', icon: 'post', title: 'Ada Kowalski on X', site: 'x.com', author: 'Ada Kowalski', handle: '@adak', text: 'Spaced repetition is not a study hack. It is what remembering looks like when you stop pretending you will reread everything.', image: 'samples/image.jpg' },
  image: { kind: 'Image', icon: 'image', title: 'Forgetting curve with reviews', site: SITE, image: 'samples/image.jpg', width: 700, height: 301 },
  page: { kind: 'Page', icon: 'page', title: 'The half-life of a good idea — The Margin', site: SITE, text: 'Most of what we read is gone within a week. A small practice of keeping — not hoarding — changes what stays.', image: 'samples/region.jpg', minutes: 9 },
  note: { kind: 'Note', icon: 'note', title: 'Call notes', site: '', text: '' },
};
export const CAPTURE_KINDS = Object.keys(CAPTURES);
