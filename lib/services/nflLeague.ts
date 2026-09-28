import { fetchWithRetry } from './nhlApi';
import {
  blendedRatings,
  simpleRatings,
  simulateSeason,
  NFL_DEFAULT_PARAMS,
  NFL_DIVISION_OF,
  NFL_CONFERENCE_OF,
  type NFLGame,
} from '@/lib/utils/nflOdds';

/**
 * League-wide NFL data from ESPN's weekly scoreboards (all 18 weeks), and the
 * playoff odds computed from it for every team.
 */

const ESPN = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard';

/* eslint-disable @typescript-eslint/no-explicit-any */
async function fetchWeek(season: number, week: number): Promise<NFLGame[]> {
  const res = await fetchWithRetry(`${ESPN}?seasontype=2&week=${week}&dates=${season}`, 2);
  const data = await res.json();
  const out: NFLGame[] = [];
  for (const e of data.events || []) {
    const c = e.competitions?.[0];
    const home = c?.competitors?.find((t: any) => t.homeAway === 'home');
    const away = c?.competitors?.find((t: any) => t.homeAway === 'away');
    if (!home || !away || !NFL_DIVISION_OF.has(home.team.abbreviation) || !NFL_DIVISION_OF.has(away.team.abbreviation)) continue;
    out.push({
      week,
      home: home.team.abbreviation,
      away: away.team.abbreviation,
      homeScore: Number(home.score || 0),
      awayScore: Number(away.score || 0),
      final: c.status?.type?.name === 'STATUS_FINAL',
      neutral: !!c.neutralSite,
    });
  }
  return out;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

const seasonCache = new Map<number, { at: number; games: NFLGame[] }>();

export async function fetchNFLSeasonGames(season: number, maxAgeMs = 10 * 60 * 1000): Promise<NFLGame[]> {
  const hit = seasonCache.get(season);
  if (hit && Date.now() - hit.at < maxAgeMs) return hit.games;
  const weeks = await Promise.all(Array.from({ length: 18 }, (_, i) => fetchWeek(season, i + 1)));
  const games = weeks.flat();
  seasonCache.set(season, { at: Date.now(), games });
  return games;
}

export interface NFLTeamRow {
  abbr: string;
  conference: string;
  division: string;
  wins: number;
  losses: number;
  ties: number;
  pointsFor: number;
  pointsAgainst: number;
  rating: number;
  projWins: number;
  playoff: number;
  divisionOdds: number;
  topSeed: number;
}

export interface NFLOddsTable {
  season: number;
  gamesPlayed: number;
  teams: NFLTeamRow[];
}

/** Odds for all 32 teams (null if the schedule can't be loaded). */
export async function computeNFLOdds(season: number): Promise<NFLOddsTable | null> {
  let games: NFLGame[];
  let prevGames: NFLGame[];
  try {
    [games, prevGames] = await Promise.all([fetchNFLSeasonGames(season), fetchNFLSeasonGames(season - 1, 24 * 60 * 60 * 1000)]);
  } catch {
    return null;
  }
  if (games.length === 0) return null;

  const prior = simpleRatings(prevGames, NFL_DEFAULT_PARAMS.hfa);
  const ratings = blendedRatings(games, prior);
  // Seed on the number of final games so the numbers stay put between renders
  // and only move when a game finishes.
  const finals = games.filter((g) => g.final);
  const odds = simulateSeason(games, ratings, NFL_DEFAULT_PARAMS, 10000, 1000 + finals.length);

  const rec = new Map<string, { w: number; l: number; t: number; pf: number; pa: number }>();
  for (const abbr of NFL_DIVISION_OF.keys()) rec.set(abbr, { w: 0, l: 0, t: 0, pf: 0, pa: 0 });
  for (const g of finals) {
    const h = rec.get(g.home)!;
    const a = rec.get(g.away)!;
    h.pf += g.homeScore; h.pa += g.awayScore;
    a.pf += g.awayScore; a.pa += g.homeScore;
    if (g.homeScore > g.awayScore) { h.w++; a.l++; }
    else if (g.awayScore > g.homeScore) { a.w++; h.l++; }
    else { h.t++; a.t++; }
  }

  const teams: NFLTeamRow[] = [...NFL_DIVISION_OF.keys()].map((abbr) => {
    const r = rec.get(abbr)!;
    const o = odds.get(abbr)!;
    return {
      abbr,
      conference: NFL_CONFERENCE_OF(abbr),
      division: NFL_DIVISION_OF.get(abbr)!,
      wins: r.w,
      losses: r.l,
      ties: r.t,
      pointsFor: r.pf,
      pointsAgainst: r.pa,
      rating: ratings.get(abbr) || 0,
      projWins: o.projWins,
      playoff: o.playoff,
      divisionOdds: o.division,
      topSeed: o.topSeed,
    };
  });
  teams.sort((a, b) => b.playoff - a.playoff || b.projWins - a.projWins);
  return { season, gamesPlayed: finals.length, teams };
}

/** "96%", "<1%", ">99%" for display. */
export function formatNFLOdds(p: number): string {
  if (p >= 99.5 && p < 100) return '>99%';
  if (p > 0 && p < 0.5) return '<1%';
  return `${Math.round(p)}%`;
}
