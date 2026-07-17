import { probabilityForFinalPoints } from '@/lib/utils/playoffProbability';

// Way-too-early preseason playoff odds.
//
// Before a single game is played there is no standings data to work with, so
// the projection is a deliberately simple, transparent estimate off last
// season's results. The projected points are then converted to a probability
// with the SAME shared curve the live site uses (probabilityForFinalPoints):
// that function's steepness scales with games played, and at zero games it sits
// at its flattest — precisely the maximum-uncertainty curve a July guess wants.
//
// Method:
//   1. Take last season's points pace (points per game).
//   2. Regress it toward the league average — team strength is sticky year over
//      year, but only partly (NHL year-to-year points correlation is ~0.6), so
//      good teams are pulled down and bad teams pulled up toward the mean.
//   3. Project that regressed pace over the coming season's game count.
//   4. Feed the projected points + playoff cut line into probabilityForFinalPoints
//      at zero games played for the odds.
//
// It is labeled everywhere as "way too early" precisely because it ignores
// roster moves, injuries, goaltending, and schedule. It exists to give the
// preseason preview a real, honest data point (and to rank for the low-
// competition "[team] 2026-27 playoff odds" summer searches).

// League-average and playoff-cut-line points pace (points per game). Historic
// NHL norms: league average ~1.12 pt/game (≈92 over 82 games); the last team in
// (2nd wild card) typically lands around ~94-95 points, ≈1.15 pt/game.
const LEAGUE_AVG_PACE = 1.12;
const PLAYOFF_CUTLINE_PACE = 1.15;
// How much of last season's deviation from average carries over (0 = all teams
// projected league-average, 1 = last season repeats exactly).
const REGRESSION_TO_MEAN = 0.62;
// Keep preseason odds honestly uncertain — never near-certain either way.
const MIN_PROB = 5;
const MAX_PROB = 94;

export interface PreseasonOdds {
  playoffProbability: number; // 0-100, integer
  projectedPoints: number; // projected over the coming season's game count
  projectedGames: number;
  cutLine: number; // projected playoff cut line, in points
  tier: 'Playoff favorite' | 'On the bubble' | 'Longshot';
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

export function computePreseasonOdds(
  lastSeasonPoints: number,
  lastSeasonGames: number,
  projectedGames: number
): PreseasonOdds {
  const lastPace = lastSeasonGames > 0 ? lastSeasonPoints / lastSeasonGames : LEAGUE_AVG_PACE;
  const regressedPace = LEAGUE_AVG_PACE + REGRESSION_TO_MEAN * (lastPace - LEAGUE_AVG_PACE);

  const projectedPoints = Math.round(regressedPace * projectedGames);
  const cutLine = Math.round(PLAYOFF_CUTLINE_PACE * projectedGames);

  // Zero games played -> flattest (most uncertain) logistic curve, the same
  // curve the live tracker uses later in the season.
  const rawProb = probabilityForFinalPoints(projectedPoints, 0, cutLine);
  const playoffProbability = clamp(rawProb, MIN_PROB, MAX_PROB);

  const tier: PreseasonOdds['tier'] =
    playoffProbability >= 60 ? 'Playoff favorite' : playoffProbability >= 35 ? 'On the bubble' : 'Longshot';

  return { playoffProbability, projectedPoints, projectedGames, cutLine, tier };
}
