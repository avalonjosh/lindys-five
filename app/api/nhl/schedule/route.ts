import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const team = request.nextUrl.searchParams.get('team');
  const date = request.nextUrl.searchParams.get('date');

  if (!team || !date) {
    return NextResponse.json(
      { error: 'Missing required parameters: team and date' },
      { status: 400 }
    );
  }

  const url = `https://api-web.nhle.com/v1/club-schedule/${team}/week/${date}`;

  try {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`NHL API returned ${response.status}`);
    }

    const data = await response.json();

    // Cache for 5 minutes - schedule data doesn't change frequently
    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 's-maxage=300, stale-while-revalidate=60',
      },
    });
  } catch (error) {
    console.error('Error fetching NHL schedule:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch schedule',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
