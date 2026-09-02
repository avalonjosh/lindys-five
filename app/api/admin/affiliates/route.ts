import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import { verifyAdmin } from '@/lib/adminAuth';
import { fetchImpactSummary, fetchPartnerizeSummary, type NetworkSummary } from '@/lib/services/affiliateNetworks';
import { fetchFirstPartyClicks, emptyFirstPartyClicks, type FirstPartyClicks } from '@/lib/services/affiliateFirstParty';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

type Range = 'today' | '7d' | '30d' | '90d' | '365d';
const RANGE_DAYS: Record<Range, number> = { today: 1, '7d': 7, '30d': 30, '90d': 90, '365d': 365 };
const CACHE_TTL_SECONDS = 30 * 60;
const TODAY_CACHE_TTL_SECONDS = 5 * 60;

/** Midnight Eastern time N days ago, as an absolute Date (Vercel runs in UTC). */
function easternMidnightDaysAgo(daysAgo: number): Date {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit', timeZoneName: 'shortOffset' }).formatToParts(now);
  const get = (t: string) => parts.find((x) => x.type === t)?.value || '';
  const hours = Number(get('timeZoneName').match(/GMT([+-]\d+)/)?.[1] || '-5'); // -4 (EDT) or -5 (EST)
  const offset = `${hours < 0 ? '-' : '+'}${String(Math.abs(hours)).padStart(2, '0')}:00`;
  const d = new Date(`${get('year')}-${get('month')}-${get('day')}T00:00:00${offset}`);
  d.setUTCDate(d.getUTCDate() - daysAgo);
  return d;
}

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
  const cacheKey = `affiliates:summary:v2:${range}`;

  if (!refresh) {
    try {
      const cached = await kv.get<AffiliatesPayload>(cacheKey);
      if (cached) return NextResponse.json(cached);
    } catch { /* cache miss is fine */ }
  }

  const to = new Date();
  const from = easternMidnightDaysAgo(RANGE_DAYS[range] - 1);

  const [fanatics, stubhub, firstParty] = await Promise.all([
    fetchImpactSummary(from, to),
    fetchPartnerizeSummary(from, to),
    fetchFirstPartyClicks(RANGE_DAYS[range]).catch(() => emptyFirstPartyClicks()),
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
    await kv.set(cacheKey, payload, { ex: range === 'today' ? TODAY_CACHE_TTL_SECONDS : CACHE_TTL_SECONDS });
  } catch { /* non-fatal */ }

  return NextResponse.json(payload);
}
