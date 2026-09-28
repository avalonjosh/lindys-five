import type { StandingsTeam } from '@/lib/types/boxscore';
import { computePositionAwareProbability } from '@/lib/utils/playoffProbability';
import { priorPaceFromLastSeason } from '@/lib/utils/nhlPriorPace';
import { cutLinesFromProjections } from '@/lib/utils/standingsCalc';

// Way-too-early preseason playoff odds.
//
// Before a single game is played there is no standings data to work with, so
// each team is projected from last season's points pace regressed toward the
// league average (priorPaceFromLastSeason, the same prior the live model
// regresses early-season pace toward). The odds are then the live model run at
// zero games played: cut lines from those projections, the division and wild
// card paths, and the flattest (most uncertain) curve. So opening night picks
// up exactly where the preseason number left off.
//
// It is labeled everywhere as "way too early" because it ignores roster moves,
// injuries, goaltending, and schedule.

export interface PreseasonOdds {
  playoffProbability: number; // 0-100, integer
  projectedPoints: number; // projected over the coming season's game count
  projectedGames: number;
  cutLine: number; // projected cut line on the team's better path, in points
  activePath: 'division' | 'wildcard';
  tier: 'Playoff favorite' | 'On the bubble' | 'Longshot';
}

/** Preseason odds for every team in last season's final standings, keyed by abbreviation. */
export function computeLeaguePreseasonOdds(
  lastSeasonStandings: StandingsTeam[],
  projectedGames: number
): Map<string, PreseasonOdds> {
  const projected = new Map(
    lastSeasonStandings.map(t => [
      t.teamAbbrev.default,
      priorPaceFromLastSeason(t.points, t.gamesPlayed) * projectedGames,
    ])
  );
  const project = (t: StandingsTeam) => projected.get(t.teamAbbrev.default) ?? 0;

  const odds = new Map<string, PreseasonOdds>();
  for (const team of lastSeasonStandings) {
    const { divCutLine, wcCutLine } = cutLinesFromProjections(team, lastSeasonStandings, project, projectedGames);
    const { probability, activePath, effectiveCutLine } = computePositionAwareProbability(
      project(team), 0, divCutLine, wcCutLine, false, undefined, projectedGames
    );
    odds.set(team.teamAbbrev.default, {
      playoffProbability: probability,
      projectedPoints: Math.round(project(team)),
      projectedGames,
      cutLine: effectiveCutLine,
      activePath,
      tier: probability >= 60 ? 'Playoff favorite' : probability >= 35 ? 'On the bubble' : 'Longshot',
    });
  }
  return odds;
}
