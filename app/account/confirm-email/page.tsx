import type { Metadata } from 'next';
import ConfirmEmail from '@/components/account/ConfirmEmail';

export const metadata: Metadata = {
  title: 'Confirm Email',
  description: "Confirm the email for your Lindy's Five account.",
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};

export default function ConfirmEmailPage() {
  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <ConfirmEmail />
    </div>
  );
}
