import type { GameResult, GameChunk, SeasonStats, ChunkStats } from '../types';
import { fetchDetailedGameStats } from '../services/nhlApi';

const GAMES_PER_CHUNK = 5;
const TOTAL_REGULAR_SEASON_GAMES = 82;
const PLAYOFF_TARGET_POINTS = 96;

export function calculateChunks(games: GameResult[]): GameChunk[] {
  const chunks: GameChunk[] = [];
  const totalChunks = Math.ceil(TOTAL_REGULAR_SEASON_GAMES / GAMES_PER_CHUNK);

  for (let i = 0; i < totalChunks; i++) {
    const startIndex = i * GAMES_PER_CHUNK;
    const endIndex = Math.min(startIndex + GAMES_PER_CHUNK, TOTAL_REGULAR_SEASON_GAMES);
    const chunkGames = games.slice(startIndex, endIndex);
    const gamesInChunk = endIndex - startIndex;

    const wins = chunkGames.filter(g => g.outcome === 'W').length;
    const otLosses = chunkGames.filter(g => g.outcome === 'OTL').length;
    const losses = chunkGames.filter(g => g.outcome === 'L').length;
    const points = chunkGames.reduce((sum, g) => sum + g.points, 0);
    const maxPoints = gamesInChunk * 2;
    const isComplete = chunkGames.length === gamesInChunk &&
                       chunkGames.every(g => g.outcome !== 'PENDING');

    chunks.push({
      chunkNumber: i + 1,
      games: chunkGames,
      totalGames: gamesInChunk,
      wins,
      otLosses,
      losses,
      points,
      maxPoints,
      isComplete,
    });
  }

  return chunks;
}

export function calculateSeasonStats(chunks: GameChunk[]): SeasonStats {
  const totalPoints = chunks.reduce((sum, chunk) => sum + chunk.points, 0);
  const gamesPlayed = chunks.reduce((sum, chunk) =>
    sum + chunk.games.filter(g => g.outcome !== 'PENDING').length, 0
  );
  const gamesRemaining = TOTAL_REGULAR_SEASON_GAMES - gamesPlayed;

  // Calculate current pace (points per game)
  const currentPace = gamesPlayed > 0 ? totalPoints / gamesPlayed : 0;

  // Project total points for the season based on current pace
  const projectedPoints = gamesPlayed > 0
    ? Math.round(currentPace * TOTAL_REGULAR_SEASON_GAMES)
    : 0;

  // Calculate points above/below playoff target
  const projectedDifference = projectedPoints - PLAYOFF_TARGET_POINTS;

  return {
    totalPoints,
    totalGames: TOTAL_REGULAR_SEASON_GAMES,
    gamesPlayed,
    gamesRemaining,
    currentPace,
    projectedPoints,
    playoffTarget: PLAYOFF_TARGET_POINTS,
    pointsAboveBelow: projectedDifference,
  };
}

export function getChunkColor(chunk: GameChunk): string {
  if (!chunk.isComplete && chunk.games.every(g => g.outcome === 'PENDING')) {
    return 'bg-gray-700'; // Future chunk
  }

  // Color gradient based on points earned
  if (chunk.maxPoints === 10) {
    // Regular 5-game chunks
    if (chunk.points >= 10) return 'bg-green-500'; // Brightest green - 10/10
    if (chunk.points >= 8) return 'bg-green-400';  // Medium green - 8-9/10
    if (chunk.points >= 6) return 'bg-green-300';  // Light green - 6-7/10 (success!)
    if (chunk.points === 5) return 'bg-orange-400'; // Orange - 5/10 (close)
    if (chunk.points >= 3) return 'bg-red-400';    // Light red - 3-4/10
    return 'bg-red-600';                            // Dark red - 0-2/10
  } else {
    // Last 2-game chunk (scaled proportionally)
    // 4 pts = best, 2.4 pts = threshold
    if (chunk.points >= 4) return 'bg-green-500';  // Perfect 4/4
    if (chunk.points >= 3) return 'bg-green-300';  // Success 3/4 or 2/2
    if (chunk.points === 2) return 'bg-orange-400'; // Close 2/4
    if (chunk.points === 1) return 'bg-red-400';    // Below 1/4
    return 'bg-red-600';                            // 0 points
  }
}

export function getChunkBorderColor(chunk: GameChunk): string {
  const baseColor = getChunkColor(chunk);

  // Return a darker border version of the same color
  return baseColor
    .replace('bg-green-500', 'border-green-600')
    .replace('bg-green-400', 'border-green-500')
    .replace('bg-green-300', 'border-green-400')
    .replace('bg-orange-400', 'border-orange-500')
    .replace('bg-red-400', 'border-red-500')
    .replace('bg-red-600', 'border-red-700')
    .replace('bg-gray-700', 'border-gray-600');
}

export async function calculateChunkStats(chunk: GameChunk, teamId: number = 7): Promise<ChunkStats | null> {
  // Only calculate stats for completed games
  const completedGames = chunk.games.filter(g => g.outcome !== 'PENDING' && g.gameId);

  if (completedGames.length === 0) {
    return null;
  }

  // Fetch detailed stats for each completed game
  const gameStatsPromises = completedGames.map(game =>
    fetchDetailedGameStats(game.gameId!, game.isHome, teamId)
  );

  const gameStatsResults = await Promise.all(gameStatsPromises);

  // Filter out any null results (failed fetches)
  const validGameStats = gameStatsResults.filter(stats => stats !== null);

  if (validGameStats.length === 0) {
    return null;
  }

  // Aggregate totals across all games
  let totalGoalsFor = 0;
  let totalGoalsAgainst = 0;
  let totalShotsFor = 0;
  let totalShotsAgainst = 0;
  let totalPowerPlayGoals = 0;
  let totalPowerPlayOpportunities = 0;
  let totalPenaltyKillOpportunities = 0;
  let totalPowerPlayGoalsAgainst = 0;
  let totalSaves = 0;
  let totalShotsAgainstGoalie = 0;

  validGameStats.forEach(stats => {
    totalGoalsFor += stats.goalsFor;
    totalGoalsAgainst += stats.goalsAgainst;
    totalShotsFor += stats.shotsFor;
    totalShotsAgainst += stats.shotsAgainst;
    totalPowerPlayGoals += stats.powerPlayGoals;
    totalPowerPlayOpportunities += stats.powerPlayOpportunities;
    totalPenaltyKillOpportunities += stats.penaltyKillOpportunities;
    totalPowerPlayGoalsAgainst += stats.powerPlayGoalsAgainst;
    totalSaves += stats.saves;
    totalShotsAgainstGoalie += stats.shotsAgainstGoalie;
  });

  const gamesPlayed = validGameStats.length;

  // Calculate per-game averages
  const goalsPerGame = totalGoalsFor / gamesPlayed;
  const goalsAgainstPerGame = totalGoalsAgainst / gamesPlayed;
  const shotsPerGame = totalShotsFor / gamesPlayed;
  const shotsAgainstPerGame = totalShotsAgainst / gamesPlayed;

  // Calculate percentages
  const powerPlayPct = totalPowerPlayOpportunities > 0
    ? (totalPowerPlayGoals / totalPowerPlayOpportunities) * 100
    : 0;

  const penaltyKillPct = totalPenaltyKillOpportunities > 0
    ? ((totalPenaltyKillOpportunities - totalPowerPlayGoalsAgainst) / totalPenaltyKillOpportunities) * 100
    : 0;

  const savePct = totalShotsAgainstGoalie > 0
    ? (totalSaves / totalShotsAgainstGoalie) * 100
    : 0;

  return {
    goalsPerGame,
    goalsAgainstPerGame,
    shotsPerGame,
    shotsAgainstPerGame,
    powerPlayPct,
    penaltyKillPct,
    savePct,
    gamesPlayed,
  };
}
