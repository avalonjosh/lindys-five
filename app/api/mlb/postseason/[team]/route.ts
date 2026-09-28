import { NextRequest, NextResponse } from 'next/server';
import { MLB_TEAMS } from '@/lib/teamConfig';
import { mlbSeasonYear } from '@/lib/utils/mlbSeason';
import { fetchMLBPostseason } from '@/lib/services/mlbPostseason';

/** A team's postseason journey (series, odds, games), for live refresh on team pages. */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ team: string }> }) {
  const { team } = await params;
  const cfg = MLB_TEAMS[team];
  if (!cfg) return NextResponse.json({ error: 'Unknown team' }, { status: 404 });
  const postseason = await fetchMLBPostseason(cfg, mlbSeasonYear());
  return NextResponse.json({ postseason }, { headers: { 'Cache-Control': 'public, s-maxage=15, stale-while-revalidate=30' } });
}
