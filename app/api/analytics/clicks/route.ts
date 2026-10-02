import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import { getDateKey } from '@/lib/analytics';
import { verifyAdmin } from '@/lib/adminAuth';
import { resolveAnalyticsWindow } from '@/lib/analyticsRange';

export async function GET(request: NextRequest) {
  if (!(await verifyAdmin(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const params = request.nextUrl.searchParams;
  const window = resolveAnalyticsWindow(params);
  if ('error' in window) return NextResponse.json({ error: window.error, items: [] }, { status: 400 });
  const limit = Math.min(parseInt(params.get('limit') || '20'), 100);
  // Daily keys are retained 90 days, so longer windows merge what's kept.
  const days = Math.min(window.days, 90);

  // Multi-day merge
  const merged = new Map<string, number>();
  const pipeline = kv.pipeline();
  for (let i = 0; i < days; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i - window.endDaysAgo);
    pipeline.zrange(`analytics:clicks:${getDateKey(d)}`, 0, -1, { rev: true, withScores: true });
  }

  const results = await pipeline.exec();
  for (const result of results) {
    const data = result as (string | number)[];
    if (!data || !Array.isArray(data)) continue;
    for (let i = 0; i < data.length; i += 2) {
      const name = String(data[i]);
      const count = Number(data[i + 1]) || 0;
      merged.set(name, (merged.get(name) || 0) + count);
    }
  }

  const items = Array.from(merged.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);

  return NextResponse.json({ items });
}
