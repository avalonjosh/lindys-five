import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import { verifyAdmin } from '@/lib/adminAuth';
import { fetchImpactSummary, fetchPartnerizeSummary, type NetworkSummary } from '@/lib/services/affiliateNetworks';
import { fetchFirstPartyClicks, type FirstPartyClicks } from '@/lib/services/affiliateFirstParty';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

type Range = '7d' | '30d' | '90d' | '365d';
const RANGE_DAYS: Record<Range, number> = { '7d': 7, '30d': 30, '90d': 90, '365d': 365 };
const CACHE_TTL_SECONDS = 30 * 60;

export interface AffiliatesPayload {
  range: Range;
  from: string;
  to: string;
  cachedAt: string;
  networks: NetworkSummary[];
  firstParty: FirstPartyClicks;
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
