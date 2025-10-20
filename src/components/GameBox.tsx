import type { GameResult } from '../types';

interface GameBoxProps {
  game: GameResult;
  gameNumber: number;
}

export default function GameBox({ game, gameNumber }: GameBoxProps) {
  const isPending = game.outcome === 'PENDING';

  // Subtle styling variations based on outcome
  const isWin = game.outcome === 'W';
  const isLoss = game.outcome === 'L';

  const borderStyle = isPending
    ? 'border-gray-200 border-2'
    : isWin
    ? 'border-sabres-blue border-2'
    : 'border-gray-300 border-2 border-dashed';

  const shadowStyle = isWin ? 'shadow-lg' : 'shadow-md';
  const opacity = isLoss ? 'opacity-75' : 'opacity-100';

  const styles = {
    bg: 'bg-gradient-to-br from-blue-50 to-slate-50',
    text: 'text-sabres-blue'
  };

  const getOutcomeText = () => {
    if (game.outcome === 'W') return 'WIN';
    if (game.outcome === 'OTL') return 'OT LOSS';
    if (game.outcome === 'L') return 'LOSS';
    return 'UPCOMING';
  };

  return (
    <div className={`${styles.bg} ${borderStyle} ${shadowStyle} ${opacity} rounded-xl p-4 hover:shadow-lg transition-all`}>
      {/* Game number and location */}
      <div className="flex justify-between items-center mb-3">
        <span className="text-xs font-bold text-gray-500">#{gameNumber}</span>
        <span className={`text-xs font-bold ${styles.text}`}>
          {game.isHome ? 'HOME' : 'AWAY'}
        </span>
      </div>

      {/* Opponent with Logo */}
      <div className="text-center mb-3">
        <div className="text-xs text-gray-500 font-semibold mb-2">
          {game.isHome ? 'vs' : '@'}
        </div>
        <div className="flex flex-col items-center gap-2">
          <div className="bg-white rounded-lg p-2 shadow-sm border border-gray-200">
            <img
              src={game.opponentLogo}
              alt={game.opponent}
              className="w-14 h-14 object-contain"
            />
          </div>
          <div className="text-sm font-bold text-gray-800">{game.opponent}</div>
        </div>
      </div>

      {/* Score or Status */}
      {!isPending ? (
        <>
          <div className="flex justify-center items-center gap-4 mb-3">
            <div className="text-center">
              <div className="text-xs text-gray-500 font-semibold mb-1">BUF</div>
              <div className="text-3xl font-bold text-gray-800">{game.sabresScore}</div>
            </div>
            <div className="text-2xl text-gray-400 font-light">-</div>
            <div className="text-center">
              <div className="text-xs text-gray-500 font-semibold mb-1">{game.opponent}</div>
              <div className="text-3xl font-bold text-gray-800">{game.opponentScore}</div>
            </div>
          </div>

          {/* Outcome and Points */}
          <div className="text-center pt-3 border-t-2 border-gray-200">
            <div className={`text-sm font-bold ${styles.text}`}>{getOutcomeText()}</div>
            <div className="text-xs text-gray-600 font-semibold mt-1">
              {game.points} {game.points === 1 ? 'PT' : 'PTS'}
            </div>
          </div>
        </>
      ) : (
        <>
          {/* Upcoming game - show date */}
          <div className="text-center py-4">
            <div className="text-sm text-gray-600 font-semibold mb-2">
              {new Date(game.date).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric'
              })}
            </div>
            <div className="text-xs text-gray-500 font-medium">Upcoming Game</div>
          </div>
        </>
      )}
    </div>
  );
}
