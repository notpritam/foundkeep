// FoundKeep design system. Stories render the product's own CSS and markup
// (apps/extension/src/theme.css, review.css, review.html, save-details.js,
// dock.js), so what shows here is what ships — nothing is redrawn.
export default {
  framework: '@storybook/html-vite',
  stories: ['../src/**/*.mdx', '../src/**/*.stories.js'],
  addons: ['@storybook/addon-docs', 'storybook-addon-pseudo-states'],
  core: { disableTelemetry: true },
  // downloads/ holds the latest dev extension (scripts/dev-extension.mjs).
  // The dashboard's CSS asks for its fonts at the site root, so the hub serves them.
  staticDirs: ['../public', { from: '../downloads', to: '/downloads' }, { from: '../../apps/site/public/assets/fonts', to: '/assets/fonts' }],
  docs: { defaultName: 'Docs' },
  // The stories import from ../apps; bb Connect serves this under another host.
  viteFinal: config => ({ ...config, server: { ...config.server, allowedHosts: true, fs: { ...config.server?.fs, allow: ['../..'] } } }),
};
