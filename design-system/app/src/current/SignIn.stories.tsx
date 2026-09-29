import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import SignIn from '../../../../apps/mobile/src/app/(auth)/sign-in.tsx';
import Register from '../../../../apps/mobile/src/app/(auth)/register.tsx';
import RecoveryCode from '../../../../apps/mobile/src/app/(auth)/recovery-code.tsx';
import Recover from '../../../../apps/mobile/src/app/(auth)/recover.tsx';
import OAuthComplete from '../../../../apps/mobile/src/app/oauth/complete.tsx';

const meta: Meta = { title: 'Current/Sign-in', parameters: { simulator: true, layout: 'fullscreen', session: 'signed-out' } };
export default meta;
type Story = StoryObj;
export const SignInScreen: Story = { name: 'Sign in', render: () => <SignIn />, parameters: { route: { pathname: '/sign-in', params: {} } } };
export const CreateAccount: Story = { name: 'Create an account', render: () => <Register />, parameters: { route: { pathname: '/register', params: {} } } };
export const SaveRecoveryCode: Story = { name: 'Save your recovery code', render: () => <RecoveryCode />, parameters: { session: 'just-registered', route: { pathname: '/recovery-code', params: {} } } };
export const RecoverAccount: Story = { name: 'Recover an account', render: () => <Recover />, parameters: { route: { pathname: '/recover', params: {} } } };
export const AppleOrGoogleFailed: Story = { name: 'Apple or Google sign-in could not be verified', render: () => <OAuthComplete />, parameters: { route: { pathname: '/oauth/complete', params: { flow: 'sample-flow', code: 'sample-code' } } } };
