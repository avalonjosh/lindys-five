import type { Metadata } from 'next';
import { dayNumber, easternDateString } from '@/lib/perfectseason/seed';

// Dynamic so the social unfurl carries today's day number (spec Section 10).
export function generateMetadata(): Metadata {
  const n = dayNumber(easternDateString());
  const title = 'Can you go 82-0?';
  const subtitle = `Daily #${n} · Draft an all-time NHL roster`;
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
        <p className="mx-auto max-w-[480px] text-[11px] leading-relaxed text-gray-400">
          An independent fan game by Lindys Five. Not affiliated with or endorsed by the National Hockey League or the
          NHLPA. NHL and the NHL Shield are trademarks of their respective owners. NHL data: the NHL stats API.
        </p>
      </footer>
    </>
  );
}
