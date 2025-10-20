import type { SeasonStats } from '../types';

interface ProgressBarProps {
  stats: SeasonStats;
}

export default function ProgressBar({ stats }: ProgressBarProps) {
  const { totalPoints, gamesPlayed, gamesRemaining, currentPace, projectedPoints, playoffTarget, pointsAboveBelow } = stats;

  // Calculate percentages for visual display
  const currentProgress = (totalPoints / playoffTarget) * 100;

  // Calculate where they SHOULD be at this point in the season (pro-rated)
  const expectedPointsAtThisStage = (playoffTarget / stats.totalGames) * gamesPlayed;
  const expectedProgress = (expectedPointsAtThisStage / playoffTarget) * 100;

  const isOnPace = projectedPoints >= playoffTarget;
  const paceColor = 'text-sabres-blue';
  const barColor = 'bg-sabres-blue';

  return (
    <div className="bg-white rounded-2xl p-6 shadow-xl mb-6 border border-gray-200">
      <h2 className="text-2xl font-bold text-sabres-navy mb-4">Season Progress</h2>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-4 border border-blue-200">
          <div className="text-sabres-blue text-xs font-semibold uppercase tracking-wide mb-1">Games Played</div>
          <div className="text-sabres-navy text-3xl font-bold">{gamesPlayed}</div>
          <div className="text-gray-600 text-xs mt-1">{gamesRemaining} remaining</div>
        </div>

        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-4 border border-blue-200">
          <div className="text-sabres-blue text-xs font-semibold uppercase tracking-wide mb-1">Current Points</div>
          <div className="text-sabres-navy text-3xl font-bold">{totalPoints}</div>
          <div className="text-gray-600 text-xs mt-1">of {stats.totalGames * 2} possible</div>
        </div>

        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-4 border border-blue-200">
          <div className="text-sabres-blue text-xs font-semibold uppercase tracking-wide mb-1">Current Pace</div>
          <div className="text-sabres-navy text-3xl font-bold">{currentPace.toFixed(2)}</div>
          <div className="text-gray-600 text-xs mt-1">pts/game</div>
        </div>

        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-4 border border-blue-200">
          <div className="text-sabres-blue text-xs font-semibold uppercase tracking-wide mb-1">Projected</div>
          <div className="text-sabres-navy text-3xl font-bold">{projectedPoints}</div>
          <div className="text-gray-600 text-xs mt-1">
            {isOnPace ? `+${pointsAboveBelow}` : pointsAboveBelow} vs target
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mb-4">
        <div className="flex justify-between text-gray-700 text-sm font-semibold mb-2">
          <span>Progress to Playoff Target ({playoffTarget} pts)</span>
          <span>{currentProgress.toFixed(1)}%</span>
        </div>
        {/* Add top padding to make room for the Expected label */}
        <div className="pt-10">
          <div className="w-full bg-gray-200 rounded-full h-8 relative shadow-inner">
          {/* Current points bar */}
          <div
            className={`${barColor} h-8 rounded-full transition-all duration-500 flex items-center justify-end pr-3 shadow-md`}
            style={{ width: `${Math.min(currentProgress, 100)}%` }}
          >
            <span className="text-white text-sm font-bold">{totalPoints}</span>
          </div>

          {/* Expected pace marker - where they SHOULD be */}
          {gamesPlayed > 0 && (
            <div
              className="absolute top-0 h-8 flex flex-col items-center"
              style={{ left: `${Math.min(expectedProgress, 100)}%` }}
            >
              <div className="w-0.5 h-8 bg-white shadow-sm"></div>
              <div className="absolute -top-8 bg-white text-sabres-navy text-xs font-bold px-2 py-1 rounded shadow-md whitespace-nowrap border border-gray-300">
                Expected: {expectedPointsAtThisStage.toFixed(1)}
              </div>
            </div>
          )}

          {/* Playoff target marker - final goal */}
          <div
            className="absolute top-0 h-8 w-1 bg-sabres-gold"
            style={{ left: '100%' }}
          />
          </div>
        </div>

        {/* Projected finish indicator */}
        {gamesPlayed > 0 && (
          <div className="mt-2 text-sm text-gray-600">
            <span className="font-semibold">Projected finish:</span>{' '}
            <span className={paceColor}>
              {projectedPoints} points
            </span>
            <span className="text-gray-600 ml-2">
              ({isOnPace ? '+' : ''}{pointsAboveBelow} vs playoff target)
            </span>
          </div>
        )}
      </div>

      {/* Additional context */}
      {gamesPlayed > 10 && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="text-sm text-gray-600">
            <p>
              {isOnPace ? (
                <>
                  At the current pace, the Sabres are projected to finish with <span className="font-semibold text-sabres-blue">{projectedPoints} points</span>.
                  They can afford to earn {' '}
                  <span className="font-semibold">{(pointsAboveBelow / gamesRemaining).toFixed(1)} fewer points per game</span> over the remaining {gamesRemaining} games.
                </>
              ) : (
                <>
                  To reach the playoff target, the Sabres need approximately{' '}
                  <span className="font-semibold text-sabres-blue">{((playoffTarget - totalPoints) / gamesRemaining).toFixed(2)} points per game</span> over the remaining {gamesRemaining} games.
                </>
              )}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
