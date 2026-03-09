import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import { jwtVerify } from 'jose';
import { getDateKey, getHourKey } from '@/lib/analytics';

async function verifyAdmin(request: NextRequest): Promise<boolean> {
  const token = request.cookies.get('admin_token')?.value;
  if (!token) return false;
  try {
    const secret = new TextEncoder().encode(process.env.ADMIN_SESSION_SECRET);
    await jwtVerify(token, secret);
    return true;
  } catch {
    return false;
  }
}

export async function GET(request: NextRequest) {
  if (!(await verifyAdmin(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const today = getDateKey();
  const currentHour = getHourKey();
  const prevHour = String((parseInt(currentHour) - 1 + 24) % 24).padStart(2, '0');

  const [viewsThisHour, viewsLastHour, activePages] = await Promise.all([
    kv.get<number>(`analytics:pv:hourly:${today}:${currentHour}`),
    kv.get<number>(`analytics:pv:hourly:${today}:${prevHour}`),
    kv.zrange(`analytics:top:pages:${today}`, 0, 9, { rev: true, withScores: true }) as Promise<(string | number)[]>,
  ]);

  const pages: { name: string; count: number }[] = [];
  if (activePages && Array.isArray(activePages)) {
    for (let i = 0; i < activePages.length; i += 2) {
      pages.push({ name: String(activePages[i]), count: Number(activePages[i + 1]) || 0 });
    }
  }

  return NextResponse.json({
    viewsThisHour: viewsThisHour || 0,
    viewsLastHour: viewsLastHour || 0,
    activePages: pages,
  });
}
