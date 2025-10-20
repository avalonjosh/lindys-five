import type { GameChunk } from '../types';
import GameBox from './GameBox';

interface ChunkCardProps {
  chunk: GameChunk;
}

export default function ChunkCard({ chunk }: ChunkCardProps) {
  const targetMet = chunk.points >= (chunk.totalGames * 2 * 0.6);
  const hasPlayed = chunk.games.some(g => g.outcome !== 'PENDING');

  // Subtle styling based on performance
  const borderStyle = hasPlayed && chunk.isComplete
    ? (targetMet ? 'border-sabres-blue border-2' : 'border-gray-300 border-2 border-dashed')
    : 'border-gray-200 border-2';

  const shadowStyle = targetMet && chunk.isComplete ? 'shadow-xl' : 'shadow-lg';
  const opacity = hasPlayed && !targetMet && chunk.isComplete ? 'opacity-80' : 'opacity-100';

  return (
    <div
      className={`bg-white ${borderStyle} ${shadowStyle} ${opacity} rounded-2xl p-6 hover:shadow-2xl transition-all`}
    >
      {/* Chunk Header */}
      <div className="mb-5 pb-5 border-b-2 border-gray-100">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h3 className="font-bold text-2xl text-sabres-navy">Chunk {chunk.chunkNumber}</h3>
            <p className="text-sm text-gray-500 mt-1">
              {chunk.totalGames} game{chunk.totalGames !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="text-right">
            <div className="text-5xl font-bold text-sabres-blue">
              {chunk.points}
            </div>
            <div className="text-xs text-gray-500 mt-1 font-semibold">of {chunk.maxPoints} points</div>
          </div>
        </div>

        {/* Record Summary */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-3 text-center border border-blue-200">
            <div className="text-3xl font-bold text-sabres-blue">{chunk.wins}</div>
            <div className="text-xs text-gray-600 font-semibold mt-1 uppercase tracking-wide">Wins</div>
          </div>
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-3 text-center border border-blue-200">
            <div className="text-3xl font-bold text-sabres-blue">{chunk.otLosses}</div>
            <div className="text-xs text-gray-600 font-semibold mt-1 uppercase tracking-wide">OT Losses</div>
          </div>
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-3 text-center border border-blue-200">
            <div className="text-3xl font-bold text-sabres-blue">{chunk.losses}</div>
            <div className="text-xs text-gray-600 font-semibold mt-1 uppercase tracking-wide">Losses</div>
          </div>
        </div>

        {/* Target Status */}
        {chunk.isComplete && (
          <div className="mt-4 text-center">
            {chunk.points >= (chunk.totalGames * 2 * 0.6) ? (
              <span className="inline-flex items-center gap-2 bg-blue-100 text-sabres-blue px-4 py-2 rounded-full text-sm font-semibold border border-blue-300">
                <span className="text-lg">✓</span> Target Met! (6+ points)
              </span>
            ) : (
              <span className="inline-flex items-center gap-2 bg-slate-100 text-gray-700 px-4 py-2 rounded-full text-sm font-semibold border border-slate-300">
                <span className="text-lg">—</span> Below Target (need 6+ points)
              </span>
            )}
          </div>
        )}
      </div>

      {/* Individual Game Boxes */}
      <div className="grid grid-cols-5 gap-2">
        {chunk.games.map((game, idx) => (
          <GameBox
            key={idx}
            game={game}
            gameNumber={(chunk.chunkNumber - 1) * 5 + idx + 1}
          />
        ))}

        {/* Empty placeholders for games not yet scheduled */}
        {chunk.games.length < chunk.totalGames &&
          Array.from({ length: chunk.totalGames - chunk.games.length }).map((_, idx) => (
            <div
              key={`empty-${idx}`}
              className="bg-gray-700 rounded-md p-3 text-white text-center opacity-50"
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
