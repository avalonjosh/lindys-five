import type { Metadata } from 'next';
import ResetPasswordForm from '@/components/account/ResetPasswordForm';

export const metadata: Metadata = {
  title: 'Reset Password',
  description: "Choose a new password for your Lindy's Five account.",
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};

export default function ResetPassword() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <ResetPasswordForm />
    </div>
  );
}
