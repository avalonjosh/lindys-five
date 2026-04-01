import type { MLBGameResult, MLBGameChunk, MLBSeasonStats } from '../types/mlb';

export const MLB_GAMES_PER_CHUNK = 5;
export const MLB_TOTAL_GAMES = 162;
export const MLB_PLAYOFF_TARGET_WINS = 90;

export function calculateMLBChunks(games: MLBGameResult[]): MLBGameChunk[] {
  const chunks: MLBGameChunk[] = [];
  const totalChunks = Math.ceil(MLB_TOTAL_GAMES / MLB_GAMES_PER_CHUNK);

  for (let i = 0; i < totalChunks; i++) {
    const startIndex = i * MLB_GAMES_PER_CHUNK;
    const endIndex = Math.min(startIndex + MLB_GAMES_PER_CHUNK, MLB_TOTAL_GAMES);
    const chunkGames = games.slice(startIndex, endIndex);
    const gamesInChunk = endIndex - startIndex;

    const wins = chunkGames.filter(g => g.outcome === 'W').length;
    const losses = chunkGames.filter(g => g.outcome === 'L').length;
    const isComplete = chunkGames.length === gamesInChunk &&
                       chunkGames.every(g => g.outcome !== 'PENDING');

    chunks.push({
      chunkNumber: i + 1,
      games: chunkGames,
      totalGames: gamesInChunk,
      wins,
      losses,
      isComplete,
    });
  }

  return chunks;
}

export function calculateMLBSeasonStats(chunks: MLBGameChunk[]): MLBSeasonStats {
  const totalWins = chunks.reduce((sum, chunk) => sum + chunk.wins, 0);
  const totalLosses = chunks.reduce((sum, chunk) => sum + chunk.losses, 0);
  const gamesPlayed = totalWins + totalLosses;
  const gamesRemaining = MLB_TOTAL_GAMES - gamesPlayed;

  const winPct = gamesPlayed > 0 ? totalWins / gamesPlayed : 0;
  const projectedWins = gamesPlayed > 0
    ? Math.round(winPct * MLB_TOTAL_GAMES)
    : 0;

  return {
    totalWins,
    totalLosses,
    gamesPlayed,
    gamesRemaining,
    totalGames: MLB_TOTAL_GAMES,
    winPct,
    projectedWins,
    playoffTarget: MLB_PLAYOFF_TARGET_WINS,
    winsAboveBelow: projectedWins - MLB_PLAYOFF_TARGET_WINS,
  };
}

export function isMLBTargetMet(chunk: MLBGameChunk): boolean {
  // Target: ~55.6% win rate (90/162)
  // For 5 games: Math.round(5 * 0.556) = 3 wins needed
  // For 2 games: Math.round(2 * 0.556) = 1 win needed
  const targetWins = Math.round(chunk.totalGames * 0.556);
  return chunk.wins >= targetWins;
}

export function getMLBChunkColor(chunk: MLBGameChunk): string {
  if (!chunk.isComplete && chunk.games.every(g => g.outcome === 'PENDING')) {
    return 'bg-gray-700';
  }

  if (chunk.totalGames === 5) {
    if (chunk.wins >= 5) return 'bg-green-500';
    if (chunk.wins >= 4) return 'bg-green-400';
    if (chunk.wins >= 3) return 'bg-green-300';
    if (chunk.wins === 2) return 'bg-orange-400';
    if (chunk.wins === 1) return 'bg-red-400';
    return 'bg-red-600';
  } else {
    // Partial last chunk (2 games)
    if (chunk.wins >= 2) return 'bg-green-500';
    if (chunk.wins === 1) return 'bg-green-300';
    return 'bg-red-600';
  }
}
