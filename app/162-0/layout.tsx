import type { Metadata } from 'next';
import { dailyDateLabel, easternDateString } from '@/lib/perfectseason/seed';

// Dynamic so the social unfurl carries today's daily date (spec Section 10).
export function generateMetadata(): Metadata {
  const title = 'Can you go 162-0?';
  const subtitle = `${dailyDateLabel(easternDateString())} · Draft an all-time MLB roster`;
  const og = `/api/og?type=sport-hub&sport=mlb&title=${encodeURIComponent(title)}&subtitle=${encodeURIComponent(subtitle)}`;
  return {
    title: '162-0 — The Perfect Season (MLB)',
    description:
      'Draft an all-time MLB roster from decade and franchise spins, then see if your team can go 162-0. A daily roster puzzle from Lindys Five.',
    alternates: { canonical: 'https://www.lindysfive.com/162-0' },
    openGraph: {
      title,
      description: subtitle,
      url: 'https://www.lindysfive.com/162-0',
      siteName: "Lindy's Five",
      images: [og],
    },
    twitter: { card: 'summary_large_image', title, description: subtitle, images: [og] },
  };
}

export default function PerfectSeasonLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <footer className="bg-slate-50 px-4 py-6 text-center">
        <p className="mx-auto max-w-[480px] text-[11px] leading-relaxed text-gray-400">
          An independent fan game by Lindys Five. Not affiliated with or endorsed by Major League Baseball or the
          MLBPA. MLB and the MLB shield are trademarks of their respective owners. MLB data: Lahman Baseball
          Database (CC BY-SA), sabr.org.
        </p>
      </footer>
    </>
  );
}
