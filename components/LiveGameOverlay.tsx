import type { GameResult } from '@/lib/types';

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

interface LiveGameOverlayProps {
  game: GameResult;
  gameNumber: number;
  teamAbbreviation: string;
  teamColors: TeamColors;
  darkModeColors: DarkModeColors;
  isGoatMode: boolean;
}

export function LiveGameOverlay({ game, gameNumber, teamAbbreviation, teamColors, darkModeColors, isGoatMode }: LiveGameOverlayProps) {
  const isIntermission = game.clock?.inIntermission || false;
  const period = game.period || 1;
  const timeRemaining = game.clock?.timeRemaining || '20:00';
  const periodType = game.periodDescriptor?.periodType || 'REG';

  // Helper function to get ordinal period text
  const getOrdinalPeriod = (periodNum: number, type: string): string => {
    if (type === 'OT') return 'Overtime';
    if (type === 'SO') return 'Shootout';

    const ordinals = ['', '1st', '2nd', '3rd', '4th'];
    return `${ordinals[periodNum] || `${periodNum}th`} Period`;
  };

  // Determine period display text
  const periodText = getOrdinalPeriod(period, periodType);

  // Determine which team is which (home vs away)
  const myTeamScore = game.sabresScore;
  const opponentScore = game.opponentScore;
  const myTeamAbbrev = teamAbbreviation;

  // Conditional styling based on mode - matching GameBox pattern
  const containerClass = isGoatMode
    ? (darkModeColors.cardBackground
        ? "relative overflow-hidden rounded-xl border-2 shadow-lg transition-all duration-300 p-3 md:p-3"
        : "relative overflow-hidden rounded-xl border-2 shadow-lg transition-all duration-300 bg-gradient-to-br from-zinc-800 to-zinc-900 p-3 md:p-3")
    : "relative overflow-hidden rounded-xl border-2 shadow-lg transition-all duration-300 bg-gradient-to-br from-blue-50 to-slate-50 p-3 md:p-3";

  const containerStyle = isGoatMode && darkModeColors.cardBackground
    ? {
        borderColor: darkModeColors.border,
        background: `linear-gradient(to bottom right, ${darkModeColors.cardBackground}f8, ${darkModeColors.cardBackground}f0)`
      }
    : isGoatMode
    ? {
        borderColor: darkModeColors.border
      }
    : { borderColor: teamColors.primary };

  const textColor = isGoatMode ? darkModeColors.accent : teamColors.primary;

  return (
    <div className={containerClass} style={containerStyle}>
      {/* Game number and location - matching GameBox header */}
      <div className="flex justify-between items-center mb-2">
        <span className={`text-xs font-bold ${
          isGoatMode ? 'text-zinc-400' : 'text-gray-500'
        }`}>#{gameNumber}</span>
        <span className="text-xs font-bold" style={{ color: textColor }}>
          {game.isHome ? 'HOME' : 'AWAY'}
        </span>
      </div>

      {/* Opponent with Logo - matching GameBox structure */}
      <div className="text-center mb-2">
        <div className={`text-xs font-semibold mb-1.5 ${
          isGoatMode ? 'text-zinc-400' : 'text-gray-500'
        }`}>
          {game.isHome ? 'vs' : '@'}
        </div>
        <div className="flex flex-col items-center gap-1.5">
          <div
            className={`rounded-lg p-1.5 md:p-2 shadow-sm border ${
              isGoatMode ? '' : 'bg-white border-gray-200'
            }`}
            style={isGoatMode ? {
              backgroundColor: darkModeColors.cardBackground || darkModeColors.background,
              borderColor: darkModeColors.border
            } : undefined}
          >
            <img
              src={game.opponentLogo}
              alt={game.opponent}
              className="w-14 h-14 md:w-12 md:h-12 object-contain"
            />
          </div>
          <div
            className={`text-sm md:text-sm font-bold ${
              isGoatMode ? '' : 'text-gray-800'
            }`}
            style={isGoatMode ? { color: darkModeColors.text } : undefined}
          >{game.opponent}</div>
        </div>
      </div>

      {/* Score Display - matching GameBox structure */}
      <div className="flex justify-center items-center gap-2 md:gap-3 mb-2">
        <div className="text-center">
          <div
            className={`text-xs font-semibold mb-1 ${
              isGoatMode ? 'text-zinc-400' : 'text-gray-500'
            }`}
            style={isGoatMode ? { color: `${darkModeColors.text}80` } : undefined}
          >{myTeamAbbrev}</div>
          <div
            className={`text-3xl md:text-3xl font-bold ${
              isGoatMode ? '' : 'text-gray-800'
            }`}
            style={isGoatMode ? { color: darkModeColors.text } : undefined}
          >{myTeamScore}</div>
        </div>
        <div
          className={`text-xl md:text-2xl font-light ${
            isGoatMode ? 'text-zinc-600' : 'text-gray-400'
          }`}
          style={isGoatMode ? { color: `${darkModeColors.text}60` } : undefined}
        >-</div>
        <div className="text-center">
          <div
            className={`text-xs font-semibold mb-1 ${
              isGoatMode ? 'text-zinc-400' : 'text-gray-500'
            }`}
            style={isGoatMode ? { color: `${darkModeColors.text}80` } : undefined}
          >{game.opponent}</div>
          <div
            className={`text-3xl md:text-3xl font-bold ${
              isGoatMode ? '' : 'text-gray-800'
            }`}
            style={isGoatMode ? { color: darkModeColors.text } : undefined}
          >{opponentScore}</div>
        </div>
      </div>

      {/* Bottom Section with Divider - Period, Time, LIVE badge */}
      <div className={`text-center pt-2 border-t-2 ${
        isGoatMode ? 'border-zinc-800' : 'border-gray-200'
      }`}>
        {/* Period */}
        <div className="text-sm font-bold" style={{ color: textColor }}>
          {isIntermission ? `End of ${periodText}` : periodText}
        </div>

        {/* Time */}
        {!isIntermission && (
          <div className={`text-xs font-semibold mt-1 ${
            isGoatMode ? 'text-zinc-400' : 'text-gray-600'
          }`}>
            {timeRemaining}
          </div>
        )}

        {/* LIVE Badge */}
        <div className="mt-2 flex justify-center">
          {isIntermission ? (
            <span className="px-2 py-0.5 rounded-full text-xs font-bold text-white bg-orange-500 animate-pulse">
              INTERMISSION
            </span>
          ) : (
            <span className="px-2 py-0.5 rounded-full text-xs font-bold text-white bg-red-600 animate-pulse">
              LIVE
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
