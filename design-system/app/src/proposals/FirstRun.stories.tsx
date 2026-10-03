import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FirstRun, TRY_LOOP, tryTaps, type FirstRunLook } from '../../../../apps/mobile/src/proposals/first-run/FirstRun.tsx';
import { PointerPath } from '../Playthrough.tsx';

// First run (proposal, 2026-10-02; Pritam picked Watch it happen, remade for the
// app with an X-style post and a reel — Current/Onboarding — and provisional until
// his recording of the real flow; all four kept for the design log): the screen after someone first signs in —
// how to save from any app — four ways. play: the screens that can run by
// themselves do (the steps turn, Try it once is tapped through by the
// pointer); otherwise you can try them. os: the iPhone share sheet or
// Android's share menu. Side by side: First run / Four ways on the page.
type Args = { os: 'ios' | 'android'; play: boolean };
const meta: Meta<Args> = {
  title: 'Tried/First run',
  parameters: { simulator: true, layout: 'fullscreen', controls: { disable: true }, route: { pathname: '/onboarding', params: {} } },
  args: { os: 'ios', play: true },
  argTypes: { os: { options: ['ios', 'android'] }, play: { control: 'boolean' } },
};
export default meta;
type Story = StoryObj<Args>;
const look = (name: FirstRunLook): Story['render'] => args => <FirstRun look={name} os={args.os} autoplay={args.play} />;
export const Watch: Story = { name: 'Watch it happen (picked)', render: look('watch') };
export const Steps: Story = { name: 'Three steps', render: look('steps') };
export const Closeup: Story = { name: 'The share sheet, up close', render: look('closeup') };
function TryPlayed({ os, play }: Args) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  return <View style={{ flex: 1 }}>
    <FirstRun look="try" os={os} autoplay={play} />
    {play ? <PointerPath length={TRY_LOOP} taps={tryTaps(width, height, insets.top, insets.bottom, os)} /> : null}
  </View>;
}
export const Try: Story = { name: 'Try it once', render: args => <TryPlayed {...args} /> };
