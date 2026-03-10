import type { Metadata } from 'next';
import Link from 'next/link';
import { TEAMS } from '@/lib/teamConfig';
import { computePositionAwareProbability } from '@/lib/utils/playoffProbability';
import PlayoffOddsClient, { type TeamData } from '@/components/PlayoffOddsClient';

export const revalidate = 300; // ISR: revalidate every 5 minutes

export const metadata: Metadata = {
  title: 'NHL Playoff Odds 2026 — Projections & Standings for All 32 Teams',
  description:
    'NHL playoff odds, projections, and standings for all 32 teams in 2025-26. Track playoff probability, points pace, and race to the postseason.',
  openGraph: {
    title: 'NHL Playoff Odds 2026 — Projections & Standings for All 32 Teams',
    description:
      'NHL playoff odds, projections, and standings for all 32 teams in 2025-26.',
    type: 'website',
    url: 'https://lindysfive.com/nhl-playoff-odds',
    siteName: "Lindy's Five",
  },
  twitter: {
    card: 'summary_large_image',
    title: 'NHL Playoff Odds 2026 — All 32 Teams',
    description:
      'NHL playoff odds, projections, and standings for the 2025-26 season.',
  },
  alternates: {
    canonical: 'https://lindysfive.com/nhl-playoff-odds',
  },
};

// Reverse lookup: NHL abbreviation -> our slug
const abbrevToSlug = Object.fromEntries(
  Object.entries(TEAMS).map(([slug, team]) => [team.abbreviation, slug])
);

interface StandingsTeam {
  teamAbbrev: { default: string };
  teamName: { default: string };
  teamCommonName: { default: string };
  teamLogo: string;
  points: number;
  gamesPlayed: number;
  wins: number;
  losses: number;
  otLosses: number;
  divisionName: string;
  conferenceName: string;
  divisionSequence: number;
  conferenceSequence: number;
  wildcardSequence: number;
  pointPctg: number;
  regulationWins: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifferential: number;
  streakCode: string;
  streakCount: number;
}

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

const TOTAL_GAMES = 82;
const HISTORICAL_FLOOR = 94;

function getProjectedPoints(points: number, gamesPlayed: number): number {
  if (gamesPlayed === 0) return 0;
  return Math.round((points / gamesPlayed) * TOTAL_GAMES);
}

function getDivCutLine(team: StandingsTeam, standings: StandingsTeam[]): number {
  const divTeams = standings
    .filter(t => t.divisionName === team.divisionName)
    .sort((a, b) => b.points - a.points);

  const div3Team = divTeams[2];
  const div4Team = divTeams[3];

  let cutLine: number;
  if (div3Team && div4Team && div3Team.gamesPlayed > 0 && div4Team.gamesPlayed > 0) {
    const div3Projected = (div3Team.points / div3Team.gamesPlayed) * TOTAL_GAMES;
    const div4Projected = (div4Team.points / div4Team.gamesPlayed) * TOTAL_GAMES;
    cutLine = Math.ceil((div3Projected + div4Projected) / 2);
  } else if (div3Team && div3Team.gamesPlayed > 0) {
    cutLine = Math.ceil((div3Team.points / div3Team.gamesPlayed) * TOTAL_GAMES);
  } else {
    cutLine = 90;
  }
  return Math.max(cutLine, 90);
}

function getWcCutLine(team: StandingsTeam, standings: StandingsTeam[]): number {
  const wcTeams = standings
    .filter(t => t.conferenceName === team.conferenceName && t.divisionSequence > 3)
    .sort((a, b) => b.points - a.points);

  const wc2Team = wcTeams[1];
  const wc3Team = wcTeams[2];

  if (!wc2Team || wc2Team.gamesPlayed === 0) return HISTORICAL_FLOOR;

  const wc2Projected = (wc2Team.points / wc2Team.gamesPlayed) * TOTAL_GAMES;

  let cutLine: number;
  if (wc3Team && wc3Team.gamesPlayed > 0) {
    const wc3Projected = (wc3Team.points / wc3Team.gamesPlayed) * TOTAL_GAMES;
    cutLine = Math.ceil((wc2Projected + wc3Projected) / 2);
  } else {
    cutLine = Math.ceil(wc2Projected);
  }
  return Math.max(cutLine, HISTORICAL_FLOOR);
}

function getPlayoffProbability(team: StandingsTeam, standings: StandingsTeam[]): number {
  if (team.gamesPlayed < 5) return 50;
  const projected = getProjectedPoints(team.points, team.gamesPlayed);
  const divCutLine = getDivCutLine(team, standings);
  const wcCutLine = getWcCutLine(team, standings);

  const wcTeams = standings
    .filter(t => t.conferenceName === team.conferenceName && t.divisionSequence > 3)
    .sort((a, b) => b.points - a.points);
  const isInPlayoffPosition = team.divisionSequence <= 3 ||
    (wcTeams.length >= 2 && team.points >= wcTeams[1].points && team.divisionSequence > 3);

  const { probability } = computePositionAwareProbability(
    projected, team.gamesPlayed, divCutLine, wcCutLine, isInPlayoffPosition
  );
  return probability;
}

function isPlayoffTeam(team: StandingsTeam, standings: StandingsTeam[]): boolean {
  if (team.divisionSequence <= 3) return true;
  const wcTeams = standings
    .filter(t => t.conferenceName === team.conferenceName && t.divisionSequence > 3)
    .sort((a, b) => b.points - a.points);
  return wcTeams.length >= 2 && team.points >= wcTeams[1].points;
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
    pace: team.gamesPlayed > 0 ? Math.round((team.points / team.gamesPlayed) * 82) : 0,
    odds: getPlayoffProbability(team, standings),
    streakCode: team.streakCode,
    streakCount: team.streakCount,
    divisionName: team.divisionName,
    conferenceName: team.conferenceName,
    divisionSequence: team.divisionSequence,
    conferenceSequence: team.conferenceSequence,
    isInPlayoffs: isPlayoffTeam(team, standings),
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
      {/* JSON-LD Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify([
            {
              '@context': 'https://schema.org',
              '@type': 'WebPage',
              name: 'NHL Playoff Odds 2026',
              description:
                'NHL playoff odds, projections, and standings for all 32 teams in 2025-26.',
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
              NHL Playoff Odds &amp; Projections 2026
            </h1>
            <p className="text-base md:text-lg text-white/80 max-w-2xl mx-auto">
              Current standings, points pace, and playoff positioning for all 32
              NHL teams in the 2025-26 season.
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
