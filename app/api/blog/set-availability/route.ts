import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import { jwtVerify } from 'jose';
import { fetchJsonWithRetry } from '@/lib/fetchWithRetry';

const NHL_API_BASE = 'https://api-web.nhle.com/v1';

// Helper to verify admin authentication
async function verifyAdmin(request: NextRequest): Promise<boolean> {
  const token = request.cookies.get('admin_token')?.value;
  if (!token) return false;

  try {
    const secret = new TextEncoder().encode(process.env.ADMIN_SESSION_SECRET);
    await jwtVerify(token, secret);
    return true;
  } catch {
    return false;
  }
}

export async function GET(request: NextRequest) {
  // Verify admin authentication
  const isAdmin = await verifyAdmin(request);
  if (!isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Fetch season schedule
    const schedule = await fetchJsonWithRetry(`${NHL_API_BASE}/club-schedule-season/BUF/20252026`);

    // Get all completed regular season games
    const completedGames = (schedule.games || [])
      .filter((g: any) => g.gameType === 2) // Regular season
      .filter((g: any) => g.gameState === 'FINAL' || g.gameState === 'OFF');

    const totalGames = completedGames.length;
    const completedSetCount = Math.floor(totalGames / 5);

    // Build set availability info
    const sets = [];
    for (let setNum = 1; setNum <= completedSetCount; setNum++) {
      const processed = await kv.sismember('blog:setrecap:processed', String(setNum));

      // Get games for this set
      const setStartIndex = (setNum - 1) * 5;
      const setEndIndex = setStartIndex + 5;
      const setGames = completedGames.slice(setStartIndex, setEndIndex);

      // Format date range
      const startDate = setGames[0]?.gameDate;
      const endDate = setGames[setGames.length - 1]?.gameDate;

      sets.push({
        setNumber: setNum,
        processed: Boolean(processed),
        startDate,
        endDate,
        gamesCount: setGames.length
      });
    }

    // Check if there's a partial set in progress
    const partialGames = totalGames % 5;
    const nextSetNumber = completedSetCount + 1;

    return NextResponse.json({
      success: true,
      totalGames,
      completedSets: completedSetCount,
      sets,
      partialSet: partialGames > 0 ? {
        setNumber: nextSetNumber,
        gamesPlayed: partialGames,
        gamesNeeded: 5 - partialGames
      } : null
    });

  } catch (error: any) {
    console.error('Error fetching set availability:', error);
    return NextResponse.json(
      { error: 'Failed to fetch set availability', details: error.message },
      { status: 500 }
    );
  }
}
