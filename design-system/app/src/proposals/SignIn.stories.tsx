import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { FirstScreen } from '../../../../apps/mobile/src/proposals/sign-in/FirstScreen.tsx';

type Args = { look: 'sky' | 'meadow' };
const meta: Meta<Args> = {
  title: 'Proposals/Sign in',
  args: { look: 'sky' },
  argTypes: { look: { control: 'inline-radio', options: ['sky', 'meadow'], description: 'Sky or Meadow' } },
  parameters: { simulator: true, layout: 'fullscreen', session: 'signed-out', route: { pathname: '/sign-in', params: {} },
    docs: { description: { component: 'The first screen, after Pritam’s review: no logo; the words are the design. Four type treatments, each with FoundKeep’s own 3D objects and the soft motion. Switch Sky/Meadow in Controls; press ↻ (Remount) to replay. Fonts: Instrument Serif, Bricolage Grotesque, Fraunces (Google Fonts, OFL).' } } },
};
export default meta;
type Story = StoryObj<Args>;
export const Highlighter: Story = { name: '1 · Highlighter', render: ({ look }) => <FirstScreen look={look} type="highlighter" /> };
export const Tags: Story = { name: '2 · Tags', render: ({ look }) => <FirstScreen look={look} type="tags" /> };
export const Rotating: Story = { name: '3 · Rotating finds', render: ({ look }) => <FirstScreen look={look} type="rotating" /> };
export const Stack: Story = { name: '4 · Big stack', render: ({ look }) => <FirstScreen look={look} type="stack" /> };
export const Email: Story = { name: 'Continuing with email', render: ({ look }) => <FirstScreen look={look} type="rotating" emailOpen />, parameters: { keyboard: true } };
