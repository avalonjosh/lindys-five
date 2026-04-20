import { TEAMS } from '@/lib/teamConfig';
import { buildCupOdds } from '@/lib/utils/cupOdds';
import type { StandingsTeam } from '@/lib/types/boxscore';
import type { PlayoffBracketResponse, StanleyCupOddsEntry } from '@/lib/types/playoffs';

const NHL_API = 'https://api-web.nhle.com/v1';
const DEFAULT_SEASON = '20252026';

interface CarouselSide {
  id: number;
  abbrev: string;
  wins: number;
  logo: string;
  darkLogo?: string;
}

interface CarouselSeries {
  seriesLetter: string;
  roundNumber: number;
  seriesLabel: string;
  seriesLink?: string;
  neededToWin: number;
  topSeed: CarouselSide;
  bottomSeed: CarouselSide;
}

interface CarouselRound {
  roundNumber: number;
  roundLabel: string;
  roundAbbrev?: string;
  series: CarouselSeries[];
}

interface DetailTeam {
  id: number;
  abbrev: string;
  name?: { default: string };
  logo?: string;
  score?: number;
  record?: string;
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
}

interface DetailResponse {
  seriesLetter: string;
  round: number;
  roundLabel: string;
  topSeedTeam?: { id: number; abbrev: string; name: { default: string } };
  bottomSeedTeam?: { id: number; abbrev: string; name: { default: string } };
  neededToWin: number;
  games: DetailGame[];
}

function teamConfigByAbbrev(abbrev: string) {
  return Object.values(TEAMS).find((t) => t.abbreviation === abbrev);
}

function assembleTeam(side: CarouselSide, detailTeam?: { name?: { default: string } }) {
  const cfg = teamConfigByAbbrev(side.abbrev);
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
}

function mapGame(g: DetailGame) {
  return {
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
  };
}

export interface PlayoffsSnapshot {
  bracket: PlayoffBracketResponse;
  standings: StandingsTeam[];
  cupOdds: StanleyCupOddsEntry[];
  hasLiveGames: boolean;
}

// Server-side fetch + assembly of the playoff bracket, standings, and Cup odds.
// Shared by /api/playoffs/bracket and the newsletter email pipeline so both see the same data.
export async function fetchPlayoffsSnapshot(season: string = DEFAULT_SEASON): Promise<PlayoffsSnapshot> {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });

  const [carouselRes, standingsRes] = await Promise.all([
    fetch(`${NHL_API}/playoff-series/carousel/${season}`, { cache: 'no-store' }),
    fetch(`${NHL_API}/standings/${today}`, { next: { revalidate: 300 } }),
  ]);

  const standingsData = standingsRes.ok ? await standingsRes.json() : { standings: [] };
  let standings: StandingsTeam[] = standingsData.standings || [];
  // Post-regular-season dates return empty; fall back to /standings/now so downstream consumers
  // (conference routing, team-strength lookups for Win Odds) still have data.
  if (standings.length === 0) {
    try {
      const nowRes = await fetch(`${NHL_API}/standings/now`, { next: { revalidate: 300 } });
      if (nowRes.ok) {
        const nowData = await nowRes.json();
        standings = nowData.standings || [];
      }
    } catch {
      /* silent — empty array is safe */
    }
  }

  if (!carouselRes.ok) {
    return {
      bracket: { rounds: [], seasonId: Number(season) },
      standings,
      cupOdds: [],
      hasLiveGames: false,
    };
  }

  const carousel = await carouselRes.json();
  const carouselRounds: CarouselRound[] = carousel.rounds || [];

  const rounds = await Promise.all(
    carouselRounds.map(async (round) => {
      const seriesWithDetail = await Promise.all(
        (round.series || []).map(async (s) => {
          try {
            const detailRes = await fetch(
              `${NHL_API}/schedule/playoff-series/${season}/${s.seriesLetter.toLowerCase()}`,
              { next: { revalidate: 60 } }
            );
            const detail: DetailResponse | null = detailRes.ok ? await detailRes.json() : null;
            return { carouselSeries: s, detail };
          } catch {
            return { carouselSeries: s, detail: null };
          }
        })
      );

      return {
        roundNumber: round.roundNumber,
        roundLabel: round.roundLabel,
        series: seriesWithDetail.map(({ carouselSeries, detail }) => ({
          seriesLetter: carouselSeries.seriesLetter,
          round: { number: round.roundNumber },
          matchupTeams: [
            {
              seed: { type: 'unknown', rank: 0, isTop: true },
              team: assembleTeam(carouselSeries.topSeed, detail?.topSeedTeam),
              seriesRecord: {
                wins: carouselSeries.topSeed.wins || 0,
                losses: carouselSeries.bottomSeed.wins || 0,
              },
            },
            {
              seed: { type: 'unknown', rank: 0, isTop: false },
              team: assembleTeam(carouselSeries.bottomSeed, detail?.bottomSeedTeam),
              seriesRecord: {
                wins: carouselSeries.bottomSeed.wins || 0,
                losses: carouselSeries.topSeed.wins || 0,
              },
            },
          ],
          topSeedWins: carouselSeries.topSeed.wins || 0,
          bottomSeedWins: carouselSeries.bottomSeed.wins || 0,
          games: (detail?.games || []).map(mapGame),
        })),
      };
    })
  );

  const hasLiveGames = rounds.some((r) =>
    r.series.some((s) => s.games.some((g) => g.gameState === 'LIVE' || g.gameState === 'CRIT'))
  );

  const bracket: PlayoffBracketResponse = { rounds, seasonId: Number(season) };
  const standingsMap = new Map<string, StandingsTeam>();
  standings.forEach((t) => standingsMap.set(t.teamAbbrev.default, t));
  const cupOdds = buildCupOdds(bracket, standingsMap);

  return { bracket, standings, cupOdds, hasLiveGames };
}
