import '../../apps/extension/src/theme.css';
import '../../apps/extension/src/components.css';
import '../../apps/extension/src/review.css';
import './preview.css';

// Light / dark comes from theme.css itself: the toolbar sets data-theme on
// <html>, exactly as the extension's appearance setting does.
const withTheme = (story, { globals }) => {
  document.documentElement.dataset.theme = globals.theme || 'light';
  return story();
};

const viewport = (name, width, height) => ({ name, styles: { width: `${width}px`, height: `${height}px` }, type: width < 600 ? 'mobile' : width < 1100 ? 'tablet' : 'desktop' });

export default {
  tags: ['autodocs'],
  decorators: [withTheme],
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
    options: { storySort: { order: ['Welcome', 'Foundations', ['Color', 'Typography', 'Spacing', 'Radius', 'Elevation', 'Iconography'], 'Components', 'Extension', ['Add details card'], 'Web', '*'] } },
  },
};
