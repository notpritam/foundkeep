import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import SaveFromAnyApp from '../../../../apps/mobile/src/app/(app)/onboarding.tsx';

// First run, picked 2026-10-02 from Proposals/First run (Watch it happen), remade with an
// X-style post and a reel. Provisional: to be remade from Pritam's recording of the real flow.
const meta: Meta = { title: 'Current/Onboarding', parameters: { simulator: true, layout: 'fullscreen' } };
export default meta;
export const SaveFromAnywhere: StoryObj = { name: 'Save from any app (first run, provisional)', render: () => <SaveFromAnyApp />, parameters: { route: { pathname: '/onboarding', params: {} } } };
