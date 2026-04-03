import type { Metadata } from 'next';
import Link from 'next/link';
import MLBTeamNav from '@/components/mlb/MLBTeamNav';
import { TEAMS } from '@/lib/teamConfig';
import type { StandingsTeam } from '@/lib/types/boxscore';
import type { PlayoffBracketResponse } from '@/lib/types/playoffs';
import { getProjectedPoints, getPlayoffProbability, isInPlayoffPosition } from '@/lib/utils/standingsCalc';
import { computeSeriesWinProbability } from '@/lib/utils/playoffProbability';
import PlayoffOddsClient, { type TeamData } from '@/components/PlayoffOddsClient';
import StanleyCupOddsTable, { type CupOddsTeam } from '@/components/playoffs/StanleyCupOddsTable';
import NewsletterModal from '@/components/newsletter/NewsletterModal';
import GameTicker from '@/components/landing/GameTicker';

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
    url: 'https://www.lindysfive.com/nhl-playoff-odds',
    siteName: "Lindy's Five",
  },
  twitter: {
    card: 'summary_large_image',
    title: 'NHL Playoff Odds 2025-26 — Standings & Playoff Picture',
    description:
      'NHL playoff odds, standings, and projections for all 32 teams. Playoff picture and Stanley Cup odds updated daily.',
  },
  alternates: {
    canonical: 'https://www.lindysfive.com/nhl-playoff-odds',
  },
};

// Reverse lookup: NHL abbreviation -> our slug
const abbrevToSlug = Object.fromEntries(
  Object.entries(TEAMS).map(([slug, team]) => [team.abbreviation, slug])
);

const NHL_API = 'https://api-web.nhle.com/v1';

async function fetchStandings(): Promise<StandingsTeam[] | null> {
  const today = new Date().toLocaleDateString('en-CA', {
    timeZone: 'America/New_York',
  });
  const res = await fetch(
    `${NHL_API}/standings/${today}`,
    { next: { revalidate: 300 } }
  );
  if (!res.ok) return null;
  const data = await res.json();
  return data.standings || [];
}

async function fetchBracket(): Promise<PlayoffBracketResponse | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(`${NHL_API}/playoff-bracket/20252026`, {
      next: { revalidate: 60 },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

function isPlayoffActive(bracket: PlayoffBracketResponse | null): boolean {
  if (!bracket?.rounds) return false;
  return bracket.rounds.some(r => r.series && r.series.length > 0);
}

const ROUND_LABELS: Record<number, string> = {
  1: 'First Round',
  2: 'Second Round',
  3: 'Conf. Finals',
  4: 'Cup Final',
};

function buildCupOddsTeams(
  bracket: PlayoffBracketResponse,
  standingsMap: Map<string, StandingsTeam>
): CupOddsTeam[] {
  const teams: CupOddsTeam[] = [];

  for (const round of bracket.rounds || []) {
    for (const series of round.series || []) {
      for (const mt of series.matchupTeams || []) {
        const abbrev = mt.team.abbrev;
        if (teams.some(t => t.abbrev === abbrev)) continue;

        const standing = standingsMap.get(abbrev);
        const isTop = mt.seed?.isTop;
        const wins = isTop ? series.topSeedWins : series.bottomSeedWins;
        const losses = isTop ? series.bottomSeedWins : series.topSeedWins;
        const isEliminated = losses >= 4;

        // Compute current series win probability
        const oppMt = series.matchupTeams?.find(t => t.team.abbrev !== abbrev);
        const oppStanding = oppMt ? standingsMap.get(oppMt.team.abbrev) : null;
        let currentSeriesOdds = 50;
        if (standing && oppStanding && !isEliminated && wins < 4) {
          currentSeriesOdds = computeSeriesWinProbability(
            standing.pointPctg, oppStanding.pointPctg, wins, losses, !!isTop
          );
        } else if (wins >= 4) {
          currentSeriesOdds = 100;
        } else if (isEliminated) {
          currentSeriesOdds = 0;
        }

        // Simple chain for cup odds
        const roundsRemaining = 5 - round.roundNumber;
        let cupOdds = currentSeriesOdds / 100;
        for (let r = 1; r < roundsRemaining; r++) {
          const p = computeSeriesWinProbability(
            standing?.pointPctg || 0.5, 0.5, 0, 0, (mt.seed?.rank || 8) <= 4
          );
          cupOdds *= p / 100;
        }

        const seriesStatusParts = [];
        if (wins >= 4) seriesStatusParts.push('Won');
        else if (isEliminated) seriesStatusParts.push('Lost');
        else if (wins === losses) seriesStatusParts.push(`Tied ${wins}-${losses}`);
        else if (wins > losses) seriesStatusParts.push(`Leads ${wins}-${losses}`);
        else seriesStatusParts.push(`Trails ${wins}-${losses}`);

        const slug = abbrevToSlug[abbrev] || '';

        teams.push({
          abbrev,
          name: mt.team.commonName?.default || mt.team.name?.default || abbrev,
          logo: mt.team.logo,
          slug,
          cupOdds: isEliminated ? 0 : Math.round(cupOdds * 1000) / 10,
          currentRound: ROUND_LABELS[round.roundNumber] || `R${round.roundNumber}`,
          seriesStatus: seriesStatusParts.join(''),
          isEliminated,
        });
      }
    }
  }

  return teams;
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
    clinchIndicator: team.clinchIndicator,
  }));
}

function buildCupOddsFromStandings(standings: StandingsTeam[]): CupOddsTeam[] | null {
  const teams: CupOddsTeam[] = [];

  for (const confName of ['Eastern', 'Western']) {
    const confTeams = standings.filter(t => t.conferenceName === confName);
    const divOrder = confName === 'Eastern' ? ['Atlantic', 'Metropolitan'] : ['Central', 'Pacific'];
    const divisionData = divOrder.map(divName => ({
      teams: confTeams.filter(t => t.divisionName === divName).sort((a, b) => a.divisionSequence - b.divisionSequence),
    }));
    divisionData.sort((a, b) => b.teams[0]?.points - a.teams[0]?.points);
    const [divA, divB] = divisionData;

    const wildcards = confTeams
      .filter(t => t.divisionSequence > 3)
      .sort((a, b) => b.points - a.points)
      .slice(0, 2);

    const playoffTeams = [
      ...(divA?.teams.slice(0, 3) || []),
      ...(divB?.teams.slice(0, 3) || []),
      ...wildcards,
    ];

    for (const st of playoffTeams) {
      const slug = abbrevToSlug[st.teamAbbrev.default] || '';
      // Simple cup odds: chain series win probabilities vs average
      let cupProb = 1;
      for (let r = 0; r < 4; r++) {
        const p = computeSeriesWinProbability(st.pointPctg, 0.5, 0, 0, true);
        cupProb *= p / 100;
      }
      teams.push({
        abbrev: st.teamAbbrev.default,
        name: st.teamCommonName?.default || st.teamName.default,
        logo: st.teamLogo,
        slug,
        cupOdds: Math.round(cupProb * 1000) / 10,
        currentRound: 'First Round',
        seriesStatus: 'Starts soon',
        isEliminated: false,
      });
    }
  }
  return teams.length > 0 ? teams : null;
}

export default async function NHLPlayoffOddsPage() {
  const [standings, bracket] = await Promise.all([fetchStandings(), fetchBracket()]);
  const playoffsActive = isPlayoffActive(bracket);
  const regularSeasonOver = standings && standings.length > 0 &&
    standings.filter(t => t.gamesPlayed >= 82).length >= 28;

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
      <GameTicker />
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
              url: 'https://www.lindysfive.com/nhl-playoff-odds',
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
                  item: 'https://www.lindysfive.com/',
                },
                {
                  '@type': 'ListItem',
                  position: 2,
                  name: 'NHL Playoff Odds',
                  item: 'https://www.lindysfive.com/nhl-playoff-odds',
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
          <div className="max-w-7xl mx-auto px-4 py-8 md:py-12 text-center relative">
            <div className="absolute top-4 left-4">
              <MLBTeamNav
                currentTeamId=""
                teamColors={{ primary: '#003087', secondary: '#FFB81C', accent: '#FFFFFF' }}
                defaultTab="nhl"
              />
            </div>
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
          <div className="mt-6 mb-4 text-center">
            <Link
              href="/playoffs"
              className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-500 text-sm font-medium"
            >
              View {playoffsActive ? 'Full' : regularSeasonOver ? 'Confirmed' : 'Projected'} Playoff Bracket &rarr;
            </Link>
          </div>

          {playoffsActive && bracket ? (
            <StanleyCupOddsTable
              teams={buildCupOddsTeams(
                bracket,
                new Map(standings.map(t => [t.teamAbbrev.default, t]))
              )}
            />
          ) : regularSeasonOver ? (
            <>
              {(() => {
                const gapOdds = buildCupOddsFromStandings(standings);
                return gapOdds ? <StanleyCupOddsTable teams={gapOdds} /> : <PlayoffOddsClient teams={teams} />;
              })()}
            </>
          ) : (
            <PlayoffOddsClient teams={teams} />
          )}

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
