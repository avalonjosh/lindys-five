import { fetchWithRetry } from '@/lib/services/nhlApi';
import { TEAMS } from '@/lib/teamConfig';
import type { StandingsTeam } from '@/lib/types/boxscore';
import { nextNHLSeason, formatSeasonLabel } from '@/lib/utils/season';

// Offseason data helpers for league-wide NHL pages (playoff odds, bracket).
//
// In the offseason the NHL API behaves awkwardly: `standings/now` returns an
// empty body and `playoff-bracket/{season}` 404s. The reliable sources are the
// playoff carousel (`playoff-series/carousel/{season}`) for the bracket outcome
// and `standings/{date}` for a specific in-season date.

const NHL_API = 'https://api-web.nhle.com/v1';

function teamFullName(abbrev: string): string {
  const team = Object.values(TEAMS).find((t) => t.abbreviation === abbrev);
  return team ? `${team.city} ${team.name}` : abbrev;
}

function teamSlug(abbrev: string): string | null {
  const team = Object.values(TEAMS).find((t) => t.abbreviation === abbrev);
  return team?.slug ?? null;
}

export interface PlayoffsOutcome {
  // True once the Stanley Cup Final has a winner (season fully over).
  complete: boolean;
  championAbbrev?: string;
  championName?: string;
  championSlug?: string;
  championLogo?: string;
  runnerUpName?: string;
}

interface CarouselSide {
  abbrev: string;
  wins: number;
  logo?: string;
}
interface CarouselSeries {
  roundNumber: number;
  neededToWin: number;
  topSeed: CarouselSide;
  bottomSeed: CarouselSide;
}
interface CarouselRound {
  roundNumber: number;
  series: CarouselSeries[];
}

// Detects whether the playoffs are over and who won, from the carousel only
// (one request). Returns { complete: false } when the season isn't finished or
// data is unavailable.
export async function getPlayoffsOutcome(season: string): Promise<PlayoffsOutcome> {
  try {
    const res = await fetchWithRetry(`${NHL_API}/playoff-series/carousel/${season}`, 1);
    if (!res.ok) return { complete: false };
    const data = await res.json();
    const rounds: CarouselRound[] = data.rounds || [];
    const finalRound = rounds.find((r) => r.roundNumber === 4);
    const finalSeries = finalRound?.series?.[0];
    if (!finalSeries) return { complete: false };

    const need = finalSeries.neededToWin || 4;
    const { topSeed, bottomSeed } = finalSeries;
    let winner: CarouselSide | undefined;
    let loser: CarouselSide | undefined;
    if ((topSeed?.wins || 0) >= need) {
      winner = topSeed;
      loser = bottomSeed;
    } else if ((bottomSeed?.wins || 0) >= need) {
      winner = bottomSeed;
      loser = topSeed;
    }
    if (!winner) return { complete: false };

    return {
      complete: true,
      championAbbrev: winner.abbrev,
      championName: teamFullName(winner.abbrev),
      championSlug: teamSlug(winner.abbrev) ?? undefined,
      championLogo: winner.logo,
      runnerUpName: loser ? teamFullName(loser.abbrev) : undefined,
    };
  } catch {
    return { complete: false };
  }
}

export interface UpcomingSeasonInfo {
  // True once the upcoming season's schedule has been published.
  scheduled: boolean;
  season: string;
  seasonLabel: string;
  openingDate?: string; // YYYY-MM-DD — league-wide regular-season opening night
  endDate?: string; // YYYY-MM-DD — regular-season finale
}

// The upcoming season's opening night, once its schedule is posted. In the
// offseason `schedule/now` is empty, so we probe a fixed in-season date (Oct 1 of
// the season's start year) and read the league `regularSeasonStartDate` off the
// response. Returns { scheduled: false } until the schedule exists.
export async function getUpcomingSeasonInfo(currentSeason: string): Promise<UpcomingSeasonInfo> {
  const season = nextNHLSeason(currentSeason);
  const startYear = season.slice(0, 4);
  const base: UpcomingSeasonInfo = {
    scheduled: false,
    season,
    seasonLabel: formatSeasonLabel(season),
  };
  try {
    const res = await fetchWithRetry(`${NHL_API}/schedule/${startYear}-10-01`, 1);
    if (!res.ok) return base;
    const data = await res.json();
    const openingDate: string | undefined = data.regularSeasonStartDate;
    if (!openingDate) return base;
    return {
      ...base,
      scheduled: true,
      openingDate,
      endDate: data.regularSeasonEndDate,
    };
  } catch {
    return base;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function maxRegularSeasonDate(games: any[]): string {
  let last = '';
  for (const g of games) {
    if (g.gameType === 2 && (g.gameState === 'FINAL' || g.gameState === 'OFF') && g.gameDate > last) {
      last = g.gameDate;
    }
  }
  return last;
}

// Final regular-season standings (all 32 teams). `standings/now` is empty in the
// offseason, so we derive the last regular-season date from a team's schedule
// and query `standings/{date}`. Returns [] on failure.
export async function getFinalStandings(season: string): Promise<StandingsTeam[]> {
  try {
    // BUF is a stable reference team; any team's last regular-season date works.
    const schedRes = await fetchWithRetry(
      `${NHL_API}/club-schedule-season/BUF/${season}`,
      1
    );
    const schedData = await schedRes.json();
    const lastRegDate = maxRegularSeasonDate(schedData.games || []);
    if (!lastRegDate) return [];

    const stRes = await fetchWithRetry(`${NHL_API}/standings/${lastRegDate}`, 1);
    if (!stRes.ok) return [];
    const stData = await stRes.json();
    return stData.standings || [];
  } catch {
    return [];
  }
}
