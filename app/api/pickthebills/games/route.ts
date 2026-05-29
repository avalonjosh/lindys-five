import { NextResponse } from 'next/server';
import { getActiveSeason, getOpenWindow, listGames } from '@/lib/pickthebills/windows';

// Public: games + the currently-open window for rendering the pick screen.
export async function GET() {
  const season = await getActiveSeason();
  if (season === null) {
    return NextResponse.json({ season: null, games: [], openWindow: null });
  }
  const now = new Date();
  const [gamesList, openWindow] = await Promise.all([listGames(season), getOpenWindow(season, now)]);
  return NextResponse.json({ season, games: gamesList, openWindow });
}
