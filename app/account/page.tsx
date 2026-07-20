import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import AccountPage from '@/components/account/AccountPage';

export const metadata: Metadata = {
  title: 'My Account',
  description: 'Your saved What-If picks and prediction history.',
  robots: { index: false, follow: false },
};

export default function Account() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="mx-auto max-w-3xl px-4 pt-6">
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-500 transition-colors hover:text-gray-700">
          <ArrowLeft className="h-4 w-4" /> Lindy&apos;s Five
        </Link>
      </div>
      <AccountPage />
    </div>
  );
}
