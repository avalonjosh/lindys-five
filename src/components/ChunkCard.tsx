import { useState, useEffect } from 'react';
import type { GameChunk, ChunkStats } from '../types';
import GameBox from './GameBox';
import { calculateChunkStats } from '../utils/chunkCalculator';

interface ChunkCardProps {
  chunk: GameChunk;
  isGoatMode: boolean;
  previousChunkStats?: ChunkStats | null;
  onStatsCalculated?: (chunkNumber: number, stats: ChunkStats) => void;
}

export default function ChunkCard({ chunk, isGoatMode, previousChunkStats, onStatsCalculated }: ChunkCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [stats, setStats] = useState<ChunkStats | null>(null);
  const [loading, setLoading] = useState(false);
  const targetMet = chunk.points >= (chunk.totalGames * 2 * 0.6);
  const hasPlayed = chunk.games.some(g => g.outcome !== 'PENDING');

  // Load stats when expanded
  useEffect(() => {
    if (isExpanded && !stats && hasPlayed) {
      setLoading(true);
      calculateChunkStats(chunk)
        .then(calculatedStats => {
          setStats(calculatedStats);
          if (calculatedStats && onStatsCalculated) {
            onStatsCalculated(chunk.chunkNumber, calculatedStats);
          }
          setLoading(false);
        })
        .catch(() => {
          setLoading(false);
        });
    }
  }, [isExpanded, stats, chunk, hasPlayed, onStatsCalculated]);

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

      {/* Show Stats Button - Only show if chunk has completed games */}
      {hasPlayed && (
        <>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className={`w-full mt-4 md:mt-6 py-3 px-4 rounded-xl font-semibold text-sm transition-all ${
              isGoatMode
                ? 'bg-zinc-900 hover:bg-zinc-950 text-red-500 border border-zinc-700'
                : 'bg-blue-50 hover:bg-blue-100 text-sabres-blue border border-blue-200'
            }`}
          >
            {isExpanded ? '▲ Hide Chunk Stats' : '▼ Show Chunk Stats'}
          </button>

          {/* Stats Section */}
          {isExpanded && (
            <div className={`mt-4 pt-4 border-t-2 ${
              isGoatMode ? 'border-zinc-700' : 'border-gray-200'
            }`}>
              {loading ? (
                <div className={`text-center py-8 ${
                  isGoatMode ? 'text-zinc-400' : 'text-gray-500'
                }`}>
                  Loading stats...
                </div>
              ) : stats ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
                  <StatItem
                    label="Goals Per Game"
                    value={stats.goalsPerGame.toFixed(2)}
                    previousValue={previousChunkStats?.goalsPerGame}
                    higherIsBetter={true}
                    isGoatMode={isGoatMode}
                  />
                  <StatItem
                    label="Goals Against Per Game"
                    value={stats.goalsAgainstPerGame.toFixed(2)}
                    previousValue={previousChunkStats?.goalsAgainstPerGame}
                    higherIsBetter={false}
                    isGoatMode={isGoatMode}
                  />
                  <StatItem
                    label="Shots Per Game"
                    value={stats.shotsPerGame.toFixed(1)}
                    previousValue={previousChunkStats?.shotsPerGame}
                    higherIsBetter={true}
                    isGoatMode={isGoatMode}
                  />
                  <StatItem
                    label="Shots Against Per Game"
                    value={stats.shotsAgainstPerGame.toFixed(1)}
                    previousValue={previousChunkStats?.shotsAgainstPerGame}
                    higherIsBetter={false}
                    isGoatMode={isGoatMode}
                  />
                  <StatItem
                    label="Power Play %"
                    value={stats.powerPlayPct.toFixed(1) + '%'}
                    previousValue={previousChunkStats?.powerPlayPct}
                    higherIsBetter={true}
                    isGoatMode={isGoatMode}
                  />
                  <StatItem
                    label="Penalty Kill %"
                    value={stats.penaltyKillPct.toFixed(1) + '%'}
                    previousValue={previousChunkStats?.penaltyKillPct}
                    higherIsBetter={true}
                    isGoatMode={isGoatMode}
                  />
                  <StatItem
                    label="Save %"
                    value={stats.savePct.toFixed(1) + '%'}
                    previousValue={previousChunkStats?.savePct}
                    higherIsBetter={true}
                    isGoatMode={isGoatMode}
                  />
                  <div className={`rounded-xl p-4 text-center border ${
                    isGoatMode
                      ? 'bg-zinc-900 border-zinc-700'
                      : 'bg-gray-50 border-gray-200'
                  }`}>
                    <div className={`text-xs font-semibold mb-2 uppercase tracking-wide ${
                      isGoatMode ? 'text-zinc-400' : 'text-gray-500'
                    }`}>
                      Games Played
                    </div>
                    <div className={`text-2xl md:text-3xl font-bold ${
                      isGoatMode ? 'text-white' : 'text-gray-800'
                    }`}>
                      {stats.gamesPlayed}
                    </div>
                  </div>
                </div>
              ) : (
                <div className={`text-center py-8 ${
                  isGoatMode ? 'text-zinc-400' : 'text-gray-500'
                }`}>
                  No stats available
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

interface StatItemProps {
  label: string;
  value: string;
  previousValue?: number;
  higherIsBetter: boolean;
  isGoatMode: boolean;
}

function StatItem({ label, value, previousValue, higherIsBetter, isGoatMode }: StatItemProps) {
  let indicator: 'up' | 'down' | 'none' = 'none';
  let indicatorColor = '';

  if (previousValue !== undefined) {
    const currentNumeric = parseFloat(value);
    const diff = currentNumeric - previousValue;

    if (Math.abs(diff) > 0.1) { // Only show indicator if difference is meaningful
      if (diff > 0) {
        indicator = 'up';
        indicatorColor = higherIsBetter ? 'text-green-500' : 'text-red-500';
      } else {
        indicator = 'down';
        indicatorColor = higherIsBetter ? 'text-red-500' : 'text-green-500';
      }
    }
  }

  return (
    <div className={`rounded-xl p-4 text-center border ${
      isGoatMode
        ? 'bg-zinc-900 border-zinc-700'
        : 'bg-gray-50 border-gray-200'
    }`}>
      <div className={`text-xs font-semibold mb-2 uppercase tracking-wide ${
        isGoatMode ? 'text-zinc-400' : 'text-gray-500'
      }`}>
        {label}
      </div>
      <div className="flex items-center justify-center gap-2">
        <div className={`text-2xl md:text-3xl font-bold ${
          isGoatMode ? 'text-white' : 'text-gray-800'
        }`}>
          {value}
        </div>
        {indicator !== 'none' && (
          <span className={`text-xl ${indicatorColor}`}>
            {indicator === 'up' ? '↑' : '↓'}
          </span>
        )}
      </div>
    </div>
  );
}
