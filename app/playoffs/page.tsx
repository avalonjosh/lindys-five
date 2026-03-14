import type { Metadata } from 'next';
import Link from 'next/link';
import { TEAMS } from '@/lib/teamConfig';
import type { StandingsTeam } from '@/lib/types/boxscore';
import type {
  PlayoffBracketResponse,
  PlayoffSeries,
  BracketMatchup,
  ConferenceBracket,
  SeriesTeam,
  StanleyCupOddsEntry,
} from '@/lib/types/playoffs';
import { computeSeriesWinProbability } from '@/lib/utils/playoffProbability';
import PlayoffBracketClient from '@/components/playoffs/PlayoffBracketClient';

export const revalidate = 60;

export const metadata: Metadata = {
  title: 'NHL Playoff Bracket 2026 — Live Results, Series Odds & Stanley Cup Predictions',
  description:
    'Live NHL playoff bracket with series win probabilities, Stanley Cup odds, and game results. Track every series in the 2026 Stanley Cup Playoffs.',
  openGraph: {
    title: 'NHL Playoff Bracket 2026 — Series Odds & Stanley Cup Predictions',
    description:
      'Live NHL playoff bracket with series win probabilities and Stanley Cup odds for all remaining teams.',
    type: 'website',
    url: 'https://lindysfive.com/playoffs',
    siteName: "Lindy's Five",
  },
  twitter: {
    card: 'summary_large_image',
    title: 'NHL Playoff Bracket 2026 — Series Odds & Stanley Cup Predictions',
    description: 'Live playoff bracket with series win probabilities and Stanley Cup odds.',
  },
  alternates: {
    canonical: 'https://lindysfive.com/playoffs',
  },
};

const NHL_API = 'https://api-web.nhle.com/v1';

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

async function fetchStandings(): Promise<StandingsTeam[]> {
  try {
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
    const res = await fetch(`${NHL_API}/standings/${today}`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.standings || [];
  } catch {
    return [];
  }
}

function isPlayoffsActive(bracket: PlayoffBracketResponse | null): boolean {
  if (!bracket?.rounds) return false;
  return bracket.rounds.some(r => r.series && r.series.length > 0);
}

// ── Real bracket helpers (when playoffs are active) ──

function buildSeriesTeam(
  matchupTeam: PlayoffSeries['matchupTeams'][0],
  standings: Map<string, StandingsTeam>
): SeriesTeam {
  const team = matchupTeam.team;
  const standing = standings.get(team.abbrev);
  return {
    id: team.id,
    abbrev: team.abbrev,
    name: team.commonName?.default || team.name?.default || team.abbrev,
    logo: team.logo,
    seed: matchupTeam.seed?.rank || 0,
    pointPctg: standing?.pointPctg || 0.5,
  };
}

function buildMatchup(
  series: PlayoffSeries,
  standingsMap: Map<string, StandingsTeam>
): BracketMatchup {
  const topTeamData = series.matchupTeams?.find(t => t.seed?.isTop);
  const bottomTeamData = series.matchupTeams?.find(t => !t.seed?.isTop);

  const topSeed = topTeamData ? buildSeriesTeam(topTeamData, standingsMap) : null;
  const bottomSeed = bottomTeamData ? buildSeriesTeam(bottomTeamData, standingsMap) : null;

  const topWins = series.topSeedWins || 0;
  const bottomWins = series.bottomSeedWins || 0;
  const isComplete = topWins >= 4 || bottomWins >= 4;

  let topSeedSeriesWinPct = 50;
  let bottomSeedSeriesWinPct = 50;

  if (topSeed && bottomSeed) {
    if (isComplete) {
      topSeedSeriesWinPct = topWins >= 4 ? 100 : 0;
      bottomSeedSeriesWinPct = bottomWins >= 4 ? 100 : 0;
    } else {
      topSeedSeriesWinPct = computeSeriesWinProbability(
        topSeed.pointPctg, bottomSeed.pointPctg, topWins, bottomWins, true
      );
      bottomSeedSeriesWinPct = 100 - topSeedSeriesWinPct;
    }
  }

  return {
    seriesLetter: series.seriesLetter,
    topSeed,
    bottomSeed,
    topSeedWins: topWins,
    bottomSeedWins: bottomWins,
    isComplete,
    winningSeed: isComplete ? (topWins >= 4 ? 'top' : 'bottom') : null,
    topSeedSeriesWinPct,
    bottomSeedSeriesWinPct,
    games: series.games || [],
  };
}

function buildConferenceBrackets(
  bracket: PlayoffBracketResponse,
  standingsMap: Map<string, StandingsTeam>
): { eastern: ConferenceBracket; western: ConferenceBracket } {
  const eastern: ConferenceBracket = { conferenceName: 'Eastern', rounds: [] };
  const western: ConferenceBracket = { conferenceName: 'Western', rounds: [] };

  for (const round of bracket.rounds || []) {
    const eastMatchups: BracketMatchup[] = [];
    const westMatchups: BracketMatchup[] = [];

    for (const series of round.series || []) {
      const matchup = buildMatchup(series, standingsMap);
      const teamAbbrev = matchup.topSeed?.abbrev || matchup.bottomSeed?.abbrev;
      const standing = teamAbbrev ? standingsMap.get(teamAbbrev) : null;
      const conf = standing?.conferenceName;

      if (round.roundNumber === 4) {
        eastMatchups.push(matchup);
      } else if (conf === 'Western') {
        westMatchups.push(matchup);
      } else {
        eastMatchups.push(matchup);
      }
    }

    if (eastMatchups.length > 0) {
      eastern.rounds.push({ roundNumber: round.roundNumber, matchups: eastMatchups });
    }
    if (westMatchups.length > 0) {
      western.rounds.push({ roundNumber: round.roundNumber, matchups: westMatchups });
    }
  }

  return { eastern, western };
}

function buildCupOdds(
  bracket: PlayoffBracketResponse,
  standingsMap: Map<string, StandingsTeam>
): StanleyCupOddsEntry[] {
  const entries: StanleyCupOddsEntry[] = [];
  const teamsInBracket = new Map<string, {
    abbrev: string; name: string; logo: string; seed: number;
    ptPctg: number; conferenceName: string; isEliminated: boolean;
    currentSeriesWinPct: number; roundsToWin: number;
  }>();

  for (const round of bracket.rounds || []) {
    for (const series of round.series || []) {
      for (const mt of series.matchupTeams || []) {
        const abbrev = mt.team.abbrev;
        if (teamsInBracket.has(abbrev)) continue;
        const standing = standingsMap.get(abbrev);
        const isTop = mt.seed?.isTop;
        const losses = isTop ? series.bottomSeedWins : series.topSeedWins;
        teamsInBracket.set(abbrev, {
          abbrev,
          name: mt.team.commonName?.default || mt.team.name?.default || abbrev,
          logo: mt.team.logo,
          seed: mt.seed?.rank || 0,
          ptPctg: standing?.pointPctg || 0.5,
          conferenceName: standing?.conferenceName || '',
          isEliminated: losses >= 4,
          currentSeriesWinPct: 50,
          roundsToWin: 5 - round.roundNumber,
        });
      }
    }
  }

  for (const round of bracket.rounds || []) {
    for (const series of round.series || []) {
      const topMt = series.matchupTeams?.find(t => t.seed?.isTop);
      const bottomMt = series.matchupTeams?.find(t => !t.seed?.isTop);
      if (!topMt || !bottomMt) continue;
      const topData = teamsInBracket.get(topMt.team.abbrev);
      const bottomData = teamsInBracket.get(bottomMt.team.abbrev);
      if (!topData || !bottomData) continue;
      const topWins = series.topSeedWins || 0;
      const bottomWins = series.bottomSeedWins || 0;
      if (topWins >= 4 || bottomWins >= 4) {
        topData.currentSeriesWinPct = topWins >= 4 ? 100 : 0;
        bottomData.currentSeriesWinPct = bottomWins >= 4 ? 100 : 0;
      } else {
        const topP = computeSeriesWinProbability(topData.ptPctg, bottomData.ptPctg, topWins, bottomWins, true);
        topData.currentSeriesWinPct = topP;
        bottomData.currentSeriesWinPct = 100 - topP;
      }
    }
  }

  for (const [, team] of teamsInBracket) {
    if (team.isEliminated) {
      entries.push({ abbrev: team.abbrev, name: team.name, logo: team.logo, seed: team.seed,
        conferenceName: team.conferenceName, cupOdds: 0, currentSeriesOdds: 0, isEliminated: true });
      continue;
    }
    let cupProb = team.currentSeriesWinPct / 100;
    for (let r = 1; r < team.roundsToWin; r++) {
      const p = computeSeriesWinProbability(team.ptPctg, 0.5, 0, 0, team.seed <= 4);
      cupProb *= p / 100;
    }
    entries.push({ abbrev: team.abbrev, name: team.name, logo: team.logo, seed: team.seed,
      conferenceName: team.conferenceName, cupOdds: Math.round(cupProb * 1000) / 10,
      currentSeriesOdds: Math.round(team.currentSeriesWinPct), isEliminated: false });
  }
  return entries;
}

// ── Projected bracket from standings (regular season) ──

function standingToSeriesTeam(st: StandingsTeam, seed: number): SeriesTeam {
  return {
    id: 0,
    abbrev: st.teamAbbrev.default,
    name: st.teamCommonName?.default || st.teamName.default,
    logo: st.teamLogo,
    seed,
    pointPctg: st.pointPctg,
  };
}

function makeProjectedMatchup(
  home: StandingsTeam,
  away: StandingsTeam,
  homeSeed: number,
  awaySeed: number,
  letter: string
): BracketMatchup {
  const topSeed = standingToSeriesTeam(home, homeSeed);
  const bottomSeed = standingToSeriesTeam(away, awaySeed);
  const topPct = computeSeriesWinProbability(topSeed.pointPctg, bottomSeed.pointPctg, 0, 0, true);
  return {
    seriesLetter: letter,
    topSeed,
    bottomSeed,
    topSeedWins: 0,
    bottomSeedWins: 0,
    isComplete: false,
    winningSeed: null,
    topSeedSeriesWinPct: topPct,
    bottomSeedSeriesWinPct: 100 - topPct,
    games: [],
  };
}

function buildProjectedBracket(standings: StandingsTeam[]): {
  eastern: ConferenceBracket;
  western: ConferenceBracket;
  cupOdds: StanleyCupOddsEntry[];
} | null {
  if (standings.length === 0) return null;

  const conferences: ConferenceBracket[] = [];
  const allMatchups: BracketMatchup[] = [];
  let letterIdx = 0;
  const letters = 'ABCDEFGH';

  for (const confName of ['Eastern', 'Western']) {
    const confTeams = standings.filter(t => t.conferenceName === confName);
    if (confTeams.length < 8) return null;

    const divOrder = confName === 'Eastern'
      ? ['Atlantic', 'Metropolitan']
      : ['Central', 'Pacific'];

    const divisionData = divOrder.map(divName => {
      const divTeams = confTeams
        .filter(t => t.divisionName === divName)
        .sort((a, b) => a.divisionSequence - b.divisionSequence);
      return { name: divName, teams: divTeams };
    });

    // Sort divisions by leader's points (A = better record)
    divisionData.sort((a, b) => b.teams[0].points - a.teams[0].points);
    const [divA, divB] = divisionData;

    // Wild cards: teams ranked 4+ in their division, sorted by conference-wide points
    const wildcards = confTeams
      .filter(t => t.divisionSequence > 3)
      .sort((a, b) => b.points - a.points)
      .slice(0, 2);

    const wc1 = wildcards[0]; // Better WC → plays divB leader
    const wc2 = wildcards[1]; // Worse WC → plays divA leader

    if (!divA.teams[2] || !divB.teams[2] || !wc1 || !wc2) return null;

    // NHL seeding: divA leader = 1, divB leader = 2
    // divA: (1) leader vs (WC2), (3) 2nd vs (6) 3rd
    // divB: (2) leader vs (WC1), (4) 2nd vs (5) 3rd
    const matchups = [
      makeProjectedMatchup(divA.teams[0], wc2, 1, 4, letters[letterIdx++]),     // 1 vs WC2
      makeProjectedMatchup(divA.teams[1], divA.teams[2], 2, 3, letters[letterIdx++]), // A2 vs A3
      makeProjectedMatchup(divB.teams[0], wc1, 1, 4, letters[letterIdx++]),     // 2 vs WC1
      makeProjectedMatchup(divB.teams[1], divB.teams[2], 2, 3, letters[letterIdx++]), // B2 vs B3
    ];

    allMatchups.push(...matchups);

    conferences.push({
      conferenceName: confName,
      rounds: [{ roundNumber: 1, matchups }],
    });
  }

  // Compute Cup odds for all 16 projected playoff teams
  const cupOdds: StanleyCupOddsEntry[] = [];
  for (const matchup of allMatchups) {
    for (const team of [matchup.topSeed, matchup.bottomSeed]) {
      if (!team) continue;
      const isTop = team === matchup.topSeed;
      const currentP = isTop ? matchup.topSeedSeriesWinPct : matchup.bottomSeedSeriesWinPct;
      // Chain: P(win R1) × P(win R2 vs avg) × P(win R3 vs avg) × P(win Final vs avg)
      let cupProb = currentP / 100;
      for (let r = 0; r < 3; r++) {
        const p = computeSeriesWinProbability(team.pointPctg, 0.5, 0, 0, team.seed <= 2);
        cupProb *= p / 100;
      }
      cupOdds.push({
        abbrev: team.abbrev,
        name: team.name,
        logo: team.logo,
        seed: team.seed,
        conferenceName: conferences.find(c =>
          c.rounds[0]?.matchups.some(m => m.topSeed?.abbrev === team.abbrev || m.bottomSeed?.abbrev === team.abbrev)
        )?.conferenceName || '',
        cupOdds: Math.round(cupProb * 1000) / 10,
        currentSeriesOdds: Math.round(currentP),
        isEliminated: false,
      });
    }
  }

  return {
    eastern: conferences.find(c => c.conferenceName === 'Eastern')!,
    western: conferences.find(c => c.conferenceName === 'Western')!,
    cupOdds,
  };
}

// ── SportsEvent structured data for active series ──

function buildSportsEventSchema(
  eastern: ConferenceBracket,
  western: ConferenceBracket,
  playoffsActive: boolean
): object[] {
  if (!playoffsActive) return [];
  const events: object[] = [];
  for (const conf of [eastern, western]) {
    for (const round of conf.rounds) {
      for (const matchup of round.matchups) {
        if (!matchup.topSeed || !matchup.bottomSeed || matchup.isComplete) continue;
        events.push({
          '@context': 'https://schema.org',
          '@type': 'SportsEvent',
          name: `${matchup.topSeed.name} vs ${matchup.bottomSeed.name} — NHL Playoffs 2026`,
          sport: 'Ice Hockey',
          homeTeam: { '@type': 'SportsTeam', name: matchup.topSeed.name },
          awayTeam: { '@type': 'SportsTeam', name: matchup.bottomSeed.name },
          description: `Series: ${matchup.topSeedWins}-${matchup.bottomSeedWins}`,
        });
      }
    }
  }
  return events;
}

// ── Page component ──

export default async function PlayoffsPage() {
  const [bracket, standings] = await Promise.all([fetchBracket(), fetchStandings()]);

  const standingsMap = new Map<string, StandingsTeam>();
  standings.forEach(t => standingsMap.set(t.teamAbbrev.default, t));

  const playoffsActive = isPlayoffsActive(bracket);

  // Use real bracket if playoffs active, otherwise project from standings
  let eastern: ConferenceBracket;
  let western: ConferenceBracket;
  let cupOdds: StanleyCupOddsEntry[];
  let hasLiveGames = false;
  let isProjected = false;

  if (playoffsActive && bracket) {
    const brackets = buildConferenceBrackets(bracket, standingsMap);
    eastern = brackets.eastern;
    western = brackets.western;
    cupOdds = buildCupOdds(bracket, standingsMap);
    hasLiveGames = bracket.rounds.some(r =>
      r.series?.some(s => s.games?.some(g => g.gameState === 'LIVE' || g.gameState === 'CRIT'))
    );
  } else {
    const projected = buildProjectedBracket(standings);
    if (!projected) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
          <div className="text-center text-white max-w-lg">
            <h1 className="text-4xl md:text-6xl font-bold mb-4" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
              Stanley Cup Playoffs 2026
            </h1>
            <p className="text-gray-400 mb-8 text-lg">
              Unable to load standings data. Please try again later.
            </p>
            <Link href="/" className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg transition-colors font-medium">
              Back to Home
            </Link>
          </div>
        </div>
      );
    }
    eastern = projected.eastern;
    western = projected.western;
    cupOdds = projected.cupOdds;
    isProjected = true;
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify([
            {
              '@context': 'https://schema.org',
              '@type': 'WebPage',
              name: 'NHL Playoff Bracket 2026',
              description: 'NHL playoff bracket with series odds and Stanley Cup predictions.',
              url: 'https://lindysfive.com/playoffs',
              publisher: { '@type': 'Organization', name: 'JRR Apps' },
            },
            {
              '@context': 'https://schema.org',
              '@type': 'BreadcrumbList',
              itemListElement: [
                { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://lindysfive.com/' },
                { '@type': 'ListItem', position: 2, name: 'Playoffs', item: 'https://lindysfive.com/playoffs' },
              ],
            },
            ...buildSportsEventSchema(eastern, western, playoffsActive),
          ]),
        }}
      />

      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
        {/* Header */}
        <header
          className="shadow-xl border-b-4"
          style={{ background: '#003087', borderBottomColor: '#0A1128' }}
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
              {isProjected ? 'Projected Playoff Bracket 2026' : 'Stanley Cup Playoffs 2026'}
            </h1>
            <p className="text-base md:text-lg text-white/80 max-w-2xl mx-auto">
              {isProjected
                ? 'If the season ended today — series win probabilities and Stanley Cup odds'
                : 'Live bracket, series win probabilities, and Stanley Cup odds'}
            </p>
          </div>
        </header>

        {/* Breadcrumb */}
        <nav className="max-w-7xl mx-auto px-4 py-3 text-sm text-gray-500">
          <Link href="/" className="hover:text-gray-700 transition-colors">Home</Link>
          <span className="mx-2">/</span>
          <span className="text-gray-600">Playoffs</span>
        </nav>

        {/* Main Content */}
        <main className="max-w-7xl mx-auto px-4 pb-16">
          <PlayoffBracketClient
            eastern={eastern}
            western={western}
            cupOdds={cupOdds}
            hasLiveGames={hasLiveGames}
            isProjected={isProjected}
          />
        </main>

        {/* Footer */}
        <footer className="mt-auto py-6 text-center text-sm text-gray-500">
          <p>Lindy&apos;s Five &bull; {new Date().getFullYear()}</p>
          <p className="mt-1">
            {isProjected
              ? 'Projected from current standings. Updated every 5 minutes.'
              : 'Data sourced from the NHL. Updated every 60 seconds.'}
          </p>
        </footer>
      </div>
    </>
  );
}
