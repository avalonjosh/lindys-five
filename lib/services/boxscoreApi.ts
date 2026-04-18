import { fetchWithRetry, isRateLimitError } from './nhlApi';
import type {
  BoxscoreResponse,
  LandingResponse,
  StandingsTeam,
  RightRailResponse,
  SkaterComparison,
  GoalieComparison,
  TeamSeasonStats,
  Last10Record,
  SeasonSeriesGame,
} from '../types/boxscore';

const API_BASE = '/api/v1';

export interface SeriesHubGame {
  id: number;
  gameNumber: number;
  gameDate?: string;
  gameState: string;
  gameScheduleState?: string;
  startTimeUTC?: string;
  ifNecessary?: boolean;
  homeTeam: { id: number; abbrev: string; logo?: string; score?: number };
  awayTeam: { id: number; abbrev: string; logo?: string; score?: number };
  venue?: { default: string };
  gameOutcome?: { lastPeriodType: string };
}

export interface SeriesHubData {
  seriesLetter: string;
  roundLabel: string;
  neededToWin: number;
  topSeed: { id: number; abbrev: string; name: string; logo: string; wins: number; points?: number };
  bottomSeed: { id: number; abbrev: string; name: string; logo: string; wins: number; points?: number };
  games: SeriesHubGame[];
  currentGameNumber?: number;
}

export interface PlayoffPreGameContext {
  skaterComparison: SkaterComparison | null;
  goalieComparison: GoalieComparison | null;
  teamSeasonStats: { awayTeam: TeamSeasonStats; homeTeam: TeamSeasonStats } | null;
  last10Record: { awayTeam: Last10Record; homeTeam: Last10Record } | null;
  seasonSeries: SeasonSeriesGame[];
}

export async function fetchBoxScoreData(gameId: string, signal?: AbortSignal): Promise<{
  boxscore: BoxscoreResponse;
  landing: LandingResponse;
}> {
  const [boxscoreRes, landingRes] = await Promise.all([
    fetchWithRetry(`${API_BASE}/gamecenter/${gameId}/boxscore`, 3, signal),
    fetchWithRetry(`${API_BASE}/gamecenter/${gameId}/landing`, 3, signal),
  ]);

  const [boxscore, landing] = await Promise.all([
    boxscoreRes.json(),
    landingRes.json(),
  ]);

  return { boxscore, landing };
}

export async function fetchRightRail(gameId: string, signal?: AbortSignal): Promise<RightRailResponse | null> {
  try {
    const response = await fetch(`${API_BASE}/gamecenter/${gameId}/right-rail`, { signal });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

// --- Series Hub data ---
// NHL's /playoff-bracket endpoint is unreliable (often 404). Use the carousel + per-series endpoints instead.
export async function fetchPlayoffSeriesHub(
  homeAbbrev: string,
  awayAbbrev: string,
  season: string,
  standings: StandingsTeam[],
  currentGameId: string
): Promise<SeriesHubData | null> {
  try {
    const carouselRes = await fetch(`${API_BASE}/playoff-series/carousel/${season}`);
    if (!carouselRes.ok) return null;
    const carousel = await carouselRes.json();
    interface CarouselSeed { id: number; abbrev: string; wins: number; logo: string }
    interface CarouselSeries { seriesLetter: string; roundNumber: number; seriesLabel: string; neededToWin: number; topSeed: CarouselSeed; bottomSeed: CarouselSeed }
    interface CarouselRound { roundNumber: number; roundLabel: string; series: CarouselSeries[] }
    const rounds: CarouselRound[] = carousel.rounds || [];
    let match: { series: CarouselSeries; round: CarouselRound } | null = null;
    for (const round of rounds) {
      for (const s of round.series || []) {
        const abbrevs = [s.topSeed?.abbrev, s.bottomSeed?.abbrev];
        if (abbrevs.includes(homeAbbrev) && abbrevs.includes(awayAbbrev)) {
          match = { series: s, round };
          break;
        }
      }
      if (match) break;
    }
    if (!match) return null;

    const { series, round } = match;
    const detailRes = await fetch(`${API_BASE}/schedule/playoff-series/${season}/${series.seriesLetter.toLowerCase()}`);
    if (!detailRes.ok) return null;
    const detail = await detailRes.json();
    interface DetailGame {
      id: number;
      gameNumber: number;
      gameDate?: string;
      gameState: string;
      gameScheduleState?: string;
      startTimeUTC?: string;
      ifNecessary?: boolean;
      awayTeam: { id: number; abbrev: string; logo?: string; score?: number };
      homeTeam: { id: number; abbrev: string; logo?: string; score?: number };
      venue?: { default: string };
      gameOutcome?: { lastPeriodType: string };
    }
    const games: SeriesHubGame[] = (detail.games || []).map((g: DetailGame) => ({
      id: g.id,
      gameNumber: g.gameNumber,
      gameDate: g.gameDate,
      gameState: g.gameState,
      gameScheduleState: g.gameScheduleState,
      startTimeUTC: g.startTimeUTC,
      ifNecessary: g.ifNecessary,
      homeTeam: g.homeTeam,
      awayTeam: g.awayTeam,
      venue: g.venue,
      gameOutcome: g.gameOutcome,
    }));

    const currentIdNum = Number(currentGameId);
    const currentGame = games.find((g) => g.id === currentIdNum);

    const pointsFor = (abbrev: string) =>
      standings.find((t) => t.teamAbbrev.default === abbrev)?.points;

    return {
      seriesLetter: series.seriesLetter,
      roundLabel: round.roundLabel || series.seriesLabel || 'Round 1',
      neededToWin: series.neededToWin || 4,
      topSeed: {
        id: series.topSeed.id,
        abbrev: series.topSeed.abbrev,
        name: detail.topSeedTeam?.name?.default || series.topSeed.abbrev,
        logo: series.topSeed.logo,
        wins: series.topSeed.wins || 0,
        points: pointsFor(series.topSeed.abbrev),
      },
      bottomSeed: {
        id: series.bottomSeed.id,
        abbrev: series.bottomSeed.abbrev,
        name: detail.bottomSeedTeam?.name?.default || series.bottomSeed.abbrev,
        logo: series.bottomSeed.logo,
        wins: series.bottomSeed.wins || 0,
        points: pointsFor(series.bottomSeed.abbrev),
      },
      games,
      currentGameNumber: currentGame?.gameNumber,
    };
  } catch {
    return null;
  }
}

// --- Playoff pre-game synthesis ---
// NHL's landing/right-rail endpoints don't populate preview data for playoff FUT games.
// We synthesize the same shapes from regular-season endpoints so SkaterMatchup / GoalieMatchup
// / TeamStatsPreview / SeasonSeries render without any component changes.

interface ClubStatsSkater {
  playerId: number;
  headshot: string;
  firstName: { default: string };
  lastName: { default: string };
  positionCode: string;
  goals: number;
  assists: number;
  points: number;
}

interface ClubStatsGoalie {
  playerId: number;
  headshot: string;
  firstName: { default: string };
  lastName: { default: string };
  gamesPlayed: number;
  wins: number;
  losses: number;
  overtimeLosses: number;
  goalsAgainstAverage: number;
  savePercentage: number;
  shutouts: number;
}

interface ClubStatsResponse {
  skaters: ClubStatsSkater[];
  goalies: ClubStatsGoalie[];
}

interface RosterPlayer {
  id: number;
  sweaterNumber: number;
}

interface RosterResponse {
  forwards?: RosterPlayer[];
  defensemen?: RosterPlayer[];
  goalies?: RosterPlayer[];
}

interface TeamSummaryRow {
  teamId: number;
  teamFullName: string;
  faceoffWinPct: number;
  goalsForPerGame: number;
  goalsAgainstPerGame: number;
  penaltyKillPct: number;
  powerPlayPct: number;
}

async function fetchClubStats(teamAbbrev: string, season: string): Promise<ClubStatsResponse | null> {
  try {
    const res = await fetch(`${API_BASE}/club-stats/${teamAbbrev}/${season}/2`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function fetchRosterSweaterMap(teamAbbrev: string): Promise<Map<number, number>> {
  const map = new Map<number, number>();
  try {
    const res = await fetch(`${API_BASE}/roster/${teamAbbrev}/current`);
    if (!res.ok) return map;
    const data: RosterResponse = await res.json();
    for (const group of [data.forwards, data.defensemen, data.goalies]) {
      for (const p of group || []) map.set(p.id, p.sweaterNumber);
    }
  } catch {
    // ignore
  }
  return map;
}

async function fetchTeamSummaryLeague(season: string): Promise<TeamSummaryRow[]> {
  try {
    const res = await fetch(`/api/nhl-stats/team-summary?seasonId=${season}`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.data || [];
  } catch {
    return [];
  }
}

async function fetchTeamScheduleSeason(teamAbbrev: string, season: string): Promise<Array<{
  id: number;
  gameDate: string;
  gameState: string;
  gameType: number;
  homeTeam: { id: number; abbrev: string; logo?: string; score?: number };
  awayTeam: { id: number; abbrev: string; logo?: string; score?: number };
  periodDescriptor?: { number: number; periodType: string };
  gameOutcome?: { lastPeriodType: string };
}>> {
  try {
    const res = await fetch(`${API_BASE}/club-schedule-season/${teamAbbrev}/${season}`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.games || [];
  } catch {
    return [];
  }
}

function buildSkaterComparison(
  awayStats: ClubStatsResponse,
  homeStats: ClubStatsResponse,
  awaySweater: Map<number, number>,
  homeSweater: Map<number, number>
): SkaterComparison | null {
  const categories: Array<{ category: string; sortKey: 'points' | 'goals' | 'assists' }> = [
    { category: 'points', sortKey: 'points' },
    { category: 'goals', sortKey: 'goals' },
    { category: 'assists', sortKey: 'assists' },
  ];
  const leaders = categories.map(({ category, sortKey }) => {
    const top = (arr: ClubStatsSkater[]) => [...arr].sort((a, b) => (b[sortKey] || 0) - (a[sortKey] || 0))[0];
    const a = top(awayStats.skaters);
    const h = top(homeStats.skaters);
    if (!a || !h) return null;
    const toLeader = (p: ClubStatsSkater, sweater: Map<number, number>) => ({
      playerId: p.playerId,
      name: { default: `${p.firstName.default} ${p.lastName.default}` },
      firstName: p.firstName,
      lastName: p.lastName,
      sweaterNumber: sweater.get(p.playerId) || 0,
      positionCode: p.positionCode,
      headshot: p.headshot,
      value: p[sortKey] || 0,
    });
    return { category, awayLeader: toLeader(a, awaySweater), homeLeader: toLeader(h, homeSweater) };
  }).filter((x): x is NonNullable<typeof x> => x !== null);
  if (leaders.length === 0) return null;
  return { leaders };
}

function buildGoalieTeamBlock(stats: ClubStatsResponse, sweater: Map<number, number>) {
  const goalies = [...stats.goalies].sort((a, b) => (b.gamesPlayed || 0) - (a.gamesPlayed || 0));
  const totalGP = goalies.reduce((s, g) => s + (g.gamesPlayed || 0), 0);
  const totalWins = goalies.reduce((s, g) => s + (g.wins || 0), 0);
  const totalLosses = goalies.reduce((s, g) => s + (g.losses || 0), 0);
  const totalOt = goalies.reduce((s, g) => s + (g.overtimeLosses || 0), 0);
  const totalShutouts = goalies.reduce((s, g) => s + (g.shutouts || 0), 0);
  // Weighted averages by games played
  const weight = totalGP || 1;
  const gaa = goalies.reduce((s, g) => s + (g.goalsAgainstAverage || 0) * (g.gamesPlayed || 0), 0) / weight;
  const savePctg = goalies.reduce((s, g) => s + (g.savePercentage || 0) * (g.gamesPlayed || 0), 0) / weight;
  const leaders = goalies.slice(0, 2).map((g) => ({
    playerId: g.playerId,
    name: { default: `${g.firstName.default} ${g.lastName.default}` },
    firstName: g.firstName,
    lastName: g.lastName,
    sweaterNumber: sweater.get(g.playerId) || 0,
    headshot: g.headshot,
    positionCode: 'G',
    gamesPlayed: g.gamesPlayed,
    record: `${g.wins || 0}-${g.losses || 0}-${g.overtimeLosses || 0}`,
    gaa: g.goalsAgainstAverage || 0,
    savePctg: g.savePercentage || 0,
    shutouts: g.shutouts || 0,
  }));
  return {
    teamTotals: {
      record: `${totalWins}-${totalLosses}-${totalOt}`,
      gaa: Number(gaa.toFixed(2)),
      savePctg: Number(savePctg.toFixed(3)),
      shutouts: totalShutouts,
      gamesPlayed: totalGP,
    },
    leaders,
  };
}

function buildTeamSeasonStats(
  league: TeamSummaryRow[],
  awayId: number,
  homeId: number
): { awayTeam: TeamSeasonStats; homeTeam: TeamSeasonStats } | null {
  if (league.length === 0) return null;
  const byStat = (key: keyof TeamSummaryRow, desc = true) =>
    [...league].sort((a, b) => {
      const av = (a[key] as number) || 0;
      const bv = (b[key] as number) || 0;
      return desc ? bv - av : av - bv;
    });
  const rankOf = (teamId: number, sorted: TeamSummaryRow[]) =>
    sorted.findIndex((r) => r.teamId === teamId) + 1;
  const ppSort = byStat('powerPlayPct');
  const pkSort = byStat('penaltyKillPct');
  const foSort = byStat('faceoffWinPct');
  const gfSort = byStat('goalsForPerGame');
  const gaSort = byStat('goalsAgainstPerGame', false); // lower = better

  const build = (teamId: number): TeamSeasonStats | null => {
    const row = league.find((r) => r.teamId === teamId);
    if (!row) return null;
    return {
      ppPctg: row.powerPlayPct || 0,
      pkPctg: row.penaltyKillPct || 0,
      faceoffWinningPctg: row.faceoffWinPct || 0,
      goalsForPerGamePlayed: row.goalsForPerGame || 0,
      goalsAgainstPerGamePlayed: row.goalsAgainstPerGame || 0,
      ppPctgRank: rankOf(teamId, ppSort),
      pkPctgRank: rankOf(teamId, pkSort),
      faceoffWinningPctgRank: rankOf(teamId, foSort),
      goalsForPerGamePlayedRank: rankOf(teamId, gfSort),
      goalsAgainstPerGamePlayedRank: rankOf(teamId, gaSort),
    };
  };

  const awayTeam = build(awayId);
  const homeTeam = build(homeId);
  if (!awayTeam || !homeTeam) return null;
  return { awayTeam, homeTeam };
}

function buildLast10FromStandings(standings: StandingsTeam[], abbrev: string): Last10Record | null {
  const s = standings.find((t) => t.teamAbbrev.default === abbrev) as (StandingsTeam & {
    l10Wins?: number;
    l10Losses?: number;
    l10OtLosses?: number;
    streakCode?: string;
    streakCount?: number;
  }) | undefined;
  if (!s) return null;
  const wins = s.l10Wins ?? 0;
  const losses = s.l10Losses ?? 0;
  const ot = s.l10OtLosses ?? 0;
  return {
    record: `${wins}-${losses}-${ot}`,
    streakType: s.streakCode || '',
    streak: s.streakCount || 0,
    pastGameResults: [],
  };
}

function buildSeasonSeries(
  homeSchedule: Awaited<ReturnType<typeof fetchTeamScheduleSeason>>,
  homeAbbrev: string,
  awayAbbrev: string
): SeasonSeriesGame[] {
  return homeSchedule
    .filter((g) => g.gameType === 2)
    .filter((g) => (g.homeTeam.abbrev === awayAbbrev || g.awayTeam.abbrev === awayAbbrev))
    .filter((g) => g.homeTeam.abbrev === homeAbbrev || g.awayTeam.abbrev === homeAbbrev)
    .map((g) => ({
      id: g.id,
      gameDate: g.gameDate,
      gameState: g.gameState,
      homeTeam: { id: g.homeTeam.id, abbrev: g.homeTeam.abbrev, logo: g.homeTeam.logo || '', score: g.homeTeam.score },
      awayTeam: { id: g.awayTeam.id, abbrev: g.awayTeam.abbrev, logo: g.awayTeam.logo || '', score: g.awayTeam.score },
      periodDescriptor: g.periodDescriptor,
      gameOutcome: g.gameOutcome,
    }));
}

export async function fetchPlayoffPreGameContext(
  homeAbbrev: string,
  awayAbbrev: string,
  homeTeamId: number,
  awayTeamId: number,
  season: string,
  standings: StandingsTeam[]
): Promise<PlayoffPreGameContext> {
  const [
    awayStats,
    homeStats,
    awaySweater,
    homeSweater,
    league,
    homeSchedule,
  ] = await Promise.all([
    fetchClubStats(awayAbbrev, season),
    fetchClubStats(homeAbbrev, season),
    fetchRosterSweaterMap(awayAbbrev),
    fetchRosterSweaterMap(homeAbbrev),
    fetchTeamSummaryLeague(season),
    fetchTeamScheduleSeason(homeAbbrev, season),
  ]);

  const skaterComparison =
    awayStats && homeStats ? buildSkaterComparison(awayStats, homeStats, awaySweater, homeSweater) : null;

  const goalieComparison: GoalieComparison | null =
    awayStats && homeStats
      ? {
          awayTeam: buildGoalieTeamBlock(awayStats, awaySweater),
          homeTeam: buildGoalieTeamBlock(homeStats, homeSweater),
        }
      : null;

  const teamSeasonStats = buildTeamSeasonStats(league, awayTeamId, homeTeamId);

  const awayLast10 = buildLast10FromStandings(standings, awayAbbrev);
  const homeLast10 = buildLast10FromStandings(standings, homeAbbrev);
  const last10Record = awayLast10 && homeLast10 ? { awayTeam: awayLast10, homeTeam: homeLast10 } : null;

  const seasonSeries = buildSeasonSeries(homeSchedule, homeAbbrev, awayAbbrev);

  return { skaterComparison, goalieComparison, teamSeasonStats, last10Record, seasonSeries };
}

export async function fetchStandingsForDate(date: string): Promise<StandingsTeam[]> {
  try {
    const response = await fetchWithRetry(`${API_BASE}/standings/${date}`);
    const data = await response.json();
    const standings: StandingsTeam[] = data.standings || [];
    // Post-regular-season dates return empty; fall back to current standings (final regular-season snapshot = playoff seeding)
    if (standings.length === 0) {
      const nowRes = await fetchWithRetry(`${API_BASE}/standings/now`);
      const nowData = await nowRes.json();
      return nowData.standings || [];
    }
    return standings;
  } catch (error) {
    if (isRateLimitError(error)) {
      console.warn('NHL rate-limited standings fetch — returning empty');
    } else {
      console.error('Failed to fetch standings:', error);
    }
    return [];
  }
}
