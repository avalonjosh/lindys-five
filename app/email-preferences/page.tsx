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
    <div className="min-h-screen bg-slate-900 text-white">
      <main className="mx-auto max-w-[560px] px-4 py-10 sm:py-16">
        <Link href="/" className="mb-6 block text-center text-4xl leading-none" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
          Lindy&apos;s Five
        </Link>
        <div className="rounded-2xl border border-slate-700 bg-slate-800/60 p-5">
          <h1 className="mb-3 text-3xl leading-none" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
            Email Preferences
          </h1>
          <EmailPreferencesPage />
        </div>
      </main>
    </div>
  );
}
