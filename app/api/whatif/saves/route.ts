import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import { getUserId } from '@/lib/perfectseason/server/session';
import { whatIfIndexKey, type WhatIfSave } from '@/lib/whatif/types';

export async function GET(request: NextRequest) {
  const userId = await getUserId(request);
  if (!userId) return NextResponse.json({ error: 'Sign in to view your picks' }, { status: 401 });

  const sport = request.nextUrl.searchParams.get('sport');
  const team = request.nextUrl.searchParams.get('team');
  const season = request.nextUrl.searchParams.get('season');
  const latestOnly = request.nextUrl.searchParams.get('latest') === '1';

  // Index members are `${sport}:${teamId}:${season}:${savedDate}`, scored by savedAt.
  const members = await kv.zrange<string[]>(whatIfIndexKey(userId), 0, -1, { rev: true });
  if (!members || members.length === 0) return NextResponse.json({ saves: [] });

  let filtered = members;
  if (sport && team && season) {
    const prefix = `${sport}:${team}:${season}:`;
    filtered = members.filter((m) => m.startsWith(prefix));
  }
  if (latestOnly) filtered = filtered.slice(0, 1);
  if (filtered.length === 0) return NextResponse.json({ saves: [] });

  // Index member === save key suffix (see lib/whatif/types.ts).
  const keys = filtered.map((m) => `whatif:save:${userId}:${m}`);
  const saves = (await kv.mget<(WhatIfSave | null)[]>(...keys)).filter(Boolean);

  return NextResponse.json({ saves });
}
