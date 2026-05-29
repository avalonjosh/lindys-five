import { kv } from '@vercel/kv';
import { computeLeaderboard, type Leaderboard } from './queries';

// Public leaderboard is read-heavy and only changes when a game goes final, so
// it is cached in KV and recomputed by the grade cron. Reads are a single KV
// get; on a cache miss (cold start) we compute once and populate.
const key = (season: number) => `pickthebills:leaderboard:${season}`;

export async function getCachedLeaderboard(season: number): Promise<Leaderboard | null> {
  return (await kv.get<Leaderboard>(key(season))) ?? null;
}

export async function setCachedLeaderboard(lb: Leaderboard): Promise<void> {
  await kv.set(key(lb.season), lb);
}

export async function getLeaderboardWithFallback(season: number, nowIso: string): Promise<Leaderboard> {
  const cached = await getCachedLeaderboard(season);
  if (cached) return cached;
  const lb = await computeLeaderboard(season, nowIso);
  await setCachedLeaderboard(lb);
  return lb;
}
