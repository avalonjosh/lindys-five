'use client';

import { useState, useEffect } from 'react';
import { MoreHorizontal, X as XIcon, Link as LinkIcon, Check, ChevronDown } from 'lucide-react';
import type { SeasonStats } from '@/lib/types';
import { getProbabilityColor, probabilityForFinalPoints, computePositionAwareProbability } from '@/lib/utils/playoffProbability';
import { trackClick } from '@/lib/analytics';

const TOTAL_GAMES = 82;
const HISTORICAL_FLOOR = 94;

interface CutLineState {
  effectiveCutLine: number;
  divisionCutLine: number;
  wildcardCutLine: number;
  activePath: 'division' | 'wildcard';
  wc2TeamAbbrev: string;
  divBubbleTeamAbbrev: string;
  isInPlayoffPosition: boolean;
  clinchIndicator?: string;
}

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

interface ProgressBarProps {
  stats: SeasonStats;
  isGoatMode: boolean;
  yearOverYearMode?: boolean;
  yearOverYearLoading?: boolean;
  onYearOverYearToggle?: () => void;
  lastSeasonStats?: SeasonStats;
  teamColors: TeamColors;
  darkModeColors: DarkModeColors;
  teamId: string;
  showShareButton?: boolean;
  teamName?: string;
  teamAbbrev: string;
  onClinchDetected?: (indicator: string) => void;
  celebrateOverride?: boolean;
  inPlayoffs?: boolean;
  playoffFetchLoaded?: boolean;
}

// Helper function to render a season section
function SeasonSection({
  stats,
  isGoatMode,
  isLastYear = false,
  currentYearStats,
  lastSeasonLabel,
  teamColors,
  darkModeColors,
  teamId,
  probability,
  probabilityColor,
  playoffExpanded,
  onPlayoffToggle,
  cutLineData,
  cutLineLoading,
  cutLineError,
  lindysFiveProbability,
  teamName,
  celebrateOverride,
  inPlayoffs,
  playoffFetchLoaded,
  collapsed,
  onCollapseToggle,
}: {
  stats: SeasonStats;
  isGoatMode: boolean;
  isLastYear?: boolean;
  currentYearStats?: SeasonStats;
  lastSeasonLabel?: string;
  teamColors: TeamColors;
  darkModeColors: DarkModeColors;
  teamId: string;
  probability?: number;
  probabilityColor?: string;
  playoffExpanded?: boolean;
  onPlayoffToggle?: () => void;
  cutLineData?: CutLineState | null;
  cutLineLoading?: boolean;
  cutLineError?: boolean;
  lindysFiveProbability?: number;
  teamName?: string;
  celebrateOverride?: boolean;
  inPlayoffs?: boolean;
  playoffFetchLoaded?: boolean;
  collapsed?: boolean;
  onCollapseToggle?: () => void;
}) {
  const { totalPoints, gamesPlayed, gamesRemaining, currentPace, projectedPoints, playoffTarget } = stats;

  // Team color classes - dynamically computed based on team colors
  const labelColor = isLastYear
    ? (isGoatMode ? 'text-zinc-500' : 'text-slate-600')
    : (isGoatMode ? (darkModeColors.cardBackground ? '' : '') : '');
  const labelStyle = isLastYear
    ? undefined
    : (isGoatMode
        ? (darkModeColors.cardBackground ? { color: darkModeColors.accent } : { color: darkModeColors.accent })
        : { color: teamColors.primary });

  const valueColor = isLastYear
    ? (isGoatMode ? 'text-zinc-400' : 'text-slate-700')
    : (isGoatMode ? (darkModeColors.cardBackground ? '' : 'text-white') : 'text-gray-900');
  const valueStyle = isLastYear
    ? undefined
    : (isGoatMode && darkModeColors.cardBackground ? { color: darkModeColors.text } : undefined);

  // Calculate differences for last year section
  const pointsDiff = isLastYear && currentYearStats ? totalPoints - currentYearStats.totalPoints : 0;
  const paceDiff = isLastYear && currentYearStats ? currentPace - currentYearStats.currentPace : 0;
  const projectedDiff = isLastYear && currentYearStats ? projectedPoints - currentYearStats.projectedPoints : 0;

  // Calculate percentages for visual display
  const currentProgress = (totalPoints / playoffTarget) * 100;

  // Calculate where they SHOULD be at this point in the season (pro-rated)
  const expectedPointsAtThisStage = (playoffTarget / stats.totalGames) * gamesPlayed;
  const expectedProgress = (expectedPointsAtThisStage / playoffTarget) * 100;

  const barColor = isLastYear
    ? isGoatMode
      ? '#52525b'
      : '#64748b'
    : isGoatMode ? darkModeColors.accent : teamColors.primary;

  // Calculate text color for points label inside progress bar
  const barTextColor = !isLastYear && isGoatMode && darkModeColors.accent === '#FFFFFF' ? '#002868' : '#FFFFFF';

  // Determine Expected indicator color based on performance
  const pointsDifference = totalPoints - expectedPointsAtThisStage;
  // Use a small threshold (0.05) to account for floating-point precision
  // Green if at or above expected (within 0.05 points tolerance)
  const indicatorColor = pointsDifference >= -0.05 ? 'border-t-green-500' : 'border-t-red-500';

  return (
    <>
      {/* Header row with title and centered pill (desktop) */}
      <div className={`relative flex items-center justify-between gap-2 ${collapsed ? '' : 'mb-2 md:mb-3'}`}>
        <h3
          className={`text-xl md:text-2xl font-bold ${valueColor}`}
          style={valueStyle}
        >
          {isLastYear ? `Last Year (${lastSeasonLabel})` : inPlayoffs ? 'Regular Season Progress' : 'Season Progress'}
        </h3>

        {/* Collapse/expand chevron (only shown when onCollapseToggle is provided, i.e. playoff mode) */}
        {onCollapseToggle && (
          <button
            type="button"
            onClick={onCollapseToggle}
            className={`flex-shrink-0 p-1 rounded transition-colors ${
              isGoatMode ? 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
            }`}
            aria-label={collapsed ? 'Expand Regular Season Progress' : 'Collapse Regular Season Progress'}
            title={collapsed ? 'Expand' : 'Collapse'}
          >
            <ChevronDown size={20} className={`transition-transform duration-200 ${collapsed ? '' : 'rotate-180'}`} />
          </button>
        )}

        {/* Desktop: Absolutely centered Playoff Probability text link */}
        {!isLastYear && !collapsed && probability !== undefined && onPlayoffToggle && (
          <div className="hidden md:flex absolute inset-0 justify-center items-center pointer-events-none">
            <button
              onClick={onPlayoffToggle}
              className="flex items-center gap-1 text-sm font-semibold transition-all focus:outline-none pointer-events-auto"
              style={{ color: probabilityColor }}
              title={playoffExpanded ? 'Hide playoff details' : 'Show playoff details'}
            >
              <span className={playoffExpanded ? 'underline decoration-2 underline-offset-2' : ''}>
                Playoff Probability: {cutLineLoading && stats.gamesPlayed >= 10 ? '--%' : `${probability}%`}
              </span>
              <ChevronDown
                size={14}
                className={`transition-transform duration-200 ${playoffExpanded ? 'rotate-180' : ''}`}
              />
            </button>
          </div>
        )}
      </div>

      {/* When collapsed, everything below the header is hidden */}
      {collapsed ? null : (
      <>

      {/* Clinch / Elimination banner — suppressed once the team is in the playoffs; also suppressed while we don't yet know (avoids a load-time flash for playoff teams) */}
      {!isLastYear && !inPlayoffs && playoffFetchLoaded !== false && cutLineData?.clinchIndicator && (
        <div className={`mb-3 px-3 py-2 rounded-lg text-center text-sm font-bold ${
          cutLineData.clinchIndicator === 'e'
            ? 'bg-red-50 text-red-700 border border-red-200'
            : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
        }`}>
          {cutLineData.clinchIndicator === 'e' && 'Eliminated from Playoff Contention'}
          {cutLineData.clinchIndicator === 'x' && 'Clinched Playoff Spot'}
          {cutLineData.clinchIndicator === 'y' && 'Clinched Division'}
          {cutLineData.clinchIndicator === 'z' && "Clinched Presidents' Trophy"}
          {cutLineData.clinchIndicator === 'p' && "Clinched Presidents' Trophy"}
        </div>
      )}

      {/* Sabres drought banner — suppressed once the team is in the playoffs; also suppressed while the playoff fetch is still pending */}
      {!isLastYear && !inPlayoffs && playoffFetchLoaded !== false && teamId === 'sabres' && (celebrateOverride || (cutLineData?.clinchIndicator && cutLineData.clinchIndicator !== 'e')) && (
        <div
          className="mb-3 py-3 px-4 rounded-lg text-center overflow-hidden relative"
          style={{ background: 'linear-gradient(135deg, #002654 0%, #003A7A 50%, #002654 100%)' }}
        >
          <div
            className="absolute inset-0 opacity-20"
            style={{
              background: 'repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(255,185,29,0.15) 10px, rgba(255,185,29,0.15) 20px)',
            }}
          />
          <p className="relative text-lg sm:text-xl md:text-2xl font-black tracking-wide" style={{ color: '#FFB91D' }}>
            The 14-Year Drought Is Over!
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3 mb-3 md:mb-4">
        {/* Games Played Card */}
        <div
          className={`rounded-xl p-2 md:p-3 border ${
            isLastYear
              ? isGoatMode
                ? 'bg-gradient-to-br from-zinc-800/60 to-zinc-900/60 border-zinc-600'
                : 'bg-gradient-to-br from-slate-100 to-slate-200 border-slate-300'
              : isGoatMode
                ? (darkModeColors.cardBackground ? '' : 'bg-gradient-to-br from-zinc-800 to-zinc-900 border-zinc-700')
                : 'bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200'
          }`}
          style={!isLastYear && isGoatMode && darkModeColors.cardBackground ? {
            background: `linear-gradient(to bottom right, ${darkModeColors.cardBackground}f0, ${darkModeColors.cardBackground}e0)`,
            borderColor: darkModeColors.border
          } : undefined}
        >
          <div className={`text-xs font-semibold uppercase tracking-wide mb-1 ${labelColor}`} style={labelStyle}>Games Played</div>
          <div className={`text-2xl md:text-3xl font-bold ${valueColor}`} style={valueStyle}>{gamesPlayed}</div>
          <div
            className={`text-xs mt-1 ${
              isLastYear
                ? isGoatMode ? 'text-zinc-600' : 'text-slate-500'
                : isGoatMode ? (darkModeColors.cardBackground ? '' : 'text-zinc-400') : 'text-gray-600'
            }`}
            style={!isLastYear && isGoatMode && darkModeColors.cardBackground ? { color: `${darkModeColors.text}80` } : undefined}
          >{gamesRemaining} remaining</div>
        </div>

        {/* Current Points Card */}
        <div
          className={`rounded-xl p-2 md:p-3 border ${
            isLastYear
              ? isGoatMode
                ? 'bg-gradient-to-br from-zinc-800/60 to-zinc-900/60 border-zinc-600'
                : 'bg-gradient-to-br from-slate-100 to-slate-200 border-slate-300'
              : isGoatMode
                ? (darkModeColors.cardBackground ? '' : 'bg-gradient-to-br from-zinc-800 to-zinc-900 border-zinc-700')
                : 'bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200'
          }`}
          style={!isLastYear && isGoatMode && darkModeColors.cardBackground ? {
            background: `linear-gradient(to bottom right, ${darkModeColors.cardBackground}f0, ${darkModeColors.cardBackground}e0)`,
            borderColor: darkModeColors.border
          } : undefined}
        >
          <div className={`text-xs font-semibold uppercase tracking-wide mb-1 ${labelColor}`} style={labelStyle}>Current Points</div>
          <div className={`text-2xl md:text-3xl font-bold flex items-center gap-2 ${valueColor}`} style={valueStyle}>
            {totalPoints}
            {isLastYear && pointsDiff !== 0 && (
              <span className={`text-sm font-semibold ${
                teamId === 'sabres'
                  ? (pointsDiff < 0 ? 'text-amber-500' : 'text-red-600')
                  : (pointsDiff < 0 ? 'text-green-600' : 'text-red-600')
              }`}>
                {pointsDiff < 0 ? '+' : '-'}{Math.abs(pointsDiff)}
              </span>
            )}
          </div>
          <div
            className={`text-xs mt-1 ${
              isLastYear
                ? isGoatMode ? 'text-zinc-600' : 'text-slate-500'
                : isGoatMode ? (darkModeColors.cardBackground ? '' : 'text-zinc-400') : 'text-gray-600'
            }`}
            style={!isLastYear && isGoatMode && darkModeColors.cardBackground ? { color: `${darkModeColors.text}80` } : undefined}
          >of {gamesPlayed * 2} possible</div>
        </div>

        {/* Current Pace Card */}
        <div
          className={`rounded-xl p-2 md:p-3 border ${
            isLastYear
              ? isGoatMode
                ? 'bg-gradient-to-br from-zinc-800/60 to-zinc-900/60 border-zinc-600'
                : 'bg-gradient-to-br from-slate-100 to-slate-200 border-slate-300'
              : isGoatMode
                ? (darkModeColors.cardBackground ? '' : 'bg-gradient-to-br from-zinc-800 to-zinc-900 border-zinc-700')
                : 'bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200'
          }`}
          style={!isLastYear && isGoatMode && darkModeColors.cardBackground ? {
            background: `linear-gradient(to bottom right, ${darkModeColors.cardBackground}f0, ${darkModeColors.cardBackground}e0)`,
            borderColor: darkModeColors.border
          } : undefined}
        >
          <div className={`text-xs font-semibold uppercase tracking-wide mb-1 ${labelColor}`} style={labelStyle}>Current Pace</div>
          <div className={`text-2xl md:text-3xl font-bold flex items-center gap-2 ${valueColor}`} style={valueStyle}>
            {currentPace.toFixed(2)}
            {isLastYear && paceDiff !== 0 && (
              <span className={`text-sm font-semibold ${
                teamId === 'sabres'
                  ? (paceDiff < 0 ? 'text-amber-500' : 'text-red-600')
                  : (paceDiff < 0 ? 'text-green-600' : 'text-red-600')
              }`}>
                {paceDiff < 0 ? '+' : '-'}{Math.abs(paceDiff).toFixed(2)}
              </span>
            )}
          </div>
          <div
            className={`text-xs mt-1 ${
              isLastYear
                ? isGoatMode ? 'text-zinc-600' : 'text-slate-500'
                : isGoatMode ? (darkModeColors.cardBackground ? '' : 'text-zinc-400') : 'text-gray-600'
            }`}
            style={!isLastYear && isGoatMode && darkModeColors.cardBackground ? { color: `${darkModeColors.text}80` } : undefined}
          >pts/game (need {(playoffTarget / stats.totalGames).toFixed(2)})</div>
        </div>

        {/* Projected Card */}
        <div
          className={`rounded-xl p-2 md:p-3 border ${
            isLastYear
              ? isGoatMode
                ? 'bg-gradient-to-br from-zinc-800/60 to-zinc-900/60 border-zinc-600'
                : 'bg-gradient-to-br from-slate-100 to-slate-200 border-slate-300'
              : isGoatMode
                ? (darkModeColors.cardBackground ? '' : 'bg-gradient-to-br from-zinc-800 to-zinc-900 border-zinc-700')
              : 'bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200'
          }`}
          style={!isLastYear && isGoatMode && darkModeColors.cardBackground ? {
            background: `linear-gradient(to bottom right, ${darkModeColors.cardBackground}f0, ${darkModeColors.cardBackground}e0)`,
            borderColor: darkModeColors.border
          } : undefined}
        >
          <div className={`text-xs font-semibold uppercase tracking-wide mb-1 ${labelColor}`} style={labelStyle}>Projected</div>
          <div className={`text-2xl md:text-3xl font-bold flex items-center gap-2 ${valueColor}`} style={valueStyle}>
            {projectedPoints}
            {isLastYear && projectedDiff !== 0 && (
              <span className={`text-sm font-semibold ${
                teamId === 'sabres'
                  ? (projectedDiff < 0 ? 'text-amber-500' : 'text-red-600')
                  : (projectedDiff < 0 ? 'text-green-600' : 'text-red-600')
              }`}>
                {projectedDiff < 0 ? '+' : '-'}{Math.abs(projectedDiff)}
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
            className={`h-8 rounded-l-full transition-all duration-500 relative shadow-md${currentProgress >= 100 ? ' rounded-r-full' : ''}`}
            style={{ width: `${Math.min(currentProgress, 100)}%`, backgroundColor: barColor }}
          >
            {/* Show points label when there's enough room */}
            {currentProgress > 0 && (
              <span
                className="absolute right-2 md:right-3 top-1/2 -translate-y-1/2 text-xs md:text-sm font-bold"
                style={{ color: barTextColor }}
              >
                {totalPoints}
              </span>
            )}
          </div>

          {/* Expected pace marker - only show for current year */}
          {!isLastYear && gamesPlayed > 0 && (
            <div
              className="absolute top-0 h-8 flex flex-col items-center"
              style={{
                left: `calc(${Math.min(expectedProgress, 100)}% - 4px)` // Shift left so white line is flush with bar edge and triangle overlaps
              }}
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

      {/* Mobile: Centered Playoff Probability text link at bottom */}
      {!isLastYear && probability !== undefined && onPlayoffToggle && (
        <div className="flex md:hidden justify-center mt-3">
          <button
            onClick={onPlayoffToggle}
            className="flex items-center gap-1 text-xs font-semibold transition-all focus:outline-none"
            style={{ color: probabilityColor }}
            title={playoffExpanded ? 'Hide playoff details' : 'Show playoff details'}
          >
            <span className={playoffExpanded ? 'underline decoration-2 underline-offset-2' : ''}>
              Playoff Probability: {cutLineLoading && stats.gamesPlayed >= 10 ? '--%' : `${probability}%`}
            </span>
            <ChevronDown
              size={12}
              className={`transition-transform duration-200 ${playoffExpanded ? 'rotate-180' : ''}`}
            />
          </button>
        </div>
      )}

      {/* Expandable Playoff Probability Section */}
      {!isLastYear && probability !== undefined && (
        <div
          className={`overflow-hidden transition-all duration-300 ease-out ${
            playoffExpanded ? 'max-h-[600px] opacity-100 mt-4' : 'max-h-0 opacity-0'
          }`}
        >
          {/* Dashed divider */}
          <div className={`border-t-2 border-dashed mb-4 ${
            isGoatMode ? 'border-zinc-700' : 'border-gray-300'
          }`}></div>

          {/* Two-column layout for targets */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Current Projected Cut Line - PRIMARY */}
            <div
              className={`rounded-lg p-3 border ${
                isGoatMode ? 'border-zinc-700 bg-zinc-800/50' : 'border-gray-200 bg-gray-50'
              }`}
            >
              <div className="flex items-center gap-3">
                {/* Text content */}
                <div className="flex-1 min-w-0">
                  <p
                    className={`text-xs font-bold uppercase tracking-wide mb-1 ${
                      isGoatMode ? 'text-zinc-400' : 'text-gray-500'
                    }`}
                  >
                    {cutLineData ? (cutLineData.activePath === 'division' ? 'Division Cut Line' : 'Wildcard Cut Line') : 'Current Projected Cut Line'}
                  </p>
                  {cutLineLoading ? (
                    <p
                      className={`text-sm ${
                        isGoatMode ? 'text-zinc-400' : 'text-gray-500'
                      }`}
                    >
                      Loading...
                    </p>
                  ) : cutLineError || !cutLineData ? (
                    <p
                      className={`text-sm ${
                        isGoatMode ? 'text-zinc-500' : 'text-gray-400'
                      }`}
                    >
                      {gamesPlayed < 10 ? 'Available after 10 games' : 'Unable to load'}
                    </p>
                  ) : (() => {
                    const cutLinePointsNeeded = Math.max(0, cutLineData.effectiveCutLine - totalPoints);
                    const cutLinePaceNeeded = gamesRemaining > 0 ? cutLinePointsNeeded / gamesRemaining : 0;
                    const bubbleTeam = cutLineData.activePath === 'division' ? cutLineData.divBubbleTeamAbbrev : cutLineData.wc2TeamAbbrev;
                    return (
                      <>
                        <p
                          className={`text-lg md:text-xl font-bold ${
                            isGoatMode ? 'text-white' : 'text-gray-900'
                          }`}
                        >
                          {cutLinePointsNeeded} pts to go
                        </p>
                        <p
                          className={`text-xs ${
                            isGoatMode ? 'text-zinc-500' : 'text-gray-500'
                          }`}
                        >
                          → {cutLineData.effectiveCutLine} pts • {cutLinePaceNeeded.toFixed(2)} pts/game{bubbleTeam ? ` • ${bubbleTeam}` : ''}
                        </p>
                      </>
                    );
                  })()}
                </div>
                {/* Probability circle - only show when data is loaded */}
                {!cutLineLoading && cutLineData && (
                  <div
                    className="flex-shrink-0 w-14 h-14 md:w-16 md:h-16 rounded-full flex items-center justify-center"
                    style={{
                      borderColor: probabilityColor,
                      backgroundColor: `${probabilityColor}15`,
                      borderWidth: '3px',
                      borderStyle: 'solid'
                    }}
                  >
                    <span
                      className="text-base md:text-lg font-bold"
                      style={{ color: probabilityColor }}
                    >
                      {probability}%
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Lindy's Five Target */}
            <div
              className={`rounded-lg p-3 border ${
                isGoatMode ? 'border-zinc-700 bg-zinc-800/50' : 'border-gray-200 bg-gray-50'
              }`}
            >
              <div className="flex items-center gap-3">
                {/* Text content */}
                <div className="flex-1 min-w-0">
                  <p
                    className={`text-xs font-bold uppercase tracking-wide mb-1 ${
                      isGoatMode ? 'text-zinc-400' : 'text-gray-500'
                    }`}
                  >
                    Lindy's Five Target
                  </p>
                  <p
                    className={`text-lg md:text-xl font-bold ${
                      isGoatMode ? 'text-white' : 'text-gray-900'
                    }`}
                  >
                    {Math.max(0, playoffTarget - totalPoints)} pts to go
                  </p>
                  <p
                    className={`text-xs ${
                      isGoatMode ? 'text-zinc-500' : 'text-gray-500'
                    }`}
                  >
                    → {playoffTarget} pts • {gamesRemaining > 0 ? ((playoffTarget - totalPoints) / gamesRemaining).toFixed(2) : '0.00'} pts/game
                  </p>
                </div>
                {/* Probability circle */}
                <div
                  className="flex-shrink-0 w-14 h-14 md:w-16 md:h-16 rounded-full flex items-center justify-center border-3"
                  style={{
                    borderColor: probabilityColor,
                    backgroundColor: `${probabilityColor}15`,
                    borderWidth: '3px'
                  }}
                >
                  <span
                    className="text-base md:text-lg font-bold"
                    style={{ color: probabilityColor }}
                  >
                    {lindysFiveProbability}%
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Probability Breakdown Table */}
          <div className={`mt-4 pt-4 border-t border-dashed ${
            isGoatMode ? 'border-zinc-700' : 'border-gray-300'
          }`}>
            <p className={`text-xs font-bold uppercase tracking-wide mb-2 ${
              isGoatMode ? 'text-zinc-400' : 'text-gray-500'
            }`}>
              If the {teamName?.split(' ').pop() || 'Team'} Finish With...
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
              {(() => {
                // Dynamic range: span both cut line and projected points
                const cutLine = cutLineData?.effectiveCutLine ?? 96;
                const gap = Math.abs(projectedPoints - cutLine);
                let start: number;
                if (gap <= 5) {
                  // Both anchors fit nicely in 8 values
                  const lower = Math.min(cutLine, projectedPoints);
                  start = lower - 2;
                } else {
                  // Large gap - center on cut line (the threshold that matters)
                  start = cutLine - 3;
                }
                const pointRange = Array.from({length: 8}, (_, i) => start + i);

                return pointRange.map((pts) => {
                  const prob = probabilityForFinalPoints(pts, gamesPlayed, cutLine);
                  const isProjected = pts === projectedPoints;
                  const isCutLine = pts === cutLine;
                  return (
                    <div
                      key={pts}
                      className={`text-center px-2 py-2 rounded-lg border ${
                        isProjected
                          ? isGoatMode ? 'bg-zinc-700 border-zinc-600' : 'bg-blue-100 border-blue-200'
                          : isCutLine
                            ? isGoatMode ? 'bg-zinc-800/50 border-zinc-500' : 'bg-gray-50 border-gray-400'
                            : isGoatMode ? 'bg-zinc-800/50 border-zinc-700' : 'bg-gray-50 border-gray-200'
                      }`}
                    >
                      <p className={`text-xs ${isGoatMode ? 'text-zinc-500' : 'text-gray-500'}`}>
                        {pts} pts
                      </p>
                      <p className={`text-lg font-bold ${
                        isGoatMode ? 'text-white' : 'text-gray-900'
                      }`}>
                        {prob}%
                      </p>
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        </div>
      )}

      </>
      )}

    </>
  );
}

export default function ProgressBar({ stats, isGoatMode, yearOverYearMode, yearOverYearLoading, onYearOverYearToggle, lastSeasonStats, teamColors, darkModeColors, teamId, showShareButton, teamName, teamAbbrev, onClinchDetected, celebrateOverride, inPlayoffs, playoffFetchLoaded }: ProgressBarProps) {
  const [shareMenuOpen, setShareMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [playoffExpanded, setPlayoffExpanded] = useState(false);
  // Collapse the Regular Season Progress card by default during playoffs (secondary context)
  const [sectionCollapsed, setSectionCollapsed] = useState<boolean>(!!inPlayoffs);
  const [cutLineData, setCutLineData] = useState<CutLineState | null>(null);
  const [cutLineLoading, setCutLineLoading] = useState(false);
  const [cutLineError, setCutLineError] = useState(false);

  // Fetch cut line data on mount (when enough games played)
  useEffect(() => {
    if (!cutLineData && !cutLineLoading && stats.gamesPlayed >= 10) {
      fetchCutLine();
    }
  }, [stats.gamesPlayed]);

  const fetchCutLine = async () => {
    setCutLineLoading(true);
    setCutLineError(false);

    try {
      const today = new Date().toISOString().split('T')[0];
      const response = await fetch(`/api/v1/standings/${today}`);

      if (!response.ok) {
        throw new Error(`API returned status ${response.status}`);
      }

      const data = await response.json();

      if (!data.standings || !Array.isArray(data.standings)) {
        throw new Error('Invalid standings data');
      }

      interface StandingTeam {
        teamAbbrev: string;
        points: number;
        gamesPlayed: number;
        divisionRank: number;
        conferenceName: string;
        divisionName: string;
        clinchIndicator?: string;
      }

      const parsedStandings: StandingTeam[] = data.standings.map((team: any) => ({
        teamAbbrev: team.teamAbbrev?.default || '',
        points: team.points || 0,
        gamesPlayed: team.gamesPlayed || 0,
        divisionRank: team.divisionSequence || 0,
        conferenceName: team.conferenceName || '',
        divisionName: team.divisionName || '',
        clinchIndicator: team.clinchIndicator || undefined,
      }));

      // Find user's team
      const userTeam = parsedStandings.find(t => t.teamAbbrev === teamAbbrev);
      if (!userTeam) {
        throw new Error('Team not found in standings');
      }

      const userConference = userTeam.conferenceName;
      const userDivision = userTeam.divisionName;

      // --- Division cut line ---
      // Sort division teams by points descending
      const divisionTeams = parsedStandings
        .filter(t => t.divisionName === userDivision)
        .sort((a, b) => b.points - a.points);

      const div3Team = divisionTeams[2]; // 3rd place - last division playoff spot
      const div4Team = divisionTeams[3]; // 4th place - first team out of division

      let divisionCutLine: number;
      let divBubbleTeamAbbrev = '';
      if (div3Team && div4Team && div3Team.gamesPlayed > 0 && div4Team.gamesPlayed > 0) {
        const div3Projected = (div3Team.points / div3Team.gamesPlayed) * TOTAL_GAMES;
        const div4Projected = (div4Team.points / div4Team.gamesPlayed) * TOTAL_GAMES;
        divisionCutLine = Math.ceil((div3Projected + div4Projected) / 2);
        divBubbleTeamAbbrev = div4Team.teamAbbrev;
      } else if (div3Team && div3Team.gamesPlayed > 0) {
        divisionCutLine = Math.ceil((div3Team.points / div3Team.gamesPlayed) * TOTAL_GAMES);
        divBubbleTeamAbbrev = div3Team.teamAbbrev;
      } else {
        divisionCutLine = 90; // fallback
      }
      // Floor of 90 for division cut line
      divisionCutLine = Math.max(divisionCutLine, 90);

      // --- Wildcard cut line ---
      const wildcardTeams = parsedStandings
        .filter(t => t.conferenceName === userConference && t.divisionRank > 3)
        .sort((a, b) => b.points - a.points);

      const wc2Team = wildcardTeams[1]; // Second wild card - last team IN
      const wc3Team = wildcardTeams[2]; // Third wild card - first team OUT

      if (!wc2Team) {
        throw new Error('Could not determine WC2 team');
      }

      const wc2Pace = wc2Team.gamesPlayed > 0 ? wc2Team.points / wc2Team.gamesPlayed : 0;
      const wc2Projected = wc2Pace * TOTAL_GAMES;

      let wildcardCutLine: number;
      if (wc3Team && wc3Team.gamesPlayed > 0) {
        const wc3Pace = wc3Team.points / wc3Team.gamesPlayed;
        const wc3Projected = wc3Pace * TOTAL_GAMES;
        wildcardCutLine = Math.ceil((wc2Projected + wc3Projected) / 2);
      } else {
        wildcardCutLine = Math.ceil(wc2Projected);
      }
      // Floor of 94 for wildcard cut line
      wildcardCutLine = Math.max(wildcardCutLine, HISTORICAL_FLOOR);

      // --- Determine playoff position ---
      const isInPlayoffPosition = userTeam.divisionRank <= 3 ||
        (wildcardTeams.length >= 2 && userTeam.points >= wildcardTeams[1].points && userTeam.divisionRank > 3);

      // --- Compute position-aware probability ---
      const result = computePositionAwareProbability(
        stats.projectedPoints,
        stats.gamesPlayed,
        divisionCutLine,
        wildcardCutLine,
        isInPlayoffPosition,
        userTeam.clinchIndicator
      );

      setCutLineData({
        effectiveCutLine: result.effectiveCutLine,
        divisionCutLine,
        wildcardCutLine,
        activePath: result.activePath,
        wc2TeamAbbrev: wc2Team.teamAbbrev,
        divBubbleTeamAbbrev,
        isInPlayoffPosition,
        clinchIndicator: userTeam.clinchIndicator,
      });

      if (userTeam.clinchIndicator && userTeam.clinchIndicator !== 'e' && onClinchDetected) {
        onClinchDetected(userTeam.clinchIndicator);
      }
    } catch (err) {
      console.error('Error calculating cut line:', err);
      setCutLineError(true);
    } finally {
      setCutLineLoading(false);
    }
  };

  // Calculate playoff probabilities
  // Main probability uses position-aware model when cut line data available
  const rawProbability = cutLineData
    ? computePositionAwareProbability(
        stats.projectedPoints,
        stats.gamesPlayed,
        cutLineData.divisionCutLine,
        cutLineData.wildcardCutLine,
        cutLineData.isInPlayoffPosition,
        cutLineData.clinchIndicator
      ).probability
    : probabilityForFinalPoints(stats.projectedPoints, stats.gamesPlayed, stats.playoffTarget);
  const probability = rawProbability === 99 ? 100 : rawProbability;
  // Lindy's Five probability always uses the fixed 96-point target
  const rawLindysFiveProbability = probabilityForFinalPoints(
    stats.projectedPoints,
    stats.gamesPlayed,
    stats.playoffTarget
  );
  const lindysFiveProbability = rawLindysFiveProbability === 99 ? 100 : rawLindysFiveProbability;
  const probabilityColorRaw = getProbabilityColor();
  const probabilityColor = probabilityColorRaw === 'team'
    ? (isGoatMode ? darkModeColors.accent : teamColors.primary)
    : probabilityColorRaw;

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

  // Share functionality
  const hostname = window.location.hostname;
  const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';
  const baseUrl = isLocalhost ? `http://${hostname}:${window.location.port}` : 'https://www.lindysfive.com';
  const teamUrl = `${baseUrl}/team/${teamId}`;

  const tweetText = `Track the ${teamName}'s road to the playoffs! 🏒
${teamUrl}
@lindysfive #LindysFive`;

  const handleTwitterShare = () => {
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}`;
    trackClick('share-x', 'progress-bar');
    window.open(twitterUrl, '_blank', 'noopener,noreferrer');
    setShareMenuOpen(false);
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(teamUrl);
      setCopied(true);
      setTimeout(() => {
        setCopied(false);
        setShareMenuOpen(false);
      }, 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <div
      className={`rounded-2xl p-3 md:p-4 shadow-xl mb-4 border-2 relative ${
        isGoatMode
          ? (darkModeColors.cardBackground ? '' : 'bg-zinc-900')
          : 'bg-white border-gray-200'
      }`}
      style={isGoatMode ? {
        backgroundColor: darkModeColors.cardBackground || darkModeColors.background,
        borderColor: darkModeColors.border
      } : undefined}
    >
      {/* Year-over-Year Toggle Text Button — hidden entirely in playoff mode (dropped to avoid chevron overlap and simplify the collapsed card) */}
      {onYearOverYearToggle && !inPlayoffs && (
        <button
          onClick={onYearOverYearToggle}
          disabled={yearOverYearLoading}
          className={`absolute top-3 md:top-4 right-3 md:right-4 flex items-center gap-1 text-xs md:text-sm font-semibold transition-all focus:outline-none group z-10 ${
            yearOverYearMode
              ? ''
              : isGoatMode
                ? 'text-zinc-500 hover:text-zinc-400'
                : 'text-gray-500 hover:text-gray-700'
          } ${yearOverYearLoading ? 'opacity-70 cursor-wait' : ''}`}
          style={yearOverYearMode ? (isGoatMode ? { color: darkModeColors.accent } : { color: teamColors.primary }) : undefined}
          title={yearOverYearLoading ? 'Loading...' : yearOverYearMode ? `Hide ${lastSeasonLabel} comparison` : `Compare to ${lastSeasonLabel}`}
        >
          <span className={yearOverYearMode ? 'underline decoration-2 underline-offset-2' : ''}>
            vs Last Year
          </span>
          {yearOverYearLoading ? (
            <svg
              className="w-3 h-3 animate-spin"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          ) : (
            <svg
              className={`w-3 h-3 transition-transform ${yearOverYearMode ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" />
            </svg>
          )}
        </button>
      )}

      {/* Current Year Section - wrapped in relative container for share button positioning */}
      <div className="relative">
        <SeasonSection
          stats={stats}
          isGoatMode={isGoatMode}
          teamColors={teamColors}
          darkModeColors={darkModeColors}
          teamId={teamId}
          probability={probability}
          probabilityColor={probabilityColor}
          playoffExpanded={playoffExpanded}
          onPlayoffToggle={() => setPlayoffExpanded(!playoffExpanded)}
          cutLineData={cutLineData}
          cutLineLoading={cutLineLoading}
          cutLineError={cutLineError}
          lindysFiveProbability={lindysFiveProbability}
          teamName={teamName}
          celebrateOverride={celebrateOverride}
          inPlayoffs={inPlayoffs}
          playoffFetchLoaded={playoffFetchLoaded}
          collapsed={inPlayoffs ? sectionCollapsed : undefined}
          onCollapseToggle={inPlayoffs ? () => setSectionCollapsed((v) => !v) : undefined}
        />

        {/* Share Button - positioned relative to current season section, hidden when playoff dropdown is open or in playoff mode */}
        {showShareButton && !playoffExpanded && !inPlayoffs && (
          <div className="relative">
            {/* Share Menu */}
            {shareMenuOpen && (
              <>
                {/* Backdrop */}
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShareMenuOpen(false)}
                />

                {/* Menu with theme-aware styling */}
                <div
                  className={`absolute bottom-12 right-0 rounded-lg shadow-2xl p-2 border-2 z-50 min-w-[240px] animate-in fade-in slide-in-from-bottom-2 duration-200 ${
                    isGoatMode
                      ? 'bg-zinc-900'
                      : 'bg-white'
                  }`}
                  style={{
                    borderColor: isGoatMode ? darkModeColors.accent : teamColors.primary
                  }}
                >
                  {/* Small arrow pointing to button */}
                  <div
                    className="absolute -bottom-2 right-4 w-0 h-0 border-l-8 border-r-8 border-t-8 border-l-transparent border-r-transparent"
                    style={{
                      borderTopColor: isGoatMode ? darkModeColors.accent : teamColors.primary
                    }}
                  />

                  <button
                    onClick={handleTwitterShare}
                    className={`flex items-center gap-3 w-full px-4 py-3 rounded-lg transition-colors text-left ${
                      isGoatMode
                        ? 'hover:bg-zinc-800'
                        : 'hover:bg-gray-100'
                    }`}
                  >
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center bg-black"
                    >
                      <XIcon size={16} color="#FFFFFF" />
                    </div>
                    <span
                      className={`font-semibold text-sm ${
                        isGoatMode ? 'text-white' : 'text-gray-800'
                      }`}
                    >
                      Share on X
                    </span>
                  </button>

                  <button
                    onClick={handleCopyLink}
                    className={`flex items-center gap-3 w-full px-4 py-3 rounded-lg transition-colors text-left ${
                      isGoatMode
                        ? 'hover:bg-zinc-800'
                        : 'hover:bg-gray-100'
                    }`}
                  >
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center"
                      style={{
                        backgroundColor: isGoatMode ? darkModeColors.accent : teamColors.primary
                      }}
                    >
                      {copied ? <Check size={16} color="#FFFFFF" /> : <LinkIcon size={16} color="#FFFFFF" />}
                    </div>
                    <span
                      className={`font-semibold text-sm ${
                        isGoatMode ? 'text-white' : 'text-gray-800'
                      }`}
                    >
                      {copied ? 'Link Copied!' : 'Copy Link'}
                    </span>
                  </button>
                </div>
              </>
            )}

            {/* Share Icon Button */}
            <button
              onClick={() => setShareMenuOpen(!shareMenuOpen)}
              className="absolute -bottom-1 md:-bottom-2 right-2 md:right-3 p-2 rounded-full hover:bg-gray-200 transition-colors group"
              aria-label="Share team page"
              title="Share this page"
            >
              <MoreHorizontal size={18} className="text-gray-500 group-hover:text-gray-700" />
            </button>
          </div>
        )}

        {/* Playoff mode: vs Last Year toggle pinned to the current-year section's bottom-right so it stays put when the Last Year section expands below */}
        {inPlayoffs && onYearOverYearToggle && !sectionCollapsed && (
          <button
            onClick={onYearOverYearToggle}
            disabled={yearOverYearLoading}
            className={`absolute bottom-0 right-0 flex items-center gap-1 text-xs md:text-sm font-semibold transition-all focus:outline-none group z-10 ${
              yearOverYearMode
                ? ''
                : isGoatMode
                  ? 'text-zinc-500 hover:text-zinc-400'
                  : 'text-gray-500 hover:text-gray-700'
            } ${yearOverYearLoading ? 'opacity-70 cursor-wait' : ''}`}
            style={yearOverYearMode ? (isGoatMode ? { color: darkModeColors.accent } : { color: teamColors.primary }) : undefined}
            title={yearOverYearLoading ? 'Loading...' : yearOverYearMode ? `Hide ${lastSeasonLabel} comparison` : `Compare to ${lastSeasonLabel}`}
          >
            <span className={yearOverYearMode ? 'underline decoration-2 underline-offset-2' : ''}>
              <span className="sm:hidden">{lastSeasonLabel?.replace(/-/g, '/')}</span>
              <span className="hidden sm:inline">vs Last Year</span>
            </span>
            {yearOverYearLoading ? (
              <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : (
              <svg className={`w-3 h-3 transition-transform ${yearOverYearMode ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" />
              </svg>
            )}
          </button>
        )}
      </div>

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
            teamColors={teamColors}
            darkModeColors={darkModeColors}
            teamId={teamId}
          />
        </>
      )}

    </div>
  );
}
