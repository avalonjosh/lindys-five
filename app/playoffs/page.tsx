import type { Metadata } from 'next';
import Link from 'next/link';
import MLBTeamNav from '@/components/mlb/MLBTeamNav';
import BreadcrumbNav from '@/components/seo/BreadcrumbNav';
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
import { buildCupOdds } from '@/lib/utils/cupOdds';
import PlayoffBracketClient from '@/components/playoffs/PlayoffBracketClient';
import GameTicker from '@/components/landing/GameTicker';
import { getCurrentNHLSeason, getCurrentSeasonGameCount, formatSeasonEndYear } from '@/lib/utils/season';
import { getPlayoffsOutcome, getFinalStandings } from '@/lib/services/nhlOffseason';

export const revalidate = 60;

export async function generateMetadata(): Promise<Metadata> {
  const season = getCurrentNHLSeason();
  const endYear = formatSeasonEndYear(season);
  const { complete, championName } = await getPlayoffsOutcome(season);

  const title = complete && championName
    ? `${championName} Win the ${endYear} Stanley Cup — NHL Playoff Bracket`
    : `NHL Playoff Bracket ${endYear} — Live Results, Series Odds & Stanley Cup Predictions`;
  const description = complete && championName
    ? `The ${championName} won the ${endYear} Stanley Cup. See the complete ${endYear} NHL playoff bracket, every series result, and the road to the Cup.`
    : `Live NHL playoff bracket with series win probabilities, Stanley Cup odds, and game results. Track every series in the ${endYear} Stanley Cup Playoffs.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'website',
      url: 'https://www.lindysfive.com/playoffs',
      siteName: "Lindy's Five",
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
    alternates: {
      canonical: 'https://www.lindysfive.com/playoffs',
    },
  };
}

const NHL_API = 'https://api-web.nhle.com/v1';

// NHL's /playoff-bracket/{season} endpoint is unreliable (often 404). Assemble the same PlayoffBracketResponse shape
// from /playoff-series/carousel/{season} (seeds + wins) + /schedule/playoff-series/{season}/{letter} (per-series games).
// Mirrors the logic in `app/api/playoffs/bracket/route.ts` — kept inline here so the server page can render without
// round-tripping through our own API route during SSR.
interface CarouselSide {
  id: number;
  abbrev: string;
  wins: number;
  logo: string;
}
interface CarouselSeries {
  seriesLetter: string;
  roundNumber: number;
  neededToWin: number;
  topSeed: CarouselSide;
  bottomSeed: CarouselSide;
}
interface CarouselRound {
  roundNumber: number;
  roundLabel: string;
  series: CarouselSeries[];
}
interface DetailTeam {
  id: number;
  abbrev: string;
  name?: { default: string };
  score?: number;
}
interface DetailGame {
  id: number;
  gameNumber: number;
  gameDate?: string;
  gameState: string;
  gameScheduleState?: string;
  startTimeUTC?: string;
  ifNecessary?: boolean;
  homeTeam: DetailTeam;
  awayTeam: DetailTeam;
  gameOutcome?: { lastPeriodType: string };
  periodDescriptor?: { number: number; periodType?: string };
  clock?: { timeRemaining?: string; inIntermission?: boolean };
}

function teamCfgByAbbrev(abbrev: string) {
  return Object.values(TEAMS).find((t) => t.abbreviation === abbrev);
}

async function fetchBracket(): Promise<PlayoffBracketResponse | null> {
  const SEASON = getCurrentNHLSeason();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const carouselRes = await fetch(`${NHL_API}/playoff-series/carousel/${SEASON}`, {
      next: { revalidate: 60 },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!carouselRes.ok) return null;
    const carousel = await carouselRes.json();
    const carouselRounds: CarouselRound[] = carousel.rounds || [];

    // For each round × series, fetch the detail endpoint in parallel for the full game list
    const rounds = await Promise.all(
      carouselRounds.map(async (round) => {
        const series = await Promise.all(
          (round.series || []).map(async (s) => {
            let detail: { topSeedTeam?: { name?: { default: string } }; bottomSeedTeam?: { name?: { default: string } }; games?: DetailGame[] } | null = null;
            try {
              const detailRes = await fetch(
                `${NHL_API}/schedule/playoff-series/${SEASON}/${s.seriesLetter.toLowerCase()}`,
                { next: { revalidate: 60 } }
              );
              if (detailRes.ok) detail = await detailRes.json();
            } catch {
              // ignore per-series failure — series still shows matchup without games
            }

            const assembleTeam = (side: CarouselSide, detailTeam?: { name?: { default: string } }) => {
              const cfg = teamCfgByAbbrev(side.abbrev);
              const commonName = detailTeam?.name?.default || cfg?.name || side.abbrev;
              const fullName = cfg ? `${cfg.city} ${cfg.name}` : commonName;
              return {
                id: side.id,
                abbrev: side.abbrev,
                name: { default: fullName },
                commonName: { default: commonName },
                placeName: { default: cfg?.city || '' },
                logo: side.logo,
              };
            };

            const mapGame = (g: DetailGame) => ({
              gameId: g.id,
              gameNumber: g.gameNumber,
              gameDate: g.gameDate || '',
              gameState: g.gameState,
              gameScheduleState: g.gameScheduleState,
              startTimeUTC: g.startTimeUTC,
              ifNecessary: g.ifNecessary,
              homeTeam: { id: g.homeTeam.id, abbrev: g.homeTeam.abbrev, score: g.homeTeam.score },
              awayTeam: { id: g.awayTeam.id, abbrev: g.awayTeam.abbrev, score: g.awayTeam.score },
              gameOutcome: g.gameOutcome,
              periodDescriptor: g.periodDescriptor,
              clock: g.clock,
            });

            return {
              seriesLetter: s.seriesLetter,
              round: { number: round.roundNumber },
              matchupTeams: [
                {
                  seed: { type: 'unknown', rank: 0, isTop: true },
                  team: assembleTeam(s.topSeed, detail?.topSeedTeam),
                  seriesRecord: { wins: s.topSeed.wins || 0, losses: s.bottomSeed.wins || 0 },
                },
                {
                  seed: { type: 'unknown', rank: 0, isTop: false },
                  team: assembleTeam(s.bottomSeed, detail?.bottomSeedTeam),
                  seriesRecord: { wins: s.bottomSeed.wins || 0, losses: s.topSeed.wins || 0 },
                },
              ],
              topSeedWins: s.topSeed.wins || 0,
              bottomSeedWins: s.bottomSeed.wins || 0,
              games: (detail?.games || []).map(mapGame),
            };
          })
        );

        return {
          roundNumber: round.roundNumber,
          roundLabel: round.roundLabel,
          series,
        };
      })
    );

    return { rounds, seasonId: Number(SEASON) } as PlayoffBracketResponse;
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
    const standings: StandingsTeam[] = data.standings || [];
    // Post-regular-season dates (playoffs, offseason) return empty — fall back to /standings/now
    if (standings.length === 0) {
      const nowRes = await fetch(`${NHL_API}/standings/now`, { next: { revalidate: 300 } });
      if (!nowRes.ok) return [];
      const nowData = await nowRes.json();
      return nowData.standings || [];
    }
    return standings;
  } catch {
    return [];
  }
}

function isPlayoffsActive(bracket: PlayoffBracketResponse | null): boolean {
  if (!bracket?.rounds) return false;
  return bracket.rounds.some(r => r.series && r.series.length > 0);
}

interface Champion {
  name: string;
  logo?: string;
  runnerUp?: string;
}

// Returns the Stanley Cup champion from a completed bracket, or null if the
// Final hasn't been decided yet.
function getChampion(bracket: PlayoffBracketResponse | null): Champion | null {
  const finalRound = bracket?.rounds?.find(r => r.roundNumber === 4);
  const series = finalRound?.series?.[0];
  if (!series) return null;
  const top = series.matchupTeams?.find(t => t.seed?.isTop);
  const bottom = series.matchupTeams?.find(t => !t.seed?.isTop);
  const teamInfo = (mt?: PlayoffSeries['matchupTeams'][0]): string =>
    mt?.team.name?.default || mt?.team.commonName?.default || mt?.team.abbrev || '';
  if ((series.topSeedWins || 0) >= 4 && top) {
    return { name: teamInfo(top), logo: top.team.logo, runnerUp: teamInfo(bottom) };
  }
  if ((series.bottomSeedWins || 0) >= 4 && bottom) {
    return { name: teamInfo(bottom), logo: bottom.team.logo, runnerUp: teamInfo(top) };
  }
  return null;
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
      // V2 model — same math as Cup Odds tab + team tracker Win Odds
      const topStanding = standingsMap.get(topSeed.abbrev);
      const botStanding = standingsMap.get(bottomSeed.abbrev);
      const strengthFor = (st: StandingsTeam | undefined) => {
        if (!st) return {};
        const gp = st.gamesPlayed || 0;
        const homeGP = (st.homeWins || 0) + (st.homeLosses || 0) + (st.homeOtLosses || 0);
        const roadGP = (st.roadWins || 0) + (st.roadLosses || 0) + (st.roadOtLosses || 0);
        return {
          goalDiffPerGame: gp > 0 ? ((st.goalFor || 0) - (st.goalAgainst || 0)) / gp : undefined,
          homeWinPct: homeGP > 0 ? (st.homeWins || 0) / homeGP : undefined,
          roadWinPct: roadGP > 0 ? (st.roadWins || 0) / roadGP : undefined,
        };
      };
      const topS = strengthFor(topStanding);
      const botS = strengthFor(botStanding);
      topSeedSeriesWinPct = computeSeriesWinProbability(
        topSeed.pointPctg, bottomSeed.pointPctg, topWins, bottomWins, true,
        {
          teamGoalDiffPerGame: topS.goalDiffPerGame,
          oppGoalDiffPerGame: botS.goalDiffPerGame,
          teamHomeWinPct: topS.homeWinPct,
          teamRoadWinPct: topS.roadWinPct,
          oppHomeWinPct: botS.homeWinPct,
          oppRoadWinPct: botS.roadWinPct,
        }
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
        .sort((a, b) => a.divisionSequence - b.divisionSequence || b.pointPctg - a.pointPctg);
      return { name: divName, teams: divTeams };
    });

    // Sort divisions by leader's points, then pointPctg tiebreaker (A = better record)
    divisionData.sort((a, b) => b.teams[0].points - a.teams[0].points || b.teams[0].pointPctg - a.teams[0].pointPctg);
    const [divA, divB] = divisionData;

    // Wild cards: teams ranked 4+ in their division, sorted by conference-wide points
    const wildcards = confTeams
      .filter(t => t.divisionSequence > 3)
      .sort((a, b) => b.points - a.points || b.pointPctg - a.pointPctg)
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
      // Build stages: R1 uses currentP, R2-Cup chained vs avg opponent
      const stageOdds: number[] = [currentP, 0, 0, 0];
      let running = currentP / 100;
      for (let stage = 2; stage <= 4; stage++) {
        const p = computeSeriesWinProbability(team.pointPctg, 0.5, 0, 0, team.seed <= 2);
        running *= p / 100;
        stageOdds[stage - 1] = running * 100;
      }
      const cupProb = Math.round(stageOdds[3] * 10) / 10;
      cupOdds.push({
        abbrev: team.abbrev,
        name: team.name,
        logo: team.logo,
        seed: team.seed,
        conferenceName: conferences.find(c =>
          c.rounds[0]?.matchups.some(m => m.topSeed?.abbrev === team.abbrev || m.bottomSeed?.abbrev === team.abbrev)
        )?.conferenceName || '',
        cupOdds: cupProb,
        currentSeriesOdds: Math.round(currentP),
        isEliminated: false,
        oddsR1: Math.round(stageOdds[0] * 10) / 10,
        oddsR2: Math.round(stageOdds[1] * 10) / 10,
        oddsConf: Math.round(stageOdds[2] * 10) / 10,
        oddsCup: cupProb,
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
  playoffsActive: boolean,
  endYear: string
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
          name: `${matchup.topSeed.name} vs ${matchup.bottomSeed.name} — NHL Playoffs ${endYear}`,
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
  const season = getCurrentNHLSeason();
  const endYear = formatSeasonEndYear(season);
  const [bracket, liveStandings] = await Promise.all([fetchBracket(), fetchStandings()]);

  // Offseason: standings/today and /now are both empty, which breaks conference
  // routing (every series falls into the East). Fall back to final standings.
  let standings = liveStandings;
  if (standings.length === 0) {
    standings = await getFinalStandings(season);
  }

  const standingsMap = new Map<string, StandingsTeam>();
  standings.forEach(t => standingsMap.set(t.teamAbbrev.default, t));

  const playoffsActive = isPlayoffsActive(bracket);
  const champion = getChampion(bracket);
  const seasonComplete = !!champion;

  // Detect if regular season is over (postseason gap)
  const regularSeasonOver = standings.length > 0 &&
    standings.filter(t => t.gamesPlayed >= getCurrentSeasonGameCount()).length >= 28;

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
              Stanley Cup Playoffs {endYear}
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
      <GameTicker />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify([
            {
              '@context': 'https://schema.org',
              '@type': 'WebPage',
              name: seasonComplete && champion
                ? `${champion.name} Win the ${endYear} Stanley Cup — NHL Playoff Bracket`
                : `NHL Playoff Bracket ${endYear}`,
              description: seasonComplete && champion
                ? `The ${champion.name} won the ${endYear} Stanley Cup. Complete ${endYear} NHL playoff bracket and every series result.`
                : 'NHL playoff bracket with series odds and Stanley Cup predictions.',
              url: 'https://www.lindysfive.com/playoffs',
              dateModified: new Date().toISOString(),
              publisher: { '@type': 'Organization', name: 'JRR Apps' },
            },
            {
              '@context': 'https://schema.org',
              '@type': 'BreadcrumbList',
              itemListElement: [
                { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://www.lindysfive.com/' },
                { '@type': 'ListItem', position: 2, name: 'Playoffs', item: 'https://www.lindysfive.com/playoffs' },
              ],
            },
            ...buildSportsEventSchema(eastern, western, playoffsActive, endYear),
          ]),
        }}
      />

      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
        {/* Header */}
        <header
          className="shadow-xl border-b-4"
          style={{ background: '#003087', borderBottomColor: '#0A1128' }}
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
                ? `${endYear} Stanley Cup Playoffs`
                : playoffsActive || regularSeasonOver
                  ? `Stanley Cup Playoffs ${endYear}`
                  : `Projected Playoff Bracket ${endYear}`}
            </h1>
            <p className="text-base md:text-lg text-white/80 max-w-2xl mx-auto">
              {seasonComplete && champion
                ? `${champion.name} won the ${endYear} Stanley Cup — see the complete bracket below`
                : playoffsActive
                  ? 'Live bracket, series win probabilities, and Stanley Cup odds'
                  : regularSeasonOver
                    ? 'Confirmed first-round matchups — series win probabilities and Stanley Cup odds'
                    : 'If the season ended today — series win probabilities and Stanley Cup odds'}
            </p>
          </div>
        </header>

        {/* Visible breadcrumb — matches the BreadcrumbList JSON-LD above */}
        <BreadcrumbNav
          className="max-w-7xl mx-auto px-4 py-3 text-sm text-gray-500"
          items={[{ name: 'Home', href: '/' }, { name: 'Playoffs' }]}
        />

        {/* Champion banner — shown once the Cup Final is decided */}
        {seasonComplete && champion && (
          <div className="max-w-7xl mx-auto px-4 pt-6">
            <div
              className="rounded-2xl border-2 px-5 py-5 text-center shadow-sm flex flex-col items-center gap-2"
              style={{ backgroundColor: '#FBF5E6', borderColor: '#D4AF37' }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/stanley-cup.png" alt="Stanley Cup" className="h-16 md:h-20 w-auto object-contain" />
              <div className="text-xs font-bold uppercase tracking-widest" style={{ color: '#9A7B1F' }}>
                {endYear} Stanley Cup Champions
              </div>
              <div className="text-2xl md:text-3xl font-bold" style={{ color: '#8a6d1b', fontFamily: 'Bebas Neue, sans-serif' }}>
                {champion.name}
              </div>
              {champion.runnerUp && (
                <div className="text-sm" style={{ color: '#9A7B1F' }}>
                  defeated the {champion.runnerUp} in the Stanley Cup Final
                </div>
              )}
            </div>
          </div>
        )}

        {/* Main Content */}
        <main className="max-w-7xl mx-auto px-4 pt-6 pb-16">
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
          <div className="flex flex-wrap justify-center gap-3 mb-3 text-xs">
            <Link href="/nhl-playoff-odds" className="hover:text-gray-700 transition-colors">NHL Playoff Odds</Link>
            <span className="text-gray-300">|</span>
            <Link href="/mlb/playoff-odds" className="hover:text-gray-700 transition-colors">MLB Playoff Odds</Link>
            <span className="text-gray-300">|</span>
            <Link href="/" className="hover:text-gray-700 transition-colors">Home</Link>
          </div>
          <p>Lindy&apos;s Five &bull; {new Date().getFullYear()}</p>
          <p className="mt-1">
            {seasonComplete
              ? `Final ${endYear} bracket. Next season's playoffs will be tracked here.`
              : playoffsActive
                ? 'Data sourced from the NHL. Updated every 60 seconds.'
                : regularSeasonOver
                  ? 'Matchups confirmed from final standings.'
                  : 'Projected from current standings. Updated every 5 minutes.'}
          </p>
        </footer>
      </div>
    </>
  );
}
