import { kv } from '@vercel/kv';
import { getDateKey } from '@/lib/analytics';
import { normalizeTeamKey, normalizeMatchupKey } from './affiliateTeamKey';

/** Click buckets written by trackClick() on outbound affiliate anchors. */
const AFFILIATE_BUCKETS = new Set(['ticket', 'ticket-boxscore', 'tickets', 'gear', 'gear-cta', 'merch']);
const TICKET_BUCKETS = new Set(['ticket', 'ticket-boxscore', 'tickets']);

export type FirstPartyVendor = 'stubhub' | 'fanatics' | 'amazon';

export interface FirstPartyDaily {
  date: string; // YYYY-MM-DD (Eastern)
  clicks: number;
  stubhub: number;
  fanatics: number;
  amazon: number;
}

export interface FirstPartyClicks {
  total: number;
  byBucket: { name: string; count: number }[]; // ticket | ticket-boxscore | tickets | gear | gear-cta | merch
  byLabel: { name: string; count: number }[];
  /** Clicks by the network the link resolves to (Amazon has no reporting API). */
  byVendor: Record<FirstPartyVendor, number>;
  /** Per-day series, oldest first. Only days inside the requested window. */
  daily: FirstPartyDaily[];
  /** Clicks by team, keyed `{sport}-{slug}` to match the normalised network rows. */
  byTeam: { name: string; count: number }[];
  /** Clicks by placement: game-link, boxscore, blog, tickets-hub, gear-hub, or the merch CTA placement. */
  byPlacement: { name: string; count: number }[];
  /** Days of first-party data actually covered (daily click keys are retained 90 days). */
  coveredDays: number;
}

export function emptyFirstPartyClicks(): FirstPartyClicks {
  return { total: 0, byBucket: [], byLabel: [], byVendor: { stubhub: 0, fanatics: 0, amazon: 0 }, daily: [], byTeam: [], byPlacement: [], coveredDays: 0 };
}

function vendorFor(bucket: string, label: string): FirstPartyVendor {
  if (TICKET_BUCKETS.has(bucket)) return 'stubhub';
  return /(^|-)amazon(-|$)/.test(label) ? 'amazon' : 'fanatics';
}

/**
 * Label shapes (see trackClick callers):
 *  ticket:BUF-vs-TOR · ticket:blog-buf-vs-tor · ticket:TOR (opponent abbrev)
 *  ticket-boxscore:BUF-vs-TOR · tickets:sabres-hub
 *  gear:sabres-fanatics-jerseys · gear:sabres-amazon-hats
 *  merch:nhl-sabres-fanatics-teampage
 */
function teamFor(bucket: string, label: string): string {
  const l = label.toLowerCase();
  if (!l) return '(untagged)';
  if (TICKET_BUCKETS.has(bucket)) {
    const vs = l.replace(/^blog-/, '').match(/^([a-z]{2,3})-vs-([a-z]{2,3})/);
    if (vs) return normalizeMatchupKey(vs[1], vs[2]);
    const hub = l.match(/^(.+)-hub$/);
    if (hub) return normalizeTeamKey(hub[1]);
    return normalizeTeamKey(l);
  }
  if (bucket === 'merch') {
    const m = l.match(/^(nhl|mlb)-(.+?)-(fanatics|amazon)-/);
    if (m) return normalizeTeamKey(`${m[1]}-${m[2]}`);
    return normalizeTeamKey(l);
  }
  const g = l.match(/^(.+?)-(fanatics|amazon)(-|$)/);
  if (g) return normalizeTeamKey(g[1]);
  return normalizeTeamKey(l);
}

function placementFor(bucket: string, label: string): string {
  const l = label.toLowerCase();
  switch (bucket) {
    case 'ticket': return l.startsWith('blog-') ? 'blog' : 'game-link';
    case 'ticket-boxscore': return 'boxscore';
    case 'tickets': return 'tickets-hub';
    case 'gear':
    case 'gear-cta': return 'gear-hub';
    case 'merch': {
      const m = l.match(/-(fanatics|amazon)-(.+)$/);
      return m ? m[2] : 'merch';
    }
    default: return bucket;
  }
}

/** On-site outbound affiliate clicks (tracked in KV by /api/analytics/track). */
export async function fetchFirstPartyClicks(days: number, endOffsetDays = 0): Promise<FirstPartyClicks> {
  const pipeline = kv.pipeline();
  const n = Math.min(days, 90); // daily click keys are retained 90 days
  const dates: string[] = [];
  for (let i = 0; i < n; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i - endOffsetDays);
    const key = getDateKey(d);
    dates.push(key);
    pipeline.zrange(`analytics:clicks:${key}`, 0, -1, { withScores: true });
  }
  const results = await pipeline.exec();
  const out = emptyFirstPartyClicks();
  out.coveredDays = n;
  const byLabel = new Map<string, number>();
  const byBucket = new Map<string, number>();
  const byTeam = new Map<string, number>();
  const byPlacement = new Map<string, number>();
  const bump = (m: Map<string, number>, k: string, c: number) => m.set(k, (m.get(k) || 0) + c);

  results.forEach((result, idx) => {
    const data = result as (string | number)[];
    if (!Array.isArray(data)) return;
    const day: FirstPartyDaily = { date: dates[idx], clicks: 0, stubhub: 0, fanatics: 0, amazon: 0 };
    for (let i = 0; i < data.length; i += 2) {
      const name = String(data[i]);
      const count = Number(data[i + 1]) || 0;
      const sep = name.indexOf(':');
      const bucket = sep === -1 ? name : name.slice(0, sep);
      const label = sep === -1 ? '' : name.slice(sep + 1);
      if (!AFFILIATE_BUCKETS.has(bucket)) continue;
      const vendor = vendorFor(bucket, label);
      out.total += count;
      out.byVendor[vendor] += count;
      day.clicks += count;
      day[vendor] += count;
      bump(byLabel, name, count);
      bump(byBucket, bucket, count);
      bump(byTeam, teamFor(bucket, label), count);
      bump(byPlacement, placementFor(bucket, label), count);
    }
    if (day.clicks > 0) out.daily.push(day);
  });

  const toList = (m: Map<string, number>) =>
    Array.from(m.entries()).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
  out.daily.sort((a, b) => a.date.localeCompare(b.date));
  out.byBucket = toList(byBucket);
  out.byLabel = toList(byLabel).slice(0, 40);
  out.byTeam = toList(byTeam);
  out.byPlacement = toList(byPlacement);
  return out;
}
