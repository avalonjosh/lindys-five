import { fetchWithRetry } from '@/lib/services/nhlApi';
import { formatSeasonLabel } from '@/lib/utils/season';
import { TEAMS } from '@/lib/teamConfig';

// Backward-looking summary of a completed season, used by the offseason
// "season-complete" view and its server-rendered SEO copy.
//
// Everything is derived from the club schedule endpoint, which is the only
// reliable source in the offseason: `standings/now` returns an empty body and
// `playoff-bracket/{season}` 404s once the Cup is awarded. The schedule still
// carries final scores plus a rich `series` object on each playoff game.

export interface PlayoffResult {
  made: boolean;
  wonCup: boolean;
  roundReached?: number; // 1-4 (1 = First Round ... 4 = Stanley Cup Final)
  roundLabel?: string;
  eliminatedBy?: string; // opponent display name, when they lost a series
}

export interface SeasonSummary {
  season: string;
  seasonLabel: string; // "2025-26"
  finalRecord: {
    wins: number;
    losses: number;
    otLosses: number;
    points: number;
    gamesPlayed: number;
  } | null;
  divisionName?: string;
  divisionFinish?: number;
  conferenceName?: string;
  conferenceFinish?: number;
  playoff: PlayoffResult;
}

const ROUND_LABELS: Record<number, string> = {
  1: 'First Round',
  2: 'Second Round',
  3: 'Conference Final',
  4: 'Stanley Cup Final',
};

const FINAL_STATES = new Set(['FINAL', 'OFF']);

function teamNameFromAbbrev(abbrev: string): string {
  const team = Object.values(TEAMS).find((t) => t.abbreviation === abbrev);
  return team ? team.name : abbrev;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function derivePlayoffResult(playoffGames: any[], teamAbbrev: string): PlayoffResult {
  const result: PlayoffResult = { made: false, wonCup: false };
  if (playoffGames.length === 0) return result;
  result.made = true;

  const maxRound = playoffGames.reduce(
    (m, g) => Math.max(m, g.series?.round || g.seriesStatus?.round || 0),
    0
  );
  const deepest = playoffGames.filter(
    (g) => (g.series?.round || g.seriesStatus?.round) === maxRound
  );

  let teamWins = 0;
  let oppWins = 0;
  let oppAbbrev = '';
  let neededToWin = 4;
  let seriesTitle: string | undefined;

  for (const g of deepest) {
    const series = g.series || g.seriesStatus;
    if (series?.neededToWin) neededToWin = series.neededToWin;
    if (series?.seriesTitle) seriesTitle = series.seriesTitle;
    const isHome = g.homeTeam.abbrev === teamAbbrev;
    const my = isHome ? g.homeTeam : g.awayTeam;
    const opp = isHome ? g.awayTeam : g.homeTeam;
    oppAbbrev = opp.abbrev;
    if ((my.score ?? 0) > (opp.score ?? 0)) teamWins++;
    else oppWins++;
  }

  result.roundReached = maxRound;
  result.roundLabel = ROUND_LABELS[maxRound] || seriesTitle;

  if (teamWins >= neededToWin && maxRound === 4) {
    result.wonCup = true;
  } else if (oppWins >= neededToWin) {
    result.eliminatedBy = teamNameFromAbbrev(oppAbbrev);
  }

  return result;
}

export interface SeasonState {
  complete: boolean;
  summary: SeasonSummary | null;
}

// Fetches the team's full season schedule and derives completion + summary.
// `complete` is true only when the team has played games and none remain
// (no FUT/PRE/LIVE/CRIT) — i.e. their season is genuinely over.
export async function getSeasonState(
  teamAbbrev: string,
  season: string
): Promise<SeasonState> {
  try {
    const res = await fetchWithRetry(
      `https://api-web.nhle.com/v1/club-schedule-season/${teamAbbrev}/${season}`,
      1
    );
    const data = await res.json();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const games: any[] = data.games || [];
    if (games.length === 0) return { complete: false, summary: null };

    const complete = games.every((g) => FINAL_STATES.has(g.gameState));
    if (!complete) return { complete: false, summary: null };

    // Final regular-season record from type-2 games.
    const regGames = games.filter((g) => g.gameType === 2 && FINAL_STATES.has(g.gameState));
    let wins = 0;
    let losses = 0;
    let otLosses = 0;
    let lastRegDate = '';
    for (const g of regGames) {
      const isHome = g.homeTeam.abbrev === teamAbbrev;
      const my = isHome ? g.homeTeam : g.awayTeam;
      const opp = isHome ? g.awayTeam : g.homeTeam;
      if ((my.score ?? 0) > (opp.score ?? 0)) wins++;
      else if (g.gameOutcome?.lastPeriodType === 'OT' || g.gameOutcome?.lastPeriodType === 'SO') otLosses++;
      else losses++;
      if (g.gameDate > lastRegDate) lastRegDate = g.gameDate;
    }
    const finalRecord = regGames.length
      ? { wins, losses, otLosses, points: wins * 2 + otLosses, gamesPlayed: wins + losses + otLosses }
      : null;

    // Playoff outcome from type-3 games.
    const playoffGames = games.filter((g) => g.gameType === 3 && FINAL_STATES.has(g.gameState));
    const playoff = derivePlayoffResult(playoffGames, teamAbbrev);

    // Division/conference finish from final-day standings (regular-season last date).
    let divisionName: string | undefined;
    let divisionFinish: number | undefined;
    let conferenceName: string | undefined;
    let conferenceFinish: number | undefined;
    if (lastRegDate) {
      try {
        const stRes = await fetchWithRetry(`https://api-web.nhle.com/v1/standings/${lastRegDate}`, 1);
        const stData = await stRes.json();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const entry = (stData.standings || []).find(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (t: any) => t.teamAbbrev?.default === teamAbbrev
        );
        if (entry) {
          divisionName = entry.divisionName;
          divisionFinish = entry.divisionSequence;
          conferenceName = entry.conferenceName;
          conferenceFinish = entry.conferenceSequence;
        }
      } catch {
        /* finish stays undefined; card renders gracefully */
      }
    }

    return {
      complete: true,
      summary: {
        season,
        seasonLabel: formatSeasonLabel(season),
        finalRecord,
        divisionName,
        divisionFinish,
        conferenceName,
        conferenceFinish,
        playoff,
      },
    };
  } catch {
    return { complete: false, summary: null };
  }
}

// One-sentence, past-tense playoff outcome (e.g. "Eliminated in the Second Round by the Canadiens").
export function playoffResultText(summary: SeasonSummary): string {
  const { playoff } = summary;
  if (playoff.wonCup) return `Won the Stanley Cup`;
  if (!playoff.made) return `Missed the playoffs`;
  if (playoff.eliminatedBy && playoff.roundLabel) {
    return `Eliminated in the ${playoff.roundLabel} by the ${playoff.eliminatedBy}`;
  }
  if (playoff.roundLabel) return `Reached the ${playoff.roundLabel}`;
  return `Made the playoffs`;
}
