import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { FirstScreen } from '../../../../apps/mobile/src/proposals/sign-in/FirstScreen.tsx';

type Args = { look: 'sky' | 'meadow' };
const meta: Meta<Args> = {
  title: 'Proposals/Sign in',
  args: { look: 'sky' },
  argTypes: { look: { control: 'inline-radio', options: ['sky', 'meadow'], description: 'Sky or Meadow' } },
  parameters: { simulator: true, layout: 'fullscreen', session: 'signed-out', route: { pathname: '/sign-in', params: {} },
    docs: { description: { component: 'The first screen: no logo, no bookmark; the words are the design. Pritam liked Rotating finds — its typefaces are compared below. Switch Sky/Meadow in Controls; press ↻ (Remount) to replay. Fonts: Google Fonts, SIL OFL.' } } },
};
export default meta;
type Story = StoryObj<Args>;
// Story names must be literal: Storybook reads them without running the file.
export const RotatingInstrument: Story = { name: 'Rotating finds · Instrument Serif', render: ({ look }) => <FirstScreen look={look} type="rotating" font="instrument" /> };
export const RotatingDMSerif: Story = { name: 'Rotating finds · DM Serif Display', render: ({ look }) => <FirstScreen look={look} type="rotating" font="dmserif" /> };
export const RotatingBricolage: Story = { name: 'Rotating finds · Bricolage Grotesque', render: ({ look }) => <FirstScreen look={look} type="rotating" font="bricolage" /> };
export const RotatingUnbounded: Story = { name: 'Rotating finds · Unbounded', render: ({ look }) => <FirstScreen look={look} type="rotating" font="unbounded" /> };
export const RotatingSyne: Story = { name: 'Rotating finds · Syne', render: ({ look }) => <FirstScreen look={look} type="rotating" font="syne" /> };
export const RotatingJakarta: Story = { name: 'Rotating finds · Plus Jakarta Sans + Caveat', render: ({ look }) => <FirstScreen look={look} type="rotating" font="jakarta" /> };
export const Highlighter: Story = { name: 'Other · Highlighter', render: ({ look }) => <FirstScreen look={look} type="highlighter" /> };
export const Tags: Story = { name: 'Other · Tags', render: ({ look }) => <FirstScreen look={look} type="tags" /> };
export const Stack: Story = { name: 'Other · Big stack', render: ({ look }) => <FirstScreen look={look} type="stack" /> };
export const Email: Story = { name: 'Continuing with email', render: ({ look }) => <FirstScreen look={look} type="rotating" emailOpen />, parameters: { keyboard: true } };
