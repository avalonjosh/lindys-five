import { useState } from 'react';
import { MoreHorizontal, X as XIcon, Link as LinkIcon, Check } from 'lucide-react';
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

interface ProgressBarProps {
  stats: SeasonStats;
  isGoatMode: boolean;
  yearOverYearMode?: boolean;
  onYearOverYearToggle?: () => void;
  lastSeasonStats?: SeasonStats;
  teamColors: TeamColors;
  darkModeColors: DarkModeColors;
  teamId: string;
  showShareButton?: boolean;
  teamName?: string;
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
  teamId
}: {
  stats: SeasonStats;
  isGoatMode: boolean;
  isLastYear?: boolean;
  currentYearStats?: SeasonStats;
  lastSeasonLabel?: string;
  teamColors: TeamColors;
  darkModeColors: DarkModeColors;
  teamId: string;
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
  const indicatorColor = pointsDifference >= 0 ? 'border-t-green-500' : 'border-t-red-500';

  return (
    <>
      <h3
        className={`text-xl md:text-2xl font-bold mb-2 md:mb-3 ${valueColor}`}
        style={valueStyle}
      >
        {isLastYear ? `Last Year (${lastSeasonLabel})` : 'Season Progress'}
      </h3>

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
            className="h-8 rounded-l-full transition-all duration-500 relative shadow-md"
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

    </>
  );
}

export default function ProgressBar({ stats, isGoatMode, yearOverYearMode, onYearOverYearToggle, lastSeasonStats, teamColors, darkModeColors, teamId, showShareButton, teamName }: ProgressBarProps) {
  const [shareMenuOpen, setShareMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);

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
  const baseUrl = isLocalhost ? `http://${hostname}:${window.location.port}` : 'https://lindysfive.com';
  const teamUrl = `${baseUrl}/team/${teamId}`;

  const tweetText = `Track the ${teamName}'s road to the playoffs! 🏒
${teamUrl}
@lindysfive #LindysFive`;

  const handleTwitterShare = () => {
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}`;
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
      {/* Year-over-Year Toggle Text Button */}
      {onYearOverYearToggle && (
        <button
          onClick={onYearOverYearToggle}
          className={`absolute top-3 md:top-4 right-3 md:right-4 flex items-center gap-1 text-xs md:text-sm font-semibold transition-all focus:outline-none group ${
            yearOverYearMode
              ? ''
              : isGoatMode
                ? 'text-zinc-500 hover:text-zinc-400'
                : 'text-gray-500 hover:text-gray-700'
          }`}
          style={yearOverYearMode ? (isGoatMode ? { color: darkModeColors.accent } : { color: teamColors.primary }) : undefined}
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
      <SeasonSection stats={stats} isGoatMode={isGoatMode} teamColors={teamColors} darkModeColors={darkModeColors} teamId={teamId} />

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

      {/* Share Button - Small grey icon in bottom-right corner */}
      {showShareButton && (
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
    </div>
  );
}
