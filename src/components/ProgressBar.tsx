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

  // Determine Expected indicator color based on performance
  const pointsDifference = totalPoints - expectedPointsAtThisStage;
  let indicatorColor = '';
  if (Math.abs(pointsDifference) < 1) {
    // Close to pace - neutral gray
    indicatorColor = isGoatMode ? 'border-t-zinc-400' : 'border-t-gray-600';
  } else if (pointsDifference > 0) {
    // Ahead of pace - green
    indicatorColor = 'border-t-green-500';
  } else {
    // Behind pace - red
    indicatorColor = 'border-t-red-500';
  }

  return (
    <div className={`rounded-2xl p-3 md:p-4 shadow-xl mb-4 border ${
      isGoatMode
        ? 'bg-zinc-900 border-zinc-800'
        : 'bg-white border-gray-200'
    }`}>
      <h2 className={`text-xl md:text-2xl font-bold mb-2 md:mb-3 ${
        isGoatMode ? 'text-white' : 'text-sabres-navy'
      }`}>Season Progress</h2>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3 mb-3 md:mb-4">
        <div className={`rounded-xl p-2 md:p-3 border ${
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

        <div className={`rounded-xl p-2 md:p-3 border ${
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

        <div className={`rounded-xl p-2 md:p-3 border ${
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

        <div className={`rounded-xl p-2 md:p-3 border ${
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
        <div className={`flex justify-end text-sm font-semibold mb-2 ${
          isGoatMode ? 'text-zinc-300' : 'text-gray-700'
        }`}>
          <span>{currentProgress.toFixed(1)}%</span>
        </div>
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
              <span className="absolute right-2 md:right-3 top-1/2 -translate-y-1/2 text-white text-xs md:text-sm font-bold">
                {totalPoints}
              </span>
            )}
          </div>

          {/* Expected pace marker - white line indicator with triangle */}
          {gamesPlayed > 0 && (
            <div
              className="absolute top-0 h-8 flex flex-col items-center"
              style={{ left: `${Math.min(expectedProgress, 100)}%` }}
            >
              {/* Triangle pointing down at top of line - color coded by performance */}
              <div className={`w-0 h-0 border-l-[4px] border-r-[4px] border-t-[5px] border-l-transparent border-r-transparent -mb-px ${indicatorColor}`}></div>
              <div className="w-0.5 h-8 bg-white shadow-sm"></div>
            </div>
          )}
        </div>

        {/* Text indicator below bar with matching triangle */}
        {gamesPlayed > 0 && (
          <div className={`mt-2 text-xs flex items-center gap-1 ${
            isGoatMode ? 'text-zinc-400' : 'text-gray-600'
          }`}>
            {/* Triangle icon matching the one on the bar - color coded by performance */}
            <div className={`w-0 h-0 border-l-[4px] border-r-[4px] border-t-[5px] border-l-transparent border-r-transparent ${indicatorColor}`}></div>
            <span>
              <span className="font-semibold">Expected:</span> {expectedPointsAtThisStage.toFixed(1)} pts
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
