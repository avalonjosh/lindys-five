'use client';

import { useRouter } from 'next/navigation';
import type { MLBGameResult } from '@/lib/types/mlb';
import { MLB_TEAMS } from '@/lib/teamConfig/mlbTeams';
import { generateGameTicketLink } from '@/lib/utils/affiliateLinks';
import MLBLiveGameOverlay from './MLBLiveGameOverlay';

interface TeamColors {
  primary: string;
  secondary: string;
  accent: string;
}

interface MLBGameBoxProps {
  game: MLBGameResult;
  gameNumber: number;
  whatIfMode?: boolean;
  onGameClick?: (gameId: number, currentGame: MLBGameResult, outcome: 'W' | 'L') => void;
  hypotheticalOutcome?: 'W' | 'L' | null;
  teamAbbreviation?: string;
  teamColors: TeamColors;
}

export default function MLBGameBox({ game, gameNumber, whatIfMode, onGameClick, hypotheticalOutcome, teamAbbreviation = 'NYY', teamColors }: MLBGameBoxProps) {
  const router = useRouter();
  const isLive = game.gameState === 'In Progress' || game.gameState === 'Warming Up';
  const isPending = game.outcome === 'PENDING' && !isLive;
  const isClickable = whatIfMode && isPending && onGameClick;

  // Find opponent's tracker slug
  const opponentTeam = Object.values(MLB_TEAMS).find(t => t.abbreviation === game.opponent);
  const opponentSlug = opponentTeam?.id || null;

  // Generate ticket link for upcoming games
  const homeTeamAbbrev = game.isHome ? teamAbbreviation : game.opponent;
  const awayTeamAbbrev = game.isHome ? game.opponent : teamAbbreviation;
  const homeTeamConfig = Object.values(MLB_TEAMS).find(t => t.abbreviation === homeTeamAbbrev);
  const ticketLink = isPending && homeTeamConfig
    ? generateGameTicketLink(homeTeamConfig.slug, homeTeamConfig.city, homeTeamConfig.stubhubId, homeTeamAbbrev, awayTeamAbbrev, game.date)
    : null;

  const isWin = game.outcome === 'W';
  const isLoss = game.outcome === 'L';

  const borderClass = isPending
    ? 'border-2'
    : isWin
    ? 'border-2'
    : 'border-2 border-dashed';

  const borderColorStyle = isPending
    ? { borderColor: '#e5e7eb' }
    : isWin
    ? { borderColor: teamColors.primary }
    : { borderColor: '#d1d5db', borderStyle: 'dashed' as const };

  const shadowStyle = isWin ? 'shadow-lg' : 'shadow-md';
  const opacity = isLoss ? 'opacity-75' : 'opacity-100';

  const getOutcomeText = () => {
    if (game.outcome === 'W') return 'WIN';
    if (game.outcome === 'L') return 'LOSS';
    return 'UPCOMING';
  };

  const handleWinClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onGameClick && game.gameId) {
      onGameClick(game.gameId, game, 'W');
    }
  };

  const handleLossClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onGameClick && game.gameId) {
      onGameClick(game.gameId, game, 'L');
    }
  };

  // Live game — render overlay with link to box score
  if (isLive) {
    const gameLink = game.gameId ? `/mlb/scores/${game.gameId}` : null;
    const overlay = (
      <MLBLiveGameOverlay
        game={game}
        gameNumber={gameNumber}
        teamAbbreviation={teamAbbreviation}
        teamColors={teamColors}
      />
    );
    if (gameLink) {
      return (
        <div
          className="block h-full cursor-pointer"
          onClick={() => router.push(gameLink)}
          role="link"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter') router.push(gameLink); }}
        >
          {overlay}
        </div>
      );
    }
    return overlay;
  }

  const cardContent = (
    <div
      className={`h-full bg-gradient-to-br from-blue-50 to-slate-50 ${borderClass} ${shadowStyle} ${opacity} rounded-xl p-2.5 md:p-3 transition-all ${
        isClickable
          ? 'hover:shadow-xl border-dashed !border-blue-400/60 shadow-blue-400/20'
          : 'hover:shadow-lg'
      }`}
      style={
        isClickable ? {
          boxShadow: '0 0 15px rgba(96, 165, 250, 0.3)',
        } : borderColorStyle
      }
    >
      {/* Game number and location */}
      <div className="flex justify-between items-center mb-2">
        <span className="text-xs font-bold text-gray-500">#{gameNumber}</span>
        <span className="text-xs font-bold" style={{ color: teamColors.primary }}>
          {game.isHome ? 'HOME' : 'AWAY'}
        </span>
      </div>

      {/* Opponent with Logo */}
      <div className="text-center mb-2">
        <div className="text-xs font-semibold mb-1.5 text-gray-500">
          {game.isHome ? 'vs' : '@'}
        </div>
        <div className="flex flex-col items-center gap-1.5">
          {opponentSlug ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                router.push(`/mlb/${opponentSlug}`);
              }}
              className="rounded-lg p-3 md:p-3.5 shadow-sm border bg-white border-gray-200 transition-transform hover:scale-110 cursor-pointer"
              title={`View ${game.opponent} tracker`}
            >
              <img
                src={game.opponentLogo}
                alt={game.opponent}
                className="w-10 h-10 md:w-9 md:h-9 object-contain"
              />
            </button>
          ) : (
            <div className="rounded-lg p-3 md:p-3.5 shadow-sm border bg-white border-gray-200">
              <img
                src={game.opponentLogo}
                alt={game.opponent}
                className="w-10 h-10 md:w-9 md:h-9 object-contain"
              />
            </div>
          )}
          <div className="text-sm font-bold text-gray-800">{game.opponent}</div>
        </div>
      </div>

      {/* Score or Status */}
      {!isPending ? (
        <>
          <div className="flex justify-center items-center gap-2 md:gap-3 mb-2">
            <div className="text-center">
              <div className="text-xs font-semibold mb-1 text-gray-500">{teamAbbreviation}</div>
              <div className="text-3xl font-bold text-gray-800">{game.teamScore}</div>
            </div>
            <div className="text-xl md:text-2xl font-light text-gray-400">-</div>
            <div className="text-center">
              <div className="text-xs font-semibold mb-1 text-gray-500">{game.opponent}</div>
              <div className="text-3xl font-bold text-gray-800">{game.opponentScore}</div>
            </div>
          </div>

          {/* Outcome */}
          <div className="text-center pt-2 border-t-2 border-gray-200">
            <div className="text-sm font-bold" style={{ color: teamColors.primary }}>{getOutcomeText()}</div>
            <div className="text-xs mt-1 text-gray-500">
              {game.date}
            </div>
          </div>
        </>
      ) : (
        <>
          {/* Upcoming game */}
          <div className="text-center py-3">
            <div className="text-sm font-semibold mb-2 text-gray-600">
              {game.date}
            </div>
            {game.startTime && (
              <div className="text-xs font-semibold mb-2" style={{ color: teamColors.primary }}>
                {game.startTime}
              </div>
            )}
            {isClickable ? (
              <div className="flex justify-center mt-2">
                <div className="inline-flex rounded-lg overflow-hidden border-2 border-blue-300 shadow-md">
                  <button
                    onClick={handleWinClick}
                    className={`px-4 py-1.5 text-xs font-bold transition-all border-r border-blue-300 ${
                      hypotheticalOutcome === 'W'
                        ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white'
                        : 'bg-blue-50 text-gray-600 hover:bg-blue-100'
                    }`}
                  >
                    W
                  </button>
                  <button
                    onClick={handleLossClick}
                    className={`px-4 py-1.5 text-xs font-bold transition-all ${
                      hypotheticalOutcome === 'L'
                        ? 'bg-gradient-to-r from-red-500 to-red-700 text-white'
                        : 'bg-blue-50 text-gray-600 hover:bg-blue-100'
                    }`}
                  >
                    L
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="text-xs font-medium mb-2 text-gray-500">
                  Upcoming Game
                </div>
                {ticketLink && (
                  <a
                    href={ticketLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="inline-block px-3 py-1.5 text-xs font-bold rounded transition-all shadow-sm hover:shadow-md bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white"
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

  const gameLink = game.gameId ? `/mlb/scores/${game.gameId}` : null;

  if (gameLink && !isClickable) {
    return (
      <div
        className="block h-full cursor-pointer"
        onClick={() => router.push(gameLink)}
        role="link"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter') router.push(gameLink); }}
      >
        {cardContent}
      </div>
    );
  }

  return cardContent;
}
