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
import GamePromo from '@/components/perfectseason/GamePromo';
import { getCurrentNHLSeason, formatSeasonLabel, formatSeasonEndYear } from '@/lib/utils/season';
import { getPlayoffsOutcome, getFinalStandings } from '@/lib/services/nhlOffseason';

export const revalidate = 300; // ISR: revalidate every 5 minutes

export async function generateMetadata(): Promise<Metadata> {
  const season = getCurrentNHLSeason();
  const label = formatSeasonLabel(season);
  const endYear = formatSeasonEndYear(season);
  const { complete, championName } = await getPlayoffsOutcome(season);

  const title = complete
    ? `NHL ${label} Final Standings & Playoff Results`
    : `NHL Playoff Odds ${label} — Standings, Projections & Playoff Picture`;
  const description = complete
    ? `Final ${label} NHL standings and playoff results for all 32 teams.${championName ? ` ${championName} won the ${endYear} Stanley Cup.` : ''} Next season's odds will be tracked here once the schedule is released.`
    : `NHL playoff odds, standings, and projections for all 32 teams in ${label}. Track playoff picture, Stanley Cup odds, wild card race, and playoff probability updated daily.`;
  const ogTitle = complete ? `NHL ${label} Final Standings & Playoff Results` : `NHL Playoff Odds ${label} — Standings, Projections & Playoff Picture`;
  const ogSubtitle = complete ? 'Final Standings & Playoff Results' : 'Live Standings, Projections & Wild Card Race';
  const ogImage = `/api/og?type=sport-hub&sport=nhl&title=${encodeURIComponent(ogTitle)}&subtitle=${encodeURIComponent(ogSubtitle)}`;

  return {
    title,
    description,
    openGraph: {
      title: ogTitle,
      description,
      type: 'website',
      url: 'https://www.lindysfive.com/nhl-playoff-odds',
      siteName: "Lindy's Five",
      images: [{ url: ogImage, width: 1200, height: 630, alt: `${ogTitle} — Lindy's Five` }],
    },
    twitter: {
      card: 'summary_large_image',
      title: ogTitle,
      description,
      images: [ogImage],
    },
    alternates: {
      canonical: 'https://www.lindysfive.com/nhl-playoff-odds',
    },
  };
}

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
  const season = getCurrentNHLSeason();
  const seasonLabel = formatSeasonLabel(season);
  const endYear = formatSeasonEndYear(season);
  const outcome = await getPlayoffsOutcome(season);
  const seasonComplete = outcome.complete;

  const [liveStandings, bracket] = await Promise.all([fetchStandings(), fetchBracket()]);
  let standings = liveStandings;
  // Offseason: standings/today is empty — fall back to final regular-season standings.
  if ((!standings || standings.length === 0) && seasonComplete) {
    standings = await getFinalStandings(season);
  }
  const playoffsActive = !seasonComplete && isPlayoffActive(bracket);
  const regularSeasonOver = !seasonComplete && standings && standings.length > 0 &&
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
  const leagueRanked = [...teams].sort(
    (a, b) => b.points - a.points || b.pointPctg - a.pointPctg
  );

  // Past-tense playoff result for a team, used in the offseason standings mirror.
  const playoffResultLabel = (t: TeamData): string => {
    if (outcome.championAbbrev && t.abbrev === outcome.championAbbrev) return 'Won Stanley Cup';
    const madePlayoffs = (t.clinchIndicator && t.clinchIndicator !== 'e') || t.isInPlayoffs;
    return madePlayoffs ? 'Made playoffs' : 'Missed playoffs';
  };

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
              name: seasonComplete
                ? `NHL ${seasonLabel} Final Standings & Playoff Results`
                : `NHL Playoff Odds ${seasonLabel}`,
              description: seasonComplete
                ? `Final ${seasonLabel} NHL standings and playoff results for all 32 teams.${outcome.championName ? ` ${outcome.championName} won the ${endYear} Stanley Cup.` : ''}`
                : `NHL playoff odds, standings, and playoff picture for all 32 teams in ${seasonLabel}. Stanley Cup projections and wild card race updated daily.`,
              url: 'https://www.lindysfive.com/nhl-playoff-odds',
              dateModified: new Date().toISOString(),
              publisher: {
                '@type': 'Organization',
                name: 'JRR Apps',
              },
            },
            {
              '@context': 'https://schema.org',
              '@type': 'Dataset',
              name: seasonComplete
                ? `NHL Final Standings & Playoff Results ${seasonLabel}`
                : `NHL Playoff Odds & Standings ${seasonLabel}`,
              description: seasonComplete
                ? `Final standings and playoff results for all 32 NHL teams for the ${seasonLabel} season. Each team row includes final record, points, games played, and playoff result.${outcome.championName ? ` ${outcome.championName} won the ${endYear} Stanley Cup.` : ''}`
                : `Daily-updated playoff probability, projected points, and standings for all 32 NHL teams for the ${seasonLabel} season. Each team row includes record, points, games played, projected points at current pace, and a logistic playoff probability measured against the division and wild card cut lines.`,
              url: 'https://www.lindysfive.com/nhl-playoff-odds',
              keywords: [
                'NHL playoff odds',
                'NHL standings',
                'Stanley Cup odds',
                'playoff probability',
                'projected points',
              ],
              creator: { '@type': 'Organization', name: 'JRR Apps' },
              publisher: { '@type': 'Organization', name: "Lindy's Five" },
              isAccessibleForFree: true,
              temporalCoverage: `${season.slice(0, 4)}-10/${season.slice(4, 8)}-06`,
              dateModified: new Date().toISOString(),
              measurementTechnique:
                'Logistic curve over the gap between projected points and the higher of the division-3 or wild-card-2 cut line, computed daily from live standings.',
              variableMeasured: [
                { '@type': 'PropertyValue', name: 'Playoff probability', unitText: 'percent' },
                { '@type': 'PropertyValue', name: 'Projected points' },
                { '@type': 'PropertyValue', name: 'Points' },
                { '@type': 'PropertyValue', name: 'Record (wins-losses-OT losses)' },
              ],
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

      {/* Server-rendered standings mirror for crawlers and AI answer engines.
          Duplicates the interactive (client-rendered) table so every team's row
          is present in the initial HTML without JS execution. */}
      <section className="sr-only" aria-label={seasonComplete ? `NHL ${seasonLabel} final standings and playoff results for all 32 teams` : `NHL playoff odds and standings for all 32 teams, ${seasonLabel} season`}>
        <h2>
          {seasonComplete
            ? `NHL ${seasonLabel} Final Standings & Playoff Results — All 32 Teams`
            : `NHL Playoff Odds & Standings ${seasonLabel} — All 32 Teams`}
        </h2>
        <p>
          {seasonComplete ? (
            <>
              Final {seasonLabel} NHL standings and playoff results for all 32 teams, ranked by points.
              {outcome.championName ? ` ${outcome.championName} won the ${endYear} Stanley Cup.` : ''} Next
              season&apos;s playoff odds will be tracked here once the schedule is released.
            </>
          ) : (
            <>
              Live NHL playoff probability, projected points, and standings for all 32 teams,
              ranked by points and updated daily. Projected points extrapolate the current
              points pace over an 82-game season; playoff probability is a logistic estimate
              against the division and wild card cut lines.
            </>
          )}
        </p>
        <table>
          <caption>
            {seasonComplete
              ? `NHL ${seasonLabel} final standings and playoff results, all 32 teams`
              : `NHL standings and playoff odds, all 32 teams, ${seasonLabel} (updated daily)`}
          </caption>
          <thead>
            <tr>
              <th scope="col">League rank</th>
              <th scope="col">Team</th>
              <th scope="col">Record (W-L-OTL)</th>
              <th scope="col">Points</th>
              <th scope="col">Games played</th>
              <th scope="col">{seasonComplete ? 'Playoff result' : 'Projected points'}</th>
              {!seasonComplete && <th scope="col">Playoff probability</th>}
              <th scope="col">Conference</th>
              <th scope="col">Division (rank)</th>
            </tr>
          </thead>
          <tbody>
            {leagueRanked.map((t, i) => (
              <tr key={t.abbrev}>
                <td>{i + 1}</td>
                <td>{t.name}</td>
                <td>{t.wins}-{t.losses}-{t.otLosses}</td>
                <td>{t.points}</td>
                <td>{t.gamesPlayed}</td>
                <td>{seasonComplete ? playoffResultLabel(t) : t.pace}</td>
                {!seasonComplete && <td>{t.odds}%</td>}
                <td>{t.conferenceName}</td>
                <td>{t.divisionName} (#{t.divisionSequence})</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

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
              {seasonComplete
                ? `NHL ${seasonLabel} Final Standings & Playoff Results`
                : `NHL Playoff Odds & Standings ${seasonLabel}`}
            </h1>
            <p className="text-base md:text-lg text-white/80 max-w-2xl mx-auto">
              {seasonComplete
                ? `Final ${seasonLabel} standings and playoff results for all 32 teams. Next season's odds arrive once the schedule is released.`
                : 'NHL playoff picture, Stanley Cup projections, and wild card race for all 32 teams. Updated daily.'}
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
          {seasonComplete && outcome.championName && (
            <Link
              href="/playoffs"
              className="mt-6 block rounded-2xl border-2 px-5 py-4 text-center shadow-sm transition-colors hover:shadow-md"
              style={{ backgroundColor: '#FBF5E6', borderColor: '#D4AF37' }}
            >
              <div className="text-xs font-bold uppercase tracking-wide" style={{ color: '#9A7B1F' }}>
                {endYear} Stanley Cup Champions
              </div>
              <div className="mt-1 text-xl md:text-2xl font-bold" style={{ color: '#8a6d1b' }}>
                🏆 {outcome.championName}
              </div>
              {outcome.runnerUpName && (
                <div className="mt-0.5 text-xs" style={{ color: '#9A7B1F' }}>
                  def. {outcome.runnerUpName} in the Final · View full bracket →
                </div>
              )}
            </Link>
          )}
          <div className="mt-6 mb-4 text-center">
            <Link
              href="/playoffs"
              className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-500 text-sm font-medium"
            >
              View {seasonComplete ? 'Final' : playoffsActive ? 'Full' : regularSeasonOver ? 'Confirmed' : 'Projected'} Playoff Bracket &rarr;
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

          <section className="mt-12 max-w-3xl mx-auto">
            <GamePromo sport="nhl" />
          </section>

          {/* Narrative Section */}
          <section className="mt-12 max-w-3xl mx-auto">
            <h2
              className="text-2xl md:text-3xl font-bold text-gray-900 mb-6"
              style={{ fontFamily: 'Bebas Neue, sans-serif' }}
            >
              {seasonComplete ? `${seasonLabel} NHL Season Recap` : `${seasonLabel} NHL Playoff Race`}
            </h2>
            <div className="space-y-4 text-gray-600 leading-relaxed">
              {seasonComplete ? (
                <p>
                  The {seasonLabel} NHL season is complete.
                  {outcome.championName ? ` ${outcome.championName} captured the ${endYear} Stanley Cup${outcome.runnerUpName ? `, defeating the ${outcome.runnerUpName} in the Final` : ''}.` : ''}{' '}
                  The final standings above show where all 32 teams finished — the top three in
                  each division plus two wild cards per conference reached the playoffs. Next
                  season&apos;s playoff odds, points pace, and projections will be tracked here
                  once the new schedule is released.
                </p>
              ) : (
                <p>
                  The {seasonLabel} NHL playoff race is heating up as teams jockey for
                  position in what has been one of the most competitive seasons in
                  recent memory. With 16 of 32 teams earning a postseason berth,
                  every point matters down the stretch. The top three teams in each
                  division clinch a playoff spot, while the remaining four spots
                  are decided by wildcard positioning within each conference.
                </p>
              )}
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
                to dive deeper. Tracking baseball too? See{' '}
                <Link
                  href="/mlb/playoff-odds"
                  className="text-blue-600 hover:text-blue-500 underline"
                >
                  MLB playoff odds for all 30 teams
                </Link>
                .
              </p>
            </div>
          </section>

          {/* Back to Home */}
          <div className="mt-12 text-center flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/"
              className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg transition-colors font-medium"
            >
              <span>&larr;</span>
              <span>Back to All Teams</span>
            </Link>
            <Link
              href="/mlb/playoff-odds"
              className="inline-flex items-center gap-2 bg-slate-700 hover:bg-slate-800 text-white px-6 py-3 rounded-lg transition-colors font-medium"
            >
              <span>MLB Playoff Odds 2026</span>
              <span>&rarr;</span>
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
