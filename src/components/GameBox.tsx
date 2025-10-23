import type { GameResult } from '../types';

interface GameBoxProps {
  game: GameResult;
  gameNumber: number;
  isGoatMode: boolean;
}

export default function GameBox({ game, gameNumber, isGoatMode }: GameBoxProps) {
  const isPending = game.outcome === 'PENDING';

  // Subtle styling variations based on outcome
  const isWin = game.outcome === 'W';
  const isLoss = game.outcome === 'L';

  const borderStyle = isPending
    ? isGoatMode ? 'border-zinc-700 border-2' : 'border-gray-200 border-2'
    : isWin
    ? isGoatMode ? 'border-red-600 border-2' : 'border-sabres-blue border-2'
    : isGoatMode ? 'border-zinc-700 border-2 border-dashed' : 'border-gray-300 border-2 border-dashed';

  const shadowStyle = isWin ? 'shadow-lg' : 'shadow-md';
  const opacity = isLoss ? 'opacity-75' : 'opacity-100';

  const styles = {
    bg: isGoatMode ? 'bg-gradient-to-br from-zinc-800 to-zinc-900' : 'bg-gradient-to-br from-blue-50 to-slate-50',
    text: isGoatMode ? 'text-red-500' : 'text-sabres-blue'
  };

  const getOutcomeText = () => {
    if (game.outcome === 'W') return 'WIN';
    if (game.outcome === 'OTL') return 'OT LOSS';
    if (game.outcome === 'L') return 'LOSS';
    return 'UPCOMING';
  };

  return (
    <div className={`${styles.bg} ${borderStyle} ${shadowStyle} ${opacity} rounded-xl p-2.5 md:p-3 hover:shadow-lg transition-all`}>
      {/* Game number and location */}
      <div className="flex justify-between items-center mb-2">
        <span className={`text-xs font-bold ${
          isGoatMode ? 'text-zinc-400' : 'text-gray-500'
        }`}>#{gameNumber}</span>
        <span className={`text-xs font-bold ${styles.text}`}>
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
          <div className={`rounded-lg p-1.5 md:p-2 shadow-sm border ${
            isGoatMode
              ? 'bg-zinc-950 border-zinc-800'
              : 'bg-white border-gray-200'
          }`}>
            <img
              src={game.opponentLogo}
              alt={game.opponent}
              className="w-14 h-14 md:w-12 md:h-12 object-contain"
            />
          </div>
          <div className={`text-sm md:text-sm font-bold ${
            isGoatMode ? 'text-white' : 'text-gray-800'
          }`}>{game.opponent}</div>
        </div>
      </div>

      {/* Score or Status */}
      {!isPending ? (
        <>
          <div className="flex justify-center items-center gap-2 md:gap-3 mb-2">
            <div className="text-center">
              <div className={`text-xs font-semibold mb-1 ${
                isGoatMode ? 'text-zinc-400' : 'text-gray-500'
              }`}>BUF</div>
              <div className={`text-3xl md:text-3xl font-bold ${
                isGoatMode ? 'text-white' : 'text-gray-800'
              }`}>{game.sabresScore}</div>
            </div>
            <div className={`text-xl md:text-2xl font-light ${
              isGoatMode ? 'text-zinc-600' : 'text-gray-400'
            }`}>-</div>
            <div className="text-center">
              <div className={`text-xs font-semibold mb-1 ${
                isGoatMode ? 'text-zinc-400' : 'text-gray-500'
              }`}>{game.opponent}</div>
              <div className={`text-3xl md:text-3xl font-bold ${
                isGoatMode ? 'text-white' : 'text-gray-800'
              }`}>{game.opponentScore}</div>
            </div>
          </div>

          {/* Outcome and Points */}
          <div className={`text-center pt-2 border-t-2 ${
            isGoatMode ? 'border-zinc-800' : 'border-gray-200'
          }`}>
            <div className={`text-sm font-bold ${styles.text}`}>{getOutcomeText()}</div>
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
            <div className={`text-xs font-medium ${
              isGoatMode ? 'text-zinc-400' : 'text-gray-500'
            }`}>Upcoming Game</div>
          </div>
        </>
      )}
    </div>
  );
}
