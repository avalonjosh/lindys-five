import type { Metadata } from 'next';
import Link from 'next/link';
import { dailyDateLabel, easternDateString } from '@/lib/perfectseason/seed';

// Dynamic so the social unfurl carries today's daily date (spec Section 10).
export function generateMetadata(): Metadata {
  const title = 'Can you go 82-0?';
  const subtitle = `${dailyDateLabel(easternDateString())} · Draft an all-time NHL roster`;
  const og = `/api/og?type=sport-hub&sport=nhl&title=${encodeURIComponent(title)}&subtitle=${encodeURIComponent(subtitle)}`;
  return {
    title: '82-0 — The Perfect Season (NHL)',
    description:
      'Draft an all-time NHL roster from decade and franchise spins, then see if your team can go 82-0. A daily roster puzzle from Lindys Five.',
    alternates: { canonical: 'https://www.lindysfive.com/82-0' },
    openGraph: {
      title,
      description: subtitle,
      url: 'https://www.lindysfive.com/82-0',
      siteName: "Lindy's Five",
      images: [og],
    },
    twitter: { card: 'summary_large_image', title, description: subtitle, images: [og] },
  };
}

export default function PerfectSeasonNhlLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <footer className="bg-slate-50 px-4 py-6 text-center">
        <nav className="mx-auto mb-4 flex max-w-[480px] flex-wrap items-center justify-center gap-x-4 gap-y-2 text-sm font-semibold">
          <Link href="/nhl-playoff-odds" className="text-sabres-blue hover:underline">NHL Playoff Odds</Link>
          <Link href="/nhl/scores" className="text-sabres-blue hover:underline">Scores</Link>
          <Link href="/blog" className="text-sabres-blue hover:underline">Blog</Link>
          <Link href="/" className="text-sabres-blue hover:underline">Home</Link>
        </nav>
        <p className="mx-auto max-w-[480px] text-[11px] leading-relaxed text-gray-400">
          An independent fan game by Lindys Five. Not affiliated with or endorsed by the National Hockey League or the
          NHLPA. NHL and the NHL Shield are trademarks of their respective owners. NHL data: the NHL stats API.
        </p>
      </footer>
    </>
  );
}
