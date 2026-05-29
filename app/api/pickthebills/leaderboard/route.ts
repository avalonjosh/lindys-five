import { NextResponse } from 'next/server';
import { getActiveSeason } from '@/lib/pickthebills/windows';
import { getLeaderboardWithFallback } from '@/lib/pickthebills/leaderboardCache';

// Public leaderboard. Reads the KV-cached result (recomputed by the grade cron),
// falling back to a live compute on a cold cache.
export async function GET() {
  const season = await getActiveSeason();
  if (season === null) {
    return NextResponse.json({ season: null, finalGames: 0, threshold: 0, ranked: [], unranked: [], computedAt: null });
  }
  const lb = await getLeaderboardWithFallback(season, new Date().toISOString());
  return NextResponse.json(lb);
}
