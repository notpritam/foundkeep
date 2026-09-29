import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import OpenLink from '../../../../apps/mobile/src/app/open.tsx';

const meta: Meta = { title: 'Current/Links', parameters: { simulator: true, layout: 'fullscreen' } };
export default meta;
export const OpenFromTheWeb: StoryObj = { name: 'Opening a FoundKeep link (a brief spinner, then the screen it names)', render: () => <OpenLink />, parameters: { route: { pathname: '/open', params: { path: 'collection' } } } };
