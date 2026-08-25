import { NextResponse } from 'next/server';
import { getDataset } from '@/lib/perfectseason/server/datasets';

// Prerendered at build and served from the CDN: the player pools are ~600KB
// of JSON and used to ship inside the client JS bundle for /82-0 and /162-0.
export const dynamic = 'force-static';

export async function generateStaticParams() {
  return [{ sport: 'nhl' }, { sport: 'mlb' }];
}

export async function GET(_req: Request, { params }: { params: Promise<{ sport: string }> }) {
  const { sport } = await params;
  if (sport !== 'nhl' && sport !== 'mlb') {
    return NextResponse.json({ error: 'Unknown sport' }, { status: 404 });
  }
  return NextResponse.json(getDataset(sport).data, {
    headers: { 'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800' },
  });
}
