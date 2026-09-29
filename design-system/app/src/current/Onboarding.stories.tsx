import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import ShareGuide from '../../../../apps/mobile/src/app/(app)/onboarding.tsx';

const meta: Meta = { title: 'Current/Onboarding', parameters: { simulator: true, layout: 'fullscreen' } };
export default meta;
export const SaveFromAnywhere: StoryObj = { name: 'Save from anywhere', render: () => <ShareGuide />, parameters: { route: { pathname: '/onboarding', params: {}, header: 'Save from anywhere' } } };
