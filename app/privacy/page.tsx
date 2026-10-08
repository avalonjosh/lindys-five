import type { Metadata } from 'next';
import Link from 'next/link';
import BreadcrumbNav from '@/components/seo/BreadcrumbNav';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: "What Lindy's Five collects, why, who it's shared with, and how to delete it.",
  alternates: { canonical: 'https://www.lindysfive.com/privacy' },
};

const UPDATED = 'October 8, 2026';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-6">
      <h2 className="mb-2 text-lg font-bold text-gray-900">{title}</h2>
      <div className="flex flex-col gap-2 text-sm leading-relaxed text-gray-700">{children}</div>
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <BreadcrumbNav
        className="mx-auto max-w-3xl px-4 py-3 text-sm text-gray-500"
        items={[{ name: 'Home', href: '/' }, { name: 'Privacy Policy' }]}
      />
      <main className="mx-auto max-w-3xl px-4 pb-12">
        <div className="rounded-2xl bg-white p-5 shadow-xl sm:p-8">
          <h1 className="mb-1 text-3xl font-bold uppercase tracking-wide text-sabres-navy" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
            Privacy Policy
          </h1>
          <p className="mb-6 text-xs text-gray-500">Last updated {UPDATED}</p>

          <Section title="Who we are">
            <p>
              Lindy&apos;s Five (lindysfive.com) is an independent sports site run by JRR Apps. It is not affiliated with the NHL, MLB,
              the NFL or any team. Questions about this policy: <a href="mailto:avalonjosh@gmail.com" className="text-sabres-blue underline">avalonjosh@gmail.com</a>.
            </p>
          </Section>

          <Section title="What we collect">
            <p><span className="font-semibold">If you create an account:</span> your email address, a username, and a password (stored only as a one-way hash). If you sign in with Google, we receive your name, email address and Google account id from Google, nothing else.</p>
            <p><span className="font-semibold">What you do with your account:</span> the teams you follow, What-If picks you save, your 82-0 and 162-0 scores and daily streaks, and any streak cards you earn. Your username appears on leaderboards and on cards you share.</p>
            <p><span className="font-semibold">If you sign up for emails:</span> your email address, the teams and kinds of email you chose, and whether each email was delivered, opened or clicked (reported by our email provider).</p>
            <p><span className="font-semibold">If you leave a tip:</span> tips go through Ko-fi, which tells us your display name, the amount and any message you add. Ko-fi handles the payment, so we never see your card or PayPal details.</p>
            <p><span className="font-semibold">On this device:</span> your favorite teams, game progress and a few display preferences are kept in your browser&apos;s local storage.</p>
            <p><span className="font-semibold">Usage data:</span> we use Google Analytics to see which pages are visited and how people find the site. It uses cookies and collects things like pages viewed, device type and approximate location.</p>
          </Section>

          <Section title="How we use it">
            <p>To run your account, show your teams and picks, keep leaderboards, send the emails you asked for, and understand which parts of the site are useful. We don&apos;t sell your personal information, and we don&apos;t use it for advertising profiles.</p>
          </Section>

          <Section title="Who we share it with">
            <p>Only the services that run the site: Vercel (hosting and data storage), Resend (sending email), Google (Analytics, and Sign in with Google if you use it), Ko-fi (tips). They process data on our behalf.</p>
            <p>Some links go to partners such as Fanatics and Amazon, and we may earn a commission if you buy something. Ticket links go to StubHub. Those sites have their own privacy policies and may use their own cookies once you click through.</p>
          </Section>

          <Section title="Your choices">
            <p><span className="font-semibold">Emails:</span> every email has a link to your email preferences, where you can turn off a team, a kind of email, or everything. Signed-in users can do the same in Settings on the <Link href="/account" className="text-sabres-blue underline">account page</Link>.</p>
            <p><span className="font-semibold">Delete your account:</span> Settings on the account page has a Delete Account option. It removes your account, saved picks, leaderboard entries and cards, and can also unsubscribe you from emails.</p>
            <p><span className="font-semibold">Anything else:</span> email us and we&apos;ll help, including removing your email address from our lists entirely.</p>
          </Section>

          <Section title="Children">
            <p>The site isn&apos;t aimed at children under 13, and we don&apos;t knowingly collect their personal information.</p>
          </Section>

          <Section title="Changes">
            <p>If this policy changes, we&apos;ll update the date at the top of this page.</p>
          </Section>
        </div>
      </main>
    </div>
  );
}
