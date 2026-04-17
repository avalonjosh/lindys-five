import type { SeasonStats } from '../types';

/**
 * Calculate playoff probability based on current performance
 * Uses a simplified model based on:
 * 1. How far above/below playoff pace they are
 * 2. Games remaining (more variance early season)
 * 3. Historical playoff thresholds
 */
export function calculatePlayoffProbability(stats: SeasonStats): number {
  const { totalPoints, gamesPlayed, gamesRemaining, projectedPoints, playoffTarget } = stats;

  // Need at least 5 games to have meaningful data
  if (gamesPlayed < 5) {
    return 50; // Default to 50% with limited data
  }

  // Calculate points needed in remaining games
  const pointsNeeded = playoffTarget - totalPoints;
  const maxPossiblePoints = gamesRemaining * 2;

  // If mathematically impossible, 0%
  if (pointsNeeded > maxPossiblePoints) {
    return 0;
  }

  // If already clinched (have enough points), 100%
  if (totalPoints >= playoffTarget) {
    return 100;
  }

  // Required pace for remaining games to make playoffs
  const requiredPaceRemaining = pointsNeeded / gamesRemaining;

  // Current pace (points per game)
  const currentPace = totalPoints / gamesPlayed;

  // Base probability from projection difference
  // Each point above/below target shifts probability
  const projectionDiff = projectedPoints - playoffTarget;

  // Scale factor - how much each projected point changes probability
  // More games played = more confidence in projection
  const confidenceFactor = Math.min(gamesPlayed / 82, 1);

  // Base calculation: 50% + (projection diff * scale factor)
  // Scale so ~20 points above/below target = near 100%/0%
  const pointScale = 2.5 * confidenceFactor;
  let probability = 50 + (projectionDiff * pointScale);

  // Adjust for feasibility of required pace
  // If they need to play at an unrealistic pace, reduce probability
  if (requiredPaceRemaining > 1.5) {
    // Needing more than 1.5 pts/game is very difficult
    probability *= Math.max(0.3, 1 - ((requiredPaceRemaining - 1.5) * 0.5));
  }

  // Bonus if current pace is well above what's needed
  if (currentPace > requiredPaceRemaining + 0.2) {
    probability += 5;
  }

  // Early season variance - less certainty
  const varianceFactor = 1 - (gamesRemaining / 82 * 0.2);
  probability = 50 + (probability - 50) * varianceFactor;

  // Clamp between 0 and 100
  return Math.max(0, Math.min(100, Math.round(probability)));
}

/**
 * Get a message describing the playoff situation
 */
export function getPlayoffStatusMessage(probability: number, gamesPlayed: number): string {
  if (gamesPlayed < 5) {
    return "Season just getting started";
  }

  if (probability >= 90) {
    return "Strong playoff position";
  } else if (probability >= 70) {
    return "On track for playoffs";
  } else if (probability >= 50) {
    return "In the playoff hunt";
  } else if (probability >= 30) {
    return "Need to pick up the pace";
  } else if (probability >= 10) {
    return "Playoff hopes fading";
  } else {
    return "Facing long odds";
  }
}

/**
 * Get color for probability display
 * Always returns 'team' to use team color scheme regardless of probability
 */
export function getProbabilityColor(): string {
  return 'team';
}

/**
 * Calculate probability for a hypothetical final point total
 * Uses a logistic (S-curve) function for more realistic probability distribution:
 * - Steep changes near the cut line where each point matters most
 * - Flattens at extremes (diminishing returns for being way above/below)
 *
 * @param finalPoints - The hypothetical final point total
 * @param gamesPlayed - Games played so far (affects curve steepness)
 * @param cutLine - The current season's projected cut line (defaults to 96)
 * @param pathType - Optional path type to tune steepness: 'division' (steeper), 'wildcard' (flatter), or 'default'
 */
export function probabilityForFinalPoints(
  finalPoints: number,
  gamesPlayed: number,
  cutLine: number = 96,
  pathType: 'division' | 'wildcard' | 'default' = 'default'
): number {
  // How far above/below the current season's projected cut line
  const diff = finalPoints - cutLine;

  // Confidence factor increases as season progresses
  const confidenceFactor = Math.min(gamesPlayed / 82, 1);

  // Steepness (k) of the S-curve varies by path type
  // Division: fewer competitors, less volatile → steeper curve
  // Wildcard: more competitors, more volatile → flatter curve
  // Default: used for breakdown table
  let k: number;
  switch (pathType) {
    case 'division':
      k = 0.18 + (confidenceFactor * 0.22); // 0.18–0.40
      break;
    case 'wildcard':
      k = 0.14 + (confidenceFactor * 0.18); // 0.14–0.32
      break;
    default:
      k = 0.15 + (confidenceFactor * 0.20); // 0.15–0.35
      break;
  }

  // Logistic function: P = 100 / (1 + e^(-k * diff))
  // At diff=0: 50%, curves toward 0% and 100% at extremes
  const probability = 100 / (1 + Math.exp(-k * diff));

  // Cap at 99/1 - never show 100% or 0% unless mathematically clinched/eliminated
  return Math.max(1, Math.min(99, Math.round(probability)));
}

/**
 * Compute position-aware playoff probability considering both division and wildcard paths.
 * A team makes the playoffs if they finish top 3 in their division OR wildcard 1-2.
 * We calculate probability for both paths and take the max.
 *
 * @param projectedPoints - Team's projected final point total
 * @param gamesPlayed - Games played so far
 * @param divCutLine - Projected division cut line (top 3 threshold)
 * @param wcCutLine - Projected wildcard cut line
 * @param isInPlayoffPosition - Whether team currently holds a playoff spot
 */
/**
 * Compute the probability that a team wins a best-of-7 series.
 *
 * Uses team point-percentages as a strength proxy.  A logistic function converts
 * the strength gap into a single-game win probability, and a binomial
 * (negative-binomial) distribution converts that into a series-win probability.
 *
 * Home-ice advantage: the higher seed hosts games 1, 2, 5, 7.
 *
 * @param teamPtPctg - Team's regular-season point percentage (0-1)
 * @param oppPtPctg  - Opponent's regular-season point percentage (0-1)
 * @param teamWins   - Games won so far in the series (0-4)
 * @param oppWins    - Games lost so far in the series (0-4)
 * @param hasHomeIce - Whether this team has home-ice advantage
 */
export interface SeriesOddsOptions {
  // Goal differential per game — blended with point % for a stronger team-strength signal
  teamGoalDiffPerGame?: number;
  oppGoalDiffPerGame?: number;
  // Team-specific home/road win rates — replaces the flat 4% home-ice boost
  teamHomeWinPct?: number;
  teamRoadWinPct?: number;
  oppHomeWinPct?: number;
  oppRoadWinPct?: number;
}

export function computeSeriesWinProbability(
  teamPtPctg: number,
  oppPtPctg: number,
  teamWins: number = 0,
  oppWins: number = 0,
  hasHomeIce: boolean = true,
  options: SeriesOddsOptions = {}
): number {
  // If series already decided
  if (teamWins >= 4) return 100;
  if (oppWins >= 4) return 0;

  // Composite strength: 60% point %, 40% normalized goal-diff per game.
  // Falls back to raw point % when goal-diff data is missing (preserves existing callers).
  const normalizeGD = (gd: number) => 0.5 + Math.max(-1, Math.min(1, gd)) * 0.25;
  const teamStrength =
    options.teamGoalDiffPerGame != null
      ? 0.6 * teamPtPctg + 0.4 * normalizeGD(options.teamGoalDiffPerGame)
      : teamPtPctg;
  const oppStrength =
    options.oppGoalDiffPerGame != null
      ? 0.6 * oppPtPctg + 0.4 * normalizeGD(options.oppGoalDiffPerGame)
      : oppPtPctg;

  // Logistic model for single-game win probability
  // k controls sensitivity; 6 is tuned so a 0.600 vs 0.500 team ≈ 58% per game
  const k = 6;
  const diff = teamStrength - oppStrength;
  const baseP = 1 / (1 + Math.exp(-k * diff));

  // Team-specific home-ice boost if splits are provided; otherwise flat 4% (historical league average).
  // Formula: half the team's own home-vs-road win-rate differential, capped at 10%.
  const FLAT_HOME_BOOST = 0.04;
  const teamOwnBoost =
    options.teamHomeWinPct != null && options.teamRoadWinPct != null
      ? Math.min(0.10, Math.max(0, (options.teamHomeWinPct - options.teamRoadWinPct) / 2))
      : FLAT_HOME_BOOST;
  const oppOwnBoost =
    options.oppHomeWinPct != null && options.oppRoadWinPct != null
      ? Math.min(0.10, Math.max(0, (options.oppHomeWinPct - options.oppRoadWinPct) / 2))
      : FLAT_HOME_BOOST;

  // pHome is P(team wins) when team is at home → boost = +teamOwnBoost
  // pAway is P(team wins) when team is on road → boost = -oppOwnBoost (opponent's home advantage working against us)
  const pHome = Math.min(0.95, Math.max(0.05, baseP + teamOwnBoost));
  const pAway = Math.min(0.95, Math.max(0.05, baseP - oppOwnBoost));

  // Best-of-7, 2-2-1-1-1 format: home team hosts games 1,2,5,7
  // Enumerate remaining games using dynamic programming
  const winsNeeded = 4 - teamWins;
  const lossesAllowed = 4 - oppWins;
  const gamesPlayed = teamWins + oppWins;

  // Build home-ice schedule for remaining games
  // Games are numbered 1-7 overall; higher seed is home for 1,2,5,7
  const homeGames = new Set(hasHomeIce ? [1, 2, 5, 7] : [3, 4, 6]);
  const remainingSchedule: boolean[] = [];
  for (let g = gamesPlayed + 1; g <= 7; g++) {
    remainingSchedule.push(homeGames.has(g));
  }

  // DP: probability of winning from state (w, l) with remaining schedule
  // w = additional wins needed, l = additional losses allowed
  const memo = new Map<string, number>();

  function dp(w: number, l: number, gameIdx: number): number {
    if (w <= 0) return 1;
    if (l <= 0) return 0;
    if (gameIdx >= remainingSchedule.length) return 0;

    const key = `${w},${l},${gameIdx}`;
    const cached = memo.get(key);
    if (cached !== undefined) return cached;

    const isHome = remainingSchedule[gameIdx];
    const p = isHome ? pHome : pAway;

    const result = p * dp(w - 1, l, gameIdx + 1) + (1 - p) * dp(w, l - 1, gameIdx + 1);
    memo.set(key, result);
    return result;
  }

  const prob = dp(winsNeeded, lossesAllowed, 0) * 100;
  return Math.max(1, Math.min(99, Math.round(prob)));
}

/**
 * Simplified Stanley Cup odds computation from bracket data.
 * For each remaining team, chains the probability of winning each remaining round.
 */
export function computeStanleyCupOddsSimple(
  teamPtPctg: number,
  remainingRounds: { oppPtPctg: number; hasHomeIce: boolean }[]
): number {
  let prob = 1;
  for (const round of remainingRounds) {
    const seriesP = computeSeriesWinProbability(teamPtPctg, round.oppPtPctg, 0, 0, round.hasHomeIce);
    prob *= seriesP / 100;
  }
  return Math.max(0.1, Math.round(prob * 1000) / 10); // One decimal place
}

export function computePositionAwareProbability(
  projectedPoints: number,
  gamesPlayed: number,
  divCutLine: number,
  wcCutLine: number,
  isInPlayoffPosition: boolean,
  clinchIndicator?: string
): { probability: number; activePath: 'division' | 'wildcard'; effectiveCutLine: number } {
  // Teams that have clinched a playoff spot are guaranteed 100%
  // x = clinched playoff, y = clinched division, z = clinched conference, p = Presidents' Trophy
  if (clinchIndicator && ['x', 'y', 'z', 'p'].includes(clinchIndicator)) {
    return { probability: 100, activePath: 'division', effectiveCutLine: 0 };
  }
  // Eliminated teams are 0%
  if (clinchIndicator === 'e') {
    return { probability: 0, activePath: 'wildcard', effectiveCutLine: 0 };
  }

  // Position bonus: teams currently holding a playoff spot have an advantage
  // Scales with games played (more meaningful later in season)
  let positionBonus = 0;
  if (isInPlayoffPosition && gamesPlayed >= 25) {
    const seasonProgress = Math.min(gamesPlayed / 82, 1);
    positionBonus = 1.5 * seasonProgress; // Up to 1.5 points reduction
  }

  const adjustedDivCutLine = divCutLine - positionBonus;
  const adjustedWcCutLine = wcCutLine - positionBonus;

  const divProb = probabilityForFinalPoints(projectedPoints, gamesPlayed, adjustedDivCutLine, 'division');
  const wcProb = probabilityForFinalPoints(projectedPoints, gamesPlayed, adjustedWcCutLine, 'wildcard');

  const probability = Math.max(divProb, wcProb);
  const activePath = divProb >= wcProb ? 'division' : 'wildcard';
  const effectiveCutLine = activePath === 'division'
    ? Math.round(adjustedDivCutLine)
    : Math.round(adjustedWcCutLine);

  return { probability, activePath, effectiveCutLine };
}
