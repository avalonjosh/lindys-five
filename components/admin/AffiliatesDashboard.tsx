'use client';

import { useCallback, useEffect, useState } from 'react';
import { RefreshCw, ShoppingBag, Ticket, MousePointerClick, DollarSign } from 'lucide-react';
import { Card, PageHeader, SectionHeading, Segmented, Badge, Button, Spinner, StatCard, WarningBanner, Table, Th, Td } from './ui';
import type { NetworkSummary, NetworkBreakdownRow, NetworkSale } from '@/lib/services/affiliateNetworks';
import type { AffiliatesPayload } from '@/app/api/admin/affiliates/route';

type Range = '7d' | '30d' | '90d' | '365d';
const RANGE_LABEL: Record<Range, string> = { '7d': 'last 7 days', '30d': 'last 30 days', '90d': 'last 90 days', '365d': 'last 12 months' };

const money = (n: number) => `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const pct = (num: number, den: number) => (den > 0 ? `${((num / den) * 100).toFixed(1)}%` : '—');
const epc = (commission: number, clicks: number) => (clicks > 0 ? money(commission / clicks) : '—');

export default function AffiliatesDashboard() {
  const [range, setRange] = useState<Range>('30d');
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
  const recent: NetworkSale[] = (data?.networks || []).flatMap((n) => n.recentSales).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 30);

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <PageHeader
        title="Affiliates"
        description={
          <>
            Fanatics (Impact) + StubHub (Partnerize) + on-site clicks, {RANGE_LABEL[range]}
            {data && <span className="text-gray-400"> · network data cached {new Date(data.cachedAt).toLocaleTimeString()}</span>}
          </>
        }
        actions={
          <div className="flex items-center gap-2">
            <Segmented
              options={[{ value: '7d', label: '7d' }, { value: '30d', label: '30d' }, { value: '90d', label: '90d' }, { value: '365d', label: '12 mo' }]}
              value={range}
              onChange={setRange}
            />
            <Button variant="secondary" onClick={() => load(true)} disabled={refreshing} title="Re-pull from the networks (bypasses the 30-minute cache)">
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

          {/* Totals across networks */}
          <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatCard label="Commission earned" value={money(totals.commission)} sub={totals.pending > 0 ? `${money(totals.pending)} still pending` : 'all approved'} icon={<DollarSign className="h-6 w-6" />} />
            <StatCard label="Sales" value={totals.conversions} sub={`${money(totals.sales)} order value`} icon={<ShoppingBag className="h-6 w-6" />} />
            <StatCard label="Network clicks" value={totals.clicks} sub={`${pct(totals.conversions, totals.clicks)} conversion · ${epc(totals.commission, totals.clicks)} per click · includes crawler hits`} icon={<MousePointerClick className="h-6 w-6" />} />
            <StatCard label="On-site clicks (humans)" value={data.firstParty.total} sub={data.firstParty.byBucket.map((b) => `${b.name} ${b.count}`).join(' · ') || 'no clicks tracked'} icon={<Ticket className="h-6 w-6" />} />
          </div>

          {/* Per network */}
          <div className="mb-6 grid gap-4 lg:grid-cols-2">
            {fanatics && <NetworkCard s={fanatics} rate="8% of sale · 30-day window" />}
            {stubhub && <NetworkCard s={stubhub} rate="4% of ticket price + fees · 30-day cookie" />}
          </div>

          {/* Daily chart */}
          <Card className="mb-6">
            <SectionHeading>Clicks and commission by day</SectionHeading>
            <DailyChart networks={data.networks} />
          </Card>

          {/* Breakdowns */}
          <div className="mb-6 grid gap-4 lg:grid-cols-3">
            <BreakdownTable title="By team" note="Fanatics subId1 · StubHub pubref venue" rows={mergeRows(data.networks.map((n) => n.byTeam))} />
            <BreakdownTable title="By placement" note="Fanatics subId2 (sales only) · StubHub link type" rows={mergeRows(data.networks.map((n) => n.byPlacement))} />
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
            Network clicks count every redirect through the affiliate link, including search-engine crawlers following
            outbound links, so they run well above the on-site count. On-site clicks need JavaScript and skip known bots,
            so they are the better read on real fans. Amazon Associates has no reporting API; check Associates Central for Amazon earnings.
          </p>
        </div>
      )}
    </main>
  );
}

function NetworkCard({ s, rate }: { s: NetworkSummary; rate: string }) {
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
        <Stat label="Clicks" value={s.clicks.toLocaleString()} />
        <Stat label="Sales" value={s.conversions.toLocaleString()} sub={pct(s.conversions, s.clicks)} />
        <Stat label="Commission" value={money(s.commission)} sub={epc(s.commission, s.clicks) + '/click'} />
      </div>
      <div className="mt-3 flex justify-between border-t border-gray-100 pt-3 text-xs text-gray-500">
        <span>Order value {money(s.sales)}</span>
        <span>Approved {money(s.approvedCommission)} · Pending {money(s.pendingCommission)}</span>
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

function mergeRows(lists: NetworkBreakdownRow[][]): NetworkBreakdownRow[] {
  const m = new Map<string, NetworkBreakdownRow>();
  for (const list of lists) for (const r of list) {
    const row = m.get(r.name) || { name: r.name, clicks: 0, conversions: 0, commission: 0 };
    row.clicks += r.clicks; row.conversions += r.conversions; row.commission += r.commission;
    m.set(r.name, row);
  }
  return Array.from(m.values()).sort((a, b) => b.commission - a.commission || b.conversions - a.conversions || b.clicks - a.clicks).slice(0, 30);
}

function BreakdownTable({ title, note, rows }: { title: string; note: string; rows: NetworkBreakdownRow[] }) {
  const max = Math.max(1, ...rows.map((r) => r.clicks));
  return (
    <Card>
      <SectionHeading>{title}</SectionHeading>
      <p className="-mt-2 mb-3 text-xs text-gray-400">{note}</p>
      {rows.length === 0 ? (
        <p className="py-4 text-sm text-gray-400">No data yet</p>
      ) : (
        <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
          {rows.map((r) => (
            <div key={r.name}>
              <div className="mb-0.5 flex justify-between text-sm">
                <span className="truncate text-gray-700" title={r.name}>{r.name}</span>
                <span className="ml-2 shrink-0 tabular-nums text-gray-500">
                  {r.clicks} clk · {r.conversions} sale{r.conversions === 1 ? '' : 's'} · <span className="font-semibold text-gray-700">{money(r.commission)}</span>
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-gray-100">
                <div className="h-full rounded-full bg-sabres-blue" style={{ width: `${(r.clicks / max) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function DailyChart({ networks }: { networks: NetworkSummary[] }) {
  const dates = Array.from(new Set(networks.flatMap((n) => n.daily.map((d) => d.date)))).sort();
  if (dates.length === 0) return <p className="py-4 text-sm text-gray-400">No activity in this window</p>;
  const series = networks.map((n) => ({
    label: n.network === 'fanatics' ? 'Fanatics' : 'StubHub',
    color: n.network === 'fanatics' ? '#003087' : '#d97706',
    byDate: new Map(n.daily.map((d) => [d.date, d])),
  }));
  const maxClicks = Math.max(1, ...dates.map((d) => series.reduce((s, x) => s + (x.byDate.get(d)?.clicks || 0), 0)));
  const W = 900, H = 160, pad = 24;
  const bw = Math.max(2, (W - pad * 2) / dates.length - 2);

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H + 24}`} className="w-full min-w-[600px]" role="img" aria-label="Daily affiliate clicks by network">
        {dates.map((d, i) => {
          let y = H;
          const x = pad + i * ((W - pad * 2) / dates.length);
          return (
            <g key={d}>
              {series.map((s) => {
                const row = s.byDate.get(d);
                const h = ((row?.clicks || 0) / maxClicks) * (H - 10);
                y -= h;
                return (
                  <rect key={s.label} x={x} y={y} width={bw} height={h} fill={s.color} opacity={0.85}>
                    <title>{`${d} · ${s.label}: ${row?.clicks || 0} clicks, ${row?.conversions || 0} sales, ${money(row?.commission || 0)}`}</title>
                  </rect>
                );
              })}
              {series.some((s) => (s.byDate.get(d)?.commission || 0) > 0) && (
                <circle cx={x + bw / 2} cy={y - 6} r={3} fill="#16a34a"><title>{`${d}: commission earned`}</title></circle>
              )}
              {(dates.length <= 14 || i % Math.ceil(dates.length / 12) === 0) && (
                <text x={x + bw / 2} y={H + 16} fontSize={10} textAnchor="middle" fill="#9ca3af">{d.slice(5)}</text>
              )}
            </g>
          );
        })}
      </svg>
      <div className="mt-2 flex gap-4 text-xs text-gray-500">
        {series.map((s) => (
          <span key={s.label} className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} />{s.label} clicks</span>
        ))}
        <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-full bg-green-600" />day with commission</span>
      </div>
    </div>
  );
}
