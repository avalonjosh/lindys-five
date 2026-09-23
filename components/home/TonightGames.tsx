import { fetchJsonWithRetry } from '@/lib/fetchWithRetry';
import { fetchMLBScores } from '@/lib/services/mlbApi';
import TonightGamesList, { type TonightGame } from './TonightGamesList';

function easternToday(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
}

/** "7:05 PM" -> minutes after midnight, for ordering upcoming games. */
function clockMinutes(time?: string): number {
  const m = time?.match(/(\d+):(\d+)\s*(AM|PM)/i);
  if (!m) return 24 * 60;
  const h = (Number(m[1]) % 12) + (m[3].toUpperCase() === 'PM' ? 12 : 0);
  return h * 60 + Number(m[2]);
}

async function nhlGames(today: string): Promise<TonightGame[]> {
  try {
    const data = await fetchJsonWithRetry(`https://api-web.nhle.com/v1/score/${today}`);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (data.games || []).map((g: any): TonightGame => {
      const live = g.gameState === 'LIVE' || g.gameState === 'CRIT';
      const final = g.gameState === 'FINAL' || g.gameState === 'OFF';
      const time = g.startTimeUTC
        ? new Date(g.startTimeUTC).toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit' })
        : undefined;
      return {
        key: `nhl-${g.id}`,
        sport: 'nhl',
        href: `/nhl/scores/${g.id}`,
        league: g.gameType === 1 ? 'NHL pre' : g.gameType === 3 ? 'NHL playoffs' : 'NHL',
        away: g.awayTeam?.abbrev || '',
        home: g.homeTeam?.abbrev || '',
        awayScore: live || final ? g.awayTeam?.score : undefined,
        homeScore: live || final ? g.homeTeam?.score : undefined,
        state: live ? 'live' : final ? 'final' : 'upcoming',
        status: live ? 'LIVE' : final ? 'Final' : time ?? 'TBD',
        sortMinutes: clockMinutes(time),
      };
    });
  } catch {
    return [];
  }
}

async function mlbGames(today: string): Promise<TonightGame[]> {
  try {
    const games = await fetchMLBScores(today);
    return games.map((g): TonightGame => {
      const live = g.gameState === 'In Progress' || g.gameState === 'Warming Up';
      const final = g.gameState === 'Final' || g.gameState === 'Game Over' || g.gameState === 'Completed Early';
      const postponed = g.gameState === 'Postponed';
      return {
        key: `mlb-${g.gameId}`,
        sport: 'mlb',
        href: `/mlb/scores/${g.gameId}`,
        league: 'MLB',
        away: g.awayTeam.abbrev,
        home: g.homeTeam.abbrev,
        awayScore: live || final ? g.awayTeam.score : undefined,
        homeScore: live || final ? g.homeTeam.score : undefined,
        state: live ? 'live' : final ? 'final' : 'upcoming',
        status: live ? (g.inning ? `${g.inningHalf === 'Top' ? 'Top' : 'Bot'} ${g.inning}` : 'LIVE') : final ? 'Final' : postponed ? 'Postponed' : g.startTime ?? 'TBD',
        sortMinutes: clockMinutes(g.startTime),
      };
    });
  } catch {
    return [];
  }
}

const STATE_ORDER = { live: 0, upcoming: 1, final: 2 } as const;

export default async function TonightGames() {
  const today = easternToday();
  const [nhl, mlb] = await Promise.all([nhlGames(today), mlbGames(today)]);
  const games = [...nhl, ...mlb].sort((a, b) => STATE_ORDER[a.state] - STATE_ORDER[b.state] || a.sortMinutes - b.sortMinutes);
  if (games.length === 0) return null;

  return <TonightGamesList games={games} />;
}
