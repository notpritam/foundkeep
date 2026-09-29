import '../../apps/extension/src/theme.css';
import '../../apps/extension/src/review.css';
import './preview.css';

// Light / dark comes from theme.css itself: the toolbar sets data-theme on
// <html>, exactly as the extension's appearance setting does.
const withTheme = (story, { globals }) => {
  document.documentElement.dataset.theme = globals.theme || 'light';
  return story();
};
// Controls that live on the Add details card are shown on its surface.
const withSurface = (story, { parameters }) => {
  const out = story();
  if (!parameters.surface) return out;
  const surface = document.createElement('div');
  surface.className = 'fk-surface' + (parameters.surface === 'wide' ? ' wide' : '');
  if (typeof out === 'string') surface.innerHTML = out; else surface.append(out);
  return surface;
};

const viewport = (name, width, height) => ({ name, styles: { width: `${width}px`, height: `${height}px` }, type: width < 600 ? 'mobile' : width < 1100 ? 'tablet' : 'desktop' });

export default {
  tags: ['autodocs'],
  decorators: [withSurface, withTheme],
  globalTypes: {
    theme: {
      description: 'Light or dark (theme.css)',
      toolbar: { title: 'Theme', icon: 'mirror', items: [{ value: 'light', title: 'Light' }, { value: 'dark', title: 'Dark' }], dynamicTitle: true },
    },
  },
  initialGlobals: { theme: 'light' },
  parameters: {
    layout: 'padded',
    controls: { expanded: true, sort: 'requiredFirst' },
    backgrounds: { disable: true },
    viewport: {
      options: {
        card: viewport('Extension card (380)', 380, 700),
        phone: viewport('Phone (390)', 390, 844),
        tablet: viewport('Tablet (768)', 768, 1024),
        laptop: viewport('Laptop (1280)', 1280, 800),
        desktop: viewport('Desktop (1600)', 1600, 1000),
      },
    },
    options: { storySort: { order: ['Welcome', 'Foundations', ['Colors', 'Typography', 'Shape', 'Icons'], 'Extension', ['Add details card', 'Card controls'], 'Proposals', ['Refined card', ['Chosen*', '*'], 'Add details card'], '*'] } },
  },
};
