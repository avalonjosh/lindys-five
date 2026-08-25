/**
 * Server-side data for the NHL team pages (direct NHL API, not the /api/v1
 * proxy, which robots.txt blocks for crawlers). Everything here feeds the
 * server-rendered HTML: the schedule seeds TeamTracker so the full season is
 * in the initial response, and the standings power the visible summary and
 * division table.
 */
import { fetchWithRetry } from '@/lib/services/nhlApi';
import type { TeamConfig } from '@/lib/teamConfig';
import type { GameResult } from '@/lib/types';
import type { StandingsTeam } from '@/lib/types/boxscore';

const NHL_API = 'https://api-web.nhle.com/v1';

/** Regular-season schedule mapped to the tracker's GameResult shape. */
export async function fetchTeamScheduleServer(team: TeamConfig, season: string): Promise<GameResult[]> {
  const res = await fetchWithRetry(`${NHL_API}/club-schedule-season/${team.abbreviation}/${season}`, 1);
  const data = await res.json();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const regularGames = (data.games || []).filter((g: any) => g.gameType === 2);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return regularGames.map((game: any): GameResult => {
    const isHome = game.homeTeam.id === team.nhlId;
    const myTeam = isHome ? game.homeTeam : game.awayTeam;
    const oppTeam = isHome ? game.awayTeam : game.homeTeam;
    let outcome: GameResult['outcome'] = 'PENDING';
    let points = 0;
    if (game.gameState === 'FINAL' || game.gameState === 'OFF') {
      const won = myTeam.score > oppTeam.score;
      const ot = game.gameOutcome?.lastPeriodType === 'OT' || game.gameOutcome?.lastPeriodType === 'SO';
      if (won) { outcome = 'W'; points = 2; }
      else if (ot) { outcome = 'OTL'; points = 1; }
      else { outcome = 'L'; points = 0; }
    }
    const date = new Date(game.gameDate + 'T00:00:00-05:00').toLocaleDateString('en-US', {
      timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit',
    });
    const startTime = game.startTimeUTC
      ? new Date(game.startTimeUTC).toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit', hour12: true })
      : undefined;
    return {
      date, startTime, opponent: oppTeam.abbrev, opponentLogo: oppTeam.logo || '',
      isHome, sabresScore: myTeam.score || 0, opponentScore: oppTeam.score || 0,
      outcome, points, gameState: game.gameState, gameId: game.id,
    };
  });
}

/** League standings for a date (YYYY-MM-DD). Empty in the offseason. */
export async function fetchStandingsServer(date: string): Promise<StandingsTeam[]> {
  const res = await fetchWithRetry(`${NHL_API}/standings/${date}`, 1);
  const data = await res.json();
  return data.standings || [];
}

export const ordinal = (n: number): string => {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

export const possessive = (name: string): string => (name.endsWith('s') ? `${name}'` : `${name}'s`);
