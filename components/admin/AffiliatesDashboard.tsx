'use client';

import { useCallback, useEffect, useState } from 'react';
import { RefreshCw, ShoppingBag, Ticket, MousePointerClick, DollarSign } from 'lucide-react';
import { Card, PageHeader, SectionHeading, Segmented, Badge, Button, Spinner, StatCard, WarningBanner, Table, Th, Td } from './ui';
import type { NetworkSummary, NetworkBreakdownRow, NetworkSale } from '@/lib/services/affiliateNetworks';
import type { FirstPartyClicks } from '@/lib/services/affiliateFirstParty';
import type { AffiliatesPayload } from '@/app/api/admin/affiliates/route';
import { getDateKey } from '@/lib/analytics';

type Range = 'today' | '7d' | '30d' | '90d' | '365d';
const RANGE_LABEL: Record<Range, string> = { today: 'today', '7d': 'last 7 days', '30d': 'last 30 days', '90d': 'last 90 days', '365d': 'last 12 months' };

const money = (n: number) => `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const pct = (num: number, den: number) => (den > 0 ? `${((num / den) * 100).toFixed(1)}%` : '—');
const epc = (commission: number, clicks: number) => (clicks > 0 ? money(commission / clicks) : '—');
const ratio = (network: number, human: number) => (human > 0 ? `${(network / human).toFixed(1)}× on-site` : 'no on-site clicks');

/** Network rows joined with on-site (human) clicks on the normalised team/placement key. */
interface JoinedRow {
  name: string;
  humanClicks: number;
  networkClicks: number;
  conversions: number;
  commission: number;
}

export default function AffiliatesDashboard() {
  const [range, setRange] = useState<Range>('today');
  const [data, setData] = useState<AffiliatesPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    try {
      const res = await fetch(`/api/admin/affiliates?range=${range}${refresh ? '&refresh=1' : ''}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json());
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [range]);

  useEffect(() => { setLoading(true); load(); }, [load]);

  const fanatics = data?.networks.find((n) => n.network === 'fanatics');
  const stubhub = data?.networks.find((n) => n.network === 'stubhub');
  const totals = (data?.networks || []).reduce(
    (acc, n) => ({ clicks: acc.clicks + n.clicks, conversions: acc.conversions + n.conversions, sales: acc.sales + n.sales, commission: acc.commission + n.commission, pending: acc.pending + n.pendingCommission }),
    { clicks: 0, conversions: 0, sales: 0, commission: 0, pending: 0 },
  );
  const human = data?.firstParty.total ?? 0;
  const byVendor = data?.firstParty.byVendor ?? { stubhub: 0, fanatics: 0, amazon: 0 };
  const partialCoverage = !!data && data.firstParty.coveredDays < ({ today: 1, '7d': 7, '30d': 30, '90d': 90, '365d': 365 } as Record<Range, number>)[range];
  const recent: NetworkSale[] = (data?.networks || []).flatMap((n) => n.recentSales).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 30);

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <PageHeader
        title="Affiliates"
        description={
          <>
            Fanatics (Impact) + StubHub (Partnerize) + on-site clicks, {RANGE_LABEL[range]}
            {data && <span className="text-gray-400"> · network data as of {new Date(data.cachedAt).toLocaleTimeString()}{range === 'today' ? ' (refreshes every 5 min)' : ''}</span>}
          </>
        }
        actions={
          <div className="flex items-center gap-2">
            <Segmented
              options={[{ value: 'today', label: 'Today' }, { value: '7d', label: '7d' }, { value: '30d', label: '30d' }, { value: '90d', label: '90d' }, { value: '365d', label: '12 mo' }]}
              value={range}
              onChange={setRange}
            />
            <Button variant="secondary" onClick={() => load(true)} disabled={refreshing} title="Re-pull from the networks (bypasses the cache)">
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        }
      />

      {error ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <p className="mb-3 text-lg text-red-500">Failed to load affiliate data: {error}</p>
          <Button variant="secondary" onClick={() => { setLoading(true); load(); }}>Retry</Button>
        </div>
      ) : loading || !data ? (
        <div className="flex items-center justify-center py-20"><Spinner size="lg" /></div>
      ) : (
        <div className={refreshing ? 'pointer-events-none opacity-50 transition-opacity' : 'transition-opacity'}>
          {data.networks.filter((n) => n.error).map((n) => (
            <div key={n.network} className="mb-4">
              <WarningBanner><strong>{n.label}:</strong> {n.error}</WarningBanner>
            </div>
          ))}
          {partialCoverage && (
            <div className="mb-4">
              <WarningBanner>On-site click history is kept for 90 days, so human-click rates in this range are based on the last {data.firstParty.coveredDays} days only.</WarningBanner>
            </div>
          )}

          {/* Totals: humans first, network clicks demoted to a diagnostic */}
          <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatCard label="Commission earned" value={money(totals.commission)} sub={totals.pending > 0 ? `${money(totals.pending)} still pending` : 'all approved'} icon={<DollarSign className="h-6 w-6" />} />
            <StatCard label="Sales" value={totals.conversions} sub={`${money(totals.sales)} order value`} icon={<ShoppingBag className="h-6 w-6" />} />
            <StatCard label="On-site clicks (humans)" value={human} sub={`${pct(totals.conversions, human)} conversion · ${epc(totals.commission, human)} per click`} icon={<Ticket className="h-6 w-6" />} />
            <StatCard label="Network clicks" value={totals.clicks} sub={`includes crawlers · ${ratio(totals.clicks, human)}`} icon={<MousePointerClick className="h-6 w-6" />} />
          </div>

          {/* Per network */}
          <div className="mb-6 grid gap-4 lg:grid-cols-2">
            {fanatics && <NetworkCard s={fanatics} rate="8% of sale · 30-day window" humanClicks={byVendor.fanatics} />}
            {stubhub && <NetworkCard s={stubhub} rate="4% of ticket price + fees · 30-day cookie" humanClicks={byVendor.stubhub} />}
          </div>

          {/* Daily chart */}
          <Card className="mb-6">
            <SectionHeading>On-site clicks and commission by day</SectionHeading>
            <DailyChart firstParty={data.firstParty} networks={data.networks} />
          </Card>

          {/* Breakdowns */}
          <div className="mb-6 grid gap-4 lg:grid-cols-3">
            <BreakdownTable title="By team" note="On-site clicks · network sales + commission" rows={joinRows(data.networks.map((n) => n.byTeam), data.firstParty.byTeam)} />
            <BreakdownTable title="By placement" note="On-site clicks · Fanatics subId2 + StubHub link type" rows={joinRows(data.networks.map((n) => n.byPlacement), data.firstParty.byPlacement)} />
            <Card>
              <SectionHeading>On-site clicks by link</SectionHeading>
              <p className="-mt-2 mb-3 text-xs text-gray-400">First-party tracking, before the redirect. Last 90 days max.</p>
              {data.firstParty.byLabel.length === 0 ? (
                <p className="py-4 text-sm text-gray-400">No affiliate clicks tracked yet</p>
              ) : (
                <div className="max-h-80 space-y-1.5 overflow-y-auto pr-1">
                  {data.firstParty.byLabel.map((r) => (
                    <div key={r.name} className="flex justify-between text-sm">
                      <span className="truncate text-gray-700" title={r.name}>{r.name}</span>
                      <span className="ml-2 shrink-0 tabular-nums text-gray-500">{r.count}</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          {/* Recent sales */}
          <Card>
            <SectionHeading>Recent sales</SectionHeading>
            {recent.length === 0 ? (
              <p className="py-4 text-sm text-gray-400">No sales in this window</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <thead>
                    <tr><Th>Date</Th><Th>Network</Th><Th>Ref</Th><Th>Detail</Th><Th align="right">Order</Th><Th align="right">Commission</Th><Th>Status</Th></tr>
                  </thead>
                  <tbody>
                    {recent.map((s, i) => (
                      <tr key={i}>
                        <Td className="whitespace-nowrap">{new Date(s.date).toLocaleDateString('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric', year: '2-digit' })}</Td>
                        <Td>{s.network === 'fanatics' ? 'Fanatics' : 'StubHub'}</Td>
                        <Td className="font-mono text-xs">{s.ref}</Td>
                        <Td className="max-w-xs"><span className="block truncate" title={s.detail}>{s.detail || '—'}</span></Td>
                        <Td align="right">{money(s.amount)}</Td>
                        <Td align="right" className="font-semibold">{money(s.commission)}</Td>
                        <Td><Badge variant={s.status === 'approved' ? 'success' : s.status === 'pending' ? 'warning' : 'neutral'}>{s.status}</Badge></Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            )}
          </Card>

          <p className="mt-6 text-center text-xs text-gray-400">
            Click counts, conversion rates and per-click earnings use on-site clicks: they need JavaScript and skip known bots,
            so they are the closest read on real fans. Network clicks count every redirect through the affiliate link, including
            search-engine crawlers, and are shown only as a health check (if they drop to zero while on-site clicks continue, a link is broken).
            Sales can land up to 30 days after the click, so rates are directional. Amazon Associates has no reporting API; check Associates Central for Amazon earnings.
          </p>
        </div>
      )}
    </main>
  );
}

function NetworkCard({ s, rate, humanClicks }: { s: NetworkSummary; rate: string; humanClicks: number }) {
  return (
    <Card>
      <div className="mb-3 flex items-start justify-between">
        <div>
          <h3 className="text-base font-bold text-gray-900">{s.label}</h3>
          <p className="text-xs text-gray-500">{rate}</p>
        </div>
        <Badge variant={!s.configured ? 'neutral' : s.error ? 'warning' : 'success'}>{!s.configured ? 'not configured' : s.error ? 'error' : 'connected'}</Badge>
      </div>
      <div className="grid grid-cols-3 gap-3 text-center">
        <Stat label="On-site clicks" value={humanClicks.toLocaleString()} sub="humans" />
        <Stat label="Sales" value={s.conversions.toLocaleString()} sub={`${pct(s.conversions, humanClicks)} of clicks`} />
        <Stat label="Commission" value={money(s.commission)} sub={epc(s.commission, humanClicks) + '/click'} />
      </div>
      <div className="mt-3 flex flex-wrap justify-between gap-x-4 gap-y-1 border-t border-gray-100 pt-3 text-xs text-gray-500">
        <span>Order value {money(s.sales)}</span>
        <span>Approved {money(s.approvedCommission)} · Pending {money(s.pendingCommission)}</span>
        <span className="w-full text-gray-400">Network reported {s.clicks.toLocaleString()} clicks (incl. crawlers, {ratio(s.clicks, humanClicks)})</span>
      </div>
    </Card>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg bg-gray-50 p-3">
      <p className="text-[10px] uppercase tracking-wider text-gray-500">{label}</p>
      <p className="text-xl font-bold text-gray-900">{value}</p>
      {sub && <p className="text-[10px] text-gray-400">{sub}</p>}
    </div>
  );
}

function joinRows(networkLists: NetworkBreakdownRow[][], humanRows: { name: string; count: number }[]): JoinedRow[] {
  const m = new Map<string, JoinedRow>();
  const get = (name: string) => {
    const row = m.get(name) || { name, humanClicks: 0, networkClicks: 0, conversions: 0, commission: 0 };
    m.set(name, row);
    return row;
  };
  for (const list of networkLists) for (const r of list) {
    const row = get(r.name);
    row.networkClicks += r.clicks; row.conversions += r.conversions; row.commission += r.commission;
  }
  for (const r of humanRows) get(r.name).humanClicks += r.count;
  return Array.from(m.values())
    .sort((a, b) => b.commission - a.commission || b.conversions - a.conversions || b.humanClicks - a.humanClicks || b.networkClicks - a.networkClicks)
    .slice(0, 30);
}

function BreakdownTable({ title, note, rows }: { title: string; note: string; rows: JoinedRow[] }) {
  const max = Math.max(1, ...rows.map((r) => r.humanClicks));
  return (
    <Card>
      <SectionHeading>{title}</SectionHeading>
      <p className="-mt-2 mb-3 text-xs text-gray-400">{note}</p>
      {rows.length === 0 ? (
        <p className="py-4 text-sm text-gray-400">No data yet</p>
      ) : (
        <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
          {rows.map((r) => (
            <div key={r.name} title={`${r.networkClicks} network clicks (incl. crawlers)`}>
              <div className="mb-0.5 flex justify-between text-sm">
                <span className="truncate text-gray-700">{r.name}</span>
                <span className="ml-2 shrink-0 tabular-nums text-gray-500">
                  {r.humanClicks} clk · {r.conversions} sale{r.conversions === 1 ? '' : 's'} · <span className="font-semibold text-gray-700">{money(r.commission)}</span>
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-gray-100">
                <div className="h-full rounded-full bg-sabres-blue" style={{ width: `${(r.humanClicks / max) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

const VENDOR_SERIES = [
  { key: 'stubhub', label: 'StubHub', color: '#d97706' },
  { key: 'fanatics', label: 'Fanatics', color: '#003087' },
  { key: 'amazon', label: 'Amazon', color: '#6b7280' },
] as const;

function DailyChart({ firstParty, networks }: { firstParty: FirstPartyClicks; networks: NetworkSummary[] }) {
  // Only chart the window first-party data covers (90 days max), so a 12-month view isn't mostly empty.
  const start = new Date();
  start.setDate(start.getDate() - (firstParty.coveredDays - 1));
  const startKey = getDateKey(start);
  const commissionByDate = new Map<string, number>();
  for (const n of networks) for (const d of n.daily) if (d.commission > 0 && d.date >= startKey) commissionByDate.set(d.date, (commissionByDate.get(d.date) || 0) + d.commission);
  const humanByDate = new Map(firstParty.daily.map((d) => [d.date, d]));
  const dates = Array.from(new Set([...humanByDate.keys(), ...commissionByDate.keys()])).sort();
  if (dates.length === 0) return <p className="py-4 text-sm text-gray-400">No activity in this window</p>;
  const maxClicks = Math.max(1, ...dates.map((d) => humanByDate.get(d)?.clicks || 0));
  const W = 900, H = 160, pad = 24;
  const bw = Math.max(2, (W - pad * 2) / dates.length - 2);

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H + 24}`} className="w-full min-w-[600px]" role="img" aria-label="Daily on-site affiliate clicks by vendor">
        {dates.map((d, i) => {
          let y = H;
          const x = pad + i * ((W - pad * 2) / dates.length);
          const row = humanByDate.get(d);
          const commission = commissionByDate.get(d) || 0;
          return (
            <g key={d}>
              {VENDOR_SERIES.map((s) => {
                const clicks = row?.[s.key] || 0;
                const h = (clicks / maxClicks) * (H - 10);
                y -= h;
                return (
                  <rect key={s.key} x={x} y={y} width={bw} height={h} fill={s.color} opacity={0.85}>
                    <title>{`${d} · ${s.label}: ${clicks} on-site clicks`}</title>
                  </rect>
                );
              })}
              {commission > 0 && (
                <circle cx={x + bw / 2} cy={y - 6} r={3} fill="#16a34a"><title>{`${d}: ${money(commission)} commission`}</title></circle>
              )}
              {(dates.length <= 14 || i % Math.ceil(dates.length / 12) === 0) && (
                <text x={x + bw / 2} y={H + 16} fontSize={10} textAnchor="middle" fill="#9ca3af">{d.slice(5)}</text>
              )}
            </g>
          );
        })}
      </svg>
      <div className="mt-2 flex flex-wrap gap-4 text-xs text-gray-500">
        {VENDOR_SERIES.map((s) => (
          <span key={s.key} className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} />{s.label} clicks</span>
        ))}
        <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-full bg-green-600" />day with commission</span>
      </div>
    </div>
  );
}
