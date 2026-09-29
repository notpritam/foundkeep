import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { AuthForm } from '../../../../apps/site/components/auth-form';
import { AuthShell } from '../../../../apps/site/components/auth-shell';
import { OAuthCompletion } from '../../../../apps/site/components/auth-oauth-completion';

const meta: Meta = { title: 'Current/Sign-in', parameters: { simulator: true, layout: 'fullscreen' } };
export default meta;
type Story = StoryObj;
const page = (mode: 'login' | 'signup' | 'recover', path: string): Story => ({ render: () => <AuthShell headingId="auth-title"><AuthForm mode={mode} /></AuthShell>, parameters: { url: 'foundkeep.app' + path, nextjs: { navigation: { pathname: path } } } });
export const LogIn: Story = { name: 'Log in', ...page('login', '/login') };
export const SignUp: Story = { name: 'Sign up', ...page('signup', '/signup') };
export const Recover: Story = { name: 'Recover an account', ...page('recover', '/recover') };
export const OAuthReturn: Story = { name: 'Returning from Apple or Google', render: () => <AuthShell headingId="oauth-title"><OAuthCompletion /></AuthShell>, parameters: { url: 'foundkeep.app/auth', nextjs: { navigation: { pathname: '/auth', query: { flow: 'sample', code: 'sample' } } } } };
