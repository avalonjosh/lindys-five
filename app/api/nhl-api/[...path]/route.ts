import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const nhlPath = path.join('/');
  const url = `https://api-web.nhle.com/v1/${nhlPath}`;

  try {
    const response = await fetch(url);

    if (!response.ok) {
      // Pass through the actual status code from NHL API
      const text = await response.text();
      return new NextResponse(text, {
        status: response.status,
        headers: { 'Content-Type': response.headers.get('Content-Type') || 'application/json' },
      });
    }

    const data = await response.json();

    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });
  } catch (error) {
    console.error('Error in NHL API proxy:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch from NHL API',
        details: error instanceof Error ? error.message : String(error),
        url: url,
      },
      { status: 502 }
    );
  }
}
