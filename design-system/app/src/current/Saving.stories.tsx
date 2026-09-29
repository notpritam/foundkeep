import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import NewNote from '../../../../apps/mobile/src/app/(app)/new-note.tsx';

const meta: Meta = { title: 'Current/Saving', parameters: { simulator: true, layout: 'fullscreen' } };
export default meta;
export const NewNoteScreen: StoryObj = { name: 'New note', render: () => <NewNote />, parameters: { keyboard: true, route: { pathname: '/new-note', params: {}, header: 'New note' } } };
