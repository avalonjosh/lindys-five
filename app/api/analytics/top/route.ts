import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import { getDateKey } from '@/lib/analytics';
import { verifyAdmin } from '@/lib/adminAuth';
import { fetchTopItems, hasGA4Credentials } from '@/lib/ga4';

// Types that stay in KV (not available in GA4)
const KV_TYPES = ['teams'];

export async function GET(request: NextRequest) {
  if (!(await verifyAdmin(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const params = request.nextUrl.searchParams;
  const type = params.get('type') || 'pages';
  const range = params.get('range') || 'today';
  const limit = Math.min(parseInt(params.get('limit') || '20'), 100);

  const validTypes = ['pages', 'referrers', 'countries', 'cities', 'devices', 'browsers', 'teams', 'utm_source', 'utm_medium', 'utm_campaign'];
  if (!validTypes.includes(type)) {
    return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
  }

  // Team data stays in KV since GA4 doesn't track teams natively
  if (KV_TYPES.includes(type)) {
    try {
      return NextResponse.json(await fetchFromKV(type, range, limit));
    } catch (error) {
      console.error(`KV top ${type} error:`, error);
      return NextResponse.json({ items: [] });
    }
  }

  // Everything else comes from GA4
  if (!hasGA4Credentials()) {
    return NextResponse.json({
      error: 'GA4 credentials missing (GSC_CLIENT_EMAIL / GSC_PRIVATE_KEY / GA4_PROPERTY_ID)',
      items: [],
    });
  }

  try {
    const data = await fetchTopItems(type, range, limit);
    return NextResponse.json(data);
  } catch (error) {
    console.error(`GA4 top ${type} error:`, error);
    return NextResponse.json({ error: 'GA4 credentials missing or invalid', items: [] });
  }
}

async function fetchFromKV(type: string, range: string, limit: number) {
  // No `:alltime` branch — nothing writes those keys anymore. Daily keys are
  // retained 90 days, so long ranges merge the full retained window.
  const days = range === '7d' ? 7 : range === '30d' ? 30 : (range === '12mo' || range === 'alltime') ? 90 : 1;

  if (days === 1) {
    const dateKey = getDateKey();
    const key = `analytics:top:${type}:${dateKey}`;
    const data = await kv.zrange(key, 0, limit - 1, { rev: true, withScores: true }) as (string | number)[];
    return { items: parseZrangeResult(data) };
  }

  const merged = new Map<string, number>();
  const pipeline = kv.pipeline();
  for (let i = 0; i < days; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateKey = getDateKey(d);
    pipeline.zrange(`analytics:top:${type}:${dateKey}`, 0, -1, { rev: true, withScores: true });
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

  return { items };
}

function parseZrangeResult(data: (string | number)[]): { name: string; count: number }[] {
  const items: { name: string; count: number }[] = [];
  if (!data || !Array.isArray(data)) return items;
  for (let i = 0; i < data.length; i += 2) {
    items.push({ name: String(data[i]), count: Number(data[i + 1]) || 0 });
  }
  return items;
}
