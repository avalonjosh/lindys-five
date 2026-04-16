import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const seasonId = request.nextUrl.searchParams.get('seasonId') || '20252026';
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
    return NextResponse.json(
      { error: 'Failed to fetch team summary', details: error instanceof Error ? error.message : String(error) },
      { status: 502 }
    );
  }
}
