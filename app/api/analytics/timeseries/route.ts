import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import { jwtVerify } from 'jose';
import { getDateKey } from '@/lib/analytics';

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

  const range = request.nextUrl.searchParams.get('range') || 'today';
  const today = getDateKey();

  if (range === 'today') {
    const pipeline = kv.pipeline();

    for (let h = 0; h < 24; h++) {
      const hh = String(h).padStart(2, '0');
      pipeline.get(`analytics:pv:hourly:${today}:${hh}`);
    }
    const results = await pipeline.exec();

    const labels: string[] = [];
    const views: number[] = [];
    for (let h = 0; h < 24; h++) {
      const period = h === 0 ? '12am' : h < 12 ? `${h}am` : h === 12 ? '12pm' : `${h - 12}pm`;
      labels.push(period);
      views.push((results[h] as number) || 0);
    }

    return NextResponse.json({ labels, views, visitors: null, timezone: 'ET' });
  }

  // 7d or 30d — daily data
  const days = range === '7d' ? 7 : 30;
  const pipeline = kv.pipeline();
  const dateKeys: string[] = [];

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dk = getDateKey(d);
    dateKeys.push(dk);
    pipeline.get(`analytics:pv:${dk}`);
    pipeline.pfcount(`analytics:uv:${dk}`);
  }

  const results = await pipeline.exec();

  const labels: string[] = [];
  const views: number[] = [];
  const visitors: number[] = [];

  for (let i = 0; i < days; i++) {
    const date = dateKeys[i];
    // Format as M/D for cleaner labels
    const [, m, d] = date.split('-');
    labels.push(`${parseInt(m)}/${parseInt(d)}`);
    views.push((results[i * 2] as number) || 0);
    visitors.push((results[i * 2 + 1] as number) || 0);
  }

  return NextResponse.json({ labels, views, visitors, timezone: 'ET' });
}
