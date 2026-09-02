/**
 * Read-only reporting clients for the affiliate networks:
 *  - Impact (Fanatics / NHL Shop), Basic auth with IMPACT_ACCOUNT_SID + IMPACT_AUTH_TOKEN
 *  - Partnerize (StubHub NORAM), Basic auth with PARTNERIZE_APP_KEY + PARTNERIZE_USER_KEY
 * Both normalise to the same shape so the admin can show them side by side.
 */

import { normalizeTeamKey, normalizeMatchupKey } from './affiliateTeamKey';

export interface NetworkDaily {
  date: string; // YYYY-MM-DD
  clicks: number;
  conversions: number;
  sales: number;
  commission: number;
}

export interface NetworkBreakdownRow {
  name: string;
  clicks: number;
  conversions: number;
  commission: number;
}

export interface NetworkSale {
  network: 'fanatics' | 'stubhub';
  date: string; // ISO
  amount: number;
  commission: number;
  status: string; // pending | approved | reversed | rejected
  ref: string; // subId1/subId2 or pubref
  detail?: string; // event name / campaign
}

export interface NetworkSummary {
  network: 'fanatics' | 'stubhub';
  label: string;
  configured: boolean;
  error?: string;
  clicks: number;
  conversions: number;
  sales: number;
  commission: number;
  pendingCommission: number;
  approvedCommission: number;
  daily: NetworkDaily[];
  byTeam: NetworkBreakdownRow[];
  byPlacement: NetworkBreakdownRow[];
  recentSales: NetworkSale[];
}

const num = (v: unknown): number => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? '').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? n : 0;
};

const ymd = (d: Date) => d.toISOString().slice(0, 10);

function emptySummary(network: NetworkSummary['network'], label: string, configured: boolean, error?: string): NetworkSummary {
  return {
    network, label, configured, error,
    clicks: 0, conversions: 0, sales: 0, commission: 0, pendingCommission: 0, approvedCommission: 0,
    daily: [], byTeam: [], byPlacement: [], recentSales: [],
  };
}

function addRow(map: Map<string, NetworkBreakdownRow>, name: string, clicks: number, conversions: number, commission: number) {
  const row = map.get(name) || { name, clicks: 0, conversions: 0, commission: 0 };
  row.clicks += clicks; row.conversions += conversions; row.commission += commission;
  map.set(name, row);
}

const sortRows = (map: Map<string, NetworkBreakdownRow>) =>
  Array.from(map.values()).sort((a, b) => b.commission - a.commission || b.conversions - a.conversions || b.clicks - a.clicks);

// ---------------------------------------------------------------------------
// Impact (Fanatics)
// ---------------------------------------------------------------------------

export function hasImpactCredentials(): boolean {
  return !!(process.env.IMPACT_ACCOUNT_SID && process.env.IMPACT_AUTH_TOKEN);
}

async function impactGet<T = Record<string, unknown>>(path: string): Promise<T> {
  const sid = process.env.IMPACT_ACCOUNT_SID!;
  const tok = process.env.IMPACT_AUTH_TOKEN!;
  const url = path.startsWith('http') ? path : `https://api.impact.com${path.startsWith('/Mediapartners') ? path : `/Mediapartners/${sid}${path}`}`;
  const res = await fetch(url, {
    headers: {
      Authorization: 'Basic ' + Buffer.from(`${sid}:${tok}`).toString('base64'),
      Accept: 'application/json',
    },
    cache: 'no-store',
  });
  if (!res.ok) {
    let detail = '';
    try { detail = ((await res.json()) as { Message?: string }).Message || ''; } catch { /* no body */ }
    throw new Error(`Impact ${res.status}${detail ? `: ${detail}` : ''} on ${path.replace(/\/Mediapartners\/[^/]+/, '')}`);
  }
  return res.json() as Promise<T>;
}

interface ImpactAction {
  EventDate?: string;
  ActionDate?: string;
  CreationDate?: string;
  Amount?: string;
  Payout?: string;
  State?: string;
  SubId1?: string;
  SubId2?: string;
  CampaignName?: string;
  ActionTrackerName?: string;
}

/** Actions endpoint only allows 45-day windows; walk the range in chunks (newest
 *  first) and follow pagination. Windows that predate the account return 400,
 *  so a failed chunk is skipped rather than failing the whole summary. */
async function fetchImpactActions(from: Date, to: Date): Promise<{ actions: ImpactAction[]; warning?: string }> {
  const out: ImpactAction[] = [];
  let warning: string | undefined;
  const chunkMs = 44 * 24 * 3600 * 1000;
  for (let end = to.getTime(); end >= from.getTime(); end -= chunkMs) {
    const start = Math.max(end - chunkMs + 1, from.getTime());
    const iso = (ms: number) => new Date(ms).toISOString().replace(/\.\d{3}Z$/, 'Z');
    let next: string | null = `/Actions?ActionDateStart=${iso(start)}&ActionDateEnd=${iso(end)}&PageSize=1000`;
    try {
      while (next) {
        const page: { Actions?: ImpactAction[]; '@nextpageuri'?: string } = await impactGet(next);
        out.push(...(page.Actions || []));
        next = page['@nextpageuri'] ? page['@nextpageuri'] : null;
      }
    } catch (e) {
      warning = (e as Error).message;
      break; // older windows will fail the same way
    }
  }
  return { actions: out, warning };
}

export async function fetchImpactSummary(from: Date, to: Date): Promise<NetworkSummary> {
  if (!hasImpactCredentials()) return emptySummary('fanatics', 'Fanatics (Impact)', false, 'IMPACT_ACCOUNT_SID / IMPACT_AUTH_TOKEN not set');
  const s = emptySummary('fanatics', 'Fanatics (Impact)', true);
  const q = `START_DATE=${ymd(from)}&END_DATE=${ymd(to)}`;
  try {
    const [byDay, bySub, { actions, warning }] = await Promise.all([
      impactGet<{ Records?: Record<string, string>[] }>(`/Reports/partner_performance_by_day?${q}`),
      impactGet<{ Records?: Record<string, string>[] }>(`/Reports/partner_performance_by_subid?${q}`),
      fetchImpactActions(from, to),
    ]);

    // Daily series. The report labels commission "Action_Cost" (cost to the brand = our payout).
    for (const r of byDay.Records || []) {
      const d = new Date(r.date_display || '');
      if (Number.isNaN(d.getTime())) continue;
      const row: NetworkDaily = {
        date: ymd(d),
        clicks: num(r.Clicks),
        conversions: num(r.Actions),
        sales: num(r.Sale_zzzAmount ?? r.sale_amount ?? r.Sale_Amount),
        commission: num(r.Earnings ?? r.Action_Cost),
      };
      s.daily.push(row);
      s.clicks += row.clicks; s.conversions += row.conversions; s.sales += row.sales; s.commission += row.commission;
    }
    s.daily.sort((a, b) => a.date.localeCompare(b.date));

    // Clicks + earnings by subId1 (team). Untagged clicks show as "(untagged)".
    const teams = new Map<string, NetworkBreakdownRow>();
    for (const r of bySub.Records || []) {
      const key = Object.keys(r).find((k) => /subid1/i.test(k));
      const name = key && r[key] ? normalizeTeamKey(r[key]) : '(untagged)';
      addRow(teams, name, num(r.Clicks), num(r.Actions), num(r.Earnings ?? r.Action_Cost));
    }
    s.byTeam = sortRows(teams);

    // Sales detail from Actions: status split, placement (subId2), recent list.
    const placements = new Map<string, NetworkBreakdownRow>();
    for (const a of actions) {
      const payout = num(a.Payout);
      const state = (a.State || '').toUpperCase();
      if (state === 'APPROVED') s.approvedCommission += payout;
      else if (state === 'PENDING') s.pendingCommission += payout;
      addRow(placements, a.SubId2 || '(untagged)', 0, 1, payout);
      s.recentSales.push({
        network: 'fanatics',
        date: a.EventDate || a.ActionDate || a.CreationDate || '',
        amount: num(a.Amount),
        commission: payout,
        status: state.toLowerCase() || 'unknown',
        ref: [a.SubId1, a.SubId2].filter(Boolean).join(' / ') || '—',
        detail: a.CampaignName || a.ActionTrackerName,
      });
    }
    s.byPlacement = sortRows(placements);
    s.recentSales.sort((a, b) => b.date.localeCompare(a.date));
    s.recentSales = s.recentSales.slice(0, 50);
    if (warning) s.error = `Sales detail partial: ${warning}`;
  } catch (e) {
    s.error = (e as Error).message;
  }
  return s;
}

// ---------------------------------------------------------------------------
// Partnerize (StubHub)
// ---------------------------------------------------------------------------

export const PARTNERIZE_PUBLISHER_ID = process.env.PARTNERIZE_PUBLISHER_ID || '1100l413235';

export function hasPartnerizeCredentials(): boolean {
  return !!(process.env.PARTNERIZE_APP_KEY && process.env.PARTNERIZE_USER_KEY);
}

async function partnerizeGet<T = Record<string, unknown>>(path: string): Promise<T> {
  const res = await fetch(`https://api.partnerize.com${path}`, {
    headers: {
      Authorization: 'Basic ' + Buffer.from(`${process.env.PARTNERIZE_APP_KEY}:${process.env.PARTNERIZE_USER_KEY}`).toString('base64'),
      Accept: 'application/json',
    },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Partnerize ${res.status} on ${path}`);
  return res.json() as Promise<T>;
}

/** Partnerize dates are "YYYY-MM-DD HH:MM:SS" in the campaign's reporting timezone. */
const pzDate = (d: Date, end: boolean) => encodeURIComponent(`${ymd(d)} ${end ? '23:59:59' : '00:00:00'}`);

interface PzClick { click: { set_time: string; publisher_reference?: string } }
interface PzConversion {
  conversion_data: {
    conversion_time: string;
    publisher_reference?: string;
    conversion_value?: { conversion_status?: string; value?: number; publisher_commission?: number };
    conversion_items?: { item_status?: string; meta_data?: { event_name?: string; event_performer?: string } }[];
  };
}

async function pzPaged<T>(type: 'click' | 'conversion', from: Date, to: Date, key: 'clicks' | 'conversions'): Promise<T[]> {
  const out: T[] = [];
  const limit = 300;
  for (let offset = 0; offset < 20000; offset += limit) {
    const page = await partnerizeGet<Record<string, unknown>>(
      `/reporting/report_publisher/publisher/${PARTNERIZE_PUBLISHER_ID}/${type}.json?start_date=${pzDate(from, false)}&end_date=${pzDate(to, true)}&limit=${limit}&offset=${offset}`,
    );
    const rows = (page[key] as T[]) || [];
    out.push(...rows);
    if (rows.length < limit) break;
  }
  return out;
}

/** pubref "buf-vs-tor" (venue/home team) or "hub-sabres" → normalised "nhl-sabres". */
function pzTeamFromRef(ref: string): string {
  if (!ref) return '(untagged)';
  const m = ref.match(/^([a-z]{2,3})-vs-([a-z]{2,3})/i);
  if (m) return normalizeMatchupKey(m[1], m[2]);
  const h = ref.match(/^hub-(.+)$/i);
  if (h) return normalizeTeamKey(h[1]);
  return normalizeTeamKey(ref);
}
const pzPlacementFromRef = (ref: string) => (!ref ? '(untagged)' : /-vs-/.test(ref) ? 'game-link' : /^hub-/.test(ref) ? 'tickets-hub' : 'other');

export async function fetchPartnerizeSummary(from: Date, to: Date): Promise<NetworkSummary> {
  if (!hasPartnerizeCredentials()) return emptySummary('stubhub', 'StubHub (Partnerize)', false, 'PARTNERIZE_APP_KEY / PARTNERIZE_USER_KEY not set');
  const s = emptySummary('stubhub', 'StubHub (Partnerize)', true);
  try {
    const [clicks, conversions] = await Promise.all([
      pzPaged<PzClick>('click', from, to, 'clicks'),
      pzPaged<PzConversion>('conversion', from, to, 'conversions'),
    ]);
    const daily = new Map<string, NetworkDaily>();
    const day = (t: string) => t.slice(0, 10);
    const bump = (date: string, f: Partial<NetworkDaily>) => {
      const row = daily.get(date) || { date, clicks: 0, conversions: 0, sales: 0, commission: 0 };
      row.clicks += f.clicks || 0; row.conversions += f.conversions || 0; row.sales += f.sales || 0; row.commission += f.commission || 0;
      daily.set(date, row);
    };
    const teams = new Map<string, NetworkBreakdownRow>();
    const placements = new Map<string, NetworkBreakdownRow>();

    for (const { click } of clicks) {
      const ref = click.publisher_reference || '';
      bump(day(click.set_time), { clicks: 1 });
      addRow(teams, pzTeamFromRef(ref), 1, 0, 0);
      addRow(placements, pzPlacementFromRef(ref), 1, 0, 0);
      s.clicks += 1;
    }
    for (const { conversion_data: c } of conversions) {
      const ref = c.publisher_reference || '';
      const value = num(c.conversion_value?.value);
      const commission = num(c.conversion_value?.publisher_commission);
      const status = (c.conversion_value?.conversion_status || c.conversion_items?.[0]?.item_status || 'pending').toLowerCase();
      if (status === 'rejected') continue;
      bump(day(c.conversion_time), { conversions: 1, sales: value, commission });
      addRow(teams, pzTeamFromRef(ref), 0, 1, commission);
      addRow(placements, pzPlacementFromRef(ref), 0, 1, commission);
      s.conversions += 1; s.sales += value; s.commission += commission;
      if (status === 'approved') s.approvedCommission += commission; else s.pendingCommission += commission;
      s.recentSales.push({
        network: 'stubhub', date: c.conversion_time.replace(' ', 'T'), amount: value, commission, status,
        ref: ref || '—', detail: c.conversion_items?.[0]?.meta_data?.event_name || c.conversion_items?.[0]?.meta_data?.event_performer,
      });
    }
    s.daily = Array.from(daily.values()).sort((a, b) => a.date.localeCompare(b.date));
    s.byTeam = sortRows(teams);
    s.byPlacement = sortRows(placements);
    s.recentSales.sort((a, b) => b.date.localeCompare(a.date));
    s.recentSales = s.recentSales.slice(0, 50);
  } catch (e) {
    s.error = (e as Error).message;
  }
  return s;
}
