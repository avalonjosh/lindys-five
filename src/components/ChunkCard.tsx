import type { GameChunk } from '../types';
import GameBox from './GameBox';

interface ChunkCardProps {
  chunk: GameChunk;
  isGoatMode: boolean;
}

export default function ChunkCard({ chunk, isGoatMode }: ChunkCardProps) {
  const targetMet = chunk.points >= (chunk.totalGames * 2 * 0.6);
  const hasPlayed = chunk.games.some(g => g.outcome !== 'PENDING');

  // Subtle styling based on performance
  const borderStyle = hasPlayed && chunk.isComplete
    ? (targetMet
      ? isGoatMode ? 'border-red-600 border-2' : 'border-sabres-blue border-2'
      : isGoatMode ? 'border-zinc-700 border-2 border-dashed' : 'border-gray-300 border-2 border-dashed')
    : isGoatMode ? 'border-zinc-800 border-2' : 'border-gray-200 border-2';

  const shadowStyle = targetMet && chunk.isComplete ? 'shadow-xl' : 'shadow-lg';
  const opacity = hasPlayed && !targetMet && chunk.isComplete ? 'opacity-80' : 'opacity-100';

  return (
    <div
      className={`${borderStyle} ${shadowStyle} ${opacity} rounded-2xl p-4 md:p-6 hover:shadow-2xl transition-all ${
        isGoatMode ? 'bg-zinc-800' : 'bg-white'
      }`}
    >
      {/* Chunk Header */}
      <div className={`mb-4 md:mb-5 pb-4 md:pb-5 border-b-2 ${
        isGoatMode ? 'border-zinc-800' : 'border-gray-100'
      }`}>
        <div className="flex justify-between items-center mb-3 md:mb-4">
          <div>
            <h3 className={`font-bold text-xl md:text-2xl ${
              isGoatMode ? 'text-white' : 'text-sabres-navy'
            }`}>Chunk {chunk.chunkNumber}</h3>
            <p className={`text-xs md:text-sm mt-1 ${
              isGoatMode ? 'text-zinc-400' : 'text-gray-500'
            }`}>
              {chunk.totalGames} game{chunk.totalGames !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="text-right">
            <div className={`text-4xl md:text-5xl font-bold ${
              isGoatMode ? 'text-red-500' : 'text-sabres-blue'
            }`}>
              {chunk.points}
            </div>
            <div className={`text-xs mt-1 font-semibold ${
              isGoatMode ? 'text-zinc-400' : 'text-gray-500'
            }`}>of {chunk.maxPoints} points</div>
          </div>
        </div>

        {/* Record Summary */}
        <div className="grid grid-cols-3 gap-2 md:gap-3">
          <div className={`rounded-xl p-2 md:p-3 text-center border ${
            isGoatMode
              ? 'bg-gradient-to-br from-zinc-800 to-zinc-900 border-zinc-700'
              : 'bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200'
          }`}>
            <div className={`text-2xl md:text-3xl font-bold ${
              isGoatMode ? 'text-red-500' : 'text-sabres-blue'
            }`}>{chunk.wins}</div>
            <div className={`text-xs font-semibold mt-1 uppercase tracking-wide ${
              isGoatMode ? 'text-zinc-400' : 'text-gray-600'
            }`}>Wins</div>
          </div>
          <div className={`rounded-xl p-2 md:p-3 text-center border ${
            isGoatMode
              ? 'bg-gradient-to-br from-zinc-800 to-zinc-900 border-zinc-700'
              : 'bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200'
          }`}>
            <div className={`text-2xl md:text-3xl font-bold ${
              isGoatMode ? 'text-red-500' : 'text-sabres-blue'
            }`}>{chunk.otLosses}</div>
            <div className={`text-xs font-semibold mt-1 uppercase tracking-wide ${
              isGoatMode ? 'text-zinc-400' : 'text-gray-600'
            }`}>OT Losses</div>
          </div>
          <div className={`rounded-xl p-2 md:p-3 text-center border ${
            isGoatMode
              ? 'bg-gradient-to-br from-zinc-800 to-zinc-900 border-zinc-700'
              : 'bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200'
          }`}>
            <div className={`text-2xl md:text-3xl font-bold ${
              isGoatMode ? 'text-red-500' : 'text-sabres-blue'
            }`}>{chunk.losses}</div>
            <div className={`text-xs font-semibold mt-1 uppercase tracking-wide ${
              isGoatMode ? 'text-zinc-400' : 'text-gray-600'
            }`}>Losses</div>
          </div>
        </div>

        {/* Target Status */}
        {chunk.isComplete && (
          <div className="mt-4 text-center">
            {chunk.points >= (chunk.totalGames * 2 * 0.6) ? (
              <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold border ${
                isGoatMode
                  ? 'bg-red-900/50 text-red-400 border-red-700'
                  : 'bg-blue-100 text-sabres-blue border-blue-300'
              }`}>
                <span className="text-lg">✓</span> Target Met! (6+ points)
              </span>
            ) : (
              <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold border ${
                isGoatMode
                  ? 'bg-zinc-800 text-zinc-400 border-zinc-700'
                  : 'bg-slate-100 text-gray-700 border-zinc-300'
              }`}>
                <span className="text-lg">—</span> Below Target (need 6+ points)
              </span>
            )}
          </div>
        )}
      </div>

      {/* Individual Game Boxes */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
        {chunk.games.map((game, idx) => (
          <GameBox
            key={idx}
            game={game}
            gameNumber={(chunk.chunkNumber - 1) * 5 + idx + 1}
            isGoatMode={isGoatMode}
          />
        ))}

        {/* Empty placeholders for games not yet scheduled */}
        {chunk.games.length < chunk.totalGames &&
          Array.from({ length: chunk.totalGames - chunk.games.length }).map((_, idx) => (
            <div
              key={`empty-${idx}`}
              className={`rounded-md p-3 text-center opacity-50 ${
                isGoatMode
                  ? 'bg-zinc-950 text-zinc-600'
                  : 'bg-gray-700 text-white'
              }`}
            >
              <div className="text-xs font-semibold opacity-60 mb-2">
                Game {(chunk.chunkNumber - 1) * 5 + chunk.games.length + idx + 1}
              </div>
              <div className="text-sm py-4">Not Scheduled Yet</div>
            </div>
          ))}
      </div>
    </div>
  );
}
