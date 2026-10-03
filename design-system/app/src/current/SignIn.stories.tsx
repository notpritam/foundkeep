import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { http, HttpResponse } from 'msw';
import { useArgs } from 'storybook/preview-api';
import SignIn from '../../../../apps/mobile/src/app/(auth)/sign-in.tsx';
import RecoveryCode from '../../../../apps/mobile/src/app/(auth)/recovery-code.tsx';
import OAuthComplete from '../../../../apps/mobile/src/app/oauth/complete.tsx';
import { HandoffView, type HandoffAction } from '../../../../apps/mobile/src/sign-in/Handoff.tsx';
import type { HandoffPhase } from '../../../../apps/mobile/src/sign-in/handoffWords.ts';
import { Playthrough } from '../Playthrough.tsx';

// Sign-in is Apple or Google only (Pritam, 2026-10-01): no email, so no create-account or recover screens.
const meta: Meta = { title: 'Final/1 Sign in', parameters: { simulator: true, layout: 'fullscreen', session: 'signed-out' } };
export default meta;
type Story = StoryObj;
export const SignInScreen: Story = { name: 'Sign in', render: () => <SignIn />, parameters: { route: { pathname: '/sign-in', params: {} } } };
export const ProvidersUnavailable: Story = { name: "Sign in: Apple and Google can't be reached", tags: ['expected-http-errors'], render: () => <SignIn />,
  parameters: { route: { pathname: '/sign-in', params: {} }, msw: { handlers: { story: [http.get('*/api/auth/providers', () => HttpResponse.json({ error: 'unavailable' }, { status: 503 }))] } } } };
export const SaveRecoveryCode: Story = { name: 'Save your recovery code', render: () => <RecoveryCode />, parameters: { session: 'just-registered', route: { pathname: '/recovery-code', params: {} } } };

// After Continue with Google (picked 2026-10-02 from Proposals/Sign-in handoff: the cards gather).
// phase "play" loops the flow with a pointer; any other holds that state, and its buttons move on as the real ones would.
type HandoffArgs = { phase: 'play' | HandoffPhase; provider: 'google' | 'apple' };
const PLAY: [HandoffPhase, number][] = [['choose', 2400], ['opening', 1600], ['browser', 2800], ['finishing', 2400]];
const NEXT: Record<HandoffAction, HandoffPhase> = { google: 'opening', apple: 'opening', reopen: 'browser', retry: 'opening', back: 'choose', connect: 'finishing' };
export const Handoff: StoryObj<HandoffArgs> = {
  name: 'After Continue with Google',
  args: { phase: 'play', provider: 'google' },
  argTypes: { phase: { options: ['play', 'choose', 'opening', 'browser', 'finishing', 'failed', 'link'] }, provider: { options: ['google', 'apple'] } },
  parameters: { controls: { disable: true }, route: { pathname: '/oauth/complete', params: {} } },
  render: function Render() {
    const [{ phase, provider }, update] = useArgs<HandoffArgs>();
    if (phase === 'play') return <Playthrough steps={PLAY} tap={provider} render={step => <HandoffView phase={step} provider={provider} on={() => {}} />} />;
    return <HandoffView phase={phase} provider={provider} on={action => update({ phase: NEXT[action], ...(action === 'google' || action === 'apple' ? { provider: action } : {}) })} />;
  },
};
export const AppleOrGoogleFailed: Story = { name: 'Apple or Google sign-in could not be verified', render: () => <OAuthComplete />, parameters: { route: { pathname: '/oauth/complete', params: { flow: 'sample-flow', code: 'sample-code' } } } };
