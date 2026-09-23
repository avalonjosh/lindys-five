import { NextResponse } from 'next/server';
import { getTeamSnapshot } from '@/lib/services/homeTeamSnapshot';

export const dynamic = 'force-static';
export const revalidate = 300;

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  try {
    const snapshot = await getTeamSnapshot(slug);
    if (!snapshot) return NextResponse.json({ error: 'Unknown team' }, { status: 404 });
    return NextResponse.json(snapshot);
  } catch (err) {
    console.error('home team snapshot failed:', slug, err);
    return NextResponse.json({ error: 'Unavailable' }, { status: 503 });
  }
}
