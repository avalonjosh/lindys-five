import type { Metadata } from 'next';
import AccountPage from '@/components/account/AccountPage';
import SiteHeader from '@/components/SiteHeader';
import SiteFooter from '@/components/SiteFooter';

export const metadata: Metadata = {
  title: 'My Account',
  description: 'Your saved picks and prediction history.',
  robots: { index: false, follow: false },
};

export default function Account() {
  return (
    <div className="flex min-h-screen flex-col bg-slate-900 text-white">
      <SiteHeader />
      <AccountPage />
      <SiteFooter />
    </div>
  );
}
