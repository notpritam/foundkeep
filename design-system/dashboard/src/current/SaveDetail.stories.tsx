import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import Dashboard from '../../../../apps/site/components/dashboard/dashboard';
import { parseDashboardState } from '../../../../apps/site/lib/dashboard';
import { saves, type SaveKind } from '../../../fixtures/world.ts';
import { InShell } from '../StoryShell.tsx';
import { me, toWeb } from '../handlers.ts';

const meta: Meta = { title: 'Current/Save detail', parameters: { simulator: true, layout: 'fullscreen' } };
export default meta;
type Story = StoryObj;
const full = (kind: SaveKind, name: string): Story => ({ name,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  render: () => <InShell><Dashboard me={me as any} initialState={parseDashboardState({ item: saves[kind].id })} readingPage initialCapture={toWeb(saves[kind]) as any} /></InShell>,
  parameters: { url: 'foundkeep.app/dashboard/saved/' + saves[kind].id, nextjs: { navigation: { pathname: '/dashboard/saved/' + saves[kind].id, query: { item: saves[kind].id } } } } });
export const Page = full('bookmark', 'A saved page');
export const Screenshot = full('region', 'A screenshot');
export const Post = full('post', 'A post on X');
export const Highlight = full('highlight', 'A highlight');
export const Note = full('note', 'A note');
export const Document = full('document', 'A document');
