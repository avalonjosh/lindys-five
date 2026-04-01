import type { Metadata } from 'next';
import Link from 'next/link';
import FavoriteTeamsGrid from '@/components/landing/FavoriteTeamsGrid';

export const metadata: Metadata = {
  title: "MLB Playoff Odds & Standings 2026 — Projections for All 30 Teams",
  description:
    "MLB playoff odds, standings, and projections for all 30 teams in 2026. Track win pace, playoff picture, and World Series odds updated daily.",
  openGraph: {
    title: "MLB Playoff Odds & Standings 2026 — Projections for All 30 Teams",
    description:
      "MLB playoff odds, standings, and projections for all 30 teams in 2026. Track win pace, playoff picture, and World Series odds updated daily.",
    type: 'website',
    url: 'https://www.lindysfive.com/mlb',
    siteName: "Lindy's Five",
  },
  twitter: {
    card: 'summary_large_image',
    title: "MLB Playoff Odds & Standings 2026 — All 30 Teams",
    description:
      "MLB playoff odds, standings, and projections for all 30 teams. Win pace, playoff picture, and World Series odds updated daily.",
  },
  alternates: {
    canonical: 'https://www.lindysfive.com/mlb',
  },
};

export default function MLBLandingPage() {
  return (
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
            MLB Playoff Odds &amp; Standings 2026
          </h1>
          <p className="text-xl md:text-2xl text-gray-300 mb-2">
            Projections &amp; World Series Odds for All 30 Teams
          </p>
          <p className="text-sm md:text-base text-gray-400">
            Win Pace &bull; 5-Game Set Analysis &bull; Updated Daily
          </p>
        </div>

        <FavoriteTeamsGrid sport="mlb" />

        {/* Quick Links */}
        <div className="text-center mb-12">
          <div className="flex flex-wrap justify-center gap-4 text-sm">
            <Link href="/mlb/scores" className="text-gray-400 hover:text-white transition-colors">MLB Scores Today</Link>
            <span className="text-gray-600">|</span>
            <Link href="/blog" className="text-gray-400 hover:text-white transition-colors">Blog</Link>
            <span className="text-gray-600">|</span>
            <Link href="/nhl" className="text-gray-400 hover:text-white transition-colors">NHL Tracker</Link>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-12 text-gray-400 text-sm">
          <p>&copy; {new Date().getFullYear()} JRR Apps. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
}
