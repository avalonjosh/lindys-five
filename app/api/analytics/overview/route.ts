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

function getDaysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return getDateKey(d);
}

function getDateRange(range: string): { current: string[]; previous: string[] } {
  const days = range === '7d' ? 7 : range === '30d' ? 30 : 1;
  const current: string[] = [];
  const previous: string[] = [];
  for (let i = 0; i < days; i++) {
    current.push(getDaysAgo(i));
    previous.push(getDaysAgo(i + days));
  }
  return { current, previous };
}

export async function GET(request: NextRequest) {
  if (!(await verifyAdmin(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const range = request.nextUrl.searchParams.get('range') || 'today';

  if (range === 'alltime') {
    const [totalViews, topPages, topReferrers] = await Promise.all([
      kv.get<number>('analytics:total:pv'),
      kv.zrange('analytics:top:pages:alltime', 0, 0, { rev: true, withScores: true }) as Promise<(string | number)[]>,
      kv.zrange('analytics:top:referrers:alltime', 0, 0, { rev: true, withScores: true }) as Promise<(string | number)[]>,
    ]);

    return NextResponse.json({
      totalViews: totalViews || 0,
      uniqueVisitors: null,
      viewsChange: null,
      bounceRate: null,
      avgDuration: null,
      topPage: topPages.length >= 2 ? { name: topPages[0], count: topPages[1] } : null,
      topReferrer: topReferrers.length >= 2 ? { name: topReferrers[0], count: topReferrers[1] } : null,
    });
  }

  const { current, previous } = getDateRange(range);

  const pipeline = kv.pipeline();
  // Current period: views, unique visitors, sessions, bounces, duration
  for (const day of current) {
    pipeline.get(`analytics:pv:${day}`);
    pipeline.pfcount(`analytics:uv:${day}`);
    pipeline.get(`analytics:sessions:${day}`);
    pipeline.get(`analytics:bounces:${day}`);
    pipeline.get(`analytics:duration:sum:${day}`);
    pipeline.get(`analytics:duration:count:${day}`);
  }
  // Previous period: views only for comparison
  for (const day of previous) {
    pipeline.get(`analytics:pv:${day}`);
  }
  // Top page and referrer
  pipeline.zrange(`analytics:top:pages:${current[0]}`, 0, 0, { rev: true, withScores: true });
  pipeline.zrange(`analytics:top:referrers:${current[0]}`, 0, 0, { rev: true, withScores: true });

  const results = await pipeline.exec();

  let totalViews = 0;
  let uniqueVisitors = 0;
  let totalSessions = 0;
  let totalBounces = 0;
  let durationSum = 0;
  let durationCount = 0;
  const currentLen = current.length;
  const fieldsPerDay = 6;

  for (let i = 0; i < currentLen; i++) {
    const base = i * fieldsPerDay;
    totalViews += (results[base] as number) || 0;
    uniqueVisitors += (results[base + 1] as number) || 0;
    totalSessions += (results[base + 2] as number) || 0;
    totalBounces += (results[base + 3] as number) || 0;
    durationSum += (results[base + 4] as number) || 0;
    durationCount += (results[base + 5] as number) || 0;
  }

  let previousViews = 0;
  const prevOffset = currentLen * fieldsPerDay;
  for (let i = 0; i < previous.length; i++) {
    previousViews += (results[prevOffset + i] as number) || 0;
  }

  const viewsChange = previousViews > 0
    ? Math.round(((totalViews - previousViews) / previousViews) * 100)
    : null;

  const bounceRate = totalSessions > 0
    ? Math.round((totalBounces / totalSessions) * 100)
    : null;

  const avgDuration = durationCount > 0
    ? Math.round(durationSum / durationCount)
    : null;

  const topPagesResult = results[prevOffset + previous.length] as string[];
  const topReferrersResult = results[prevOffset + previous.length + 1] as string[];

  return NextResponse.json({
    totalViews,
    uniqueVisitors,
    viewsChange,
    bounceRate,
    avgDuration,
    topPage: topPagesResult?.length >= 2 ? { name: topPagesResult[0], count: topPagesResult[1] } : null,
    topReferrer: topReferrersResult?.length >= 2 ? { name: topReferrersResult[0], count: topReferrersResult[1] } : null,
  });
}
