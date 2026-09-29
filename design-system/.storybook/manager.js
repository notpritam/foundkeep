import { addons } from 'storybook/manager-api';
import { create } from 'storybook/theming';

addons.setConfig({
  theme: create({
    base: 'dark',
    brandTitle: 'FoundKeep design system',
    brandTarget: '_self',
    colorPrimary: '#4cc38a',
    colorSecondary: '#4cc38a',
    appBg: '#0f1011',
    appContentBg: '#08090a',
    appPreviewBg: '#08090a',
    appBorderColor: '#23252a',
    appBorderRadius: 10,
    barBg: '#0f1011',
    barTextColor: '#8a8f98',
    barSelectedColor: '#4cc38a',
    textColor: '#f7f8f8',
    textMutedColor: '#8a8f98',
    inputBg: '#1a1c20',
    inputBorder: '#34373d',
    inputTextColor: '#f7f8f8',
    fontBase: 'Inter, system-ui, sans-serif',
  }),
  sidebar: { showRoots: true },
});
