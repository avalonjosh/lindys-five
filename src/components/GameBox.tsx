import type { GameResult } from '../types';
import { generateGameTicketLink } from '../utils/affiliateLinks';
import { TEAMS } from '../teamConfig';

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

interface GameBoxProps {
  game: GameResult;
  gameNumber: number;
  isGoatMode: boolean;
  whatIfMode?: boolean;
  onGameClick?: (gameId: number, currentGame: GameResult, outcome: 'W' | 'OTL' | 'L') => void;
  hypotheticalOutcome?: 'W' | 'OTL' | 'L' | null;
  teamAbbreviation?: string;
  teamColors: TeamColors;
  darkModeColors: DarkModeColors;
  venueTeamAbbreviation?: string; // Team whose venue is hosting the game
}

export default function GameBox({ game, gameNumber, isGoatMode, whatIfMode, onGameClick, hypotheticalOutcome, teamAbbreviation = 'BUF', teamColors, darkModeColors, venueTeamAbbreviation }: GameBoxProps) {
  const isPending = game.outcome === 'PENDING';
  const isClickable = whatIfMode && isPending && onGameClick;

  // Get the venue team (home team) for ticket link
  const homeTeamAbbrev = game.isHome ? teamAbbreviation : game.opponentAbbreviation;
  const awayTeamAbbrev = game.isHome ? game.opponentAbbreviation : teamAbbreviation;

  // Find the venue team's info for ticket link
  const venueTeam = Object.values(TEAMS).find(t => t.abbreviation === (venueTeamAbbreviation || homeTeamAbbrev));
  const ticketLink = venueTeam
    ? generateGameTicketLink(
        venueTeam.slug,
        venueTeam.city,
        venueTeam.stubhubId,
        homeTeamAbbrev || '',
        awayTeamAbbrev || '',
        game.date
      )
    : null;

  // Subtle styling variations based on outcome
  const isWin = game.outcome === 'W';
  const isLoss = game.outcome === 'L';

  const teamPrimaryColor = isGoatMode ? darkModeColors.accent : teamColors.primary;
  const borderClass = isPending
    ? 'border-2'
    : isWin
    ? 'border-2'
    : 'border-2 border-dashed';

  const borderColorStyle = isPending
    ? (isGoatMode ? { borderColor: darkModeColors.border } : { borderColor: '#e5e7eb' })
    : isWin
    ? (isGoatMode ? { borderColor: darkModeColors.border } : { borderColor: teamColors.primary })
    : (isGoatMode ? { borderColor: darkModeColors.border, borderStyle: 'dashed' } : { borderColor: '#d1d5db', borderStyle: 'dashed' });

  const shadowStyle = isWin ? 'shadow-lg' : 'shadow-md';
  const opacity = isLoss ? 'opacity-75' : 'opacity-100';

  const styles = {
    bg: isGoatMode
      ? (darkModeColors.cardBackground
          ? ''
          : 'bg-gradient-to-br from-zinc-800 to-zinc-900')
      : 'bg-gradient-to-br from-blue-50 to-slate-50',
    textColor: teamPrimaryColor
  };

  const getOutcomeText = () => {
    if (game.outcome === 'W') return 'WIN';
    if (game.outcome === 'OTL') return 'OT LOSS';
    if (game.outcome === 'L') return 'LOSS';
    return 'UPCOMING';
  };

  const handleWinClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onGameClick && game.gameId) {
      onGameClick(game.gameId, game, 'W');
    }
  };

  const handleOTLClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onGameClick && game.gameId) {
      onGameClick(game.gameId, game, 'OTL');
    }
  };

  const handleLossClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onGameClick && game.gameId) {
      onGameClick(game.gameId, game, 'L');
    }
  };

  return (
    <div
      className={`${styles.bg} ${borderClass} ${shadowStyle} ${opacity} rounded-xl p-2.5 md:p-3 transition-all ${
        isClickable
          ? isGoatMode
            ? 'hover:shadow-xl border-dashed !border-red-500/60 shadow-red-500/20'
            : 'hover:shadow-xl border-dashed !border-blue-400/60 shadow-blue-400/20'
          : 'hover:shadow-lg'
      }`}
      style={
        isClickable ? {
          boxShadow: isGoatMode
            ? '0 0 15px rgba(239, 68, 68, 0.3)'
            : '0 0 15px rgba(96, 165, 250, 0.3)',
          ...(isGoatMode && darkModeColors.cardBackground ? {
            background: `linear-gradient(to bottom right, ${darkModeColors.cardBackground}f8, ${darkModeColors.cardBackground}f0)`,
            borderColor: darkModeColors.border
          } : {})
        } : {
          ...borderColorStyle,
          ...(isGoatMode && darkModeColors.cardBackground ? {
            background: `linear-gradient(to bottom right, ${darkModeColors.cardBackground}f8, ${darkModeColors.cardBackground}f0)`,
            borderColor: darkModeColors.border
          } : {})
        }
      }
    >
      {/* Game number and location */}
      <div className="flex justify-between items-center mb-2">
        <span className={`text-xs font-bold ${
          isGoatMode ? 'text-zinc-400' : 'text-gray-500'
        }`}>#{gameNumber}</span>
        <span className="text-xs font-bold" style={{ color: styles.textColor }}>
          {game.isHome ? 'HOME' : 'AWAY'}
        </span>
      </div>

      {/* Opponent with Logo */}
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
              isGoatMode ? (darkModeColors.cardBackground ? '' : 'text-white') : 'text-gray-800'
            }`}
            style={isGoatMode && darkModeColors.cardBackground ? { color: darkModeColors.text } : undefined}
          >{game.opponent}</div>
        </div>
      </div>

      {/* Score or Status */}
      {!isPending ? (
        <>
          <div className="flex justify-center items-center gap-2 md:gap-3 mb-2">
            <div className="text-center">
              <div
                className={`text-xs font-semibold mb-1 ${
                  isGoatMode ? (darkModeColors.cardBackground ? '' : 'text-zinc-400') : 'text-gray-500'
                }`}
                style={isGoatMode && darkModeColors.cardBackground ? { color: `${darkModeColors.text}80` } : undefined}
              >{teamAbbreviation}</div>
              <div
                className={`text-3xl md:text-3xl font-bold ${
                  isGoatMode ? (darkModeColors.cardBackground ? '' : 'text-white') : 'text-gray-800'
                }`}
                style={isGoatMode && darkModeColors.cardBackground ? { color: darkModeColors.text } : undefined}
              >{game.sabresScore}</div>
            </div>
            <div
              className={`text-xl md:text-2xl font-light ${
                isGoatMode ? (darkModeColors.cardBackground ? '' : 'text-zinc-600') : 'text-gray-400'
              }`}
              style={isGoatMode && darkModeColors.cardBackground ? { color: `${darkModeColors.text}60` } : undefined}
            >-</div>
            <div className="text-center">
              <div
                className={`text-xs font-semibold mb-1 ${
                  isGoatMode ? (darkModeColors.cardBackground ? '' : 'text-zinc-400') : 'text-gray-500'
                }`}
                style={isGoatMode && darkModeColors.cardBackground ? { color: `${darkModeColors.text}80` } : undefined}
              >{game.opponent}</div>
              <div
                className={`text-3xl md:text-3xl font-bold ${
                  isGoatMode ? (darkModeColors.cardBackground ? '' : 'text-white') : 'text-gray-800'
                }`}
                style={isGoatMode && darkModeColors.cardBackground ? { color: darkModeColors.text } : undefined}
              >{game.opponentScore}</div>
            </div>
          </div>

          {/* Outcome and Points */}
          <div className={`text-center pt-2 border-t-2 ${
            isGoatMode ? 'border-zinc-800' : 'border-gray-200'
          }`}>
            <div className="text-sm font-bold" style={{ color: styles.textColor }}>{getOutcomeText()}</div>
            <div className={`text-xs font-semibold mt-1 ${
              isGoatMode ? 'text-zinc-400' : 'text-gray-600'
            }`}>
              {game.points} {game.points === 1 ? 'PT' : 'PTS'}
            </div>
            <div className={`text-xs mt-1 ${
              isGoatMode ? 'text-zinc-500' : 'text-gray-500'
            }`}>
              {new Date(game.date).toLocaleDateString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric'
              })}
            </div>
          </div>
        </>
      ) : (
        <>
          {/* Upcoming game - show date */}
          <div className="text-center py-3">
            <div className={`text-xs font-semibold mb-1 ${
              isGoatMode ? 'text-zinc-400' : 'text-gray-500'
            }`}>
              {new Date(game.date).toLocaleDateString('en-US', {
                weekday: 'short'
              })}
            </div>
            <div className={`text-sm font-semibold mb-2 ${
              isGoatMode ? 'text-zinc-300' : 'text-gray-600'
            }`}>
              {new Date(game.date).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric'
              })}
            </div>
            {game.startTime && (
              <div className={`text-xs font-semibold mb-2 ${
                isGoatMode ? 'text-red-400' : 'text-sabres-blue'
              }`}>
                {game.startTime}
              </div>
            )}
            {isClickable ? (
              <div className="flex justify-center mt-2">
                <div className={`inline-flex rounded-lg overflow-hidden border-2 shadow-md ${
                  isGoatMode
                    ? 'border-zinc-600'
                    : 'border-blue-300'
                }`}>
                  <button
                    onClick={handleWinClick}
                    className={`px-3 py-1.5 text-xs font-bold transition-all ${
                      isGoatMode
                        ? 'border-r border-zinc-600'
                        : 'border-r border-blue-300'
                    } ${
                      hypotheticalOutcome === 'W'
                        ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white'
                        : isGoatMode
                          ? 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                          : 'bg-blue-50 text-gray-600 hover:bg-blue-100'
                    }`}
                  >
                    W
                  </button>
                  <button
                    onClick={handleOTLClick}
                    className={`px-3 py-1.5 text-xs font-bold transition-all ${
                      isGoatMode
                        ? 'border-r border-zinc-600'
                        : 'border-r border-blue-300'
                    } ${
                      hypotheticalOutcome === 'OTL'
                        ? 'bg-gradient-to-r from-amber-400 to-amber-600 text-white'
                        : isGoatMode
                          ? 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                          : 'bg-blue-50 text-gray-600 hover:bg-blue-100'
                    }`}
                  >
                    OTL
                  </button>
                  <button
                    onClick={handleLossClick}
                    className={`px-3 py-1.5 text-xs font-bold transition-all ${
                      hypotheticalOutcome === 'L'
                        ? 'bg-gradient-to-r from-red-500 to-red-700 text-white'
                        : isGoatMode
                          ? 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                          : 'bg-blue-50 text-gray-600 hover:bg-blue-100'
                    }`}
                  >
                    L
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className={`text-xs font-medium mb-2 ${
                  isGoatMode ? 'text-zinc-400' : 'text-gray-500'
                }`}>
                  Upcoming Game
                </div>
                {ticketLink && (
                  <a
                    href={ticketLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`inline-block px-3 py-1.5 text-xs font-bold rounded transition-all shadow-sm hover:shadow-md ${
                      isGoatMode
                        ? 'bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white'
                        : 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white'
                    }`}
                  >
                    Get Tickets
                  </a>
                )}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
