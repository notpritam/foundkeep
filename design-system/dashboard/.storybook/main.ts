import path from 'node:path';
import type { StorybookConfig } from '@storybook/nextjs-vite';

// The dashboard's React 19.3 lives in apps/site/node_modules and Next in the
// repo root. Alias both so the preview runs exactly the dashboard's copies.
const root = path.resolve(import.meta.dirname, '../../..');
const site = path.join(root, 'apps/site');
const own = { react: path.join(site, 'node_modules/react'), 'react-dom': path.join(site, 'node_modules/react-dom'), next: path.join(root, 'node_modules/next') };

const config: StorybookConfig = {
  stories: ['../src/**/*.mdx', '../src/**/*.stories.@(ts|tsx)', '../../../apps/site/components/**/*.stories.@(ts|tsx)'],
  addons: ['@storybook/addon-docs'],
  staticDirs: ['../../public', '../public', { from: '../../../apps/site/public/assets', to: '/assets' }],
  framework: { name: '@storybook/nextjs-vite', options: { nextConfigPath: path.join(site, 'next.config.ts') } },
  core: { disableTelemetry: true },
  docs: { defaultName: 'Docs' },
  viteFinal: async config => {
    // apps/site imports '@/…' from its root (tsconfig paths).
    const siteAlias = { find: /^@\//, replacement: site + '/' };
    const aliases = Object.entries(own).map(([name, dir]) => ({ find: new RegExp(`^${name}(?=$|/)`), replacement: dir }));
    const existing = Array.isArray(config.resolve?.alias) ? config.resolve.alias : Object.entries(config.resolve?.alias || {}).map(([find, replacement]) => ({ find, replacement: replacement as string }));
    config.resolve = { ...config.resolve, dedupe: [...(config.resolve?.dedupe || []), 'react', 'react-dom', 'next'], alias: [...aliases, siteAlias, ...existing] };
    config.server = { ...config.server, fs: { ...config.server?.fs, allow: [root, path.resolve(root, '../foundkeep-scenic-landing/node_modules')] } };
    return config;
  },
};
export default config;
