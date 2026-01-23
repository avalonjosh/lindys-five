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
 */
export function getProbabilityColor(probability: number): string {
  if (probability >= 70) {
    return '#22c55e'; // green-500
  } else if (probability >= 40) {
    return 'team'; // Signal to use team color
  } else {
    return '#ef4444'; // red-500
  }
}
