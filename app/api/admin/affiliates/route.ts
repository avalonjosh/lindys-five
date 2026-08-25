import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import { verifyAdmin } from '@/lib/adminAuth';
import { getDateKey } from '@/lib/analytics';
import { fetchImpactSummary, fetchPartnerizeSummary, type NetworkSummary } from '@/lib/services/affiliateNetworks';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

type Range = '7d' | '30d' | '90d' | '365d';
const RANGE_DAYS: Record<Range, number> = { '7d': 7, '30d': 30, '90d': 90, '365d': 365 };
const CACHE_TTL_SECONDS = 30 * 60;

export interface FirstPartyClicks {
  total: number;
  byBucket: { name: string; count: number }[]; // gear | tickets | merch | gear-cta
  byLabel: { name: string; count: number }[];
}

export interface AffiliatesPayload {
  range: Range;
  from: string;
  to: string;
  cachedAt: string;
  networks: NetworkSummary[];
  firstParty: FirstPartyClicks;
}

/** On-site outbound affiliate clicks (tracked in KV by /api/analytics/track). */
async function fetchFirstPartyClicks(days: number): Promise<FirstPartyClicks> {
  const pipeline = kv.pipeline();
  const n = Math.min(days, 90); // daily click keys are retained 90 days
  for (let i = 0; i < n; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    pipeline.zrange(`analytics:clicks:${getDateKey(d)}`, 0, -1, { withScores: true });
  }
  const results = await pipeline.exec();
  const byLabel = new Map<string, number>();
  const byBucket = new Map<string, number>();
  let total = 0;
  for (const result of results) {
    const data = result as (string | number)[];
    if (!Array.isArray(data)) continue;
    for (let i = 0; i < data.length; i += 2) {
      const name = String(data[i]);
      const count = Number(data[i + 1]) || 0;
      const bucket = name.split(':')[0];
      if (!['gear', 'tickets', 'merch', 'gear-cta'].includes(bucket)) continue;
      total += count;
      byLabel.set(name, (byLabel.get(name) || 0) + count);
      byBucket.set(bucket, (byBucket.get(bucket) || 0) + count);
    }
  }
  const toList = (m: Map<string, number>) =>
    Array.from(m.entries()).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
  return { total, byBucket: toList(byBucket), byLabel: toList(byLabel).slice(0, 40) };
}

export async function GET(request: NextRequest) {
  if (!(await verifyAdmin(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const params = request.nextUrl.searchParams;
  const range = (Object.keys(RANGE_DAYS).includes(params.get('range') || '') ? params.get('range') : '30d') as Range;
  const refresh = params.get('refresh') === '1';
  const cacheKey = `affiliates:summary:${range}`;

  if (!refresh) {
    try {
      const cached = await kv.get<AffiliatesPayload>(cacheKey);
      if (cached) return NextResponse.json(cached);
    } catch { /* cache miss is fine */ }
  }

  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - (RANGE_DAYS[range] - 1));
  from.setHours(0, 0, 0, 0);

  const [fanatics, stubhub, firstParty] = await Promise.all([
    fetchImpactSummary(from, to),
    fetchPartnerizeSummary(from, to),
    fetchFirstPartyClicks(RANGE_DAYS[range]).catch(() => ({ total: 0, byBucket: [], byLabel: [] })),
  ]);

  const payload: AffiliatesPayload = {
    range,
    from: from.toISOString(),
    to: to.toISOString(),
    cachedAt: new Date().toISOString(),
    networks: [fanatics, stubhub],
    firstParty,
  };

  try {
    await kv.set(cacheKey, payload, { ex: CACHE_TTL_SECONDS });
  } catch { /* non-fatal */ }

  return NextResponse.json(payload);
}
