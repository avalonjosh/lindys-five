import type { SeasonStats } from '../types';

interface ProgressBarProps {
  stats: SeasonStats;
  isGoatMode: boolean;
  yearOverYearMode?: boolean;
  onYearOverYearToggle?: () => void;
  lastSeasonStats?: SeasonStats;
}

// Helper function to render a season section
function SeasonSection({
  stats,
  isGoatMode,
  isLastYear = false,
  currentYearStats,
  lastSeasonLabel
}: {
  stats: SeasonStats;
  isGoatMode: boolean;
  isLastYear?: boolean;
  currentYearStats?: SeasonStats;
  lastSeasonLabel?: string;
}) {
  const { totalPoints, gamesPlayed, gamesRemaining, currentPace, projectedPoints, playoffTarget, pointsAboveBelow } = stats;

  // Calculate differences for last year section
  const pointsDiff = isLastYear && currentYearStats ? totalPoints - currentYearStats.totalPoints : 0;
  const paceDiff = isLastYear && currentYearStats ? currentPace - currentYearStats.currentPace : 0;
  const projectedDiff = isLastYear && currentYearStats ? projectedPoints - currentYearStats.projectedPoints : 0;

  // Calculate percentages for visual display
  const currentProgress = (totalPoints / playoffTarget) * 100;

  // Calculate where they SHOULD be at this point in the season (pro-rated)
  const expectedPointsAtThisStage = (playoffTarget / stats.totalGames) * gamesPlayed;
  const expectedProgress = (expectedPointsAtThisStage / playoffTarget) * 100;

  const isOnPace = projectedPoints >= playoffTarget;
  const paceColor = isGoatMode ? 'text-red-500' : 'text-sabres-blue';
  const barColor = isLastYear
    ? isGoatMode
      ? 'bg-zinc-600'
      : 'bg-slate-500'
    : isGoatMode ? 'bg-red-600' : 'bg-sabres-blue';

  // Determine Expected indicator color based on performance
  const pointsDifference = totalPoints - expectedPointsAtThisStage;
  const indicatorColor = pointsDifference >= 0 ? 'border-t-green-500' : 'border-t-red-500';

  return (
    <>
      <h3 className={`text-xl md:text-2xl font-bold mb-2 md:mb-3 ${
        isLastYear
          ? isGoatMode ? 'text-zinc-400' : 'text-slate-600'
          : isGoatMode ? 'text-white' : 'text-sabres-navy'
      }`}>
        {isLastYear ? `Last Year (${lastSeasonLabel})` : 'Season Progress'}
      </h3>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3 mb-3 md:mb-4">
        {/* Games Played Card */}
        <div className={`rounded-xl p-2 md:p-3 border ${
          isLastYear
            ? isGoatMode
              ? 'bg-gradient-to-br from-zinc-800/60 to-zinc-900/60 border-zinc-600'
              : 'bg-gradient-to-br from-slate-100 to-slate-200 border-slate-300'
            : isGoatMode
              ? 'bg-gradient-to-br from-zinc-800 to-zinc-900 border-zinc-700'
              : 'bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200'
        }`}>
          <div className={`text-xs font-semibold uppercase tracking-wide mb-1 ${
            isLastYear
              ? isGoatMode ? 'text-zinc-500' : 'text-slate-600'
              : isGoatMode ? 'text-red-400' : 'text-sabres-blue'
          }`}>Games Played</div>
          <div className={`text-2xl md:text-3xl font-bold ${
            isLastYear
              ? isGoatMode ? 'text-zinc-400' : 'text-slate-700'
              : isGoatMode ? 'text-white' : 'text-sabres-navy'
          }`}>{gamesPlayed}</div>
          <div className={`text-xs mt-1 ${
            isLastYear
              ? isGoatMode ? 'text-zinc-600' : 'text-slate-500'
              : isGoatMode ? 'text-zinc-400' : 'text-gray-600'
          }`}>{gamesRemaining} remaining</div>
        </div>

        {/* Current Points Card */}
        <div className={`rounded-xl p-2 md:p-3 border ${
          isLastYear
            ? isGoatMode
              ? 'bg-gradient-to-br from-zinc-800/60 to-zinc-900/60 border-zinc-600'
              : 'bg-gradient-to-br from-slate-100 to-slate-200 border-slate-300'
            : isGoatMode
              ? 'bg-gradient-to-br from-zinc-800 to-zinc-900 border-zinc-700'
              : 'bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200'
        }`}>
          <div className={`text-xs font-semibold uppercase tracking-wide mb-1 ${
            isLastYear
              ? isGoatMode ? 'text-zinc-500' : 'text-slate-600'
              : isGoatMode ? 'text-red-400' : 'text-sabres-blue'
          }`}>Current Points</div>
          <div className={`text-2xl md:text-3xl font-bold flex items-center gap-2 ${
            isLastYear
              ? isGoatMode ? 'text-zinc-400' : 'text-slate-700'
              : isGoatMode ? 'text-white' : 'text-sabres-navy'
          }`}>
            {totalPoints}
            {isLastYear && pointsDiff !== 0 && (
              <span className={`text-sm font-semibold ${
                pointsDiff < 0 ? 'text-amber-500' : 'text-red-600'
              }`}>
                {pointsDiff < 0 ? '+' : ''}{Math.abs(pointsDiff)}
              </span>
            )}
          </div>
          <div className={`text-xs mt-1 ${
            isLastYear
              ? isGoatMode ? 'text-zinc-600' : 'text-slate-500'
              : isGoatMode ? 'text-zinc-400' : 'text-gray-600'
          }`}>of {gamesPlayed * 2} possible</div>
        </div>

        {/* Current Pace Card */}
        <div className={`rounded-xl p-2 md:p-3 border ${
          isLastYear
            ? isGoatMode
              ? 'bg-gradient-to-br from-zinc-800/60 to-zinc-900/60 border-zinc-600'
              : 'bg-gradient-to-br from-slate-100 to-slate-200 border-slate-300'
            : isGoatMode
              ? 'bg-gradient-to-br from-zinc-800 to-zinc-900 border-zinc-700'
              : 'bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200'
        }`}>
          <div className={`text-xs font-semibold uppercase tracking-wide mb-1 ${
            isLastYear
              ? isGoatMode ? 'text-zinc-500' : 'text-slate-600'
              : isGoatMode ? 'text-red-400' : 'text-sabres-blue'
          }`}>Current Pace</div>
          <div className={`text-2xl md:text-3xl font-bold flex items-center gap-2 ${
            isLastYear
              ? isGoatMode ? 'text-zinc-400' : 'text-slate-700'
              : isGoatMode ? 'text-white' : 'text-sabres-navy'
          }`}>
            {currentPace.toFixed(2)}
            {isLastYear && paceDiff !== 0 && (
              <span className={`text-sm font-semibold ${
                paceDiff < 0 ? 'text-amber-500' : 'text-red-600'
              }`}>
                {paceDiff < 0 ? '+' : ''}{Math.abs(paceDiff).toFixed(2)}
              </span>
            )}
          </div>
          <div className={`text-xs mt-1 ${
            isLastYear
              ? isGoatMode ? 'text-zinc-600' : 'text-slate-500'
              : isGoatMode ? 'text-zinc-400' : 'text-gray-600'
          }`}>pts/game (need {(playoffTarget / stats.totalGames).toFixed(2)})</div>
        </div>

        {/* Projected Card */}
        <div className={`rounded-xl p-2 md:p-3 border ${
          isLastYear
            ? isGoatMode
              ? 'bg-gradient-to-br from-zinc-800/60 to-zinc-900/60 border-zinc-600'
              : 'bg-gradient-to-br from-slate-100 to-slate-200 border-slate-300'
            : isGoatMode
              ? 'bg-gradient-to-br from-zinc-800 to-zinc-900 border-zinc-700'
              : 'bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200'
        }`}>
          <div className={`text-xs font-semibold uppercase tracking-wide mb-1 ${
            isLastYear
              ? isGoatMode ? 'text-zinc-500' : 'text-slate-600'
              : isGoatMode ? 'text-red-400' : 'text-sabres-blue'
          }`}>Projected</div>
          <div className={`text-2xl md:text-3xl font-bold flex items-center gap-2 ${
            isLastYear
              ? isGoatMode ? 'text-zinc-400' : 'text-slate-700'
              : isGoatMode ? 'text-white' : 'text-sabres-navy'
          }`}>
            {projectedPoints}
            {isLastYear && projectedDiff !== 0 && (
              <span className={`text-sm font-semibold ${
                projectedDiff < 0 ? 'text-amber-500' : 'text-red-600'
              }`}>
                {projectedDiff < 0 ? '+' : ''}{Math.abs(projectedDiff)}
              </span>
            )}
          </div>
          <div className={`text-xs mt-1 ${
            isLastYear
              ? isGoatMode ? 'text-zinc-600' : 'text-slate-500'
              : isGoatMode ? 'text-zinc-400' : 'text-gray-600'
          }`}>
            season total (need {playoffTarget})
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className={isLastYear ? '' : 'mb-4'}>
        <div className={`flex justify-end text-sm font-semibold mb-2 ${
          isLastYear
            ? isGoatMode ? 'text-zinc-500' : 'text-slate-600'
            : isGoatMode ? 'text-zinc-300' : 'text-gray-700'
        }`}>
          <span>{currentProgress.toFixed(1)}%</span>
        </div>
        <div className={`w-full rounded-full h-8 relative shadow-inner ${
          isLastYear
            ? isGoatMode ? 'bg-zinc-800/50' : 'bg-slate-200'
            : isGoatMode ? 'bg-zinc-800' : 'bg-gray-200'
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

          {/* Expected pace marker - only show for current year */}
          {!isLastYear && gamesPlayed > 0 && (
            <div
              className="absolute top-0 h-8 flex flex-col items-center"
              style={{ left: `${Math.min(expectedProgress, 100)}%` }}
            >
              <div className={`w-0 h-0 border-l-[4px] border-r-[4px] border-t-[5px] border-l-transparent border-r-transparent -mb-px ${indicatorColor}`}></div>
              {currentProgress <= expectedProgress && (
                <div className="w-0.5 h-8 bg-white shadow-sm"></div>
              )}
            </div>
          )}
        </div>

        {/* Text indicator below bar - only show for current year */}
        {!isLastYear && gamesPlayed > 0 && (
          <div className={`mt-2 text-xs flex items-center gap-1 ${
            isGoatMode ? 'text-zinc-400' : 'text-gray-600'
          }`}>
            <div className={`w-0 h-0 border-l-[4px] border-r-[4px] border-t-[5px] border-l-transparent border-r-transparent ${indicatorColor}`}></div>
            <span>
              <span className="font-semibold">Expected:</span> {expectedPointsAtThisStage.toFixed(1)} pts
            </span>
          </div>
        )}
      </div>

      {/* Additional context - only show for current year, hidden on mobile */}
      {!isLastYear && gamesPlayed > 10 && (
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
    </>
  );
}

export default function ProgressBar({ stats, isGoatMode, yearOverYearMode, onYearOverYearToggle, lastSeasonStats }: ProgressBarProps) {
  // Calculate the last season label dynamically
  // Current season is 2025-2026, so we get the start year (2025) and format as "24-25"
  const currentDate = new Date();
  const currentMonth = currentDate.getMonth(); // 0-11
  const currentYear = currentDate.getFullYear();

  // NHL season typically starts in October (month 9)
  // If we're before October, we're still in the previous season
  const seasonStartYear = currentMonth >= 9 ? currentYear : currentYear - 1;

  // Last season would be one year before
  const lastSeasonStartYear = seasonStartYear - 1;
  const lastSeasonEndYear = seasonStartYear;

  // Format as "YY-YY" (e.g., "24-25")
  const lastSeasonLabel = `${String(lastSeasonStartYear).slice(-2)}-${String(lastSeasonEndYear).slice(-2)}`;

  return (
    <div className={`rounded-2xl p-3 md:p-4 shadow-xl mb-4 border-2 relative ${
      isGoatMode
        ? 'bg-zinc-900 border-zinc-800'
        : 'bg-white border-gray-200'
    }`}>
      {/* Year-over-Year Toggle Text Button */}
      {onYearOverYearToggle && (
        <button
          onClick={onYearOverYearToggle}
          className={`absolute top-3 md:top-4 right-3 md:right-4 flex items-center gap-1 text-xs md:text-sm font-semibold transition-all focus:outline-none group ${
            yearOverYearMode
              ? isGoatMode
                ? 'text-red-400'
                : 'text-sabres-blue'
              : isGoatMode
                ? 'text-zinc-500 hover:text-zinc-400'
                : 'text-gray-500 hover:text-gray-700'
          }`}
          title={yearOverYearMode ? `Hide ${lastSeasonLabel} comparison` : `Compare to ${lastSeasonLabel}`}
        >
          <span className={yearOverYearMode ? 'underline decoration-2 underline-offset-2' : ''}>
            vs Last Year
          </span>
          <svg
            className={`w-3 h-3 transition-transform ${yearOverYearMode ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      )}

      {/* Current Year Section */}
      <SeasonSection stats={stats} isGoatMode={isGoatMode} />

      {/* Divider and Last Year Section */}
      {lastSeasonStats && (
        <>
          {/* Visual Divider */}
          <div className={`my-6 border-t-2 border-dashed ${
            isGoatMode ? 'border-zinc-700' : 'border-gray-300'
          }`}></div>

          {/* Last Year Section */}
          <SeasonSection
            stats={lastSeasonStats}
            isGoatMode={isGoatMode}
            isLastYear={true}
            currentYearStats={stats}
            lastSeasonLabel={lastSeasonLabel}
          />
        </>
      )}
    </div>
  );
}
