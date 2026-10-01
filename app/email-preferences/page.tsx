import type { Metadata } from 'next';
import Link from 'next/link';
import EmailPreferencesPage from '@/components/newsletter/EmailPreferencesPage';

export const metadata: Metadata = {
  title: 'Email Preferences',
  description: "Choose which Lindy's Five emails you get, or unsubscribe.",
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};

export default function EmailPreferencesRoute() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <main className="mx-auto max-w-[520px] px-4 py-10 sm:py-16">
        <Link href="/" className="mb-6 block text-center text-3xl font-bold tracking-wider text-sabres-navy" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
          Lindy&apos;s Five
        </Link>
        <div className="rounded-2xl bg-white p-5 shadow-xl">
          <h1 className="mb-3 text-2xl font-bold uppercase tracking-wide text-sabres-navy" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
            Email Preferences
          </h1>
          <EmailPreferencesPage />
        </div>
      </main>
    </div>
  );
}
