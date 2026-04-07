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
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: 'NHL Playoff Odds & Standings 2025-26 — Projections for All 32 Teams',
    description: 'NHL playoff odds, standings, and playoff picture for all 32 teams in 2025-26. Track playoff probability, Stanley Cup odds, points pace, and wild card race updated daily.',
    url: 'https://www.lindysfive.com/nhl',
    publisher: {
      '@type': 'Organization',
      name: "Lindy's Five",
    },
    about: {
      '@type': 'SportsOrganization',
      name: 'National Hockey League',
      sport: 'Ice Hockey',
    },
  };

  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Home',
        item: 'https://www.lindysfive.com',
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'NHL',
        item: 'https://www.lindysfive.com/nhl',
      },
    ],
  };

  const faqLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: 'Which NHL teams will make the playoffs in 2026?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Track live playoff odds for all 32 NHL teams on this page. Playoff probability, points pace, wild card standings, and Stanley Cup projections are updated daily based on current standings.',
        },
      },
      {
        '@type': 'Question',
        name: 'How are NHL playoff odds calculated?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: "NHL playoff odds are calculated using each team's current points pace projected over 82 games, combined with division and wild card positioning. Probabilities update daily as standings change.",
        },
      },
      {
        '@type': 'Question',
        name: 'What is the NHL wild card race?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'The NHL wild card race determines the final four playoff spots — two per conference — for teams that do not finish in the top three of their division. Wild card teams are ranked by total points regardless of division.',
        },
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }}
      />
      <div className="sr-only" aria-hidden="false">
        <h1>NHL Playoff Odds &amp; Standings 2025-26 — All 32 Teams</h1>
        <p>
          NHL playoff odds, standings, and playoff picture for all 32 teams in the 2025-26 season.
          Track playoff probability, Stanley Cup odds, points pace, and the wild card race — updated daily.
        </p>
        <h2>All 32 NHL Teams — 2025-26 Playoff Odds</h2>
        <ul>
          <li><a href="/nhl/sabres">Buffalo Sabres Playoff Odds</a></li>
          <li><a href="/nhl/bruins">Boston Bruins Playoff Odds</a></li>
          <li><a href="/nhl/canadiens">Montreal Canadiens Playoff Odds</a></li>
          <li><a href="/nhl/redwings">Detroit Red Wings Playoff Odds</a></li>
          <li><a href="/nhl/senators">Ottawa Senators Playoff Odds</a></li>
          <li><a href="/nhl/panthers">Florida Panthers Playoff Odds</a></li>
          <li><a href="/nhl/mapleleafs">Toronto Maple Leafs Playoff Odds</a></li>
          <li><a href="/nhl/lightning">Tampa Bay Lightning Playoff Odds</a></li>
          <li><a href="/nhl/devils">New Jersey Devils Playoff Odds</a></li>
          <li><a href="/nhl/penguins">Pittsburgh Penguins Playoff Odds</a></li>
          <li><a href="/nhl/hurricanes">Carolina Hurricanes Playoff Odds</a></li>
          <li><a href="/nhl/capitals">Washington Capitals Playoff Odds</a></li>
          <li><a href="/nhl/islanders">New York Islanders Playoff Odds</a></li>
          <li><a href="/nhl/flyers">Philadelphia Flyers Playoff Odds</a></li>
          <li><a href="/nhl/bluejackets">Columbus Blue Jackets Playoff Odds</a></li>
          <li><a href="/nhl/rangers">New York Rangers Playoff Odds</a></li>
          <li><a href="/nhl/utah">Utah Mammoth Playoff Odds</a></li>
          <li><a href="/nhl/avalanche">Colorado Avalanche Playoff Odds</a></li>
          <li><a href="/nhl/jets">Winnipeg Jets Playoff Odds</a></li>
          <li><a href="/nhl/stars">Dallas Stars Playoff Odds</a></li>
          <li><a href="/nhl/blackhawks">Chicago Blackhawks Playoff Odds</a></li>
          <li><a href="/nhl/predators">Nashville Predators Playoff Odds</a></li>
          <li><a href="/nhl/wild">Minnesota Wild Playoff Odds</a></li>
          <li><a href="/nhl/blues">St. Louis Blues Playoff Odds</a></li>
          <li><a href="/nhl/goldenknights">Vegas Golden Knights Playoff Odds</a></li>
          <li><a href="/nhl/oilers">Edmonton Oilers Playoff Odds</a></li>
          <li><a href="/nhl/canucks">Vancouver Canucks Playoff Odds</a></li>
          <li><a href="/nhl/flames">Calgary Flames Playoff Odds</a></li>
          <li><a href="/nhl/kings">Los Angeles Kings Playoff Odds</a></li>
          <li><a href="/nhl/ducks">Anaheim Ducks Playoff Odds</a></li>
          <li><a href="/nhl/sharks">San Jose Sharks Playoff Odds</a></li>
          <li><a href="/nhl/kraken">Seattle Kraken Playoff Odds</a></li>
        </ul>
      </div>
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
