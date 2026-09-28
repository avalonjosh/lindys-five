import { fetchWithRetry } from './nhlApi';
import { MLB_TEAMS, type MLBTeamConfig } from '@/lib/teamConfig';
import { generateGameTicketLink, generateTeamTicketsLink } from '@/lib/utils/affiliateLinks';
import { mlbWatchInfo, type MLBBroadcast } from '@/lib/watch/mlbWatch';

/**
 * A team's postseason from the MLB Stats API (game types F/D/L/W): each series
 * it has played or is scheduled for, with results, TV and ticket links. Empty
 * when the team isn't in the postseason.
 */

export type PostseasonRound = 'F' | 'D' | 'L' | 'W';

export interface PostseasonGame {
  gamePk: number;
  gameNumber: number;
  when: string;
  isHome: boolean;
  state: 'final' | 'live' | 'upcoming';
  teamScore?: number;
  oppScore?: number;
  ifNecessary: boolean;
  tv?: string;
  ticketLink?: string;
  broadcasts: MLBBroadcast[];
}

export interface PostseasonSeries {
  round: PostseasonRound;
  name: string;
  short: string;
  oppName: string;
  bestOf: number;
  teamWins: number;
  oppWins: number;
  state: 'upcoming' | 'leads' | 'trails' | 'tied' | 'won' | 'lost';
  games: PostseasonGame[];
}

export interface MLBPostseason {
  series: PostseasonSeries[];
  eliminated: boolean;
  champion: boolean;
}

const ROUND_ORDER: PostseasonRound[] = ['F', 'D', 'L', 'W'];
const SHORT: Record<string, string> = {
  'AL Wild Card Series': 'AL Wild Card',
  'NL Wild Card Series': 'NL Wild Card',
  'AL Division Series': 'ALDS',
  'NL Division Series': 'NLDS',
  'AL Championship Series': 'ALCS',
  'NL Championship Series': 'NLCS',
  'World Series': 'World Series',
};

const BY_ABBREV = new Map(Object.values(MLB_TEAMS).map((t) => [t.abbreviation, t]));
const MLB_ID_TO_TEAM = new Map(Object.values(MLB_TEAMS).map((t) => [t.mlbId, t]));

/** "NYY/BOS" placeholders (series not decided yet) read as "Yankees/Red Sox". */
function opponentLabel(team: { id: number; name: string; teamName?: string }): string {
  const known = MLB_ID_TO_TEAM.get(team.id);
  if (known) return known.name;
  const parts = team.name.split('/');
  if (parts.length > 1 && parts.every((p) => BY_ABBREV.has(p.trim()))) {
    return parts.map((p) => BY_ABBREV.get(p.trim())!.name).join('/');
  }
  return team.teamName || team.name;
}

function whenLabel(iso: string, tbd: boolean): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString('en-US', { timeZone: 'America/New_York', weekday: 'short', month: 'short', day: 'numeric' });
  if (tbd) return `${date} · Time TBA`;
  const time = d.toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit' });
  return `${date} · ${time} ET`;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export async function fetchMLBPostseason(team: MLBTeamConfig, season: number): Promise<MLBPostseason | null> {
  let games: any[] = [];
  try {
    const res = await fetchWithRetry(
      `https://statsapi.mlb.com/api/v1/schedule?sportId=1&teamId=${team.mlbId}&season=${season}&gameType=F,D,L,W&hydrate=broadcasts(all),team`,
      2,
    );
    const data = await res.json();
    games = (data.dates || []).flatMap((d: any) => d.games);
  } catch {
    return null;
  }
  if (games.length === 0) return null;

  const bySeries = new Map<string, any[]>();
  for (const g of games) bySeries.set(g.seriesDescription, [...(bySeries.get(g.seriesDescription) || []), g]);

  const series: PostseasonSeries[] = [...bySeries.entries()].map(([name, list]) => {
    list.sort((a, b) => (a.seriesGameNumber || 0) - (b.seriesGameNumber || 0));
    const first = list[0];
    const round = first.gameType as PostseasonRound;
    const bestOf = first.gamesInSeries || (round === 'F' ? 3 : round === 'D' ? 5 : 7);
    const need = Math.ceil(bestOf / 2);
    const firstIsHome = first.teams.home.team.id === team.mlbId;
    const oppName = opponentLabel(firstIsHome ? first.teams.away.team : first.teams.home.team);

    let teamWins = 0;
    let oppWins = 0;
    const out: PostseasonGame[] = list.map((g) => {
      const isHome = g.teams.home.team.id === team.mlbId;
      const mine = isHome ? g.teams.home : g.teams.away;
      const theirs = isHome ? g.teams.away : g.teams.home;
      const status = g.status?.abstractGameState;
      const state: PostseasonGame['state'] = status === 'Final' ? 'final' : status === 'Live' ? 'live' : 'upcoming';
      if (state === 'final') {
        if (mine.isWinner) teamWins++;
        else if (theirs.isWinner) oppWins++;
      }
      const homeCfg = MLB_ID_TO_TEAM.get(g.teams.home.team.id);
      const awayCfg = MLB_ID_TO_TEAM.get(g.teams.away.team.id);
      // Opponent still undecided: send home games to the team's ticket page.
      const ticketLink = state === 'final' || !homeCfg
        ? undefined
        : awayCfg
          ? generateGameTicketLink(homeCfg.slug, homeCfg.city, homeCfg.stubhubId, homeCfg.abbreviation, awayCfg.abbreviation, g.gameDate, 'mlb')
          : generateTeamTicketsLink(homeCfg.slug, homeCfg.city, homeCfg.stubhubId);
      const broadcasts: MLBBroadcast[] = g.broadcasts || [];
      const tv = mlbWatchInfo(broadcasts).info.national.map((n) => n.name).join(', ') || undefined;
      return {
        gamePk: g.gamePk,
        gameNumber: g.seriesGameNumber || 0,
        when: whenLabel(g.gameDate, !!g.status?.startTimeTBD),
        isHome,
        state,
        teamScore: state === 'upcoming' ? undefined : mine.score,
        oppScore: state === 'upcoming' ? undefined : theirs.score,
        ifNecessary: g.ifNecessary === 'Y',
        tv,
        ticketLink,
        broadcasts,
      };
    });

    let state: PostseasonSeries['state'];
    if (teamWins >= need) state = 'won';
    else if (oppWins >= need) state = 'lost';
    else if (teamWins === 0 && oppWins === 0) state = out.some((g) => g.state !== 'upcoming') ? 'tied' : 'upcoming';
    else state = teamWins > oppWins ? 'leads' : teamWins < oppWins ? 'trails' : 'tied';

    // Once a series is decided, drop the unplayed "if necessary" games.
    const games = state === 'won' || state === 'lost' ? out.filter((g) => g.state !== 'upcoming') : out;
    return { round, name, short: SHORT[name] || name, oppName, bestOf, teamWins, oppWins, state, games };
  });

  series.sort((a, b) => ROUND_ORDER.indexOf(a.round) - ROUND_ORDER.indexOf(b.round));
  const last = series[series.length - 1];
  return {
    series,
    eliminated: last.state === 'lost',
    champion: last.round === 'W' && last.state === 'won',
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/** "Rays lead ALDS 1-0", "Rays won the Wild Card 2-1", "Season over: lost the ALDS 3-1". */
export function seriesHeadline(teamName: string, s: PostseasonSeries): string {
  const score = `${Math.max(s.teamWins, s.oppWins)}-${Math.min(s.teamWins, s.oppWins)}`;
  switch (s.state) {
    case 'upcoming': return `${s.short} vs ${s.oppName}`;
    case 'leads': return `${teamName} lead ${s.short} ${score}`;
    case 'trails': return `${teamName} trail ${s.short} ${score}`;
    case 'tied': return `${s.short} tied ${s.teamWins}-${s.oppWins}`;
    case 'won': return s.round === 'W' ? `World Series champions! Won ${score}` : `${teamName} won the ${s.short} ${score}`;
    case 'lost': return `Season over: lost the ${s.short} ${score}`;
  }
}
