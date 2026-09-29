import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { PublicCollection } from '../../../../apps/site/components/collections/public-page';
import { collectionDetail } from '../handlers.ts';

const meta: Meta = { title: 'Current/Public', parameters: { simulator: true, layout: 'fullscreen' } };
export default meta;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const CollectionPage: StoryObj = { name: 'A public collection', render: () => <PublicCollection initial={collectionDetail('col-design') as any} />, parameters: { url: 'foundkeep.app/collection/design-that-works', nextjs: { navigation: { pathname: '/collection/design-that-works' } } } };
