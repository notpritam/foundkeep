import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { useArgs } from 'storybook/preview-api';
import { Handoff, HandoffPlaythrough, type HandoffAction, type HandoffLook, type HandoffPhase } from '../../../../apps/mobile/src/proposals/handoff/Handoff.tsx';

// The step after "Continue with Google" (proposal, 2026-10-02; Pritam picked
// "the cards gather" — now Current/Sign-in › After Continue with Google, kept here
// with the others it was chosen from, for the design log): four ways to
// show FoundKeep opening Google, waiting, and signing in. phase "play" runs the
// flow on a loop with a pointer; any other phase holds that state, and the
// buttons move between states as the real ones would. Side by side, with every
// state one click away: Sign in / Handoff on the design system's page.
type Args = { phase: 'play' | HandoffPhase; provider: 'google' | 'apple' };
const meta: Meta<Args> = {
  title: 'Proposals/Sign-in handoff',
  parameters: { simulator: true, layout: 'fullscreen', session: 'signed-out', route: { pathname: '/oauth/complete', params: {} }, controls: { disable: true } },
  args: { phase: 'play', provider: 'google' },
  argTypes: { phase: { options: ['play', 'choose', 'opening', 'browser', 'finishing', 'failed', 'link'] }, provider: { options: ['google', 'apple'] } },
};
export default meta;
type Story = StoryObj<Args>;

/** Where each button leads, so a held state can be clicked through. */
const NEXT: Record<HandoffAction, HandoffPhase> = { google: 'opening', apple: 'opening', reopen: 'browser', retry: 'opening', back: 'choose', connect: 'finishing' };
function Look({ look, phase, provider, update }: Args & { look: HandoffLook; update: (args: Partial<Args>) => void }) {
  if (phase === 'play') return <HandoffPlaythrough look={look} provider={provider} />;
  return <Handoff look={look} phase={phase} provider={provider} on={action => update({ phase: NEXT[action], ...(action === 'google' || action === 'apple' ? { provider: action } : {}) })} />;
}
// Storybook's useArgs belongs in the render function itself, not in a component inside it.
const render = (look: HandoffLook): Story['render'] => function Render() {
  const [{ phase, provider }, update] = useArgs<Args>();
  return <Look look={look} phase={phase} provider={provider} update={update} />;
};
export const OnScreen: Story = { name: 'The buttons become a card', render: render('screen') };
export const Sheet: Story = { name: 'A sheet over sign-in', render: render('sheet') };
export const Gather: Story = { name: 'The cards gather round the mark (picked)', render: render('gather') };
export const Quiet: Story = { name: 'A calm light page', render: render('quiet') };
