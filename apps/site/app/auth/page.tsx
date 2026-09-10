import type {Metadata} from 'next';
import {AuthPage, type AuthSearchParams} from '@/components/auth-page';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {title: 'Your account', robots: {index: false, follow: false}};
export default function ProviderAuthPage({searchParams}: {searchParams: AuthSearchParams}) {
  return <AuthPage searchParams={searchParams} legacyMode/>;
}
