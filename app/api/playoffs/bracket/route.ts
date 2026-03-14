import { NextResponse } from 'next/server';

const NHL_API = 'https://api-web.nhle.com/v1';

export async function GET() {
  try {
    const [bracketRes, standingsRes] = await Promise.all([
      fetch(`${NHL_API}/playoff-bracket/20252026`, { cache: 'no-store' }),
      fetch(`${NHL_API}/standings/${new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' })}`, {
        next: { revalidate: 300 },
      }),
    ]);

    if (!bracketRes.ok) {
      return NextResponse.json({ error: 'Bracket unavailable' }, { status: 503 });
    }

    const bracket = await bracketRes.json();
    const standingsData = standingsRes.ok ? await standingsRes.json() : { standings: [] };

    // Return raw data — client will process
    return NextResponse.json({
      bracket,
      standings: standingsData.standings || [],
      hasLiveGames: bracket.rounds?.some((r: { series?: { games?: { gameState: string }[] }[] }) =>
        r.series?.some(s =>
          s.games?.some(g => g.gameState === 'LIVE' || g.gameState === 'CRIT')
        )
      ) || false,
    });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch bracket' }, { status: 500 });
  }
}
