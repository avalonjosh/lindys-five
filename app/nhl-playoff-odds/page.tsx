import type { Metadata } from 'next';
import Link from 'next/link';
import { TEAMS } from '@/lib/teamConfig';
import type { StandingsTeam } from '@/lib/types/boxscore';
import { getProjectedPoints, getPlayoffProbability, isInPlayoffPosition } from '@/lib/utils/standingsCalc';
import PlayoffOddsClient, { type TeamData } from '@/components/PlayoffOddsClient';
import NewsletterModal from '@/components/newsletter/NewsletterModal';

export const revalidate = 300; // ISR: revalidate every 5 minutes

export const metadata: Metadata = {
  title: 'NHL Playoff Odds 2025-26 — Standings, Projections & Playoff Picture',
  description:
    'NHL playoff odds, standings, and projections for all 32 teams in 2025-26. Track playoff picture, Stanley Cup odds, wild card race, and playoff probability updated daily.',
  openGraph: {
    title: 'NHL Playoff Odds 2025-26 — Standings, Projections & Playoff Picture',
    description:
      'NHL playoff odds, standings, and playoff picture for all 32 teams. Stanley Cup projections and wild card race updated daily.',
    type: 'website',
    url: 'https://lindysfive.com/nhl-playoff-odds',
    siteName: "Lindy's Five",
  },
  twitter: {
    card: 'summary_large_image',
    title: 'NHL Playoff Odds 2025-26 — Standings & Playoff Picture',
    description:
      'NHL playoff odds, standings, and projections for all 32 teams. Playoff picture and Stanley Cup odds updated daily.',
  },
  alternates: {
    canonical: 'https://lindysfive.com/nhl-playoff-odds',
  },
};

// Reverse lookup: NHL abbreviation -> our slug
const abbrevToSlug = Object.fromEntries(
  Object.entries(TEAMS).map(([slug, team]) => [team.abbreviation, slug])
);

async function fetchStandings(): Promise<StandingsTeam[] | null> {
  const today = new Date().toLocaleDateString('en-CA', {
    timeZone: 'America/New_York',
  });
  const res = await fetch(
    `https://api-web.nhle.com/v1/standings/${today}`,
    { next: { revalidate: 300 } }
  );
  if (!res.ok) return null;
  const data = await res.json();
  return data.standings || [];
}

function buildTeamData(standings: StandingsTeam[]): TeamData[] {
  return standings.map(team => ({
    abbrev: team.teamAbbrev.default,
    name: team.teamName.default,
    logo: team.teamLogo,
    slug: abbrevToSlug[team.teamAbbrev.default] || '',
    gamesPlayed: team.gamesPlayed,
    wins: team.wins,
    losses: team.losses,
    otLosses: team.otLosses,
    points: team.points,
    pointPctg: team.pointPctg,
    pace: getProjectedPoints(team.points, team.gamesPlayed),
    odds: getPlayoffProbability(team, standings),
    streakCode: team.streakCode,
    streakCount: team.streakCount,
    divisionName: team.divisionName,
    conferenceName: team.conferenceName,
    divisionSequence: team.divisionSequence,
    conferenceSequence: team.conferenceSequence,
    isInPlayoffs: isInPlayoffPosition(team),
  }));
}

export default async function NHLPlayoffOddsPage() {
  const standings = await fetchStandings();

  if (!standings || standings.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <div className="text-center text-white">
          <h1
            className="text-4xl font-bold mb-4"
            style={{ fontFamily: 'Bebas Neue, sans-serif' }}
          >
            Standings Unavailable
          </h1>
          <p className="text-gray-400 mb-8">
            Unable to load NHL standings. Please try again later.
          </p>
          <Link href="/" className="text-blue-400 hover:text-blue-300 underline">
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  const teams = buildTeamData(standings);

  return (
    <>
      <NewsletterModal />

      {/* JSON-LD Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify([
            {
              '@context': 'https://schema.org',
              '@type': 'WebPage',
              name: 'NHL Playoff Odds 2025-26',
              description:
                'NHL playoff odds, standings, and playoff picture for all 32 teams in 2025-26. Stanley Cup projections and wild card race updated daily.',
              url: 'https://lindysfive.com/nhl-playoff-odds',
              publisher: {
                '@type': 'Organization',
                name: 'JRR Apps',
              },
            },
            {
              '@context': 'https://schema.org',
              '@type': 'BreadcrumbList',
              itemListElement: [
                {
                  '@type': 'ListItem',
                  position: 1,
                  name: 'Home',
                  item: 'https://lindysfive.com/',
                },
                {
                  '@type': 'ListItem',
                  position: 2,
                  name: 'NHL Playoff Odds',
                  item: 'https://lindysfive.com/nhl-playoff-odds',
                },
              ],
            },
          ]),
        }}
      />

      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
        {/* Header */}
        <header
          className="shadow-xl border-b-4"
          style={{
            background: '#003087',
            borderBottomColor: '#0A1128',
          }}
        >
          <div className="max-w-7xl mx-auto px-4 py-8 md:py-12 text-center">
            <Link href="/" className="inline-block mb-2">
              <p
                className="text-xl md:text-2xl font-bold text-white/70 hover:text-white transition-colors"
                style={{ fontFamily: 'Bebas Neue, sans-serif' }}
              >
                Lindy&apos;s Five
              </p>
            </Link>
            <h1
              className="text-3xl md:text-5xl lg:text-6xl font-bold text-white mb-3"
              style={{ fontFamily: 'Bebas Neue, sans-serif' }}
            >
              NHL Playoff Odds &amp; Standings 2025-26
            </h1>
            <p className="text-base md:text-lg text-white/80 max-w-2xl mx-auto">
              NHL playoff picture, Stanley Cup projections, and wild card race for
              all 32 teams. Updated daily.
            </p>
          </div>
        </header>

        {/* Breadcrumb */}
        <nav className="max-w-7xl mx-auto px-4 py-3 text-sm text-gray-500">
          <Link href="/" className="hover:text-gray-700 transition-colors">
            Home
          </Link>
          <span className="mx-2">/</span>
          <span className="text-gray-600">NHL Playoff Odds</span>
        </nav>

        {/* Main Content */}
        <main className="max-w-7xl mx-auto px-4 pb-16">
          <PlayoffOddsClient teams={teams} />

          {/* Narrative Section */}
          <section className="mt-12 max-w-3xl mx-auto">
            <h2
              className="text-2xl md:text-3xl font-bold text-gray-900 mb-6"
              style={{ fontFamily: 'Bebas Neue, sans-serif' }}
            >
              2025-26 NHL Playoff Race
            </h2>
            <div className="space-y-4 text-gray-600 leading-relaxed">
              <p>
                The 2025-26 NHL playoff race is heating up as teams jockey for
                position in what has been one of the most competitive seasons in
                recent memory. With 16 of 32 teams earning a postseason berth,
                every point matters down the stretch. The top three teams in each
                division clinch a playoff spot, while the remaining four spots
                are decided by wildcard positioning within each conference.
              </p>
              <p>
                Points pace is one of the most telling indicators of a
                team&apos;s playoff trajectory. Teams on pace for 100 or more
                points are typically in strong playoff position, while those
                hovering around 90 points are firmly in the bubble. Goal
                differential also serves as a key predictor -- teams with a
                positive goal differential tend to sustain their success, while
                those relying on close games may see regression.
              </p>
              <p>
                Follow along all season with{' '}
                <Link
                  href="/"
                  className="text-blue-600 hover:text-blue-500 underline"
                >
                  Lindy&apos;s Five
                </Link>{' '}
                for detailed 5-game set analysis, points pace tracking, and
                playoff projections for every NHL team. Select your team from the
                standings above or from our{' '}
                <Link
                  href="/"
                  className="text-blue-600 hover:text-blue-500 underline"
                >
                  home page
                </Link>{' '}
                to dive deeper.
              </p>
            </div>
          </section>

          {/* Back to Home */}
          <div className="mt-12 text-center">
            <Link
              href="/"
              className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg transition-colors font-medium"
            >
              <span>&larr;</span>
              <span>Back to All Teams</span>
            </Link>
          </div>
        </main>

        {/* Footer */}
        <footer className="mt-auto py-6 text-center text-sm text-gray-500">
          <p>Lindy&apos;s Five &bull; {new Date().getFullYear()}</p>
          <p className="mt-1">
            Data sourced from the NHL. Updated every 5 minutes.
          </p>
        </footer>
      </div>
    </>
  );
}
