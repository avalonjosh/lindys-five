import type { SeasonStats } from '../types';

interface TeamColors {
  primary: string;
  secondary: string;
  accent: string;
}

interface DarkModeColors {
  background: string;
  backgroundGradient?: string;
  cardBackground?: string;
  accent: string;
  border: string;
  text: string;
}

interface PlayoffProbabilityCardProps {
  stats: SeasonStats;
  isGoatMode: boolean;
  teamColors: TeamColors;
  darkModeColors: DarkModeColors;
}

/**
 * Calculate playoff probability based on current performance
 * Uses a simplified model based on:
 * 1. How far above/below playoff pace they are
 * 2. Games remaining (more variance early season)
 * 3. Historical playoff thresholds
 */
function calculatePlayoffProbability(stats: SeasonStats): number {
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
function getStatusMessage(probability: number, stats: SeasonStats): string {
  const { gamesPlayed } = stats;

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
function getProbabilityColor(probability: number, isGoatMode: boolean, teamColors: TeamColors, darkModeColors: DarkModeColors): string {
  if (probability >= 70) {
    return '#22c55e'; // green-500
  } else if (probability >= 40) {
    return isGoatMode ? darkModeColors.accent : teamColors.primary;
  } else {
    return '#ef4444'; // red-500
  }
}

export default function PlayoffProbabilityCard({
  stats,
  isGoatMode,
  teamColors,
  darkModeColors
}: PlayoffProbabilityCardProps) {
  const probability = calculatePlayoffProbability(stats);
  const statusMessage = getStatusMessage(probability, stats);
  const probabilityColor = getProbabilityColor(probability, isGoatMode, teamColors, darkModeColors);

  // Calculate points needed context
  const pointsNeeded = Math.max(0, stats.playoffTarget - stats.totalPoints);
  const gamesRemaining = stats.gamesRemaining;
  const requiredPace = gamesRemaining > 0 ? (pointsNeeded / gamesRemaining).toFixed(2) : '0.00';

  return (
    <div
      className={`rounded-2xl p-3 md:p-4 shadow-xl mb-4 border-2 ${
        isGoatMode
          ? (darkModeColors.cardBackground ? '' : 'bg-zinc-900')
          : 'bg-white border-gray-200'
      }`}
      style={isGoatMode ? {
        backgroundColor: darkModeColors.cardBackground || darkModeColors.background,
        borderColor: darkModeColors.border
      } : undefined}
    >
      {/* Header */}
      <h3
        className={`text-lg md:text-xl font-bold mb-3 ${
          isGoatMode ? '' : ''
        }`}
        style={isGoatMode
          ? { color: darkModeColors.accent }
          : { color: teamColors.primary }
        }
      >
        Playoff Probability
      </h3>

      {/* Main content - probability and context */}
      <div className="flex items-center gap-4 md:gap-6">
        {/* Large probability circle */}
        <div
          className="relative flex-shrink-0 w-20 h-20 md:w-24 md:h-24 rounded-full flex items-center justify-center border-4"
          style={{
            borderColor: probabilityColor,
            backgroundColor: `${probabilityColor}15`
          }}
        >
          <span
            className="text-2xl md:text-3xl font-bold"
            style={{ color: probabilityColor }}
          >
            {probability}%
          </span>
        </div>

        {/* Context info */}
        <div className="flex-1 min-w-0">
          <p
            className={`text-base md:text-lg font-semibold mb-1 ${
              isGoatMode ? 'text-white' : 'text-gray-900'
            }`}
          >
            {statusMessage}
          </p>
          <p
            className={`text-xs md:text-sm ${
              isGoatMode ? 'text-zinc-400' : 'text-gray-600'
            }`}
          >
            Need {pointsNeeded} more points ({requiredPace} pts/game)
          </p>
          <p
            className={`text-xs md:text-sm mt-1 ${
              isGoatMode ? 'text-zinc-500' : 'text-gray-500'
            }`}
          >
            Projected: {stats.projectedPoints} pts • Target: {stats.playoffTarget} pts
          </p>
        </div>
      </div>
    </div>
  );
}
