import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import BreadcrumbNav from '@/components/seo/BreadcrumbNav';
import { KOFI_URL, supportEnabled } from '@/lib/support';

export const metadata: Metadata = {
  title: "Support Lindy's Five",
  description: "Lindy's Five is a one-person, independent sports site with no betting ads. Tips help cover the data, hosting and email that keep it running.",
  alternates: { canonical: 'https://www.lindysfive.com/support' },
};

export default function SupportPage() {
  if (!supportEnabled) notFound();
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <BreadcrumbNav
        className="mx-auto max-w-2xl px-4 py-3 text-sm text-gray-500"
        items={[{ name: 'Home', href: '/' }, { name: 'Support' }]}
      />
      <main className="mx-auto max-w-2xl px-4 pb-12">
        <div className="rounded-2xl bg-white p-5 shadow-xl sm:p-8">
          <h1 className="mb-4 text-3xl font-bold uppercase tracking-wide text-sabres-navy sm:text-4xl" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
            Support Lindy&apos;s Five
          </h1>
          <div className="flex flex-col gap-3 text-sm leading-relaxed text-gray-700 sm:text-base">
            <p>
              Lindy&apos;s Five is built and run by one person. No big company behind it, no paywall, and no betting ads.
            </p>
            <p>
              The playoff odds, scores, recaps, emails and the 82-0 and 162-0 games all cost something to run: live data, hosting,
              sending email and writing the recaps. If the site has become part of your game nights, a tip helps keep it going and
              keeps it free for everyone.
            </p>
          </div>

          <a
            href={KOFI_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-6 flex w-full items-center justify-center rounded-xl bg-sabres-blue py-3.5 text-sm font-bold uppercase tracking-wide text-white shadow-md transition-colors hover:bg-sabres-light sm:text-base"
          >
            Leave a tip
          </a>
          <p className="mt-2 text-center text-xs text-gray-500">One-time or monthly, any amount. Payment is handled by Ko-fi.</p>

          <div className="mt-8 border-t border-gray-100 pt-5">
            <h2 className="mb-2 text-lg font-bold text-gray-900">Other ways to help</h2>
            <ul className="flex list-disc flex-col gap-1.5 pl-5 text-sm text-gray-700">
              <li>Share your team&apos;s odds page or your 82-0 lineup with a friend.</li>
              <li>
                Get your team&apos;s recaps by email from your <Link href="/account" className="text-sabres-blue underline">account</Link>.
              </li>
              <li>Buying tickets or gear through the links on team pages also sends a small commission our way, at no cost to you.</li>
            </ul>
          </div>
          <p className="mt-6 text-sm text-gray-700">Thank you. Seriously.</p>
        </div>
      </main>
    </div>
  );
}
