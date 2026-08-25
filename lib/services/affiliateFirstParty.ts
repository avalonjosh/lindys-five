import { kv } from '@vercel/kv';
import { getDateKey } from '@/lib/analytics';

/** Click buckets written by trackClick() on outbound affiliate anchors. */
const AFFILIATE_BUCKETS = new Set(['ticket', 'ticket-boxscore', 'tickets', 'gear', 'gear-cta', 'merch']);

export interface FirstPartyClicks {
  total: number;
  byBucket: { name: string; count: number }[]; // ticket | ticket-boxscore | tickets | gear | gear-cta | merch
  byLabel: { name: string; count: number }[];
}

/** On-site outbound affiliate clicks (tracked in KV by /api/analytics/track). */
export async function fetchFirstPartyClicks(days: number, endOffsetDays = 0): Promise<FirstPartyClicks> {
  const pipeline = kv.pipeline();
  const n = Math.min(days, 90); // daily click keys are retained 90 days
  for (let i = 0; i < n; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i - endOffsetDays);
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
      if (!AFFILIATE_BUCKETS.has(bucket)) continue;
      total += count;
      byLabel.set(name, (byLabel.get(name) || 0) + count);
      byBucket.set(bucket, (byBucket.get(bucket) || 0) + count);
    }
  }
  const toList = (m: Map<string, number>) =>
    Array.from(m.entries()).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
  return { total, byBucket: toList(byBucket), byLabel: toList(byLabel).slice(0, 40) };
}
