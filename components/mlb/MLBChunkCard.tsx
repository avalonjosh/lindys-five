'use client';

import type { MLBGameChunk, MLBGameResult } from '@/lib/types/mlb';
import { isMLBTargetMet } from '@/lib/utils/mlbChunkCalculator';
import MLBGameBox from './MLBGameBox';

interface TeamColors {
  primary: string;
  secondary: string;
  accent: string;
}

interface MLBChunkCardProps {
  chunk: MLBGameChunk;
  teamColors: TeamColors;
  teamAbbrev: string;
  whatIfMode?: boolean;
  onGameClick?: (gameId: number, currentGame: MLBGameResult, outcome: 'W' | 'L') => void;
  hypotheticalResults?: Map<number, MLBGameResult>;
}

export default function MLBChunkCard({ chunk, teamColors, teamAbbrev, whatIfMode, onGameClick, hypotheticalResults }: MLBChunkCardProps) {
  // Calculate display values with hypotheticals applied
  const getDisplayGame = (game: MLBGameResult): MLBGameResult => {
    const hypo = hypotheticalResults?.get(game.gameId || 0);
    return hypo || game;
  };

  const displayWins = chunk.games.filter(g => getDisplayGame(g).outcome === 'W').length;
  const displayLosses = chunk.games.filter(g => getDisplayGame(g).outcome === 'L').length;

  const targetMet = chunk.isComplete && isMLBTargetMet({ ...chunk, wins: displayWins });
  const hasPlayed = chunk.games.some(g => g.outcome !== 'PENDING');

  // Border/shadow logic — matches NHL ChunkCard exactly
  const borderClass = hasPlayed && chunk.isComplete
    ? (targetMet ? 'border-2' : 'border-gray-300 border-2 border-dashed')
    : 'border-gray-200 border-2';

  const borderColorStyle = hasPlayed && chunk.isComplete && targetMet
    ? { borderColor: teamColors.primary }
    : undefined;

  const shadowStyle = targetMet && chunk.isComplete ? 'shadow-xl' : 'shadow-lg';
  const opacity = hasPlayed && !targetMet && chunk.isComplete ? 'opacity-80' : 'opacity-100';

  return (
    <div
      className={`${borderClass} ${shadowStyle} ${opacity} rounded-2xl p-3 md:p-4 hover:shadow-2xl transition-all bg-white`}
      style={borderColorStyle}
    >
      {/* Set Header — matches NHL exactly */}
      <div className="mb-3 md:mb-4 pb-3 md:pb-4 border-b-2 border-gray-100">
        <div className="flex justify-between items-center mb-2 md:mb-3">
          <div>
            <h3 className="font-bold text-xl md:text-2xl text-gray-900">
              Set {chunk.chunkNumber}
            </h3>
            <p className="text-xs md:text-sm mt-1 text-gray-500">
              {chunk.games.length > 0 ? (() => {
                const firstDate = chunk.games[0]?.date;
                const lastDate = chunk.games[chunk.games.length - 1]?.date;
                if (!firstDate || !lastDate) return `${chunk.totalGames} games`;
                if (chunk.games.length === 1) return firstDate;
                return `${firstDate} - ${lastDate}`;
              })() : `${chunk.totalGames} games`}
            </p>
          </div>
          <div className="text-right">
            <div className="text-4xl md:text-5xl font-bold" style={{ color: teamColors.primary }}>
              {displayWins}
            </div>
            <div className="text-xs mt-1 font-semibold text-gray-500">
              of {chunk.totalGames} games
            </div>
          </div>
        </div>

        {/* Record Summary — 2 columns (no OTL in baseball) */}
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-xl p-2 text-center border bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
            <div className="text-2xl md:text-3xl font-bold" style={{ color: teamColors.primary }}>
              {displayWins}
            </div>
            <div className="text-xs font-semibold mt-1 uppercase tracking-wide text-gray-600">
              Wins
            </div>
          </div>
          <div className="rounded-xl p-2 text-center border bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
            <div className="text-2xl md:text-3xl font-bold" style={{ color: teamColors.primary }}>
              {displayLosses}
            </div>
            <div className="text-xs font-semibold mt-1 uppercase tracking-wide text-gray-600">
              Losses
            </div>
          </div>
        </div>

        {/* Target Status — matches NHL badge exactly */}
        {chunk.isComplete && (
          <div className="mt-3 text-center">
            {targetMet ? (
              <span
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold border"
                style={{
                  backgroundColor: `${teamColors.primary}15`,
                  borderColor: teamColors.primary,
                  color: teamColors.primary,
                }}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
                Target Met! ({displayWins}+ wins)
              </span>
            ) : (
              <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold bg-gray-100 text-gray-500 border border-gray-200">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M20 12H4" />
                </svg>
                Below Target (need 3+ wins)
              </span>
            )}
          </div>
        )}
      </div>

      {/* Game Grid — matches NHL grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
        {chunk.games.map((game, idx) => {
          const hypoOutcome = hypotheticalResults?.get(game.gameId || 0)?.outcome as ('W' | 'L' | undefined) || null;
          return (
            <MLBGameBox
              key={game.gameId || `pending-${chunk.chunkNumber}-${idx}`}
              game={game}
              gameNumber={(chunk.chunkNumber - 1) * 5 + idx + 1}
              whatIfMode={whatIfMode}
              onGameClick={onGameClick}
              hypotheticalOutcome={hypoOutcome}
              teamAbbreviation={teamAbbrev}
              teamColors={teamColors}
            />
          );
        })}
        {/* Empty placeholder boxes */}
        {Array.from({ length: Math.max(0, 5 - chunk.games.length) }).map((_, i) => (
          <div
            key={`empty-${i}`}
            className="rounded-xl p-2.5 md:p-3 bg-gray-50 border-2 border-gray-100 opacity-50"
          />
        ))}
      </div>
    </div>
  );
}
