import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { SearchAndKit } from '../../../../apps/mobile/src/proposals/kit/Locked.tsx';

// Home and Ask Kit, closed 2026-10-03: the final of each, then variations of it. Board: Home and
// Ask Kit / Final, and variations. The final's every state: Current/Search and Ask Kit.
const meta: Meta = { title: 'Proposals/Home and Ask Kit', parameters: { simulator: true, layout: 'fullscreen', controls: { disable: true }, route: { pathname: '/collection', params: {} } } };
export default meta;
type Story = StoryObj;
export const HomeFinal: Story = { name: 'Home · final', render: () => <SearchAndKit /> };
export const HomeGreeting: Story = { name: 'Home · a greeting', render: () => <SearchAndKit home="greeting" /> };
export const HomeCompact: Story = { name: 'Home · compact', render: () => <SearchAndKit home="compact" /> };
export const HomeNudge: Story = { name: 'Home · a nudge to ask Kit', render: () => <SearchAndKit home="nudge" /> };
export const KitFinal: Story = { name: 'Ask Kit · final', render: () => <SearchAndKit state="followup" /> };
export const KitList: Story = { name: 'Ask Kit · the saves as a list', render: () => <SearchAndKit state="followup" answers="list" /> };
export const KitLead: Story = { name: 'Ask Kit · the best match large', render: () => <SearchAndKit state="question" answers="lead" /> };
export const KitThinking: Story = { name: 'Ask Kit · a thinking moment', render: () => <SearchAndKit state="followup" thinking /> };
