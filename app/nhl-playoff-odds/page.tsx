import type { Metadata } from 'next';
import Link from 'next/link';
import { TEAMS } from '@/lib/teamConfig';
import { computePositionAwareProbability } from '@/lib/utils/playoffProbability';

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

function getPointsPace(team: StandingsTeam): number {
  if (team.gamesPlayed === 0) return 0;
  return Math.round((team.points / team.gamesPlayed) * 82);
}

function isPlayoffTeam(team: StandingsTeam): boolean {
  return (
    team.divisionSequence <= 3 ||
    (team.wildcardSequence >= 1 && team.wildcardSequence <= 2 && team.divisionSequence > 3)
  );
}

function getProjectedPoints(points: number, gamesPlayed: number): number {
  if (gamesPlayed === 0) return 0;
  return (points / gamesPlayed) * 82;
}

function getDivCutLine(team: StandingsTeam, standings: StandingsTeam[]): number {
  const divTeams = standings.filter(t => t.divisionName === team.divisionName);
  const thirdPlace = divTeams.find(t => t.divisionSequence === 3);
  if (thirdPlace && thirdPlace.gamesPlayed > 0) {
    return getProjectedPoints(thirdPlace.points, thirdPlace.gamesPlayed);
  }
  return 100;
}

function getWcCutLine(team: StandingsTeam, standings: StandingsTeam[]): number {
  const confTeams = standings.filter(
    t => t.conferenceName === team.conferenceName && t.divisionSequence > 3
  );
  const sorted = [...confTeams].sort((a, b) => b.points - a.points);
  const wcTeam = sorted[1];
  if (wcTeam && wcTeam.gamesPlayed > 0) {
    return getProjectedPoints(wcTeam.points, wcTeam.gamesPlayed);
  }
  return 96;
}

function getPlayoffProbability(team: StandingsTeam, standings: StandingsTeam[]): number {
  if (team.gamesPlayed < 5) return 50;
  const projected = getProjectedPoints(team.points, team.gamesPlayed);
  const divCutLine = getDivCutLine(team, standings);
  const wcCutLine = getWcCutLine(team, standings);
  const { probability } = computePositionAwareProbability(
    projected, team.gamesPlayed, divCutLine, wcCutLine, team.conferenceSequence <= 8
  );
  return probability;
}

const DIVISION_ORDER = ['Atlantic', 'Metropolitan', 'Central', 'Pacific'];

const CONFERENCE_MAP: Record<string, string> = {
  Atlantic: 'Eastern',
  Metropolitan: 'Eastern',
  Central: 'Western',
  Pacific: 'Western',
};

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

  // Group teams by division
  const divisionTeams: Record<string, StandingsTeam[]> = {};
  for (const team of standings) {
    const div = team.divisionName;
    if (!divisionTeams[div]) divisionTeams[div] = [];
    divisionTeams[div].push(team);
  }

  // Sort each division by divisionSequence, then by wildcardSequence for those outside top 3
  for (const div of Object.keys(divisionTeams)) {
    divisionTeams[div].sort((a, b) => {
      if (a.divisionSequence !== b.divisionSequence)
        return a.divisionSequence - b.divisionSequence;
      return b.points - a.points;
    });
  }

  // Get wildcard teams per conference
  const wildcardsByConference: Record<string, StandingsTeam[]> = {
    Eastern: [],
    Western: [],
  };
  for (const team of standings) {
    if (team.divisionSequence > 3 && team.wildcardSequence >= 1 && team.wildcardSequence <= 2) {
      wildcardsByConference[team.conferenceName]?.push(team);
    }
  }

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

      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        {/* Header */}
        <header className="bg-slate-900/80 border-b border-slate-700/50 backdrop-blur-sm">
          <div className="max-w-7xl mx-auto px-4 py-8 md:py-12 text-center">
            <Link href="/" className="inline-block mb-2">
              <p
                className="text-xl md:text-2xl font-bold text-gray-400 hover:text-gray-300 transition-colors"
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
            <p className="text-base md:text-lg text-gray-400 max-w-2xl mx-auto">
              Current standings, points pace, and playoff positioning for all 32
              NHL teams in the 2025-26 season.
            </p>
          </div>
        </header>

        {/* Breadcrumb */}
        <nav className="max-w-7xl mx-auto px-4 py-3 text-sm text-gray-500">
          <Link href="/" className="hover:text-gray-300 transition-colors">
            Home
          </Link>
          <span className="mx-2">/</span>
          <span className="text-gray-400">NHL Playoff Odds</span>
        </nav>

        {/* Main Content */}
        <main className="max-w-7xl mx-auto px-4 pb-16">
          {/* Division Tables */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-6">
            {DIVISION_ORDER.map((divName) => {
              const teams = divisionTeams[divName];
              if (!teams) return null;
              const conference = CONFERENCE_MAP[divName];
              const wcTeams = wildcardsByConference[conference] || [];

              return (
                <div
                  key={divName}
                  className="bg-slate-800/60 rounded-xl border border-slate-700/50 overflow-hidden"
                >
                  {/* Division Header */}
                  <div className="bg-slate-800 px-4 py-3 border-b border-slate-700/50">
                    <h2
                      className="text-xl md:text-2xl font-bold text-white"
                      style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                    >
                      {divName} Division
                    </h2>
                    <p className="text-xs text-gray-500 uppercase tracking-wider">
                      {conference} Conference
                    </p>
                  </div>

                  {/* Table */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-gray-400 text-xs uppercase border-b border-slate-700/50">
                          <th className="text-left py-2 px-3 w-8">#</th>
                          <th className="text-left py-2 px-2">Team</th>
                          <th className="text-center py-2 px-2 hidden sm:table-cell">
                            GP
                          </th>
                          <th className="text-center py-2 px-2">
                            <span className="hidden sm:inline">Record</span>
                            <span className="sm:hidden">W-L</span>
                          </th>
                          <th className="text-center py-2 px-2 font-bold text-gray-300">
                            PTS
                          </th>
                          <th className="text-center py-2 px-2 hidden md:table-cell">
                            PTS%
                          </th>
                          <th className="text-center py-2 px-2">Pace</th>
                          <th className="text-center py-2 px-2 font-bold text-gray-300">
                            Odds
                          </th>
                          <th className="text-center py-2 px-2 hidden sm:table-cell">
                            DIFF
                          </th>
                          <th className="text-center py-2 px-2 hidden lg:table-cell">
                            Strk
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {teams.map((team, idx) => {
                          const slug =
                            abbrevToSlug[team.teamAbbrev.default] || '';
                          const inPlayoffs = isPlayoffTeam(team);
                          const pace = getPointsPace(team);
                          const odds = getPlayoffProbability(team, standings);
                          const diff = team.goalDifferential;
                          const rank = idx + 1;
                          const isDivisionClinch = team.divisionSequence <= 3;
                          const isWildcard =
                            !isDivisionClinch &&
                            wcTeams.some(
                              (wc) =>
                                wc.teamAbbrev.default ===
                                team.teamAbbrev.default
                            );
                          const showGreen = isDivisionClinch || isWildcard;

                          return (
                            <tr
                              key={team.teamAbbrev.default}
                              className={`border-b border-slate-700/30 hover:bg-slate-700/30 transition-colors ${
                                showGreen ? 'border-l-3 border-l-emerald-500' : 'border-l-3 border-l-transparent'
                              }`}
                            >
                              <td className="py-2.5 px-3 text-gray-500 text-xs font-medium">
                                {rank}
                              </td>
                              <td className="py-2.5 px-2">
                                <Link
                                  href={slug ? `/${slug}` : '#'}
                                  className="flex items-center gap-2 group"
                                >
                                  <img
                                    src={team.teamLogo}
                                    alt={team.teamName.default}
                                    className="w-6 h-6 flex-shrink-0"
                                    loading="lazy"
                                  />
                                  <span className="text-white font-medium group-hover:text-blue-400 transition-colors truncate">
                                    <span className="hidden md:inline">
                                      {team.teamName.default}
                                    </span>
                                    <span className="md:hidden">
                                      {team.teamAbbrev.default}
                                    </span>
                                  </span>
                                  {showGreen && (
                                    <span
                                      className="text-[10px] font-bold uppercase tracking-wider flex-shrink-0 hidden sm:inline"
                                      style={{ color: '#34d399' }}
                                    >
                                      {isDivisionClinch ? '' : 'WC'}
                                    </span>
                                  )}
                                </Link>
                              </td>
                              <td className="py-2.5 px-2 text-center text-gray-400 hidden sm:table-cell">
                                {team.gamesPlayed}
                              </td>
                              <td className="py-2.5 px-2 text-center text-gray-300 whitespace-nowrap">
                                {team.wins}-{team.losses}-{team.otLosses}
                              </td>
                              <td className="py-2.5 px-2 text-center text-white font-bold">
                                {team.points}
                              </td>
                              <td className="py-2.5 px-2 text-center text-gray-400 hidden md:table-cell">
                                {(team.pointPctg * 100).toFixed(1)}
                              </td>
                              <td
                                className={`py-2.5 px-2 text-center font-semibold ${
                                  pace >= 100
                                    ? 'text-emerald-400'
                                    : pace >= 90
                                      ? 'text-yellow-400'
                                      : 'text-red-400'
                                }`}
                              >
                                {pace}
                              </td>
                              <td
                                className={`py-2.5 px-2 text-center font-bold ${
                                  odds >= 75
                                    ? 'text-emerald-400'
                                    : odds >= 40
                                      ? 'text-yellow-400'
                                      : 'text-red-400'
                                }`}
                              >
                                {odds}%
                              </td>
                              <td
                                className={`py-2.5 px-2 text-center hidden sm:table-cell ${
                                  diff > 0
                                    ? 'text-emerald-400'
                                    : diff < 0
                                      ? 'text-red-400'
                                      : 'text-gray-400'
                                }`}
                              >
                                {diff > 0 ? `+${diff}` : diff}
                              </td>
                              <td className="py-2.5 px-2 text-center text-gray-400 hidden lg:table-cell whitespace-nowrap">
                                {team.streakCode}
                                {team.streakCount}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Legend */}
                  <div className="px-4 py-2 border-t border-slate-700/30 flex items-center gap-2 text-[10px] text-gray-500">
                    <span className="inline-block w-2 h-2 rounded-sm bg-emerald-500" />
                    <span>Playoff position</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Key / Legend */}
          <div className="mt-8 bg-slate-800/40 rounded-xl border border-slate-700/50 px-5 py-4 text-sm text-gray-400 flex flex-wrap gap-x-6 gap-y-2">
            <span>
              <strong className="text-gray-300">Pace</strong> = projected
              82-game point total
            </span>
            <span>
              <strong className="text-gray-300">Odds</strong> = playoff
              probability
            </span>
            <span>
              <strong className="text-gray-300">PTS%</strong> = points
              percentage
            </span>
            <span>
              <strong className="text-gray-300">DIFF</strong> = goal
              differential
            </span>
            <span>
              <strong className="text-gray-300">WC</strong> = wildcard spot
            </span>
          </div>

          {/* Narrative Section */}
          <section className="mt-12 max-w-3xl mx-auto">
            <h2
              className="text-2xl md:text-3xl font-bold text-white mb-6"
              style={{ fontFamily: 'Bebas Neue, sans-serif' }}
            >
              2025-26 NHL Playoff Race
            </h2>
            <div className="space-y-4 text-gray-300 leading-relaxed">
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
                  className="text-blue-400 hover:text-blue-300 underline"
                >
                  Lindy&apos;s Five
                </Link>{' '}
                for detailed 5-game set analysis, points pace tracking, and
                playoff projections for every NHL team. Select your team from the
                standings above or from our{' '}
                <Link
                  href="/"
                  className="text-blue-400 hover:text-blue-300 underline"
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
              className="inline-flex items-center gap-2 bg-slate-700/50 hover:bg-slate-700 text-white px-6 py-3 rounded-lg transition-colors font-medium"
            >
              <span>&larr;</span>
              <span>Back to All Teams</span>
            </Link>
          </div>
        </main>

        {/* Footer */}
        <footer className="border-t border-slate-700/50 py-8 text-center text-gray-500 text-sm">
          <p>
            &copy; {new Date().getFullYear()} JRR Apps. All rights reserved.
          </p>
          <p className="mt-1">
            Data sourced from the NHL. Updated every 5 minutes.
          </p>
        </footer>
      </div>
    </>
  );
}
