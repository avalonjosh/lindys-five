import type { Metadata } from 'next';
import Link from 'next/link';
import FavoriteTeamsGrid from '@/components/landing/FavoriteTeamsGrid';

export const metadata: Metadata = {
  title: "NHL Playoff Odds & Standings Tracker 2026 — All 32 Teams",
  description:
    "Track NHL playoff odds, projections, and standings for all 32 teams. 5-game set analysis, points pace, and playoff probability updated daily.",
  openGraph: {
    title: "NHL Playoff Odds & Standings Tracker 2026 — All 32 Teams",
    description:
      "Track NHL playoff odds, projections, and standings for all 32 teams. 5-game set analysis, points pace, and playoff probability updated daily.",
    type: 'website',
    url: 'https://lindysfive.com/',
    siteName: "Lindy's Five",
  },
  twitter: {
    card: 'summary_large_image',
    title: "NHL Playoff Odds & Standings Tracker 2026 — All 32 Teams",
    description:
      "Track NHL playoff odds, projections, and standings for all 32 teams. 5-game set analysis and playoff probability updated daily.",
  },
  alternates: {
    canonical: 'https://lindysfive.com/',
  },
  other: {
    'script:ld+json': JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: "Lindy's Five",
      description:
        "Track your NHL team's playoff race with 5-game set analysis",
      url: 'https://lindysfive.com',
      publisher: {
        '@type': 'Organization',
        name: 'JRR Apps',
      },
    }),
  },
};

export default function LandingPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'WebSite',
            name: "Lindy's Five",
            description:
              "Track your NHL team's playoff race with 5-game set analysis",
            url: 'https://lindysfive.com',
            publisher: {
              '@type': 'Organization',
              name: 'JRR Apps',
            },
          }),
        }}
      />

      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <div className="max-w-4xl w-full">
          {/* Header */}
          <div className="text-center mb-12">
            <p
              className="text-2xl md:text-3xl font-bold text-gray-400 mb-2"
              style={{ fontFamily: 'Bebas Neue, sans-serif' }}
            >
              Lindy&apos;s Five
            </p>
            <h1
              className="text-4xl md:text-6xl font-bold text-white mb-4"
              style={{ fontFamily: 'Bebas Neue, sans-serif' }}
            >
              NHL Playoff Tracker — All 32 Teams
            </h1>
            <p className="text-xl md:text-2xl text-gray-300 mb-2">
              Track Your Team&apos;s Road to the Playoffs
            </p>
            <p className="text-sm md:text-base text-gray-400">
              5-Game Set Analysis &bull; Target: 6+ points per set
            </p>
          </div>

          <FavoriteTeamsGrid />

          {/* NHL Playoff Odds CTA */}
          <div className="mb-12 mt-4">
            <Link
              href="/nhl-playoff-odds"
              className="block rounded-2xl p-8 shadow-2xl border-2 border-gray-600 bg-gradient-to-br from-slate-800 to-slate-700 hover:border-white/50 transition-all duration-300 hover:scale-[1.02]"
            >
              <div className="text-center">
                <h2
                  className="text-3xl md:text-4xl font-bold text-white mb-2"
                  style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                >
                  NHL Playoff Odds & Projections 2026
                </h2>
                <p className="text-gray-300 text-sm md:text-base">
                  Full standings, points pace, and playoff projections for all 32 teams →
                </p>
              </div>
            </Link>
          </div>

          {/* Quick Links */}
          <div className="text-center mb-12">
            <div className="flex flex-wrap justify-center gap-4 text-sm">
              <Link href="/scores" className="text-gray-400 hover:text-white transition-colors">
                NHL Scores Today
              </Link>
              <span className="text-gray-600">|</span>
              <Link href="/blog/sabres" className="text-gray-400 hover:text-white transition-colors">
                Sabres Blog
              </Link>
              <span className="text-gray-600">|</span>
              <Link href="/feed.xml" className="text-gray-400 hover:text-white transition-colors">
                RSS Feed
              </Link>
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

