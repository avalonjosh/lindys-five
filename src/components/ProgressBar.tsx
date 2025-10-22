import type { SeasonStats } from '../types';

interface ProgressBarProps {
  stats: SeasonStats;
  isGoatMode: boolean;
}

export default function ProgressBar({ stats, isGoatMode }: ProgressBarProps) {
  const { totalPoints, gamesPlayed, gamesRemaining, currentPace, projectedPoints, playoffTarget, pointsAboveBelow } = stats;

  // Calculate percentages for visual display
  const currentProgress = (totalPoints / playoffTarget) * 100;

  // Calculate where they SHOULD be at this point in the season (pro-rated)
  const expectedPointsAtThisStage = (playoffTarget / stats.totalGames) * gamesPlayed;
  const expectedProgress = (expectedPointsAtThisStage / playoffTarget) * 100;

  const isOnPace = projectedPoints >= playoffTarget;
  const paceColor = isGoatMode ? 'text-red-500' : 'text-sabres-blue';
  const barColor = isGoatMode ? 'bg-red-600' : 'bg-sabres-blue';

  return (
    <div className={`rounded-2xl p-4 md:p-6 shadow-xl mb-6 border ${
      isGoatMode
        ? 'bg-zinc-900 border-zinc-800'
        : 'bg-white border-gray-200'
    }`}>
      <h2 className={`text-xl md:text-2xl font-bold mb-3 md:mb-4 ${
        isGoatMode ? 'text-white' : 'text-sabres-navy'
      }`}>Season Progress</h2>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-4 md:mb-6">
        <div className={`rounded-xl p-3 md:p-4 border ${
          isGoatMode
            ? 'bg-gradient-to-br from-zinc-800 to-zinc-900 border-zinc-700'
            : 'bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200'
        }`}>
          <div className={`text-xs font-semibold uppercase tracking-wide mb-1 ${
            isGoatMode ? 'text-red-400' : 'text-sabres-blue'
          }`}>Games Played</div>
          <div className={`text-2xl md:text-3xl font-bold ${
            isGoatMode ? 'text-white' : 'text-sabres-navy'
          }`}>{gamesPlayed}</div>
          <div className={`text-xs mt-1 ${
            isGoatMode ? 'text-zinc-400' : 'text-gray-600'
          }`}>{gamesRemaining} remaining</div>
        </div>

        <div className={`rounded-xl p-3 md:p-4 border ${
          isGoatMode
            ? 'bg-gradient-to-br from-zinc-800 to-zinc-900 border-zinc-700'
            : 'bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200'
        }`}>
          <div className={`text-xs font-semibold uppercase tracking-wide mb-1 ${
            isGoatMode ? 'text-red-400' : 'text-sabres-blue'
          }`}>Current Points</div>
          <div className={`text-2xl md:text-3xl font-bold ${
            isGoatMode ? 'text-white' : 'text-sabres-navy'
          }`}>{totalPoints}</div>
          <div className={`text-xs mt-1 ${
            isGoatMode ? 'text-zinc-400' : 'text-gray-600'
          }`}>of {gamesPlayed * 2} possible</div>
        </div>

        <div className={`rounded-xl p-3 md:p-4 border ${
          isGoatMode
            ? 'bg-gradient-to-br from-zinc-800 to-zinc-900 border-zinc-700'
            : 'bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200'
        }`}>
          <div className={`text-xs font-semibold uppercase tracking-wide mb-1 ${
            isGoatMode ? 'text-red-400' : 'text-sabres-blue'
          }`}>Current Pace</div>
          <div className={`text-2xl md:text-3xl font-bold ${
            isGoatMode ? 'text-white' : 'text-sabres-navy'
          }`}>{currentPace.toFixed(2)}</div>
          <div className={`text-xs mt-1 ${
            isGoatMode ? 'text-zinc-400' : 'text-gray-600'
          }`}>pts/game (need {(playoffTarget / stats.totalGames).toFixed(2)})</div>
        </div>

        <div className={`rounded-xl p-3 md:p-4 border ${
          isGoatMode
            ? 'bg-gradient-to-br from-zinc-800 to-zinc-900 border-zinc-700'
            : 'bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200'
        }`}>
          <div className={`text-xs font-semibold uppercase tracking-wide mb-1 ${
            isGoatMode ? 'text-red-400' : 'text-sabres-blue'
          }`}>Projected</div>
          <div className={`text-2xl md:text-3xl font-bold ${
            isGoatMode ? 'text-white' : 'text-sabres-navy'
          }`}>{projectedPoints}</div>
          <div className={`text-xs mt-1 ${
            isGoatMode ? 'text-zinc-400' : 'text-gray-600'
          }`}>
            season total (need {playoffTarget})
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mb-4">
        <div className={`flex justify-between text-sm font-semibold mb-2 ${
          isGoatMode ? 'text-zinc-300' : 'text-gray-700'
        }`}>
          <span>Progress to Playoff Target ({playoffTarget} pts)</span>
          <span>{currentProgress.toFixed(1)}%</span>
        </div>
        {/* Add top padding to make room for the Expected label */}
        <div className="pt-10">
          <div className={`w-full rounded-full h-8 relative shadow-inner ${
            isGoatMode ? 'bg-zinc-800' : 'bg-gray-200'
          }`}>
          {/* Current points bar */}
          <div
            className={`${barColor} h-8 rounded-full transition-all duration-500 relative shadow-md`}
            style={{ width: `${Math.min(currentProgress, 100)}%` }}
          >
            {/* Show points label when there's enough room */}
            {currentProgress > 0 && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-white text-sm font-bold">
                <span className="hidden md:inline">{totalPoints}</span>
                <span className="md:hidden">{currentProgress > 8 ? totalPoints : ''}</span>
              </span>
            )}
          </div>

          {/* Expected pace marker - where they SHOULD be */}
          {gamesPlayed > 0 && (
            <div
              className="absolute top-0 h-8 flex flex-col items-center"
              style={{ left: `${Math.min(expectedProgress, 100)}%` }}
            >
              <div className="w-0.5 h-8 bg-white shadow-sm"></div>
              <div className={`absolute -top-8 text-xs font-bold px-2 py-1 rounded shadow-md whitespace-nowrap border ${
                isGoatMode
                  ? 'bg-zinc-900 text-white border-zinc-700'
                  : 'bg-white text-sabres-navy border-gray-300'
              }`}>
                Expected: {expectedPointsAtThisStage.toFixed(1)}
              </div>
            </div>
          )}

          {/* Playoff target marker - final goal */}
          <div
            className={`absolute top-0 h-8 w-1 ${
              isGoatMode ? 'bg-red-500' : 'bg-sabres-gold'
            }`}
            style={{ left: '100%' }}
          />
          </div>
        </div>

        {/* Points earned indicator */}
        {gamesPlayed > 0 && (
          <div className={`mt-2 text-sm ${
            isGoatMode ? 'text-zinc-300' : 'text-gray-600'
          }`}>
            <span className="font-semibold">Points Earned:</span>{' '}
            <span className={paceColor}>
              {totalPoints}
            </span>
          </div>
        )}
      </div>

      {/* Additional context - hidden on mobile for cleaner experience */}
      {gamesPlayed > 10 && (
        <div className={`mt-4 pt-4 border-t hidden md:block ${
          isGoatMode ? 'border-zinc-800' : 'border-gray-200'
        }`}>
          <div className={`text-sm ${
            isGoatMode ? 'text-zinc-300' : 'text-gray-600'
          }`}>
            <p>
              {isOnPace ? (
                <>
                  At the current pace, the Sabres are projected to finish with <span className={`font-semibold ${paceColor}`}>{projectedPoints} points</span>.
                  They can afford to earn {' '}
                  <span className="font-semibold">{(pointsAboveBelow / gamesRemaining).toFixed(1)} fewer points per game</span> over the remaining {gamesRemaining} games.
                </>
              ) : (
                <>
                  To reach the playoff target, the Sabres need approximately{' '}
                  <span className={`font-semibold ${paceColor}`}>{((playoffTarget - totalPoints) / gamesRemaining).toFixed(2)} points per game</span> over the remaining {gamesRemaining} games.
                </>
              )}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
