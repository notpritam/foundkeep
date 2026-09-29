import path from 'node:path';
import type { StorybookConfig } from '@storybook/react-native-web-vite';

// The app's own React, React Native and react-native-web live in the repo
// root's node_modules. Storybook's docs addon brings React 19.3; alias every
// React import to the app's copy so exactly one React runs in the preview.
const root = path.resolve(import.meta.dirname, '../../..');
const shared = ['react', 'react-dom', 'react-native-web', 'react-native-safe-area-context'];

const config: StorybookConfig = {
  stories: ['../src/**/*.mdx', '../src/**/*.stories.@(ts|tsx)', '../../../apps/mobile/src/**/*.stories.@(ts|tsx)'],
  addons: ['@storybook/addon-docs'],
  staticDirs: ['../../public', '../public'],
  framework: { name: '@storybook/react-native-web-vite', options: { modulesToTranspile: ['react-native-safe-area-context', 'react-native-screens'] } },
  core: { disableTelemetry: true },
  docs: { defaultName: 'Docs' },
  viteFinal: async config => {
    const aliases = shared.map(name => ({ find: new RegExp(`^${name}(?=$|/)`), replacement: path.join(root, 'node_modules', name) }));
    // Screens render outside a navigator: expo-router is replaced by mocks/expo-router.tsx.
    aliases.push({ find: /^expo-router$/, replacement: path.resolve(import.meta.dirname, '../mocks/expo-router.tsx') });
    config.resolve = { ...config.resolve, dedupe: [...(config.resolve?.dedupe || []), ...shared],
      alias: [...aliases, ...(Array.isArray(config.resolve?.alias) ? config.resolve.alias : Object.entries(config.resolve?.alias || {}).map(([find, replacement]) => ({ find, replacement: replacement as string })))] };
    config.server = { ...config.server, fs: { ...config.server?.fs, allow: [root, path.resolve(root, '../foundkeep-scenic-landing/node_modules')] } };
    return config;
  },
};
export default config;
