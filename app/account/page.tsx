import type { Metadata } from 'next';
import AccountPage from '@/components/account/AccountPage';

export const metadata: Metadata = {
  title: 'My Account',
  description: 'Your saved What-If picks and prediction history.',
  robots: { index: false, follow: false },
};

export default function Account() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <AccountPage />
    </div>
  );
}
