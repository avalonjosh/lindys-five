import type { ChunkStats } from '../types';

interface CachedChunkStats {
  stats: ChunkStats;
  timestamp: number;
  teamId: number;
}

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const STORAGE_KEY_PREFIX = 'chunk-stats';

// Generate storage key: "chunk-stats-sabres-3" for team sabres chunk 3
function getStorageKey(teamId: string, chunkNumber: number): string {
  return `${STORAGE_KEY_PREFIX}-${teamId}-${chunkNumber}`;
}

// Save stats to localStorage
export function saveChunkStatsToCache(
  teamId: string,
  chunkNumber: number,
  stats: ChunkStats
): void {
  const cached: CachedChunkStats = {
    stats,
    timestamp: Date.now(),
    teamId: parseInt(teamId) // Store numeric team ID for verification
  };

  try {
    localStorage.setItem(
      getStorageKey(teamId, chunkNumber),
      JSON.stringify(cached)
    );
  } catch (error) {
    console.error('Failed to save chunk stats to cache:', error);
  }
}

// Load stats from localStorage
export function loadChunkStatsFromCache(
  teamId: string,
  chunkNumber: number
): ChunkStats | null {
  try {
    const key = getStorageKey(teamId, chunkNumber);
    const item = localStorage.getItem(key);

    if (!item) return null;

    const cached: CachedChunkStats = JSON.parse(item);

    // Validate TTL
    const age = Date.now() - cached.timestamp;
    if (age > CACHE_TTL_MS) {
      // Expired - remove from storage
      localStorage.removeItem(key);
      return null;
    }

    // Validate team ID matches
    if (cached.teamId.toString() !== teamId) {
      localStorage.removeItem(key);
      return null;
    }

    return cached.stats;
  } catch (error) {
    console.error('Failed to load chunk stats from cache:', error);
    return null;
  }
}

// Clear all cached stats for a specific team
export function clearTeamStatsCache(teamId: string): void {
  try {
    const keys = Object.keys(localStorage);
    const prefix = `${STORAGE_KEY_PREFIX}-${teamId}-`;

    keys.forEach(key => {
      if (key.startsWith(prefix)) {
        localStorage.removeItem(key);
      }
    });
  } catch (error) {
    console.error('Failed to clear team stats cache:', error);
  }
}

// Clear ALL cached stats (for all teams) - useful for debugging
export function clearAllStatsCache(): void {
  try {
    const keys = Object.keys(localStorage);

    keys.forEach(key => {
      if (key.startsWith(STORAGE_KEY_PREFIX)) {
        localStorage.removeItem(key);
      }
    });
  } catch (error) {
    console.error('Failed to clear all stats cache:', error);
  }
}
