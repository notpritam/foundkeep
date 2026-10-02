import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { http, HttpResponse } from 'msw';
import SignIn from '../../../../apps/mobile/src/app/(auth)/sign-in.tsx';
import RecoveryCode from '../../../../apps/mobile/src/app/(auth)/recovery-code.tsx';
import OAuthComplete from '../../../../apps/mobile/src/app/oauth/complete.tsx';

// Sign-in is Apple or Google only (Pritam, 2026-10-01): no email, so no create-account or recover screens.
const meta: Meta = { title: 'Current/Sign-in', parameters: { simulator: true, layout: 'fullscreen', session: 'signed-out' } };
export default meta;
type Story = StoryObj;
export const SignInScreen: Story = { name: 'Sign in', render: () => <SignIn />, parameters: { route: { pathname: '/sign-in', params: {} } } };
export const ProvidersUnavailable: Story = { name: "Sign in: Apple and Google can't be reached", tags: ['expected-http-errors'], render: () => <SignIn />,
  parameters: { route: { pathname: '/sign-in', params: {} }, msw: { handlers: { story: [http.get('*/api/auth/providers', () => HttpResponse.json({ error: 'unavailable' }, { status: 503 }))] } } } };
export const SaveRecoveryCode: Story = { name: 'Save your recovery code', render: () => <RecoveryCode />, parameters: { session: 'just-registered', route: { pathname: '/recovery-code', params: {} } } };
export const AppleOrGoogleFailed: Story = { name: 'Apple or Google sign-in could not be verified', render: () => <OAuthComplete />, parameters: { route: { pathname: '/oauth/complete', params: { flow: 'sample-flow', code: 'sample-code' } } } };
