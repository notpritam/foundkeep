// FoundKeep design system. Stories render the product's own CSS and markup
// (apps/extension/src/theme.css, review.css, review.html, save-details.js,
// dock.js), so what shows here is what ships — nothing is redrawn.
export default {
  framework: '@storybook/html-vite',
  stories: ['../src/**/*.mdx', '../src/**/*.stories.js'],
  addons: ['@storybook/addon-docs', 'storybook-addon-pseudo-states'],
  core: { disableTelemetry: true },
  // downloads/ holds the latest dev extension (scripts/dev-extension.mjs).
  // The dashboard asks for its fonts and images at the site root (/assets), so the hub serves them.
  staticDirs: ['../public', { from: '../downloads', to: '/downloads' }, { from: '../../apps/site/public/assets', to: '/assets' }],
  docs: { defaultName: 'Docs' },
  // The App and Dashboard Storybooks are built into dist/app and dist/dashboard
  // (scripts/build-all.mjs) and composed here, so one address shows all three.
  refs: { app: { title: 'App', url: './app' }, dashboard: { title: 'Dashboard', url: './dashboard' } },
  // The stories import from ../apps; bb Connect serves this under another host.
  viteFinal: config => ({ ...config, server: { ...config.server, allowedHosts: true, fs: { ...config.server?.fs, allow: ['../..'] } } }),
};
