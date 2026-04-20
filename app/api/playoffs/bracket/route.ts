import { NextResponse } from 'next/server';
import { fetchPlayoffsSnapshot } from '@/lib/services/playoffsSnapshot';

export async function GET() {
  try {
    const snapshot = await fetchPlayoffsSnapshot();
    return NextResponse.json({
      bracket: snapshot.bracket,
      standings: snapshot.standings,
      hasLiveGames: snapshot.hasLiveGames,
      cupOdds: snapshot.cupOdds,
    });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch bracket' }, { status: 500 });
  }
}
