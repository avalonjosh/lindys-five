import { NextRequest, NextResponse } from 'next/server';
import { getCurrentNHLSeason } from '@/lib/utils/season';

export async function GET(request: NextRequest) {
  const seasonId = request.nextUrl.searchParams.get('seasonId') || getCurrentNHLSeason();
  // Strict 8-digit season only — this is interpolated into the upstream cayenneExp query
  if (!/^\d{8}$/.test(seasonId)) {
    return NextResponse.json({ error: 'Invalid seasonId' }, { status: 400 });
  }
  const url = `https://api.nhle.com/stats/rest/en/team/summary?cayenneExp=seasonId=${seasonId}%20and%20gameTypeId=2`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      return new NextResponse(await response.text(), { status: response.status });
    }
    const data = await response.json();
    return NextResponse.json(data, {
      headers: { 'Cache-Control': 's-maxage=3600, stale-while-revalidate=7200' },
    });
  } catch (error) {
    console.error('team-summary proxy error:', error);
    return NextResponse.json({ error: 'Failed to fetch team summary' }, { status: 502 });
  }
}
