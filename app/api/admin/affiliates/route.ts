import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import { verifyAdmin } from '@/lib/adminAuth';
import { fetchImpactSummary, fetchPartnerizeSummary, type NetworkSummary } from '@/lib/services/affiliateNetworks';
import { fetchFirstPartyClicks, emptyFirstPartyClicks, type FirstPartyClicks } from '@/lib/services/affiliateFirstParty';
import { getKofiSummary, type KofiSummary } from '@/lib/kofi';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

type Preset = 'today' | 'yesterday' | '7d' | '30d' | '90d' | '365d';
export type EarningsRange = Preset | 'custom';
/** Days in each preset, and how many days before today it ends (yesterday ends 1 day back). */
const PRESETS: Record<Preset, { days: number; endDaysAgo: number }> = {
  today: { days: 1, endDaysAgo: 0 },
  yesterday: { days: 1, endDaysAgo: 1 },
  '7d': { days: 7, endDaysAgo: 0 },
  '30d': { days: 30, endDaysAgo: 0 },
  '90d': { days: 90, endDaysAgo: 0 },
  '365d': { days: 365, endDaysAgo: 0 },
};
const MAX_CUSTOM_DAYS = 400;
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

const easternToday = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
/** Whole days from an Eastern YYYY-MM-DD date to today (0 = today). */
const daysAgoOf = (date: string) => Math.round((Date.parse(`${easternToday()}T12:00:00Z`) - Date.parse(`${date}T12:00:00Z`)) / 86400000);

/** The window to report on: a preset, or a custom from/to (Eastern dates, inclusive). */
function resolveWindow(params: URLSearchParams): { range: EarningsRange; days: number; endDaysAgo: number; key: string } | { error: string } {
  const range = params.get('range') || '30d';
  if (range in PRESETS) {
    const p = PRESETS[range as Preset];
    return { range: range as Preset, ...p, key: range };
  }
  if (range !== 'custom') return { error: 'Unknown range' };
  const from = params.get('from') || '';
  const to = params.get('to') || '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) return { error: 'Pick a start and end date' };
  const endDaysAgo = daysAgoOf(to);
  const days = daysAgoOf(from) - endDaysAgo + 1;
  if (endDaysAgo < 0) return { error: "The end date can't be in the future" };
  if (days < 1) return { error: 'The start date must be on or before the end date' };
  if (days > MAX_CUSTOM_DAYS) return { error: `Pick ${MAX_CUSTOM_DAYS} days or fewer` };
  return { range: 'custom', days, endDaysAgo, key: `custom:${from}:${to}` };
}

export interface AffiliatesPayload {
  range: EarningsRange;
  /** Days in the window (for the click-history coverage note). */
  days: number;
  from: string;
  to: string;
  cachedAt: string;
  networks: NetworkSummary[];
  firstParty: FirstPartyClicks;
  /** Ko-fi tips in the range. Read fresh on every request (not cached with the networks). */
  kofi: KofiSummary;
}

export async function GET(request: NextRequest) {
  if (!(await verifyAdmin(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const params = request.nextUrl.searchParams;
  const window = resolveWindow(params);
  if ('error' in window) return NextResponse.json({ error: window.error }, { status: 400 });
  const { range, days, endDaysAgo } = window;
  const refresh = params.get('refresh') === '1';
  const cacheKey = `affiliates:summary:v3:${window.key}`;

  const from = easternMidnightDaysAgo(endDaysAgo + days - 1);
  // A window ending today runs to now; one ending earlier stops at that day's midnight.
  const to = endDaysAgo === 0 ? new Date() : new Date(easternMidnightDaysAgo(endDaysAgo - 1).getTime() - 1);
  const kofi = await getKofiSummary(from, to).catch((): KofiSummary => ({ configured: !!process.env.KOFI_VERIFICATION_TOKEN, total: 0, count: 0, monthlyCount: 0, otherCurrency: 0, recent: [], lastTestAt: null }));

  if (!refresh) {
    try {
      const cached = await kv.get<Omit<AffiliatesPayload, 'kofi'>>(cacheKey);
      if (cached) return NextResponse.json({ ...cached, kofi });
    } catch { /* cache miss is fine */ }
  }

  const [fanatics, stubhub, firstParty] = await Promise.all([
    fetchImpactSummary(from, to),
    fetchPartnerizeSummary(from, to),
    fetchFirstPartyClicks(days, endDaysAgo).catch(() => emptyFirstPartyClicks()),
  ]);

  const payload: Omit<AffiliatesPayload, 'kofi'> = {
    range,
    days,
    from: from.toISOString(),
    to: to.toISOString(),
    cachedAt: new Date().toISOString(),
    networks: [fanatics, stubhub],
    firstParty,
  };

  try {
    await kv.set(cacheKey, payload, { ex: endDaysAgo === 0 && days === 1 ? TODAY_CACHE_TTL_SECONDS : CACHE_TTL_SECONDS });
  } catch { /* non-fatal */ }

  return NextResponse.json({ ...payload, kofi } satisfies AffiliatesPayload);
}
