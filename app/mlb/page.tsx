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
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: 'MLB Playoff Odds & Standings 2026 — Projections for All 30 Teams',
    description: 'MLB playoff odds, standings, and projections for all 30 teams in 2026. Track win pace, playoff picture, and World Series odds updated daily.',
    url: 'https://www.lindysfive.com/mlb',
    publisher: {
      '@type': 'Organization',
      name: "Lindy's Five",
    },
    about: {
      '@type': 'SportsOrganization',
      name: 'Major League Baseball',
      sport: 'Baseball',
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
        name: 'MLB',
        item: 'https://www.lindysfive.com/mlb',
      },
    ],
  };

  const faqLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: 'Which MLB teams will make the playoffs in 2026?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Track live playoff odds for all 30 MLB teams on this page. Playoff probability, win pace, division standings, and World Series projections are updated daily.',
        },
      },
      {
        '@type': 'Question',
        name: 'How are MLB playoff odds calculated?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: "MLB playoff odds are calculated using each team's current win pace projected over 162 games, combined with division standings and wild card positioning. Probabilities update daily as the season progresses.",
        },
      },
      {
        '@type': 'Question',
        name: 'How does the MLB playoff format work?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'The MLB playoffs feature 12 teams — six per league. The three division winners and three wild card teams qualify. The top two seeds earn a first-round bye, while the remaining four teams play in the Wild Card Series.',
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
        <h1>MLB Playoff Odds &amp; Standings 2026 — All 30 Teams</h1>
        <p>
          MLB playoff odds, standings, and projections for all 30 teams in the 2026 season.
          Track win pace, playoff picture, World Series odds, and the wild card race — updated daily.
        </p>
        <h2>All 30 MLB Teams — 2026 Playoff Odds</h2>
        <ul>
          <li><a href="/mlb/diamondbacks">Arizona Diamondbacks Playoff Odds</a></li>
          <li><a href="/mlb/braves">Atlanta Braves Playoff Odds</a></li>
          <li><a href="/mlb/orioles">Baltimore Orioles Playoff Odds</a></li>
          <li><a href="/mlb/redsox">Boston Red Sox Playoff Odds</a></li>
          <li><a href="/mlb/cubs">Chicago Cubs Playoff Odds</a></li>
          <li><a href="/mlb/whitesox">Chicago White Sox Playoff Odds</a></li>
          <li><a href="/mlb/reds">Cincinnati Reds Playoff Odds</a></li>
          <li><a href="/mlb/guardians">Cleveland Guardians Playoff Odds</a></li>
          <li><a href="/mlb/rockies">Colorado Rockies Playoff Odds</a></li>
          <li><a href="/mlb/tigers">Detroit Tigers Playoff Odds</a></li>
          <li><a href="/mlb/astros">Houston Astros Playoff Odds</a></li>
          <li><a href="/mlb/royals">Kansas City Royals Playoff Odds</a></li>
          <li><a href="/mlb/angels">Los Angeles Angels Playoff Odds</a></li>
          <li><a href="/mlb/dodgers">Los Angeles Dodgers Playoff Odds</a></li>
          <li><a href="/mlb/marlins">Miami Marlins Playoff Odds</a></li>
          <li><a href="/mlb/brewers">Milwaukee Brewers Playoff Odds</a></li>
          <li><a href="/mlb/twins">Minnesota Twins Playoff Odds</a></li>
          <li><a href="/mlb/mets">New York Mets Playoff Odds</a></li>
          <li><a href="/mlb/yankees">New York Yankees Playoff Odds</a></li>
          <li><a href="/mlb/athletics">Oakland Athletics Playoff Odds</a></li>
          <li><a href="/mlb/phillies">Philadelphia Phillies Playoff Odds</a></li>
          <li><a href="/mlb/pirates">Pittsburgh Pirates Playoff Odds</a></li>
          <li><a href="/mlb/padres">San Diego Padres Playoff Odds</a></li>
          <li><a href="/mlb/giants">San Francisco Giants Playoff Odds</a></li>
          <li><a href="/mlb/mariners">Seattle Mariners Playoff Odds</a></li>
          <li><a href="/mlb/cardinals">St. Louis Cardinals Playoff Odds</a></li>
          <li><a href="/mlb/rays">Tampa Bay Rays Playoff Odds</a></li>
          <li><a href="/mlb/txrangers">Texas Rangers Playoff Odds</a></li>
          <li><a href="/mlb/bluejays">Toronto Blue Jays Playoff Odds</a></li>
          <li><a href="/mlb/nationals">Washington Nationals Playoff Odds</a></li>
        </ul>
      </div>
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
    </>
  );
}
