import { fetchWithRetry } from './nhlApi';
import { fetchMLBStandings, fetchSeasonSeries } from './mlbApi';
import { MLB_TEAMS, type MLBTeamConfig } from '@/lib/teamConfig';
import { generateGameTicketLink, generateTeamTicketsLink } from '@/lib/utils/affiliateLinks';
import { mlbWatchInfo, type MLBBroadcast } from '@/lib/watch/mlbWatch';
import { bracketDistribution, homePattern, teamStrength, type BracketNode } from '@/lib/utils/mlbPostseasonOdds';
import type { MLBStandingsTeam } from '@/lib/types/mlb';

/**
 * A team's postseason from the MLB Stats API (game types F/D/L/W), with series
 * and World Series odds from the bracket model in lib/utils/mlbPostseasonOdds.
 * Null when the team isn't in the postseason.
 */

export type PostseasonRound = 'F' | 'D' | 'L' | 'W';

export interface PostseasonGame {
  gamePk: number;
  gameNumber: number;
  when: string;
  dateShort: string;
  timeShort: string;
  isHome: boolean;
  state: 'final' | 'live' | 'upcoming';
  teamScore?: number;
  oppScore?: number;
  liveInning?: string;
  inning?: number;
  inningHalf?: 'Top' | 'Bot';
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
  oppId: number | null;
  oppLogo?: string;
  /** "BOS", or "NYY/BOS" while the opponent is undecided. */
  oppAbbrev: string;
  /** One logo, or each possible opponent's while undecided. */
  oppLogos: string[];
  bestOf: number;
  teamWins: number;
  oppWins: number;
  state: 'upcoming' | 'leads' | 'trails' | 'tied' | 'won' | 'lost';
  /** Team's chance to win this series (0-100), null when not computable. */
  winOdds: number | null;
  /** Regular-season head-to-head vs this opponent, e.g. "4-2". */
  h2h: string | null;
  games: PostseasonGame[];
}

export interface MLBPostseason {
  series: PostseasonSeries[];
  eliminated: boolean;
  champion: boolean;
  wins: number;
  /** Wins needed for a title from where the team started (13 via Wild Card, 11 with a bye). */
  winsNeeded: number;
  /** World Series odds (0-100) and rank among teams still alive. */
  wsOdds: number | null;
  wsRank: { rank: number; total: number } | null;
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
const logoFor = (id: number) => `https://www.mlbstatic.com/team-logos/${id}.svg`;

/** "NYY/BOS" placeholders (side not decided yet) read as "Yankees/Red Sox". */
function opponentLabel(team: { id: number; name: string; teamName?: string }): string {
  const known = MLB_ID_TO_TEAM.get(team.id);
  if (known) return known.name;
  const parts = team.name.split('/');
  if (parts.length > 1 && parts.every((p) => BY_ABBREV.has(p.trim()))) {
    return parts.map((p) => BY_ABBREV.get(p.trim())!.name).join('/');
  }
  return team.teamName || team.name;
}

const et = (iso: string, opts: Intl.DateTimeFormatOptions) => new Date(iso).toLocaleString('en-US', { timeZone: 'America/New_York', ...opts });

/* eslint-disable @typescript-eslint/no-explicit-any */

// League-wide postseason schedule, shared by every team page in a render.
let leagueCache: { season: number; at: number; games: any[] } | null = null;
async function fetchLeaguePostseason(season: number): Promise<any[]> {
  if (leagueCache && leagueCache.season === season && Date.now() - leagueCache.at < 60_000) return leagueCache.games;
  const res = await fetchWithRetry(
    `https://statsapi.mlb.com/api/v1/schedule?sportId=1&season=${season}&gameType=F,D,L,W&hydrate=broadcasts(all),team,linescore`,
    2,
  );
  const data = await res.json();
  const games = (data.dates || []).flatMap((d: any) => d.games);
  leagueCache = { season, at: Date.now(), games };
  return games;
}

interface LeagueSeries {
  key: string;
  desc: string;
  round: PostseasonRound;
  league: 'AL' | 'NL' | 'WS';
  bestOf: number;
  games: any[];
  hostId: number;
  visitorId: number;
  hostReal: boolean;
  visitorReal: boolean;
  visitorAbbrev: string;
  aWins: number;
  bWins: number;
}

function groupSeries(games: any[], realIds: Set<number>): LeagueSeries[] {
  const map = new Map<string, any[]>();
  for (const g of games) {
    const ids = [g.teams.home.team.id, g.teams.away.team.id].sort((x: number, y: number) => x - y).join('-');
    const key = `${g.seriesDescription}|${ids}`;
    map.set(key, [...(map.get(key) || []), g]);
  }
  return [...map.entries()].map(([key, list]) => {
    list.sort((x, y) => (x.seriesGameNumber || 0) - (y.seriesGameNumber || 0));
    const g1 = list[0];
    const round = g1.gameType as PostseasonRound;
    const hostId = g1.teams.home.team.id;
    const visitorId = g1.teams.away.team.id;
    let aWins = 0;
    let bWins = 0;
    for (const g of list) {
      if (g.status?.abstractGameState !== 'Final') continue;
      const hostSide = g.teams.home.team.id === hostId ? g.teams.home : g.teams.away;
      if (hostSide.isWinner) aWins++; else bWins++;
    }
    const desc: string = g1.seriesDescription;
    return {
      key,
      desc,
      round,
      league: desc.startsWith('AL') ? 'AL' : desc.startsWith('NL') ? 'NL' : 'WS',
      bestOf: g1.gamesInSeries || (round === 'F' ? 3 : round === 'D' ? 5 : 7),
      games: list,
      hostId,
      visitorId,
      hostReal: realIds.has(hostId),
      visitorReal: realIds.has(visitorId),
      visitorAbbrev: g1.teams.away.team.abbreviation || g1.teams.away.team.name || '',
      aWins,
      bWins,
    } as LeagueSeries;
  });
}

/** Bracket nodes for every series, keyed by series key (plus the World Series root). */
function buildBracket(series: LeagueSeries[]): { nodes: Map<string, BracketNode>; root: BracketNode | null } {
  const nodes = new Map<string, BracketNode>();
  const seriesNode = (s: LeagueSeries, a: BracketNode, b: BracketNode, fixedHostId?: number): BracketNode => {
    const both = s.hostReal && s.visitorReal;
    const std = homePattern(s.bestOf);
    const aHomeByGame = std.map((h, i) => (s.games[i] ? s.games[i].teams.home.team.id === s.hostId : h));
    return {
      kind: 'series',
      key: s.key,
      bestOf: s.bestOf,
      a,
      b,
      fixedHostId,
      state: both ? { teamA: s.hostId, teamB: s.visitorId, aWins: s.aWins, bWins: s.bWins, aHomeByGame } : undefined,
    };
  };
  const teamNode = (id: number): BracketNode => ({ kind: 'team', id });
  const contains = (node: BracketNode, id: number): boolean =>
    node.kind === 'team' ? node.id === id : contains(node.a, id) || contains(node.b, id);

  const leagueChamp: Partial<Record<'AL' | 'NL', BracketNode>> = {};
  for (const league of ['AL', 'NL'] as const) {
    const wc = series.filter((s) => s.league === league && s.round === 'F').map((s) => {
      const n = seriesNode(s, teamNode(s.hostId), teamNode(s.visitorId));
      nodes.set(s.key, n);
      return { s, n };
    });
    const ds = series.filter((s) => s.league === league && s.round === 'D').map((s) => {
      // The bye team hosts; its opponent is a Wild Card winner (placeholder "HOU/CWS" until decided).
      const host = s.hostReal ? s.hostId : s.visitorId;
      const otherId = s.hostReal ? s.visitorId : s.hostId;
      const otherReal = s.hostReal ? s.visitorReal : s.hostReal;
      const abbrevs = s.visitorAbbrev.split('/').map((x) => x.trim());
      const feeder = wc.find(({ n }) => (otherReal ? contains(n, otherId) : abbrevs.every((ab) => {
        const cfg = BY_ABBREV.get(ab);
        return cfg ? contains(n, cfg.mlbId) : false;
      })));
      const other = feeder ? feeder.n : otherReal ? teamNode(otherId) : null;
      if (!other) return null;
      const n = seriesNode(s, teamNode(host), other, host);
      nodes.set(s.key, n);
      return n;
    }).filter((n): n is BracketNode => n !== null);
    const lcs = series.find((s) => s.league === league && s.round === 'L');
    if (ds.length === 2) {
      const n = lcs
        ? seriesNode(lcs, ds[0], ds[1])
        : { kind: 'series' as const, key: `${league}-LCS`, bestOf: 7, a: ds[0], b: ds[1] };
      if (lcs) nodes.set(lcs.key, n);
      leagueChamp[league] = n;
    }
  }
  const ws = series.find((s) => s.round === 'W');
  let root: BracketNode | null = null;
  if (leagueChamp.AL && leagueChamp.NL) {
    root = ws ? seriesNode(ws, leagueChamp.AL, leagueChamp.NL) : { kind: 'series', key: 'WS', bestOf: 7, a: leagueChamp.AL, b: leagueChamp.NL };
    if (ws) nodes.set(ws.key, root);
  }
  return { nodes, root };
}

export async function fetchMLBPostseason(team: MLBTeamConfig, season: number): Promise<MLBPostseason | null> {
  let games: any[];
  let standings: MLBStandingsTeam[];
  try {
    [games, standings] = await Promise.all([fetchLeaguePostseason(season), fetchMLBStandings(season)]);
  } catch {
    return null;
  }
  const mine = games.filter((g) => g.teams.home.team.id === team.mlbId || g.teams.away.team.id === team.mlbId);
  if (mine.length === 0) return null;

  const strengthById = new Map(standings.map((t) => [t.teamId, teamStrength(t)]));
  const strength = (id: number) => strengthById.get(id) ?? 0.5;
  const realIds = new Set(standings.map((t) => t.teamId));
  const allSeries = groupSeries(games, realIds);
  const { nodes, root } = buildBracket(allSeries);
  const cache = new Map<string, Map<number, number>>();
  const dist = (n: BracketNode) => bracketDistribution(n, strength, cache);

  const mySeries = allSeries
    .filter((s) => s.hostId === team.mlbId || s.visitorId === team.mlbId)
    .sort((a, b) => ROUND_ORDER.indexOf(a.round) - ROUND_ORDER.indexOf(b.round));

  const series: PostseasonSeries[] = await Promise.all(mySeries.map(async (s) => {
    const iAmHost = s.hostId === team.mlbId;
    const oppId = iAmHost ? s.visitorId : s.hostId;
    const oppReal = realIds.has(oppId);
    const g1 = s.games[0];
    const oppTeam = g1.teams.home.team.id === oppId ? g1.teams.home.team : g1.teams.away.team;
    const need = Math.ceil(s.bestOf / 2);
    const teamWins = iAmHost ? s.aWins : s.bWins;
    const oppWins = iAmHost ? s.bWins : s.aWins;

    const out: PostseasonGame[] = s.games.map((g) => {
      const isHome = g.teams.home.team.id === team.mlbId;
      const me = isHome ? g.teams.home : g.teams.away;
      const them = isHome ? g.teams.away : g.teams.home;
      const abstract = g.status?.abstractGameState;
      const state: PostseasonGame['state'] = abstract === 'Final' ? 'final' : abstract === 'Live' ? 'live' : 'upcoming';
      const tbd = !!g.status?.startTimeTBD;
      const homeCfg = MLB_ID_TO_TEAM.get(g.teams.home.team.id);
      const awayCfg = MLB_ID_TO_TEAM.get(g.teams.away.team.id);
      // Opponent still undecided: send home games to the team's ticket page.
      const ticketLink = state === 'final' || !homeCfg
        ? undefined
        : awayCfg
          ? generateGameTicketLink(homeCfg.slug, homeCfg.city, homeCfg.stubhubId, homeCfg.abbreviation, awayCfg.abbreviation, g.gameDate, 'mlb')
          : generateTeamTicketsLink(homeCfg.slug, homeCfg.city, homeCfg.stubhubId);
      const broadcasts: MLBBroadcast[] = g.broadcasts || [];
      const ls = g.linescore;
      const date = et(g.gameDate, { weekday: 'short', month: 'short', day: 'numeric' });
      const time = tbd ? 'Time TBA' : `${et(g.gameDate, { hour: 'numeric', minute: '2-digit' })} ET`;
      return {
        gamePk: g.gamePk,
        gameNumber: g.seriesGameNumber || 0,
        when: `${date} · ${time}`,
        dateShort: date,
        timeShort: time,
        isHome,
        state,
        teamScore: state === 'upcoming' ? undefined : me.score,
        oppScore: state === 'upcoming' ? undefined : them.score,
        liveInning: state === 'live' && ls ? `${ls.isTopInning ? 'Top' : 'Bot'} ${ls.currentInning}` : undefined,
        inning: state === 'live' ? ls?.currentInning : undefined,
        inningHalf: state === 'live' && ls ? (ls.isTopInning ? 'Top' : 'Bot') : undefined,
        ifNecessary: g.ifNecessary === 'Y',
        tv: mlbWatchInfo(broadcasts).info.national.map((n) => n.name).join(', ') || undefined,
        ticketLink,
        broadcasts,
      };
    });

    let state: PostseasonSeries['state'];
    if (teamWins >= need) state = 'won';
    else if (oppWins >= need) state = 'lost';
    else if (teamWins === 0 && oppWins === 0) state = out.some((g) => g.state !== 'upcoming') ? 'tied' : 'upcoming';
    else state = teamWins > oppWins ? 'leads' : teamWins < oppWins ? 'trails' : 'tied';

    let winOdds: number | null = null;
    if (state === 'won') winOdds = 100;
    else if (state === 'lost') winOdds = 0;
    else {
      const node = nodes.get(s.key);
      if (node && node.kind === 'series') {
        const side = dist(node.a).has(team.mlbId) ? node.a : node.b;
        const reach = dist(side).get(team.mlbId) || 0;
        if (reach > 0) winOdds = Math.round((100 * (dist(node).get(team.mlbId) || 0)) / reach);
      }
    }

    let h2h: string | null = null;
    if (oppReal) {
      try {
        const rec = await fetchSeasonSeries(team.mlbId, oppId, season);
        if (rec.wins + rec.losses > 0) h2h = `${rec.wins}-${rec.losses}`;
      } catch {
        /* optional */
      }
    }

    // Once a series is decided, drop the unplayed "if necessary" games.
    const gamesShown = state === 'won' || state === 'lost' ? out.filter((g) => g.state !== 'upcoming') : out;
    return {
      round: s.round,
      name: s.desc,
      short: SHORT[s.desc] || s.desc,
      oppName: opponentLabel(oppTeam),
      oppId: oppReal ? oppId : null,
      oppLogo: oppReal ? logoFor(oppId) : undefined,
      oppAbbrev: oppReal ? MLB_ID_TO_TEAM.get(oppId)?.abbreviation ?? oppTeam.abbreviation ?? '' : oppTeam.abbreviation || oppTeam.name,
      oppLogos: oppReal
        ? [logoFor(oppId)]
        : String(oppTeam.abbreviation || oppTeam.name).split('/').map((ab: string) => BY_ABBREV.get(ab.trim())).filter(Boolean).map((t) => logoFor(t!.mlbId)),
      bestOf: s.bestOf,
      teamWins,
      oppWins,
      state,
      winOdds,
      h2h,
      games: gamesShown,
    };
  }));

  const last = series[series.length - 1];
  const eliminated = last.state === 'lost';
  const wins = series.reduce((sum, s) => sum + s.teamWins, 0);
  const winsNeeded = series.some((s) => s.round === 'F') ? 13 : 11;

  let wsOdds: number | null = null;
  let wsRank: MLBPostseason['wsRank'] = null;
  if (root) {
    const champ = dist(root);
    wsOdds = eliminated ? 0 : Math.round(100 * (champ.get(team.mlbId) || 0));
    const alive = [...champ.entries()].filter(([, p]) => p > 0).sort((a, b) => b[1] - a[1]);
    const idx = alive.findIndex(([id]) => id === team.mlbId);
    if (idx >= 0 && !eliminated) wsRank = { rank: idx + 1, total: alive.length };
  }

  return {
    series,
    eliminated,
    champion: last.round === 'W' && last.state === 'won',
    wins,
    winsNeeded,
    wsOdds,
    wsRank,
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
