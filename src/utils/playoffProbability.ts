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
 */
export function probabilityForFinalPoints(
  finalPoints: number,
  gamesPlayed: number,
  cutLine: number = 96
): number {
  // How far above/below the current season's projected cut line
  const diff = finalPoints - cutLine;

  // Confidence factor increases as season progresses
  const confidenceFactor = Math.min(gamesPlayed / 82, 1);

  // Steepness (k) of the S-curve - intentionally flat to be conservative
  // Early season: very gentle curve (k=0.10) - high uncertainty
  // Late season: still gentle (k=0.18) - accounts for cut line variance
  // This keeps teams within ~10 points of cut line in the 25-75% range
  const k = 0.10 + (confidenceFactor * 0.08);

  // Logistic function: P = 100 / (1 + e^(-k * diff))
  // At diff=0: 50%, curves toward 0% and 100% at extremes
  const probability = 100 / (1 + Math.exp(-k * diff));

  // Cap at 99/1 - never show 100% or 0% unless mathematically clinched/eliminated
  return Math.max(1, Math.min(99, Math.round(probability)));
}
