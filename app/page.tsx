import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';

export const metadata: Metadata = {
  title: "Lindy's Five — Track Every Season, Five Games at a Time",
  description:
    "NHL and MLB playoff odds, standings, and projections. Track your team's playoff race with 5-game set analysis, updated daily.",
  openGraph: {
    title: "Lindy's Five — Track Every Season, Five Games at a Time",
    description:
      "NHL and MLB playoff odds, standings, and projections. Track your team's playoff race with 5-game set analysis.",
    type: 'website',
    url: 'https://www.lindysfive.com/',
    siteName: "Lindy's Five",
  },
  twitter: {
    card: 'summary_large_image',
    title: "Lindy's Five — NHL & MLB Playoff Tracker",
    description:
      "Track your team's playoff race with 5-game set analysis. NHL and MLB standings, projections, and odds updated daily.",
  },
  alternates: {
    canonical: 'https://www.lindysfive.com/',
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
            description: "Track every season, five games at a time. NHL and MLB playoff odds and projections.",
            url: 'https://www.lindysfive.com',
            publisher: { '@type': 'Organization', name: 'JRR Apps' },
          }),
        }}
      />

      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <div className="max-w-4xl w-full">
          {/* Header */}
          <div className="text-center mb-16">
            <p
              className="text-5xl md:text-7xl font-bold text-white mb-4"
              style={{ fontFamily: 'Bebas Neue, sans-serif' }}
            >
              Lindy&apos;s Five
            </p>
            <p className="text-lg md:text-xl text-gray-400">
              Track Every Season, Five Games at a Time
            </p>
          </div>

          {/* Sport Badges */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16 max-w-3xl mx-auto">
            {/* NHL Badge */}
            <Link
              href="/nhl"
              className="group relative rounded-2xl p-10 md:p-14 shadow-2xl border-4 transition-all duration-300 hover:scale-105"
              style={{
                background: 'linear-gradient(to bottom right, #003087, #0A1128)',
                borderColor: '#ffffff',
              }}
            >
              <div className="flex flex-col items-center text-center">
                <Image
                  src="https://assets.nhle.com/logos/nhl/svg/NHL_light.svg"
                  alt="NHL"
                  width={160}
                  height={160}
                  className="w-32 h-32 md:w-40 md:h-40 mb-6 group-hover:scale-110 transition-transform duration-300"
                />
                <h2
                  className="text-4xl md:text-5xl font-bold text-white mb-2"
                  style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                >
                  NHL
                </h2>
                <p className="text-sm md:text-base text-white/60 mb-4">
                  32 Teams &bull; Playoff Odds &bull; Stanley Cup Race
                </p>
                <p className="font-bold text-lg text-white/80">Enter →</p>
              </div>
            </Link>

            {/* MLB Badge */}
            <Link
              href="/mlb"
              className="group relative rounded-2xl p-10 md:p-14 shadow-2xl border-4 transition-all duration-300 hover:scale-105"
              style={{
                background: 'linear-gradient(to bottom right, #002D72, #041E42)',
                borderColor: '#E4002C',
              }}
            >
              <div className="flex flex-col items-center text-center">
                <Image
                  src="https://www.mlbstatic.com/team-logos/league-on-dark/1.svg"
                  alt="MLB"
                  width={160}
                  height={160}
                  className="w-32 h-32 md:w-40 md:h-40 mb-6 group-hover:scale-110 transition-transform duration-300"
                />
                <h2
                  className="text-4xl md:text-5xl font-bold text-white mb-2"
                  style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                >
                  MLB
                </h2>
                <p className="text-sm md:text-base text-white/60 mb-4">
                  30 Teams &bull; Playoff Odds &bull; World Series Race
                </p>
                <p className="font-bold text-lg text-white/80">Enter →</p>
              </div>
            </Link>
          </div>

          {/* Footer */}
          <div className="text-center text-gray-500 text-sm">
            <div className="flex flex-wrap justify-center gap-4 mb-4">
              <Link href="/scores" className="text-gray-400 hover:text-white transition-colors">NHL Scores</Link>
              <span className="text-gray-600">|</span>
              <Link href="/mlb/scores" className="text-gray-400 hover:text-white transition-colors">MLB Scores</Link>
              <span className="text-gray-600">|</span>
              <Link href="/blog" className="text-gray-400 hover:text-white transition-colors">Blog</Link>
              <span className="text-gray-600">|</span>
              <Link href="/feed.xml" className="text-gray-400 hover:text-white transition-colors">RSS</Link>
            </div>
            <p>&copy; {new Date().getFullYear()} JRR Apps. All rights reserved.</p>
          </div>
        </div>
      </div>
    </>
  );
}
