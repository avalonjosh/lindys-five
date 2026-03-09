'use client';

import { useState, useEffect, useCallback } from 'react';
import AdminNav from './AdminNav';

type Range = 'today' | '7d' | '30d' | 'alltime';

interface OverviewData {
  totalViews: number;
  uniqueVisitors: number | null;
  viewsChange: number | null;
  topPage: { name: string; count: number } | null;
  topReferrer: { name: string; count: number } | null;
}

interface TimeseriesData {
  labels: string[];
  views: number[];
  visitors: number[] | null;
}

interface TopItem {
  name: string;
  count: number;
}

export default function AnalyticsDashboard() {
  const [range, setRange] = useState<Range>('today');
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [timeseries, setTimeseries] = useState<TimeseriesData | null>(null);
  const [topPages, setTopPages] = useState<TopItem[]>([]);
  const [topReferrers, setTopReferrers] = useState<TopItem[]>([]);
  const [topDevices, setTopDevices] = useState<TopItem[]>([]);
  const [topCountries, setTopCountries] = useState<TopItem[]>([]);
  const [topTeams, setTopTeams] = useState<TopItem[]>([]);
  const [clicks, setClicks] = useState<TopItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [ovRes, tsRes, pagesRes, refRes, devRes, countryRes, teamsRes, clicksRes] =
        await Promise.all([
          fetch(`/api/analytics/overview?range=${range}`),
          range !== 'alltime' ? fetch(`/api/analytics/timeseries?range=${range}`) : null,
          fetch(`/api/analytics/top?type=pages&range=${range}&limit=10`),
          fetch(`/api/analytics/top?type=referrers&range=${range}&limit=10`),
          fetch(`/api/analytics/top?type=devices&range=${range}&limit=5`),
          fetch(`/api/analytics/top?type=countries&range=${range}&limit=10`),
          fetch(`/api/analytics/top?type=teams&range=${range}&limit=15`),
          fetch(`/api/analytics/clicks?range=${range}&limit=15`),
        ]);

      const ovData = await ovRes.json();
      setOverview(ovData);

      if (tsRes) {
        const tsData = await tsRes.json();
        setTimeseries(tsData);
      } else {
        setTimeseries(null);
      }

      setTopPages((await pagesRes.json()).items || []);
      setTopReferrers((await refRes.json()).items || []);
      setTopDevices((await devRes.json()).items || []);
      setTopCountries((await countryRes.json()).items || []);
      setTopTeams((await teamsRes.json()).items || []);
      setClicks((await clicksRes.json()).items || []);
    } catch (e) {
      console.error('Failed to fetch analytics:', e);
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    setLoading(true);
    fetchData();
  }, [fetchData]);

  // Auto-refresh every 30s when viewing "today"
  useEffect(() => {
    if (range !== 'today') return;
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [range, fetchData]);

  const rangeOptions: { value: Range; label: string }[] = [
    { value: 'today', label: 'Today' },
    { value: '7d', label: '7 Days' },
    { value: '30d', label: '30 Days' },
    { value: 'alltime', label: 'All Time' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-700 to-slate-800">
      <AdminNav activeTab="analytics" />

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Range Picker */}
        <div className="flex items-center justify-between mb-6">
          <h2
            className="text-3xl font-bold text-white"
            style={{ fontFamily: 'Bebas Neue, sans-serif' }}
          >
            Analytics
          </h2>
          <div className="flex gap-1 bg-slate-800 rounded-lg p-1">
            {rangeOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setRange(opt.value)}
                className={`px-4 py-1.5 rounded text-sm font-medium transition-colors ${
                  range === opt.value
                    ? 'text-slate-900'
                    : 'text-slate-400 hover:text-white'
                }`}
                style={range === opt.value ? { backgroundColor: '#FCB514' } : {}}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {loading && !overview ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-10 w-10 border-4 border-gray-700 border-t-[#FCB514]" />
          </div>
        ) : (
          <>
            {/* Overview Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <OverviewCard
                label="Page Views"
                value={overview?.totalViews ?? 0}
                change={overview?.viewsChange}
              />
              <OverviewCard
                label="Unique Visitors"
                value={overview?.uniqueVisitors ?? '—'}
                change={null}
              />
              <OverviewCard
                label="Top Page"
                value={overview?.topPage?.name ?? '—'}
                sub={overview?.topPage ? `${overview.topPage.count} views` : undefined}
                isText
              />
              <OverviewCard
                label="Top Referrer"
                value={overview?.topReferrer?.name ?? '—'}
                sub={overview?.topReferrer ? `${overview.topReferrer.count} visits` : undefined}
                isText
              />
            </div>

            {/* Time-Series Chart */}
            {timeseries && <TimeseriesChart data={timeseries} />}

            {/* Two-column: Pages & Referrers */}
            <div className="grid md:grid-cols-2 gap-6 mb-6">
              <TopTable title="Top Pages" items={topPages} />
              <TopTable title="Referrers" items={topReferrers} />
            </div>

            {/* Two-column: Devices & Countries */}
            <div className="grid md:grid-cols-2 gap-6 mb-6">
              <BarList title="Devices" items={topDevices} />
              <TopTable title="Countries" items={topCountries} />
            </div>

            {/* Team Popularity */}
            {topTeams.length > 0 && (
              <BarList title="Team Popularity" items={topTeams} className="mb-6" />
            )}

            {/* Clicks */}
            {clicks.length > 0 && <TopTable title="Click Tracking" items={clicks} />}
          </>
        )}
      </main>
    </div>
  );
}

// --- Sub-components ---

function OverviewCard({
  label,
  value,
  change,
  sub,
  isText,
}: {
  label: string;
  value: number | string;
  change?: number | null;
  sub?: string;
  isText?: boolean;
}) {
  return (
    <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
      <p className="text-slate-400 text-xs uppercase tracking-wide mb-1">{label}</p>
      <p
        className={`font-bold ${isText ? 'text-sm text-white truncate' : 'text-2xl text-white'}`}
      >
        {typeof value === 'number' ? value.toLocaleString() : value}
      </p>
      {change !== null && change !== undefined && (
        <span
          className={`text-xs font-medium ${change >= 0 ? 'text-green-400' : 'text-red-400'}`}
        >
          {change >= 0 ? '+' : ''}
          {change}% vs prev
        </span>
      )}
      {sub && <p className="text-slate-500 text-xs mt-0.5">{sub}</p>}
    </div>
  );
}

function TimeseriesChart({ data }: { data: TimeseriesData }) {
  const max = Math.max(...data.views, 1);
  const barCount = data.labels.length;
  const barWidth = Math.max(4, Math.floor(800 / barCount) - 2);

  return (
    <div className="bg-slate-800 rounded-xl p-5 border border-slate-700 mb-6">
      <h3
        className="text-lg font-bold text-white mb-4"
        style={{ fontFamily: 'Bebas Neue, sans-serif' }}
      >
        Views Over Time
      </h3>
      <div className="overflow-x-auto">
        <svg
          width={Math.max(barCount * (barWidth + 2), 400)}
          height={180}
          className="w-full"
          viewBox={`0 0 ${Math.max(barCount * (barWidth + 2), 400)} 180`}
          preserveAspectRatio="none"
        >
          {data.views.map((v, i) => {
            const h = (v / max) * 140;
            const x = i * (barWidth + 2);
            return (
              <g key={i}>
                <rect
                  x={x}
                  y={150 - h}
                  width={barWidth}
                  height={h}
                  fill="#FCB514"
                  opacity={0.85}
                  rx={2}
                />
                {data.visitors && (
                  <rect
                    x={x}
                    y={150 - (data.visitors[i] / max) * 140}
                    width={barWidth}
                    height={(data.visitors[i] / max) * 140}
                    fill="#3b82f6"
                    opacity={0.5}
                    rx={2}
                  />
                )}
              </g>
            );
          })}
          {/* X-axis labels - show every nth */}
          {data.labels.map((label, i) => {
            const step = barCount > 14 ? Math.ceil(barCount / 10) : 1;
            if (i % step !== 0) return null;
            return (
              <text
                key={`label-${i}`}
                x={i * (barWidth + 2) + barWidth / 2}
                y={170}
                textAnchor="middle"
                fill="#94a3b8"
                fontSize={10}
              >
                {label}
              </text>
            );
          })}
        </svg>
      </div>
      <div className="flex gap-4 mt-2 text-xs text-slate-400">
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: '#FCB514' }} />
          Views
        </span>
        {data.visitors && (
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-sm inline-block bg-blue-500" />
            Unique Visitors
          </span>
        )}
      </div>
    </div>
  );
}

function TopTable({ title, items }: { title: string; items: TopItem[] }) {
  const max = items.length > 0 ? items[0].count : 1;

  return (
    <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
      <h3
        className="text-lg font-bold text-white mb-3"
        style={{ fontFamily: 'Bebas Neue, sans-serif' }}
      >
        {title}
      </h3>
      {items.length === 0 ? (
        <p className="text-slate-500 text-sm">No data yet</p>
      ) : (
        <div className="space-y-2">
          {items.map((item, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex justify-between text-sm mb-0.5">
                  <span className="text-slate-200 truncate">{item.name}</span>
                  <span className="text-slate-400 ml-2 shrink-0">{item.count.toLocaleString()}</span>
                </div>
                <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${(item.count / max) * 100}%`,
                      backgroundColor: '#FCB514',
                    }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function BarList({
  title,
  items,
  className = '',
}: {
  title: string;
  items: TopItem[];
  className?: string;
}) {
  const max = items.length > 0 ? Math.max(...items.map((i) => i.count)) : 1;

  return (
    <div className={`bg-slate-800 rounded-xl p-5 border border-slate-700 ${className}`}>
      <h3
        className="text-lg font-bold text-white mb-3"
        style={{ fontFamily: 'Bebas Neue, sans-serif' }}
      >
        {title}
      </h3>
      {items.length === 0 ? (
        <p className="text-slate-500 text-sm">No data yet</p>
      ) : (
        <div className="space-y-3">
          {items.map((item, i) => (
            <div key={i}>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-slate-200 capitalize">{item.name}</span>
                <span className="text-slate-400">{item.count.toLocaleString()}</span>
              </div>
              <div className="h-4 bg-slate-700 rounded overflow-hidden">
                <div
                  className="h-full rounded"
                  style={{
                    width: `${(item.count / max) * 100}%`,
                    backgroundColor: '#FCB514',
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface TopItem {
  name: string;
  count: number;
}
