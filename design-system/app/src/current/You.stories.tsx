import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { http, HttpResponse } from 'msw';
import Settings from '../../../../apps/mobile/src/app/(app)/(tabs)/settings.tsx';
import Subscription from '../../../../apps/mobile/src/app/(app)/subscription.tsx';
import { plans } from '../../../fixtures/world.ts';
import { StoryTabs } from '../StoryTabs.tsx';

const meta: Meta = { title: 'Current/You', parameters: { simulator: true, layout: 'fullscreen' } };
export default meta;
type Story = StoryObj;
const pro = { msw: { handlers: { story: [http.get('*/api/plan', () => HttpResponse.json(plans.pro))] } } };
export const You: Story = { render: () => <StoryTabs active="settings"><Settings /></StoryTabs>, parameters: { route: { pathname: '/settings', params: {} } } };
export const YouOnPro: Story = { name: 'You, on Pro', render: () => <StoryTabs active="settings"><Settings /></StoryTabs>, parameters: { ...pro, route: { pathname: '/settings', params: {} } } };
export const PlanFree: Story = { name: 'Your plan (Free)', render: () => <Subscription />, parameters: { route: { pathname: '/subscription', params: {}, header: 'Your plan' } } };
export const PlanPro: Story = { name: 'Your plan (Pro)', render: () => <Subscription />, parameters: { ...pro, route: { pathname: '/subscription', params: {}, header: 'Your plan' } } };
