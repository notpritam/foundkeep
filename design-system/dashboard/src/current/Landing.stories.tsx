import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import Home from '../../../../apps/site/app/page';

// foundkeep.app itself: the scenic landing page, as the site renders it.
const meta: Meta = { title: 'Current/Landing', parameters: { simulator: true, layout: 'fullscreen' } };
export default meta;
export const Landing: StoryObj = { name: 'foundkeep.app', render: () => <Home />, parameters: { url: 'foundkeep.app', nextjs: { navigation: { pathname: '/' } } } };
