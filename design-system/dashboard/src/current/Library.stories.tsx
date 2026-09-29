import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { http, HttpResponse } from 'msw';
import Dashboard from '../../../../apps/site/components/dashboard/dashboard';
import { parseDashboardState } from '../../../../apps/site/lib/dashboard';
import { library, saves } from '../../../fixtures/world.ts';
import { InShell } from '../StoryShell.tsx';
import { me, toWeb } from '../handlers.ts';

const meta: Meta = { title: 'Current/Library', parameters: { simulator: true, layout: 'fullscreen', url: 'foundkeep.app/dashboard', nextjs: { navigation: { pathname: '/dashboard' } } } };
export default meta;
type Story = StoryObj;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const shown = (state: Record<string, string> = {}, captures: any[] = library.map(toWeb)) => () => <InShell><Dashboard me={me as any} initialCaptures={{ captures, nextCursor: null, total: captures.length }} initialState={parseDashboardState(state)} /></InShell>;
export const Library: Story = { render: shown() };
export const Empty: Story = { name: 'Empty library', render: shown({}, []), parameters: { msw: { handlers: { story: [http.get('*/api/captures', () => HttpResponse.json({ captures: [], nextCursor: null, total: 0 }))] } } } };
export const SaveOpen: Story = { name: 'A save open over the library', render: shown({ item: saves.bookmark.id }), parameters: { nextjs: { navigation: { pathname: '/dashboard', query: { item: saves.bookmark.id } } } } };
