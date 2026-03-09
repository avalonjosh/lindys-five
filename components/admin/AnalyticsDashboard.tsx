'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { countryFlag } from '@/lib/analytics';
import AdminNav from './AdminNav';

type Range = 'today' | '7d' | '30d' | 'alltime';

interface OverviewData {
  totalViews: number;
  uniqueVisitors: number | null;
  viewsChange: number | null;
  bounceRate: number | null;
  avgDuration: number | null;
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

interface RealtimeData {
  viewsThisHour: number;
  viewsLastHour: number;
  liveVisitors: number;
  activePages: TopItem[];
  liveFeed: { path: string; country: string; city: string; device: string; time: string }[];
}

export default function AnalyticsDashboard() {
  const [range, setRange] = useState<Range>('today');
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [timeseries, setTimeseries] = useState<TimeseriesData | null>(null);
  const [topPages, setTopPages] = useState<TopItem[]>([]);
  const [topReferrers, setTopReferrers] = useState<TopItem[]>([]);
  const [topDevices, setTopDevices] = useState<TopItem[]>([]);
  const [topCountries, setTopCountries] = useState<TopItem[]>([]);
  const [topCities, setTopCities] = useState<TopItem[]>([]);
  const [topTeams, setTopTeams] = useState<TopItem[]>([]);
  const [utmSources, setUtmSources] = useState<TopItem[]>([]);
  const [utmCampaigns, setUtmCampaigns] = useState<TopItem[]>([]);
  const [clicks, setClicks] = useState<TopItem[]>([]);
  const [realtime, setRealtime] = useState<RealtimeData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [ovRes, tsRes, pagesRes, refRes, devRes, countryRes, citiesRes, teamsRes, utmSrcRes, utmCampRes, clicksRes] =
        await Promise.all([
          fetch(`/api/analytics/overview?range=${range}`),
          range !== 'alltime' ? fetch(`/api/analytics/timeseries?range=${range}`) : null,
          fetch(`/api/analytics/top?type=pages&range=${range}&limit=10`),
          fetch(`/api/analytics/top?type=referrers&range=${range}&limit=10`),
          fetch(`/api/analytics/top?type=devices&range=${range}&limit=5`),
          fetch(`/api/analytics/top?type=countries&range=${range}&limit=10`),
          fetch(`/api/analytics/top?type=cities&range=${range}&limit=15`),
          fetch(`/api/analytics/top?type=teams&range=${range}&limit=15`),
          fetch(`/api/analytics/top?type=utm_source&range=${range}&limit=10`),
          fetch(`/api/analytics/top?type=utm_campaign&range=${range}&limit=10`),
          fetch(`/api/analytics/clicks?range=${range}&limit=15`),
        ]);

      setOverview(await ovRes.json());
      if (tsRes) setTimeseries(await tsRes.json());
      else setTimeseries(null);

      setTopPages((await pagesRes.json()).items || []);
      setTopReferrers((await refRes.json()).items || []);
      setTopDevices((await devRes.json()).items || []);
      setTopCountries((await countryRes.json()).items || []);
      setTopCities((await citiesRes.json()).items || []);
      setTopTeams((await teamsRes.json()).items || []);
      setUtmSources((await utmSrcRes.json()).items || []);
      setUtmCampaigns((await utmCampRes.json()).items || []);
      setClicks((await clicksRes.json()).items || []);
    } catch (e) {
      console.error('Failed to fetch analytics:', e);
    } finally {
      setLoading(false);
    }
  }, [range]);

  const fetchRealtime = useCallback(async () => {
    try {
      const res = await fetch('/api/analytics/realtime');
      if (res.ok) setRealtime(await res.json());
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchData();
    if (range === 'today') fetchRealtime();
  }, [fetchData, fetchRealtime, range]);

  // Auto-refresh every 30s when viewing "today"
  useEffect(() => {
    if (range !== 'today') return;
    const interval = setInterval(() => {
      fetchData();
      fetchRealtime();
    }, 30000);
    return () => clearInterval(interval);
  }, [range, fetchData, fetchRealtime]);

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
        {/* Header Row */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <h2
              className="text-3xl font-bold text-white"
              style={{ fontFamily: 'Bebas Neue, sans-serif' }}
            >
              Analytics
            </h2>
            {range === 'today' && realtime && (
              <div className="flex items-center gap-2 px-3 py-1 bg-green-900/40 border border-green-700/50 rounded-full">
                <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                <span className="text-green-400 text-xs font-medium">
                  {realtime.liveVisitors} live
                </span>
              </div>
            )}
          </div>
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
            {/* Overview Cards — 6 cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
              <OverviewCard
                label="Page Views"
                value={overview?.totalViews ?? 0}
                change={overview?.viewsChange}
                sparkData={timeseries?.views}
              />
              <OverviewCard
                label="Unique Visitors"
                value={overview?.uniqueVisitors ?? '—'}
                sparkData={timeseries?.visitors || undefined}
              />
              <OverviewCard
                label="Bounce Rate"
                value={overview?.bounceRate != null ? `${overview.bounceRate}%` : '—'}
              />
              <OverviewCard
                label="Avg Duration"
                value={overview?.avgDuration != null ? formatDuration(overview.avgDuration) : '—'}
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

            {/* Real-time banner when today */}
            {range === 'today' && realtime && (
              <RealtimeBanner data={realtime} />
            )}

            {/* Time-Series Chart */}
            {timeseries && <TimeseriesChart data={timeseries} range={range} />}

            {/* Two-column: Pages & Referrers */}
            <div className="grid md:grid-cols-2 gap-6 mb-6">
              <TopTable title="Top Pages" items={topPages} />
              <TopTable title="Referrers" items={topReferrers} />
            </div>

            {/* Two-column: Devices & Countries */}
            <div className="grid md:grid-cols-2 gap-6 mb-6">
              <BarList title="Devices" items={topDevices} />
              <TopTable title="Countries" items={topCountries} showFlags />
            </div>

            {/* Cities */}
            {topCities.length > 0 && (
              <TopTable title="Cities" items={topCities} className="mb-6" />
            )}

            {/* Team Popularity */}
            {topTeams.length > 0 && (
              <BarList title="Team Popularity" items={topTeams} className="mb-6" />
            )}

            {/* UTM Campaigns */}
            {(utmSources.length > 0 || utmCampaigns.length > 0) && (
              <div className="grid md:grid-cols-2 gap-6 mb-6">
                {utmSources.length > 0 && <TopTable title="UTM Sources" items={utmSources} />}
                {utmCampaigns.length > 0 && <TopTable title="UTM Campaigns" items={utmCampaigns} />}
              </div>
            )}

            {/* Clicks */}
            {clicks.length > 0 && <TopTable title="Click Tracking" items={clicks} className="mb-6" />}

            {/* Live Feed when today */}
            {range === 'today' && realtime && realtime.liveFeed.length > 0 && (
              <LiveFeed feed={realtime.liveFeed} />
            )}

            {/* Export */}
            <ExportButton
              topPages={topPages}
              topReferrers={topReferrers}
              topCountries={topCountries}
              topCities={topCities}
              range={range}
            />
          </>
        )}
      </main>
    </div>
  );
}

// --- Helpers ---

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

// --- Sub-components ---

function OverviewCard({
  label,
  value,
  change,
  sub,
  isText,
  sparkData,
}: {
  label: string;
  value: number | string;
  change?: number | null;
  sub?: string;
  isText?: boolean;
  sparkData?: number[];
}) {
  return (
    <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 relative overflow-hidden">
      {/* Sparkline background */}
      {sparkData && sparkData.length > 1 && (
        <Sparkline data={sparkData} />
      )}
      <p className="text-slate-400 text-xs uppercase tracking-wide mb-1 relative z-10">{label}</p>
      <p
        className={`font-bold relative z-10 ${isText ? 'text-sm text-white truncate' : 'text-2xl text-white'}`}
      >
        {typeof value === 'number' ? value.toLocaleString() : value}
      </p>
      {change !== null && change !== undefined && (
        <span
          className={`text-xs font-medium relative z-10 ${change >= 0 ? 'text-green-400' : 'text-red-400'}`}
        >
          {change >= 0 ? '↑' : '↓'} {Math.abs(change)}%
        </span>
      )}
      {sub && <p className="text-slate-500 text-xs mt-0.5 relative z-10">{sub}</p>}
    </div>
  );
}

function Sparkline({ data }: { data: number[] }) {
  const max = Math.max(...data, 1);
  const w = 120;
  const h = 40;
  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * w;
      const y = h - (v / max) * h * 0.8;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <svg
      className="absolute bottom-0 right-0 opacity-20"
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
    >
      <polyline
        points={points}
        fill="none"
        stroke="#FCB514"
        strokeWidth={2}
        strokeLinejoin="round"
      />
    </svg>
  );
}

function RealtimeBanner({ data }: { data: RealtimeData }) {
  return (
    <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 mb-6 flex items-center gap-6 overflow-x-auto">
      <div className="flex items-center gap-2 shrink-0">
        <span className="w-2.5 h-2.5 rounded-full bg-green-400 animate-pulse" />
        <span className="text-white font-bold text-lg">{data.liveVisitors}</span>
        <span className="text-slate-400 text-sm">on site now</span>
      </div>
      <div className="h-8 w-px bg-slate-700 shrink-0" />
      <div className="shrink-0">
        <span className="text-slate-400 text-xs">This hour</span>
        <p className="text-white font-bold">{data.viewsThisHour}</p>
      </div>
      <div className="shrink-0">
        <span className="text-slate-400 text-xs">Last hour</span>
        <p className="text-white font-bold">{data.viewsLastHour}</p>
      </div>
      <div className="h-8 w-px bg-slate-700 shrink-0" />
      <div className="flex gap-3 overflow-x-auto">
        {data.activePages.slice(0, 5).map((p, i) => (
          <div key={i} className="shrink-0 px-2 py-1 bg-slate-700/50 rounded text-xs">
            <span className="text-slate-300">{p.name}</span>
            <span className="text-[#FCB514] ml-1 font-medium">{p.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function TimeseriesChart({ data, range }: { data: TimeseriesData; range: Range }) {
  const [tooltip, setTooltip] = useState<{ x: number; y: number; label: string; views: number; visitors?: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const isToday = range === 'today';
  const max = Math.max(...data.views, ...(data.visitors || []), 1);
  const count = data.labels.length;

  const W = 800;
  const H = 200;
  const PAD_TOP = 20;
  const PAD_BOTTOM = 30;
  const PAD_LEFT = 45;
  const PAD_RIGHT = 10;
  const chartW = W - PAD_LEFT - PAD_RIGHT;
  const chartH = H - PAD_TOP - PAD_BOTTOM;

  function toPoints(values: number[]): string {
    return values
      .map((v, i) => {
        const x = PAD_LEFT + (i / (count - 1)) * chartW;
        const y = PAD_TOP + chartH - (v / max) * chartH;
        return `${x},${y}`;
      })
      .join(' ');
  }

  function toAreaPath(values: number[]): string {
    const baseline = PAD_TOP + chartH;
    const pts = values.map((v, i) => {
      const x = PAD_LEFT + (i / (count - 1)) * chartW;
      const y = PAD_TOP + chartH - (v / max) * chartH;
      return { x, y };
    });
    let d = `M${pts[0].x},${baseline} L${pts[0].x},${pts[0].y}`;
    for (let i = 1; i < pts.length; i++) d += ` L${pts[i].x},${pts[i].y}`;
    d += ` L${pts[pts.length - 1].x},${baseline} Z`;
    return d;
  }

  const barGap = 2;
  const barWidth = Math.max(4, Math.floor(chartW / count) - barGap);

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const mouseX = ((e.clientX - rect.left) / rect.width) * W;
    let idx: number;
    if (isToday) {
      idx = Math.round((mouseX - PAD_LEFT) / (barWidth + barGap));
    } else {
      idx = Math.round(((mouseX - PAD_LEFT) / chartW) * (count - 1));
    }
    idx = Math.max(0, Math.min(count - 1, idx));
    const x = isToday
      ? PAD_LEFT + idx * (barWidth + barGap) + barWidth / 2
      : PAD_LEFT + (idx / (count - 1)) * chartW;
    const y = PAD_TOP + chartH - (data.views[idx] / max) * chartH;
    setTooltip({
      x,
      y,
      label: data.labels[idx],
      views: data.views[idx],
      visitors: data.visitors?.[idx],
    });
  };

  // Y-axis labels
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map(frac => ({
    value: Math.round(max * frac),
    y: PAD_TOP + chartH - frac * chartH,
  }));

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
          ref={svgRef}
          width={W}
          height={H}
          className="w-full cursor-crosshair"
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="xMidYMid meet"
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setTooltip(null)}
        >
          {/* Grid lines & Y labels */}
          {yTicks.map((tick) => (
            <g key={tick.value}>
              <line
                x1={PAD_LEFT}
                x2={W - PAD_RIGHT}
                y1={tick.y}
                y2={tick.y}
                stroke="#334155"
                strokeWidth={0.5}
              />
              <text x={PAD_LEFT - 5} y={tick.y + 4} textAnchor="end" fill="#64748b" fontSize={9}>
                {tick.value.toLocaleString()}
              </text>
            </g>
          ))}

          {isToday ? (
            <>
              {data.views.map((v, i) => {
                const h = (v / max) * chartH;
                const x = PAD_LEFT + i * (barWidth + barGap);
                return (
                  <rect
                    key={i}
                    x={x}
                    y={PAD_TOP + chartH - h}
                    width={barWidth}
                    height={h}
                    fill="#FCB514"
                    opacity={0.85}
                    rx={2}
                  />
                );
              })}
            </>
          ) : (
            <>
              <path d={toAreaPath(data.views)} fill="#FCB514" opacity={0.12} />
              <polyline
                points={toPoints(data.views)}
                fill="none"
                stroke="#FCB514"
                strokeWidth={2.5}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              {data.views.map((v, i) => {
                const x = PAD_LEFT + (i / (count - 1)) * chartW;
                const y = PAD_TOP + chartH - (v / max) * chartH;
                return <circle key={`vd-${i}`} cx={x} cy={y} r={3} fill="#FCB514" />;
              })}
              {data.visitors && (
                <>
                  <path d={toAreaPath(data.visitors)} fill="#3b82f6" opacity={0.08} />
                  <polyline
                    points={toPoints(data.visitors)}
                    fill="none"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    strokeDasharray="6,3"
                  />
                  {data.visitors.map((v, i) => {
                    const x = PAD_LEFT + (i / (count - 1)) * chartW;
                    const y = PAD_TOP + chartH - (v / max) * chartH;
                    return <circle key={`ud-${i}`} cx={x} cy={y} r={2.5} fill="#3b82f6" />;
                  })}
                </>
              )}
            </>
          )}

          {/* X-axis labels */}
          {data.labels.map((label, i) => {
            const step = count > 14 ? Math.ceil(count / 10) : 1;
            if (i % step !== 0) return null;
            const x = isToday
              ? PAD_LEFT + i * (barWidth + barGap) + barWidth / 2
              : PAD_LEFT + (i / (count - 1)) * chartW;
            return (
              <text key={`label-${i}`} x={x} y={H - 5} textAnchor="middle" fill="#94a3b8" fontSize={10}>
                {label}
              </text>
            );
          })}

          {/* Tooltip crosshair */}
          {tooltip && (
            <>
              <line x1={tooltip.x} x2={tooltip.x} y1={PAD_TOP} y2={PAD_TOP + chartH} stroke="#FCB514" strokeWidth={1} opacity={0.4} strokeDasharray="3,3" />
              <circle cx={tooltip.x} cy={tooltip.y} r={5} fill="#FCB514" stroke="#1e293b" strokeWidth={2} />
            </>
          )}
        </svg>
      </div>

      {/* Tooltip popup */}
      {tooltip && (
        <div className="mt-1 text-xs text-slate-300">
          <span className="text-white font-medium">{tooltip.label}</span>
          {' — '}
          <span className="text-[#FCB514]">{tooltip.views.toLocaleString()} views</span>
          {tooltip.visitors != null && (
            <span className="text-blue-400 ml-2">{tooltip.visitors.toLocaleString()} visitors</span>
          )}
        </div>
      )}

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

function TopTable({
  title,
  items,
  className = '',
  showFlags = false,
}: {
  title: string;
  items: TopItem[];
  className?: string;
  showFlags?: boolean;
}) {
  const max = items.length > 0 ? items[0].count : 1;

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
        <div className="space-y-2">
          {items.map((item, i) => (
            <div key={i} className="flex items-center gap-3">
              <span className="text-slate-500 text-xs w-5 text-right shrink-0">{i + 1}</span>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between text-sm mb-0.5">
                  <span className="text-slate-200 truncate">
                    {showFlags && <span className="mr-1">{countryFlag(item.name)}</span>}
                    {item.name}
                  </span>
                  <span className="text-slate-400 ml-2 shrink-0">{item.count.toLocaleString()}</span>
                </div>
                <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
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
                  className="h-full rounded transition-all duration-500"
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

function LiveFeed({ feed }: { feed: RealtimeData['liveFeed'] }) {
  return (
    <div className="bg-slate-800 rounded-xl p-5 border border-slate-700 mb-6">
      <h3
        className="text-lg font-bold text-white mb-3 flex items-center gap-2"
        style={{ fontFamily: 'Bebas Neue, sans-serif' }}
      >
        <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
        Live Feed
      </h3>
      <div className="space-y-1 max-h-64 overflow-y-auto">
        {feed.map((entry, i) => {
          const ago = getTimeAgo(entry.time);
          return (
            <div key={i} className="flex items-center gap-3 text-xs py-1.5 border-b border-slate-700/50 last:border-0">
              <span className="text-slate-500 w-12 shrink-0">{ago}</span>
              {entry.country && (
                <span className="shrink-0">{countryFlag(entry.country)}</span>
              )}
              <span className="text-slate-300 truncate flex-1">{entry.path}</span>
              <span className="text-slate-500 shrink-0 capitalize">{entry.device}</span>
              {entry.city && (
                <span className="text-slate-500 shrink-0 hidden md:inline">{entry.city}</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function getTimeAgo(isoTime: string): string {
  const diff = Math.round((Date.now() - new Date(isoTime).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

function ExportButton({
  topPages,
  topReferrers,
  topCountries,
  topCities,
  range,
}: {
  topPages: TopItem[];
  topReferrers: TopItem[];
  topCountries: TopItem[];
  topCities: TopItem[];
  range: Range;
}) {
  const handleExport = () => {
    let csv = 'Section,Name,Count\n';

    const addSection = (section: string, items: TopItem[]) => {
      items.forEach((item) => {
        csv += `${section},"${item.name.replace(/"/g, '""')}",${item.count}\n`;
      });
    };

    addSection('Pages', topPages);
    addSection('Referrers', topReferrers);
    addSection('Countries', topCountries);
    addSection('Cities', topCities);

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `analytics-${range}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="mt-6 flex justify-end">
      <button
        onClick={handleExport}
        className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm rounded-lg border border-slate-600 transition-colors"
      >
        Export CSV
      </button>
    </div>
  );
}
