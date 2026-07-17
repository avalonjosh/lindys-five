import { fetchWithRetry } from '@/lib/services/nhlApi';
import {
  getCurrentNHLSeason,
  formatSeasonLabel,
  nextNHLSeason,
  previousNHLSeason,
  getRegularSeasonGameCount,
} from '@/lib/utils/season';
import { getSeasonState, type SeasonSummary } from '@/lib/utils/seasonSummary';
import { computePreseasonOdds, type PreseasonOdds } from '@/lib/utils/preseasonOdds';

// Season-state detection driven by the NHL API, so pages flip between live,
// season-complete, and next-season-preview modes on their own as the schedule
// data changes (season ends -> new schedule publishes -> games start).
//
// - live:      the display season has games in progress or already played.
// - complete:  the display season is fully played and no next schedule exists.
// - preseason: a schedule exists but no games have started (next-season preview).

export type SeasonPhase = 'live' | 'complete' | 'preseason';

const FINAL_STATES = new Set(['FINAL', 'OFF']);
const STARTED_STATES = new Set(['FINAL', 'OFF', 'LIVE', 'CRIT']);

type ScheduleKind = 'live' | 'complete' | 'preseason' | 'none';

// Classify a team's schedule for a given season from the club-schedule endpoint,
// the one source that stays reliable year-round (standings/bracket go empty/404
// in the offseason).
async function classifySchedule(teamAbbrev: string, season: string): Promise<ScheduleKind> {
  try {
    const res = await fetchWithRetry(
      `https://api-web.nhle.com/v1/club-schedule-season/${teamAbbrev}/${season}`,
      1
    );
    const data = await res.json();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const games: any[] = (data.games || []).filter((g: any) => g.gameType === 2 || g.gameType === 3);
    if (games.length === 0) return 'none';
    if (games.every((g) => FINAL_STATES.has(g.gameState))) return 'complete';
    if (!games.some((g) => STARTED_STATES.has(g.gameState))) return 'preseason';
    return 'live';
  } catch {
    return 'none';
  }
}

export interface PreseasonOpener {
  date: string; // YYYY-MM-DD (Eastern)
  startTimeUTC?: string;
  opponent: string; // abbrev
  opponentLogo?: string;
  isHome: boolean;
}

export interface PreseasonInfo {
  season: string;
  seasonLabel: string;
  totalGames: number;
  opener: PreseasonOpener | null;
  odds: PreseasonOdds | null; // way-too-early projection from last season
}

export interface SeasonContext {
  season: string; // the season to display and fetch schedules for
  seasonLabel: string;
  phase: SeasonPhase;
  seasonComplete: boolean; // convenience: phase === 'complete'
  isPreseason: boolean; // convenience: phase === 'preseason'
  totalGames: number; // regular-season game count for the display season
  summary: SeasonSummary | null; // completed-season summary (complete phase)
  lastSeasonSummary: SeasonSummary | null; // prior-season summary (preseason context)
  preseason: PreseasonInfo | null;
}

async function buildPreseasonInfo(
  teamAbbrev: string,
  season: string
): Promise<PreseasonInfo> {
  const info: PreseasonInfo = {
    season,
    seasonLabel: formatSeasonLabel(season),
    totalGames: getRegularSeasonGameCount(season),
    opener: null,
    odds: null,
  };
  try {
    const res = await fetchWithRetry(
      `https://api-web.nhle.com/v1/club-schedule-season/${teamAbbrev}/${season}`,
      1
    );
    const data = await res.json();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const games: any[] = (data.games || []).filter((g: any) => g.gameType === 2);
    if (games.length > 0) {
      const first = games[0];
      const isHome = first.homeTeam?.abbrev === teamAbbrev;
      const opp = isHome ? first.awayTeam : first.homeTeam;
      info.opener = {
        date: first.gameDate,
        startTimeUTC: first.startTimeUTC,
        opponent: opp?.abbrev || '',
        opponentLogo: opp?.logo,
        isHome,
      };
    }
  } catch {
    /* opener stays null; card degrades gracefully */
  }
  return info;
}

// Way-too-early odds for the coming season, projected from last season's record.
function oddsFromLastSeason(
  lastSeasonSummary: SeasonSummary | null,
  projectedGames: number
): PreseasonOdds | null {
  const record = lastSeasonSummary?.finalRecord;
  if (!record || record.gamesPlayed === 0) return null;
  return computePreseasonOdds(record.points, record.gamesPlayed, projectedGames);
}

// Resolve which NHL season to display and in what phase. `teamAbbrev` is used
// as the schedule probe (any team works; the schedule shape is league-wide).
export async function resolveSeasonContext(teamAbbrev: string): Promise<SeasonContext> {
  const dateSeason = getCurrentNHLSeason();
  const dateKind = await classifySchedule(teamAbbrev, dateSeason);

  // Date-based season is under way (or was): live tracker on that season.
  if (dateKind === 'live') {
    return {
      season: dateSeason,
      seasonLabel: formatSeasonLabel(dateSeason),
      phase: 'live',
      seasonComplete: false,
      isPreseason: false,
      totalGames: getRegularSeasonGameCount(dateSeason),
      summary: null,
      lastSeasonSummary: null,
      preseason: null,
    };
  }

  // Date-based season exists but hasn't started (e.g. September): preview it.
  if (dateKind === 'preseason' || dateKind === 'none') {
    // 'none' shouldn't happen for the current date season, but if the API has
    // no data yet, fall back to preview framing off whatever schedule exists.
    const [preseason, lastSeasonState] = await Promise.all([
      buildPreseasonInfo(teamAbbrev, dateSeason),
      getSeasonState(teamAbbrev, previousNHLSeason(dateSeason)),
    ]);
    preseason.odds = oddsFromLastSeason(lastSeasonState.summary, preseason.totalGames);
    return {
      season: dateSeason,
      seasonLabel: formatSeasonLabel(dateSeason),
      phase: 'preseason',
      seasonComplete: false,
      isPreseason: true,
      totalGames: getRegularSeasonGameCount(dateSeason),
      summary: null,
      lastSeasonSummary: lastSeasonState.summary,
      preseason,
    };
  }

  // Date-based season is fully played. Is next season's schedule out yet?
  const upcoming = nextNHLSeason(dateSeason);
  const nextKind = await classifySchedule(teamAbbrev, upcoming);

  if (nextKind === 'preseason' || nextKind === 'live') {
    const [preseason, lastSeasonState] = await Promise.all([
      buildPreseasonInfo(teamAbbrev, upcoming),
      getSeasonState(teamAbbrev, dateSeason),
    ]);
    preseason.odds = oddsFromLastSeason(lastSeasonState.summary, preseason.totalGames);
    return {
      season: upcoming,
      seasonLabel: formatSeasonLabel(upcoming),
      phase: 'preseason',
      seasonComplete: false,
      isPreseason: true,
      totalGames: getRegularSeasonGameCount(upcoming),
      summary: null,
      lastSeasonSummary: lastSeasonState.summary,
      preseason,
    };
  }

  // No next-season schedule yet: stay in season-complete mode.
  const completeState = await getSeasonState(teamAbbrev, dateSeason);
  return {
    season: dateSeason,
    seasonLabel: formatSeasonLabel(dateSeason),
    phase: 'complete',
    seasonComplete: true,
    isPreseason: false,
    totalGames: getRegularSeasonGameCount(dateSeason),
    summary: completeState.summary,
    lastSeasonSummary: null,
    preseason: null,
  };
}
