import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/utils/adminAuth';
import { getActiveSeason, listGames, listWindows, getNextKickoff } from '@/lib/pickthebills/windows';

// Dashboard data for the admin Pick the Bills page: season, games, windows.
export async function GET(request: NextRequest) {
  if (!(await verifyAdmin(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const season = await getActiveSeason();
  if (season === null) {
    return NextResponse.json({ season: null, games: [], windows: [], nextKickoff: null });
  }

  const now = new Date();
  const [gamesList, windowsList, nextKickoff] = await Promise.all([
    listGames(season),
    listWindows(season),
    getNextKickoff(season, now),
  ]);

  return NextResponse.json({ season, games: gamesList, windows: windowsList, nextKickoff });
}
