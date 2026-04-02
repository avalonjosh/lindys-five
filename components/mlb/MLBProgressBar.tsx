'use client';

import type { MLBSeasonStats } from '@/lib/types/mlb';

interface MLBProgressBarProps {
  stats: MLBSeasonStats;
  teamColors: {
    primary: string;
    secondary: string;
    accent: string;
  };
}

export default function MLBProgressBar({ stats, teamColors }: MLBProgressBarProps) {
  const { totalWins, totalLosses, gamesPlayed, gamesRemaining, winPct, projectedWins, playoffTarget, totalGames } = stats;

  const currentProgress = playoffTarget > 0 ? (totalWins / playoffTarget) * 100 : 0;
  const expectedWinsAtThisPoint = totalGames > 0 ? (gamesPlayed / totalGames) * playoffTarget : 0;
  const expectedProgress = playoffTarget > 0 ? (expectedWinsAtThisPoint / playoffTarget) * 100 : 0;

  const currentPace = gamesPlayed > 0 ? (totalWins / gamesPlayed).toFixed(3) : '0';
  const neededPace = totalGames > 0 ? (playoffTarget / totalGames).toFixed(3) : '0';

  const pointsDifference = totalWins - expectedWinsAtThisPoint;
  const indicatorColor = pointsDifference >= -0.05 ? 'border-t-green-500' : 'border-t-red-500';

  return (
    <div className="rounded-2xl p-3 md:p-4 shadow-xl mb-4 border-2 relative bg-white" style={{ borderColor: '#e5e7eb' }}>
      {/* Header */}
      <h3 className="text-xl md:text-2xl font-bold text-gray-900 mb-2 md:mb-3">
        Season Progress
      </h3>

      {/* Stats Grid — matches NHL exactly */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3 mb-3 md:mb-4">
        {/* Games Played */}
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-2 md:p-3 border border-blue-200">
          <div className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: teamColors.primary }}>
            Games Played
          </div>
          <div className="text-2xl md:text-3xl font-bold text-gray-900">{gamesPlayed}</div>
          <div className="text-xs text-gray-600 mt-1">{gamesRemaining} remaining</div>
        </div>

        {/* Current Wins */}
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-2 md:p-3 border border-blue-200">
          <div className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: teamColors.primary }}>
            Current Wins
          </div>
          <div className="text-2xl md:text-3xl font-bold text-gray-900">{totalWins}</div>
          <div className="text-xs text-gray-600 mt-1">
            {totalWins}-{totalLosses} ({gamesPlayed > 0 ? `${(winPct * 100).toFixed(1)}%` : '—'})
          </div>
        </div>

        {/* Win Pace */}
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-2 md:p-3 border border-blue-200">
          <div className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: teamColors.primary }}>
            Win Pace
          </div>
          <div className="text-2xl md:text-3xl font-bold text-gray-900">{currentPace}</div>
          <div className="text-xs text-gray-600 mt-1">wins/game (need {neededPace})</div>
        </div>

        {/* Projected */}
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-2 md:p-3 border border-blue-200">
          <div className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: teamColors.primary }}>
            Projected
          </div>
          <div className="text-2xl md:text-3xl font-bold text-gray-900">
            {gamesPlayed > 0 ? projectedWins : '—'}
          </div>
          <div className="text-xs text-gray-600 mt-1">
            {gamesPlayed > 0 ? `season total (need ${playoffTarget})` : '—'}
          </div>
        </div>
      </div>

      {/* Progress Bar — matches NHL exactly: h-8, rounded-full, shadow-inner, rounded-l-full fill */}
      {gamesPlayed > 0 && (
        <div className="mb-4">
          <div className="flex justify-end text-sm font-semibold mb-2 text-gray-700">
            <span>{currentProgress.toFixed(1)}%</span>
          </div>
          <div className="w-full rounded-full h-8 relative shadow-inner bg-gray-200">
            {/* Current wins bar */}
            <div
              className="h-8 rounded-l-full transition-all duration-500 relative shadow-md flex items-center justify-end"
              style={{ width: `${Math.max(Math.min(currentProgress, 100), 5)}%`, backgroundColor: teamColors.primary }}
            >
              {currentProgress > 0 && (
                <span className="pr-1.5 md:pr-3 text-[10px] md:text-sm font-bold text-white whitespace-nowrap">
                  {totalWins}
                </span>
              )}
            </div>

            {/* Expected pace marker — triangle + white line, same as NHL */}
            <div
              className="absolute top-0 h-8 flex flex-col items-center"
              style={{ left: `calc(${Math.min(expectedProgress, 100)}% - 4px)` }}
            >
              <div className={`w-0 h-0 border-l-[4px] border-r-[4px] border-t-[5px] border-l-transparent border-r-transparent -mb-px ${indicatorColor}`} />
              {currentProgress <= expectedProgress && (
                <div className="w-0.5 h-8 bg-white shadow-sm" />
              )}
            </div>
          </div>

          {/* Expected text below bar — matches NHL exactly */}
          <div className="mt-2 text-xs flex items-center gap-1 text-gray-600">
            <div className={`w-0 h-0 border-l-[4px] border-r-[4px] border-t-[5px] border-l-transparent border-r-transparent ${indicatorColor}`} />
            <span>
              <span className="font-semibold">Expected:</span> {expectedWinsAtThisPoint.toFixed(1)} wins
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
