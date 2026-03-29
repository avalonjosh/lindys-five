'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { countryFlag } from '@/lib/analytics';
import { TEAMS } from '@/lib/teamConfig';
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

interface GSCData {
  overview: {
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
    clicksChange: number | null;
    impressionsChange: number | null;
  };
  queries: { query: string; clicks: number; impressions: number; ctr: number; position: number }[];
  pages: { page: string; clicks: number; impressions: number; ctr: number; position: number }[];
  daily: { date: string; clicks: number; impressions: number }[];
  dateRange: { start: string; end: string };
}

// --- Path prettifier using team config ---
const TEAM_SLUG_MAP: Record<string, string> = {};
Object.values(TEAMS).forEach((t) => {
  TEAM_SLUG_MAP[`/${t.slug}`] = t.city + ' ' + t.name;
});

const COUNTRY_NAMES: Record<string, string> = {
  US: 'United States', CA: 'Canada', GB: 'United Kingdom', DE: 'Germany', FR: 'France',
  AU: 'Australia', JP: 'Japan', BR: 'Brazil', IN: 'India', MX: 'Mexico', SE: 'Sweden',
  FI: 'Finland', NO: 'Norway', DK: 'Denmark', CZ: 'Czech Republic', SK: 'Slovakia',
  CH: 'Switzerland', RU: 'Russia', IE: 'Ireland', NL: 'Netherlands', IT: 'Italy',
  ES: 'Spain', PL: 'Poland', AT: 'Austria', BE: 'Belgium', PT: 'Portugal', NZ: 'New Zealand',
  KR: 'South Korea', CN: 'China', TW: 'Taiwan', HK: 'Hong Kong', SG: 'Singapore',
  PH: 'Philippines', TH: 'Thailand', ZA: 'South Africa',
};

function prettifyPath(path: string): string {
  if (path === '/') return 'Home';
  if (path === '/scores') return 'Live Scores';
  if (path === '/nhl-playoff-odds') return 'NHL Playoff Odds';
  if (path === '/blog') return 'Blog';
  if (TEAM_SLUG_MAP[path]) return TEAM_SLUG_MAP[path];
  if (path.startsWith('/blog/')) {
    const rest = path.replace('/blog/', '');
    const parts = rest.split('/');
    if (parts.length === 1) return `Blog: ${parts[0].charAt(0).toUpperCase() + parts[0].slice(1)}`;
    return rest.split('/').pop()?.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) || path;
  }
  return path;
}

function countryName(code: string): string {
  return COUNTRY_NAMES[code.toUpperCase()] || code;
}

// --- Main Component ---

export default function AnalyticsDashboard() {
  const [range, setRange] = useState<Range>('today');
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [timeseries, setTimeseries] = useState<TimeseriesData | null>(null);
  const [topPages, setTopPages] = useState<TopItem[]>([]);
  const [topReferrers, setTopReferrers] = useState<TopItem[]>([]);
  const [topDevices, setTopDevices] = useState<TopItem[]>([]);
  const [topCountries, setTopCountries] = useState<TopItem[]>([]);
  const [topTeams, setTopTeams] = useState<TopItem[]>([]);
  const [utmSources, setUtmSources] = useState<TopItem[]>([]);
  const [clicks, setClicks] = useState<TopItem[]>([]);
  const [gsc, setGsc] = useState<GSCData | null>(null);
  const [gscError, setGscError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const toggleSection = (key: string) =>
    setCollapsed((prev) => ({ ...prev, [key]: !prev[key] }));

  const fetchData = useCallback(async () => {
    try {
      const [ovRes, tsRes, pagesRes, refRes, devRes, countryRes, teamsRes, utmSrcRes, clicksRes] =
        await Promise.all([
          fetch(`/api/analytics/overview?range=${range}`),
          range !== 'alltime' ? fetch(`/api/analytics/timeseries?range=${range}`) : null,
          fetch(`/api/analytics/top?type=pages&range=${range}&limit=10`),
          fetch(`/api/analytics/top?type=referrers&range=${range}&limit=10`),
          fetch(`/api/analytics/top?type=devices&range=${range}&limit=5`),
          fetch(`/api/analytics/top?type=countries&range=${range}&limit=10`),
          fetch(`/api/analytics/top?type=teams&range=${range}&limit=15`),
          fetch(`/api/analytics/top?type=utm_source&range=${range}&limit=10`),
          fetch(`/api/analytics/clicks?range=${range}&limit=15`),
        ]);

      // Check for auth failures first
      if (!ovRes.ok) {
        const status = ovRes.status;
        setError(status === 401 ? 'Session expired — please log in again' : `API error (${status})`);
        return;
      }

      setError(null);
      setOverview(await ovRes.json());
      if (tsRes?.ok) setTimeseries(await tsRes.json());
      else setTimeseries(null);

      setTopPages(pagesRes.ok ? (await pagesRes.json()).items || [] : []);
      setTopReferrers(refRes.ok ? (await refRes.json()).items || [] : []);
      setTopDevices(devRes.ok ? (await devRes.json()).items || [] : []);
      setTopCountries(countryRes.ok ? (await countryRes.json()).items || [] : []);
      setTopTeams(teamsRes.ok ? (await teamsRes.json()).items || [] : []);
      setUtmSources(utmSrcRes.ok ? (await utmSrcRes.json()).items || [] : []);
      setClicks(clicksRes.ok ? (await clicksRes.json()).items || [] : []);
      setLastUpdated(new Date());
    } catch (e) {
      console.error('Failed to fetch analytics:', e);
      setError('Failed to load analytics data');
    } finally {
      setLoading(false);
    }
  }, [range]);

  const fetchGSC = useCallback(async () => {
    // GSC only has data for 7d/30d (not today or alltime)
    const gscRange = range === 'today' || range === '7d' ? '7d' : '30d';
    try {
      const res = await fetch(`/api/analytics/search?range=${gscRange}`);
      if (res.ok) {
        setGsc(await res.json());
        setGscError(null);
      } else {
        const data = await res.json();
        setGscError(data.details || 'Failed to load');
        setGsc(null);
      }
    } catch {
      setGscError('Failed to connect');
      setGsc(null);
    }
  }, [range]);

  useEffect(() => {
    setLoading(true);
    fetchData();
    fetchGSC();
  }, [fetchData, fetchGSC, range]);

  useEffect(() => {
    if (range !== 'today') return;
    const interval = setInterval(() => {
      fetchData();
    }, 120000);
    return () => clearInterval(interval);
  }, [range, fetchData]);

  const rangeOptions: { value: Range; label: string; shortLabel: string }[] = [
    { value: 'today', label: 'Today', shortLabel: 'Today' },
    { value: '7d', label: '7 Days', shortLabel: '7d' },
    { value: '30d', label: '30 Days', shortLabel: '30d' },
    { value: 'alltime', label: 'All Time', shortLabel: 'All' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-700 to-slate-800">
      <AdminNav activeTab="analytics" />

      {/* Sticky header — stacks on mobile */}
      <div className="sticky top-0 z-30 bg-slate-800/95 backdrop-blur-sm border-b border-slate-700">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-2 sm:py-3">
          {/* Row 1: title + timestamp (mobile), title + live + timestamp + picker (desktop) */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h2
                className="text-xl sm:text-2xl font-bold text-white"
                style={{ fontFamily: 'Bebas Neue, sans-serif' }}
              >
                Analytics
              </h2>
              {lastUpdated && (
                <span className="text-slate-500 text-[10px] sm:text-xs hidden md:inline">
                  Updated {lastUpdated.toLocaleTimeString()}
                </span>
              )}
            </div>
            {/* Range picker — desktop: inline. Mobile: shown below */}
            <div className="hidden sm:flex gap-1 bg-slate-700 rounded-lg p-1">
              {rangeOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setRange(opt.value)}
                  className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
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
          {/* Row 2: range picker on mobile only */}
          <div className="flex sm:hidden gap-1 bg-slate-700 rounded-lg p-1 mt-2">
            {rangeOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setRange(opt.value)}
                className={`flex-1 px-2 py-1.5 rounded text-xs font-medium transition-colors ${
                  range === opt.value
                    ? 'text-slate-900'
                    : 'text-slate-400 hover:text-white'
                }`}
                style={range === opt.value ? { backgroundColor: '#FCB514' } : {}}
              >
                {opt.shortLabel}
              </button>
            ))}
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {error ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <p className="text-red-400 text-lg mb-3">{error}</p>
            <button
              onClick={() => { setError(null); setLoading(true); fetchData(); }}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm"
            >
              Retry
            </button>
          </div>
        ) : loading && !overview ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-10 w-10 border-4 border-gray-700 border-t-[#FCB514]" />
          </div>
        ) : (
          <>
            {/* Overview Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
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
                sentiment={overview?.bounceRate != null ? (overview.bounceRate > 70 ? 'bad' : overview.bounceRate > 50 ? 'neutral' : 'good') : undefined}
              />
              <OverviewCard
                label="Avg Duration"
                value={overview?.avgDuration != null ? formatDuration(overview.avgDuration) : '—'}
                sentiment={overview?.avgDuration != null ? (overview.avgDuration > 60 ? 'good' : overview.avgDuration > 20 ? 'neutral' : 'bad') : undefined}
              />
              <OverviewCard
                label="Top Page"
                value={overview?.topPage ? prettifyPath(overview.topPage.name) : '—'}
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

            {/* Chart */}
            {timeseries && <TimeseriesChart data={timeseries} range={range} />}

            {/* ===== SEARCH (GSC) SECTION ===== */}
            <SectionHeader
              title="Google Search"
              subtitle={gsc?.dateRange ? `${gsc.dateRange.start} to ${gsc.dateRange.end}` : 'Search Console data'}
              collapsed={collapsed['search']}
              onToggle={() => toggleSection('search')}
            />
            {!collapsed['search'] && (
              gscError ? (
                <EmptyCard message={`Search Console: ${gscError}`} className="mb-6" />
              ) : gsc ? (
                <>
                  {/* GSC Overview Cards */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                    <OverviewCard
                      label="Search Clicks"
                      value={gsc.overview.clicks}
                      change={gsc.overview.clicksChange}
                    />
                    <OverviewCard
                      label="Impressions"
                      value={gsc.overview.impressions}
                      change={gsc.overview.impressionsChange}
                    />
                    <OverviewCard
                      label="Avg CTR"
                      value={`${gsc.overview.ctr}%`}
                    />
                    <OverviewCard
                      label="Avg Position"
                      value={gsc.overview.position}
                      sentiment={gsc.overview.position <= 10 ? 'good' : gsc.overview.position <= 30 ? 'neutral' : 'bad'}
                    />
                  </div>

                  {/* GSC Chart */}
                  {gsc.daily.length > 0 && <GSCChart daily={gsc.daily} />}

                  {/* Queries & Pages */}
                  <div className="grid md:grid-cols-2 gap-4 mb-6">
                    <GSCTable
                      title="Top Search Queries"
                      rows={gsc.queries.map(q => ({ name: q.query, clicks: q.clicks, impressions: q.impressions, ctr: q.ctr, position: q.position }))}
                    />
                    <GSCTable
                      title="Top Pages in Search"
                      rows={gsc.pages.map(p => ({ name: prettifyPath(p.page), clicks: p.clicks, impressions: p.impressions, ctr: p.ctr, position: p.position }))}
                    />
                  </div>
                </>
              ) : (
                <EmptyCard message="Loading Search Console data..." className="mb-6" />
              )
            )}

            {/* ===== CONTENT SECTION ===== */}
            <SectionHeader
              title="Content"
              subtitle="What people are viewing"
              collapsed={collapsed['content']}
              onToggle={() => toggleSection('content')}
            />
            {!collapsed['content'] && (
              <>
                <div className="grid md:grid-cols-2 gap-4 mb-6">
                  <TopTable title="Top Pages" items={topPages} prettify={prettifyPath} />
                  <BarList title="Team Popularity" items={topTeams} prettify={prettifyPath} />
                </div>
                <div className="grid md:grid-cols-2 gap-4 mb-6">
                  <BarList title="Devices" items={topDevices} />
                </div>
              </>
            )}

            {/* ===== ACQUISITION SECTION ===== */}
            <SectionHeader
              title="Acquisition"
              subtitle="Where visitors come from"
              collapsed={collapsed['acquisition']}
              onToggle={() => toggleSection('acquisition')}
            />
            {!collapsed['acquisition'] && (
              <>
                <div className="grid md:grid-cols-2 gap-4 mb-6">
                  <TopTable title="Referrers" items={topReferrers} emptyMessage="Share your link to start seeing referrer data" />
                  <TopTable title="UTM Sources" items={utmSources} emptyMessage="Add ?utm_source=... to your links to track campaigns" />
                </div>
              </>
            )}

            {/* ===== AUDIENCE SECTION ===== */}
            <SectionHeader
              title="Audience"
              subtitle="Who is visiting"
              collapsed={collapsed['audience']}
              onToggle={() => toggleSection('audience')}
            />
            {!collapsed['audience'] && (
              <>
                <div className="grid md:grid-cols-2 gap-4 mb-6">
                  <TopTable title="Countries" items={topCountries} showFlags formatName={countryName} />
                </div>
              </>
            )}

            {/* ===== ENGAGEMENT SECTION ===== */}
            <SectionHeader
              title="Engagement"
              subtitle="Clicks and interactions"
              collapsed={collapsed['engagement']}
              onToggle={() => toggleSection('engagement')}
            />
            {!collapsed['engagement'] && (
              <>
                {clicks.length > 0 ? (
                  <TopTable title="Click Tracking" items={clicks} className="mb-6" />
                ) : (
                  <EmptyCard message="Click data will appear as users interact with ticket links, share buttons, and team logos" className="mb-6" />
                )}
              </>
            )}

            {/* Export */}
            <div className="mt-8 pt-6 border-t border-slate-700 flex items-center justify-between">
              <span className="text-slate-500 text-xs">
                {lastUpdated && `Last updated ${lastUpdated.toLocaleTimeString()}`}
                {range === 'today' && ' · Auto-refreshes every 2m'}
              </span>
              <ExportButton
                topPages={topPages}
                topReferrers={topReferrers}
                topCountries={topCountries}
                topTeams={topTeams}
                clicks={clicks}
                range={range}
              />
            </div>
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
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

// --- Sub-components ---

function SectionHeader({
  title,
  subtitle,
  collapsed,
  onToggle,
}: {
  title: string;
  subtitle: string;
  collapsed?: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className="w-full flex items-center justify-between py-3 mb-3 border-b border-slate-600 group cursor-pointer"
    >
      <div className="text-left">
        <h3
          className="text-xl font-bold text-white"
          style={{ fontFamily: 'Bebas Neue, sans-serif' }}
        >
          {title}
        </h3>
        <p className="text-slate-400 text-xs">{subtitle}</p>
      </div>
      <span className={`text-slate-400 group-hover:text-white transition-transform duration-200 text-lg ${collapsed ? '' : 'rotate-180'}`}>
        &#9660;
      </span>
    </button>
  );
}

function EmptyCard({ message, className = '' }: { message: string; className?: string }) {
  return (
    <div className={`bg-slate-800/50 rounded-xl p-8 border border-slate-700/50 border-dashed text-center ${className}`}>
      <p className="text-slate-500 text-sm">{message}</p>
    </div>
  );
}

function OverviewCard({
  label,
  value,
  change,
  sub,
  isText,
  sparkData,
  sentiment,
}: {
  label: string;
  value: number | string;
  change?: number | null;
  sub?: string;
  isText?: boolean;
  sparkData?: number[];
  sentiment?: 'good' | 'neutral' | 'bad';
}) {
  const sentimentColor = sentiment === 'good' ? 'text-green-400' : sentiment === 'bad' ? 'text-red-400' : 'text-slate-300';
  const borderColor = sentiment === 'good' ? 'border-green-800/40' : sentiment === 'bad' ? 'border-red-800/40' : 'border-slate-700';

  return (
    <div className={`bg-slate-800 rounded-xl p-4 border ${borderColor} relative overflow-hidden`}>
      {sparkData && sparkData.length > 1 && <Sparkline data={sparkData} />}
      <p className="text-slate-400 text-[10px] uppercase tracking-wider mb-1 relative z-10">{label}</p>
      <p
        className={`font-bold relative z-10 ${isText ? 'text-xs text-white truncate leading-tight' : `text-xl ${sentiment ? sentimentColor : 'text-white'}`}`}
      >
        {typeof value === 'number' ? value.toLocaleString() : value}
      </p>
      {change !== null && change !== undefined && (
        <span
          className={`text-[10px] font-medium relative z-10 ${change >= 0 ? 'text-green-400' : 'text-red-400'}`}
        >
          {change >= 0 ? '↑' : '↓'} {Math.abs(change)}% vs prev period
        </span>
      )}
      {sub && <p className="text-slate-500 text-[10px] mt-0.5 relative z-10">{sub}</p>}
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
    <svg className="absolute bottom-0 right-0 opacity-15" width={w} height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      <polyline points={points} fill="none" stroke="#FCB514" strokeWidth={2} strokeLinejoin="round" />
    </svg>
  );
}

function TimeseriesChart({ data, range }: { data: TimeseriesData; range: Range }) {
  const [tooltip, setTooltip] = useState<{ x: number; y: number; label: string; views: number; visitors?: number } | null>(null);
  const [showVisitors, setShowVisitors] = useState(true);
  const svgRef = useRef<SVGSVGElement>(null);
  const isToday = range === 'today';
  const max = Math.max(...data.views, ...(showVisitors && data.visitors ? data.visitors : []), 1);
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
    const pts = values.map((v, i) => ({
      x: PAD_LEFT + (i / (count - 1)) * chartW,
      y: PAD_TOP + chartH - (v / max) * chartH,
    }));
    let d = `M${pts[0].x},${baseline} L${pts[0].x},${pts[0].y}`;
    for (let i = 1; i < pts.length; i++) d += ` L${pts[i].x},${pts[i].y}`;
    d += ` L${pts[pts.length - 1].x},${baseline} Z`;
    return d;
  }

  const barGap = 2;
  const barWidth = Math.max(4, Math.floor(chartW / count) - barGap);

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current) return;
    const pt = svgRef.current.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const svgPt = pt.matrixTransform(svgRef.current.getScreenCTM()!.inverse());
    const mouseX = svgPt.x;
    let idx = isToday
      ? Math.round((mouseX - PAD_LEFT) / (barWidth + barGap))
      : Math.round(((mouseX - PAD_LEFT) / chartW) * (count - 1));
    idx = Math.max(0, Math.min(count - 1, idx));
    const x = isToday
      ? PAD_LEFT + idx * (barWidth + barGap) + barWidth / 2
      : PAD_LEFT + (idx / (count - 1)) * chartW;
    const y = PAD_TOP + chartH - (data.views[idx] / max) * chartH;
    setTooltip({ x, y, label: data.labels[idx], views: data.views[idx], visitors: data.visitors?.[idx] });
  };

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map(frac => ({
    value: Math.round(max * frac),
    y: PAD_TOP + chartH - frac * chartH,
  }));

  return (
    <div className="bg-slate-800 rounded-xl p-5 border border-slate-700 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-white" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
          Views Over Time <span className="text-xs font-normal text-slate-400 ml-1">(ET)</span>
        </h3>
        {data.visitors && (
          <button
            onClick={() => setShowVisitors(!showVisitors)}
            className={`text-xs px-3 py-1 rounded-full border transition-colors ${
              showVisitors
                ? 'border-blue-500/50 text-blue-400 bg-blue-500/10'
                : 'border-slate-600 text-slate-500 hover:text-slate-300'
            }`}
          >
            {showVisitors ? 'Hide' : 'Show'} Visitors
          </button>
        )}
      </div>
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
          {yTicks.map((tick) => (
            <g key={tick.value}>
              <line x1={PAD_LEFT} x2={W - PAD_RIGHT} y1={tick.y} y2={tick.y} stroke="#334155" strokeWidth={0.5} />
              <text x={PAD_LEFT - 5} y={tick.y + 4} textAnchor="end" fill="#64748b" fontSize={9}>
                {tick.value.toLocaleString()}
              </text>
            </g>
          ))}

          {isToday ? (
            data.views.map((v, i) => {
              const h = (v / max) * chartH;
              const x = PAD_LEFT + i * (barWidth + barGap);
              return <rect key={i} x={x} y={PAD_TOP + chartH - h} width={barWidth} height={h} fill="#FCB514" opacity={0.85} rx={2} />;
            })
          ) : (
            <>
              <path d={toAreaPath(data.views)} fill="#FCB514" opacity={0.12} />
              <polyline points={toPoints(data.views)} fill="none" stroke="#FCB514" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
              {data.views.map((v, i) => {
                const x = PAD_LEFT + (i / (count - 1)) * chartW;
                const y = PAD_TOP + chartH - (v / max) * chartH;
                return <circle key={`vd-${i}`} cx={x} cy={y} r={3} fill="#FCB514" />;
              })}
              {showVisitors && data.visitors && (
                <>
                  <path d={toAreaPath(data.visitors)} fill="#3b82f6" opacity={0.08} />
                  <polyline points={toPoints(data.visitors)} fill="none" stroke="#3b82f6" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" strokeDasharray="6,3" />
                  {data.visitors.map((v, i) => {
                    const x = PAD_LEFT + (i / (count - 1)) * chartW;
                    const y = PAD_TOP + chartH - (v / max) * chartH;
                    return <circle key={`ud-${i}`} cx={x} cy={y} r={2.5} fill="#3b82f6" />;
                  })}
                </>
              )}
            </>
          )}

          {data.labels.map((label, i) => {
            const step = count > 14 ? Math.ceil(count / 10) : 1;
            if (i % step !== 0) return null;
            const x = isToday ? PAD_LEFT + i * (barWidth + barGap) + barWidth / 2 : PAD_LEFT + (i / (count - 1)) * chartW;
            return <text key={`label-${i}`} x={x} y={H - 5} textAnchor="middle" fill="#94a3b8" fontSize={10}>{label}</text>;
          })}

          {tooltip && (
            <>
              <line x1={tooltip.x} x2={tooltip.x} y1={PAD_TOP} y2={PAD_TOP + chartH} stroke="#FCB514" strokeWidth={1} opacity={0.4} strokeDasharray="3,3" />
              <circle cx={tooltip.x} cy={tooltip.y} r={5} fill="#FCB514" stroke="#1e293b" strokeWidth={2} />
            </>
          )}
        </svg>
      </div>

      {tooltip && (
        <div className="mt-1 text-xs text-slate-300">
          <span className="text-white font-medium">{tooltip.label}</span>
          {' — '}
          <span className="text-[#FCB514]">{tooltip.views.toLocaleString()} views</span>
          {tooltip.visitors != null && showVisitors && (
            <span className="text-blue-400 ml-2">{tooltip.visitors.toLocaleString()} visitors</span>
          )}
        </div>
      )}

      <div className="flex gap-4 mt-2 text-xs text-slate-400">
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: '#FCB514' }} />
          Views
        </span>
        {showVisitors && data.visitors && (
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
  prettify,
  formatName,
  emptyMessage,
}: {
  title: string;
  items: TopItem[];
  className?: string;
  showFlags?: boolean;
  prettify?: (s: string) => string;
  formatName?: (s: string) => string;
  emptyMessage?: string;
}) {
  const max = items.length > 0 ? items[0].count : 1;

  return (
    <div className={`bg-slate-800 rounded-xl p-5 border border-slate-700 ${className}`}>
      <h3 className="text-lg font-bold text-white mb-3" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
        {title}
      </h3>
      {items.length === 0 ? (
        <p className="text-slate-500 text-sm py-4">{emptyMessage || 'No data yet'}</p>
      ) : (
        <div className="space-y-2">
          {items.map((item, i) => {
            const displayName = prettify ? prettify(item.name) : formatName ? formatName(item.name) : item.name;
            return (
              <div key={i} className="flex items-center gap-3 group">
                <span className="text-slate-600 text-xs w-5 text-right shrink-0 font-mono">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between text-sm mb-0.5">
                    <span className="text-slate-200 truncate group-hover:text-white transition-colors" title={item.name}>
                      {showFlags && <span className="mr-1.5">{countryFlag(item.name)}</span>}
                      {displayName}
                    </span>
                    <span className="text-slate-400 ml-2 shrink-0 tabular-nums">{item.count.toLocaleString()}</span>
                  </div>
                  <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${(item.count / max) * 100}%`, backgroundColor: '#FCB514' }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function BarList({
  title,
  items,
  className = '',
  prettify,
  emptyMessage,
}: {
  title: string;
  items: TopItem[];
  className?: string;
  prettify?: (s: string) => string;
  emptyMessage?: string;
}) {
  const max = items.length > 0 ? Math.max(...items.map((i) => i.count)) : 1;

  return (
    <div className={`bg-slate-800 rounded-xl p-5 border border-slate-700 ${className}`}>
      <h3 className="text-lg font-bold text-white mb-3" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
        {title}
      </h3>
      {items.length === 0 ? (
        <p className="text-slate-500 text-sm py-4">{emptyMessage || 'No data yet'}</p>
      ) : (
        <div className="space-y-3">
          {items.map((item, i) => {
            const displayName = prettify ? prettify(`/${item.name}`) : item.name;
            return (
              <div key={i}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-slate-200 capitalize">{displayName}</span>
                  <span className="text-slate-400 tabular-nums">{item.count.toLocaleString()}</span>
                </div>
                <div className="h-4 bg-slate-700 rounded overflow-hidden">
                  <div
                    className="h-full rounded transition-all duration-500"
                    style={{ width: `${(item.count / max) * 100}%`, backgroundColor: '#FCB514' }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ExportButton({
  topPages,
  topReferrers,
  topCountries,
  topTeams,
  clicks,
  range,
}: {
  topPages: TopItem[];
  topReferrers: TopItem[];
  topCountries: TopItem[];
  topTeams: TopItem[];
  clicks: TopItem[];
  range: Range;
}) {
  const handleExport = () => {
    let csv = 'Section,Name,Count\n';
    const add = (section: string, items: TopItem[]) => {
      items.forEach((item) => {
        csv += `${section},"${item.name.replace(/"/g, '""')}",${item.count}\n`;
      });
    };
    add('Pages', topPages);
    add('Referrers', topReferrers);
    add('Countries', topCountries);
    add('Teams', topTeams);
    add('Clicks', clicks);

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `analytics-${range}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <button
      onClick={handleExport}
      className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm rounded-lg border border-slate-600 transition-colors"
    >
      Export CSV
    </button>
  );
}

// --- GSC Components ---

function GSCChart({ daily }: { daily: GSCData['daily'] }) {
  const [tooltip, setTooltip] = useState<{ x: number; label: string; clicks: number; impressions: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const count = daily.length;
  const maxClicks = Math.max(...daily.map(d => d.clicks), 1);
  const maxImpressions = Math.max(...daily.map(d => d.impressions), 1);

  const W = 800;
  const H = 180;
  const PAD = { top: 15, bottom: 30, left: 45, right: 45 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;

  function toPoints(values: number[], maxVal: number): string {
    return values
      .map((v, i) => {
        const x = PAD.left + (i / (count - 1)) * chartW;
        const y = PAD.top + chartH - (v / maxVal) * chartH;
        return `${x},${y}`;
      })
      .join(' ');
  }

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current) return;
    const pt = svgRef.current.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const svgPt = pt.matrixTransform(svgRef.current.getScreenCTM()!.inverse());
    const mouseX = svgPt.x;
    let idx = Math.round(((mouseX - PAD.left) / chartW) * (count - 1));
    idx = Math.max(0, Math.min(count - 1, idx));
    const x = PAD.left + (idx / (count - 1)) * chartW;
    setTooltip({ x, label: daily[idx].date, clicks: daily[idx].clicks, impressions: daily[idx].impressions });
  };

  return (
    <div className="bg-slate-800 rounded-xl p-5 border border-slate-700 mb-6">
      <h3 className="text-lg font-bold text-white mb-4" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
        Search Performance
      </h3>
      <div className="overflow-x-auto">
        <svg
          ref={svgRef}
          width={W} height={H} className="w-full cursor-crosshair"
          viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet"
          onMouseMove={handleMouseMove} onMouseLeave={() => setTooltip(null)}
        >
          {/* Grid */}
          {[0.25, 0.5, 0.75, 1].map(f => (
            <line key={f} x1={PAD.left} x2={W - PAD.right} y1={PAD.top + chartH - f * chartH} y2={PAD.top + chartH - f * chartH} stroke="#334155" strokeWidth={0.5} />
          ))}

          {/* Impressions line (right axis) */}
          <polyline
            points={toPoints(daily.map(d => d.impressions), maxImpressions)}
            fill="none" stroke="#8b5cf6" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" strokeDasharray="6,3"
          />

          {/* Clicks line (left axis) */}
          <polyline
            points={toPoints(daily.map(d => d.clicks), maxClicks)}
            fill="none" stroke="#22c55e" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round"
          />
          {daily.map((d, i) => {
            const x = PAD.left + (i / (count - 1)) * chartW;
            const y = PAD.top + chartH - (d.clicks / maxClicks) * chartH;
            return <circle key={i} cx={x} cy={y} r={2.5} fill="#22c55e" />;
          })}

          {/* Y-axis labels */}
          {[0, 0.5, 1].map(f => (
            <g key={`y-${f}`}>
              <text x={PAD.left - 5} y={PAD.top + chartH - f * chartH + 4} textAnchor="end" fill="#22c55e" fontSize={9}>
                {Math.round(maxClicks * f)}
              </text>
              <text x={W - PAD.right + 5} y={PAD.top + chartH - f * chartH + 4} textAnchor="start" fill="#8b5cf6" fontSize={9}>
                {Math.round(maxImpressions * f)}
              </text>
            </g>
          ))}

          {/* X-axis labels */}
          {daily.map((d, i) => {
            const step = count > 14 ? Math.ceil(count / 8) : 1;
            if (i % step !== 0) return null;
            const x = PAD.left + (i / (count - 1)) * chartW;
            return <text key={i} x={x} y={H - 5} textAnchor="middle" fill="#94a3b8" fontSize={10}>{d.date}</text>;
          })}

          {/* Tooltip crosshair */}
          {tooltip && (
            <line x1={tooltip.x} x2={tooltip.x} y1={PAD.top} y2={PAD.top + chartH} stroke="#22c55e" strokeWidth={1} opacity={0.4} strokeDasharray="3,3" />
          )}
        </svg>
      </div>
      {tooltip && (
        <div className="mt-1 text-xs text-slate-300">
          <span className="text-white font-medium">{tooltip.label}</span>
          {' — '}
          <span className="text-green-400">{tooltip.clicks} clicks</span>
          <span className="text-purple-400 ml-2">{tooltip.impressions.toLocaleString()} impressions</span>
        </div>
      )}
      <div className="flex gap-4 mt-2 text-xs text-slate-400">
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-sm inline-block bg-green-500" />
          Clicks
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-sm inline-block bg-purple-500" />
          Impressions
        </span>
      </div>
    </div>
  );
}

function GSCTable({
  title,
  rows,
}: {
  title: string;
  rows: { name: string; clicks: number; impressions: number; ctr: number; position: number }[];
}) {
  return (
    <div className="bg-slate-800 rounded-xl p-5 border border-slate-700 overflow-x-auto">
      <h3 className="text-lg font-bold text-white mb-3" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
        {title}
      </h3>
      {rows.length === 0 ? (
        <p className="text-slate-500 text-sm py-4">No data yet — GSC needs a few days to populate</p>
      ) : (
        <>
          {/* Header */}
          <div className="flex items-center gap-2 text-[10px] text-slate-500 uppercase tracking-wider mb-2 px-1 min-w-0">
            <span className="flex-1">Query</span>
            <span className="w-12 text-right">Clicks</span>
            <span className="w-14 text-right hidden sm:block">Impr</span>
            <span className="w-12 text-right hidden md:block">CTR</span>
            <span className="w-10 text-right">Pos</span>
          </div>
          <div className="space-y-1">
            {rows.map((row, i) => (
              <div key={i} className="flex items-center gap-2 text-sm py-1.5 px-1 rounded hover:bg-slate-700/50 group">
                <span className="text-slate-600 text-xs w-4 text-right shrink-0 font-mono">{i + 1}</span>
                <span className="flex-1 text-slate-200 truncate group-hover:text-white" title={row.name}>{row.name}</span>
                <span className="w-12 text-right text-green-400 font-medium tabular-nums">{row.clicks}</span>
                <span className="w-14 text-right text-purple-400 tabular-nums hidden sm:block">{row.impressions.toLocaleString()}</span>
                <span className="w-12 text-right text-slate-400 tabular-nums hidden md:block">{row.ctr}%</span>
                <span className={`w-10 text-right tabular-nums font-medium ${row.position <= 10 ? 'text-green-400' : row.position <= 30 ? 'text-yellow-400' : 'text-red-400'}`}>
                  {row.position}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
