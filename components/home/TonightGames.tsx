import Link from 'next/link';
import { fetchJsonWithRetry } from '@/lib/fetchWithRetry';
import { fetchMLBScores } from '@/lib/services/mlbApi';

interface TonightGame {
  key: string;
  href: string;
  league: string;
  away: string;
  home: string;
  awayScore?: number;
  homeScore?: number;
  state: 'live' | 'upcoming' | 'final';
  status: string;
  sortMinutes: number;
}

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

  return (
    <section aria-labelledby="tonight-heading" className="flex min-w-0 flex-col gap-2.5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="tonight-heading" className="text-2xl text-white sm:text-3xl" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
          Today&apos;s Games
        </h2>
        <div className="flex gap-4 text-sm font-bold text-blue-300">
          {nhl.length > 0 && <Link href="/nhl/scores" className="hover:text-white">NHL scores</Link>}
          {mlb.length > 0 && <Link href="/mlb/scores" className="hover:text-white">MLB scores</Link>}
        </div>
      </div>
      <ul className="-mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-2 [scrollbar-color:#334155_transparent] [scrollbar-width:thin] sm:mx-0 sm:px-0">
        {games.map((g) => (
          <li key={g.key} className="shrink-0 snap-start">
            <Link
              href={g.href}
              className="flex w-36 flex-col gap-1 rounded-xl border border-slate-700 bg-slate-800/70 p-2.5 transition-colors hover:border-slate-500"
            >
              <span className="flex h-4 items-center justify-between gap-1 whitespace-nowrap text-[11px] leading-none">
                <span className="text-slate-400">{g.league}</span>
                {g.state === 'live' ? (
                  <span className="rounded bg-red-600 px-1.5 py-0.5 font-extrabold text-white">{g.status}</span>
                ) : (
                  <span className="font-bold text-slate-300">{g.status}</span>
                )}
              </span>
              {[{ abbrev: g.away, score: g.awayScore }, { abbrev: g.home, score: g.homeScore }].map((side, i) => (
                <span key={i} className="flex items-center justify-between text-sm font-bold text-white">
                  <span>{i === 0 ? side.abbrev : `@ ${side.abbrev}`}</span>
                  {side.score !== undefined && <span className="tabular-nums">{side.score}</span>}
                </span>
              ))}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
