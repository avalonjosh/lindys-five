import type { Metadata } from 'next';
import Link from 'next/link';
import FavoriteTeamsGrid from '@/components/landing/FavoriteTeamsGrid';
import GameTicker from '@/components/landing/GameTicker';

export const metadata: Metadata = {
  title: "NHL Playoff Odds & Standings 2025-26 — Projections for All 32 Teams",
  description:
    "NHL playoff odds, standings, and playoff picture for all 32 teams in 2025-26. Track playoff probability, Stanley Cup odds, points pace, and wild card race updated daily.",
  openGraph: {
    title: "NHL Playoff Odds & Standings 2025-26 — Projections for All 32 Teams",
    description:
      "NHL playoff odds, standings, and playoff picture for all 32 teams in 2025-26. Track playoff probability, Stanley Cup odds, and wild card race updated daily.",
    type: 'website',
    url: 'https://www.lindysfive.com/nhl',
    siteName: "Lindy's Five",
  },
  twitter: {
    card: 'summary_large_image',
    title: "NHL Playoff Odds & Standings 2025-26 — All 32 Teams",
    description:
      "NHL playoff odds, standings, and projections for all 32 teams. Playoff picture, Stanley Cup odds, and wild card race updated daily.",
  },
  alternates: {
    canonical: 'https://www.lindysfive.com/nhl',
  },
};

export default function NHLLandingPage() {
  return (
    <>
      <GameTicker />
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <div className="max-w-4xl w-full">
          {/* Header */}
          <div className="text-center mb-12">
            <Link href="/" className="text-2xl md:text-3xl font-bold text-gray-400 mb-2 block hover:text-gray-300 transition-colors" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
              Lindy&apos;s Five
            </Link>
            <h1
              className="text-4xl md:text-6xl font-bold text-white mb-4"
              style={{ fontFamily: 'Bebas Neue, sans-serif' }}
            >
              NHL Playoff Odds &amp; Standings 2025-26
            </h1>
            <p className="text-xl md:text-2xl text-gray-300 mb-2">
              Playoff Picture, Projections &amp; Stanley Cup Odds for All 32 Teams
            </p>
            <p className="text-sm md:text-base text-gray-400">
              Points Pace &bull; Wild Card Race &bull; Updated Daily
            </p>
          </div>

          <FavoriteTeamsGrid sport="nhl" />

          {/* Quick Links */}
          <div className="text-center mb-12">
            <div className="flex flex-wrap justify-center gap-4 text-sm">
              <Link href="/playoffs" className="text-gray-400 hover:text-white transition-colors">Playoff Bracket</Link>
              <span className="text-gray-600">|</span>
              <Link href="/nhl/scores" className="text-gray-400 hover:text-white transition-colors">NHL Scores Today</Link>
              <span className="text-gray-600">|</span>
              <Link href="/blog/sabres" className="text-gray-400 hover:text-white transition-colors">Sabres Blog</Link>
              <span className="text-gray-600">|</span>
              <Link href="/feed.xml" className="text-gray-400 hover:text-white transition-colors">RSS Feed</Link>
            </div>
          </div>

          {/* Footer */}
          <div className="text-center mt-12 text-gray-400 text-sm">
            <p>&copy; {new Date().getFullYear()} JRR Apps. All rights reserved.</p>
          </div>
        </div>
      </div>
    </>
  );
}
