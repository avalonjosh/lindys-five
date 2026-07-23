'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Radio } from 'lucide-react';
import { countryFlag } from '@/lib/analytics';
import { TEAMS } from '@/lib/teamConfig';
import { Card, PageHeader, SectionHeading, Badge, Button, Spinner, WarningBanner, Segmented, EmptyState } from './ui';

// Chart palette for the light surface. Views = Sabres blue; the paired series
// (visitors / impressions) get clearly separated hues.
const BLUE = '#003087';
const AMBER = '#d97706';
const GREEN = '#16a34a';
const VIOLET = '#7c3aed';
const GRID = '#e5e7eb';
const AXIS_TEXT = '#9ca3af';

type Range = 'today' | '7d' | '30d' | '12mo';

const RANGE_LABEL: Record<Range, string> = {
  today: 'today',
  '7d': 'last 7 days',
  '30d': 'last 30 days',
  '12mo': 'last 12 months',
};

const DELTA_LABEL: Record<Range, string | null> = {
  today: 'vs yesterday',
  '7d': 'vs previous 7 days',
  '30d': 'vs previous 30 days',
  '12mo': null,
};

interface OverviewData {
  error?: string;
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
  activeUsers: number;
  pages: TopItem[];
  error?: string;
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
  if (path === '/nhl/scores') return 'NHL Scores';
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
  const [acquisitionSources, setAcquisitionSources] = useState<TopItem[]>([]);
  const [clicks, setClicks] = useState<TopItem[]>([]);
  const [realtime, setRealtime] = useState<RealtimeData | null>(null);
  const [gsc, setGsc] = useState<GSCData | null>(null);
  const [gscError, setGscError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ga4Error, setGa4Error] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Race guard: abort in-flight requests on range switch and drop responses
  // that arrive for a stale request id.
  const abortRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef(0);

  const fetchData = useCallback(async (opts?: { background?: boolean }) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const requestId = ++requestIdRef.current;
    const { signal } = controller;
    if (!opts?.background) setRefreshing(true);

    try {
      const [ovRes, tsRes, pagesRes, refRes, devRes, countryRes, teamsRes, srcRes, clicksRes] =
        await Promise.all([
          fetch(`/api/analytics/overview?range=${range}`, { signal }),
          fetch(`/api/analytics/timeseries?range=${range}`, { signal }),
          fetch(`/api/analytics/top?type=pages&range=${range}&limit=10`, { signal }),
          fetch(`/api/analytics/top?type=referrers&range=${range}&limit=10`, { signal }),
          fetch(`/api/analytics/top?type=devices&range=${range}&limit=5`, { signal }),
          fetch(`/api/analytics/top?type=countries&range=${range}&limit=10`, { signal }),
          fetch(`/api/analytics/top?type=teams&range=${range}&limit=15`, { signal }),
          fetch(`/api/analytics/top?type=utm_source&range=${range}&limit=10`, { signal }),
          fetch(`/api/analytics/clicks?range=${range}&limit=15`, { signal }),
        ]);

      if (requestId !== requestIdRef.current) return; // stale response — drop it

      if (!ovRes.ok) {
        const status = ovRes.status;
        setError(status === 401 ? 'Session expired — please log in again' : `API error (${status})`);
        return;
      }

      setError(null);
      const ov = await ovRes.json();
      setOverview(ov);
      // One flag covers every GA4-fed panel — same credentials behind all of them.
      setGa4Error(ov.error || null);

      if (tsRes.ok) {
        const ts = await tsRes.json();
        setTimeseries(ts.labels?.length ? ts : null);
      } else {
        setTimeseries(null);
      }

      setTopPages(pagesRes.ok ? (await pagesRes.json()).items || [] : []);
      setTopReferrers(refRes.ok ? (await refRes.json()).items || [] : []);
      setTopDevices(devRes.ok ? (await devRes.json()).items || [] : []);
      setTopCountries(countryRes.ok ? (await countryRes.json()).items || [] : []);
      setTopTeams(teamsRes.ok ? (await teamsRes.json()).items || [] : []);
      setAcquisitionSources(srcRes.ok ? (await srcRes.json()).items || [] : []);
      setClicks(clicksRes.ok ? (await clicksRes.json()).items || [] : []);
      setLastUpdated(new Date());
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
      console.error('Failed to fetch analytics:', e);
      if (requestId === requestIdRef.current) setError('Failed to load analytics data');
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [range]);

  // GSC lags ~2 days and only supports 7d/30d windows; the card labels its own
  // window instead of pretending to follow the page range.
  const gscRange = range === 'today' || range === '7d' ? '7d' : '30d';
  const fetchGSC = useCallback(async () => {
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
  }, [gscRange]);

  const fetchRealtime = useCallback(async () => {
    try {
      const res = await fetch('/api/analytics/realtime');
      if (res.ok) setRealtime(await res.json());
    } catch {
      /* non-fatal */
    }
  }, []);

  useEffect(() => {
    fetchData();
    fetchGSC();
    fetchRealtime();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchData, fetchGSC]);

  // Auto-refresh on Today: full data every 2 minutes, realtime every minute.
  useEffect(() => {
    if (range !== 'today') return;
    const dataInterval = setInterval(() => fetchData({ background: true }), 120000);
    const rtInterval = setInterval(fetchRealtime, 60000);
    return () => {
      clearInterval(dataInterval);
      clearInterval(rtInterval);
    };
  }, [range, fetchData, fetchRealtime]);

  const deltaLabel = DELTA_LABEL[range];

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <PageHeader
        title="Analytics"
        description={
          <>
            Showing {RANGE_LABEL[range]}
            {lastUpdated && <span className="text-gray-400"> · updated {lastUpdated.toLocaleTimeString()}</span>}
            {range === 'today' && <Badge variant="success" className="ml-2">Auto-refreshes every 2m</Badge>}
          </>
        }
        actions={
          <Segmented
            options={[
              { value: 'today', label: 'Today' },
              { value: '7d', label: '7d' },
              { value: '30d', label: '30d' },
              { value: '12mo', label: '12 mo' },
            ]}
            value={range}
            onChange={setRange}
          />
        }
      />

      {error ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <p className="mb-3 text-lg text-red-500">{error}</p>
          <Button variant="secondary" onClick={() => { setError(null); setLoading(true); fetchData(); }}>
            Retry
          </Button>
        </div>
      ) : loading && !overview ? (
        <div className="flex items-center justify-center py-20">
          <Spinner size="lg" />
        </div>
      ) : (
        <div className={refreshing ? 'pointer-events-none opacity-50 transition-opacity' : 'transition-opacity'}>
          {/* GA4 credential / fetch failure — covers every GA4-fed panel below */}
          {ga4Error && (
            <div className="mb-6">
              <WarningBanner>
                <strong>Google Analytics data unavailable:</strong> {ga4Error}. All GA4 panels (views, visitors,
                pages, referrers, sources, countries, devices, live) will show zeros until the
                GSC_CLIENT_EMAIL / GSC_PRIVATE_KEY / GA4_PROPERTY_ID keys are fixed in Vercel. First-party
                panels (teams, clicks) and Search Console are unaffected.
              </WarningBanner>
            </div>
          )}

          {/* Live now + overview stats */}
          <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
            <LiveNowCard realtime={realtime} />
            <OverviewCard
              label="Page Views"
              value={overview?.totalViews ?? 0}
              change={overview?.viewsChange}
              changeLabel={deltaLabel}
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
          </div>

          {/* Views over time */}
          {timeseries && <TimeseriesChart data={timeseries} range={range} />}

          {/* Content */}
          <SectionBlock title="Content" subtitle={`What people are viewing · ${RANGE_LABEL[range]}`}>
            <div className="grid gap-4 md:grid-cols-2">
              <TopTable title="Top Pages" items={topPages} prettify={prettifyPath} ga4Down={!!ga4Error} />
              <TopTable
                title="Team Popularity"
                items={topTeams}
                prettify={(s) => prettifyPath(`/${s}`)}
                note={range === '12mo' ? 'First-party tracking · last 90 days (retention limit)' : 'First-party tracking'}
              />
            </div>
          </SectionBlock>

          {/* Acquisition */}
          <SectionBlock title="Acquisition" subtitle={`Where visitors come from · ${RANGE_LABEL[range]}`}>
            <div className="grid gap-4 md:grid-cols-2">
              <TopTable
                title="Referrers"
                items={topReferrers}
                ga4Down={!!ga4Error}
                emptyMessage="Share your link to start seeing referrer data"
              />
              <TopTable
                title="Acquisition Sources"
                items={acquisitionSources}
                ga4Down={!!ga4Error}
                note="GA4 first-user source (includes UTM + organic + direct)"
                emptyMessage="Add ?utm_source=... to your links to track campaigns"
              />
            </div>
          </SectionBlock>

          {/* Audience */}
          <SectionBlock title="Audience" subtitle={`Who is visiting · ${RANGE_LABEL[range]}`}>
            <div className="grid gap-4 md:grid-cols-2">
              <TopTable title="Countries" items={topCountries} showFlags formatName={countryName} ga4Down={!!ga4Error} />
              <TopTable title="Devices" items={topDevices} formatName={(s) => s.charAt(0).toUpperCase() + s.slice(1)} ga4Down={!!ga4Error} />
            </div>
          </SectionBlock>

          {/* Engagement */}
          <SectionBlock title="Engagement" subtitle={`Clicks on tickets, gear, and share buttons · ${RANGE_LABEL[range]}`}>
            <TopTable
              title="Click Tracking"
              items={clicks}
              note={range === '12mo' ? 'First-party tracking · last 90 days (retention limit)' : 'First-party tracking'}
              emptyMessage="Click data will appear as users interact with ticket links, share buttons, and team logos"
            />
          </SectionBlock>

          {/* Search Console — its own window, clearly labeled */}
          <SectionBlock
            title="Google Search"
            subtitle={
              gsc?.dateRange
                ? `Search Console · ${gsc.dateRange.start} to ${gsc.dateRange.end} (data lags ~2 days${range === 'today' ? '; no same-day view exists' : ''})`
                : 'Search Console · data lags ~2 days'
            }
          >
            {gscError ? (
              <Card className="border-dashed">
                <EmptyState>Search Console: {gscError}</EmptyState>
              </Card>
            ) : gsc ? (
              <>
                <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
                  <OverviewCard label="Search Clicks" value={gsc.overview.clicks} change={gsc.overview.clicksChange} changeLabel={`vs previous ${gscRange === '7d' ? '7' : '30'} days`} />
                  <OverviewCard label="Impressions" value={gsc.overview.impressions} change={gsc.overview.impressionsChange} changeLabel={`vs previous ${gscRange === '7d' ? '7' : '30'} days`} />
                  <OverviewCard label="Avg CTR" value={`${gsc.overview.ctr}%`} />
                  <OverviewCard
                    label="Avg Position"
                    value={gsc.overview.position}
                    sentiment={gsc.overview.position <= 10 ? 'good' : gsc.overview.position <= 30 ? 'neutral' : 'bad'}
                  />
                </div>
                {gsc.daily.length > 0 && <GSCChart daily={gsc.daily} />}
                <div className="grid gap-4 md:grid-cols-2">
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
              <Card className="border-dashed">
                <EmptyState>Loading Search Console data...</EmptyState>
              </Card>
            )}
          </SectionBlock>

          {/* Export */}
          <div className="mt-8 flex items-center justify-between border-t border-gray-200 pt-6">
            <span className="text-xs text-gray-400">
              {lastUpdated && `Last updated ${lastUpdated.toLocaleTimeString()}`}
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
        </div>
      )}
    </main>
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

function SectionBlock({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <div className="mb-3 border-b border-gray-200 pb-2">
        <h3 className="text-base font-bold text-gray-900">{title}</h3>
        <p className="text-xs text-gray-500">{subtitle}</p>
      </div>
      {children}
    </section>
  );
}

function LiveNowCard({ realtime }: { realtime: RealtimeData | null }) {
  const active = realtime && !realtime.error ? realtime.activeUsers : null;
  const topPage = realtime?.pages?.[0];
  return (
    <Card padding={false} className="relative overflow-hidden p-4">
      <p className="mb-1 flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-gray-500">
        <Radio className="h-3 w-3 text-green-600" />
        Live now
        {active != null && active > 0 && (
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
          </span>
        )}
      </p>
      <p className={`text-xl font-bold ${active != null && active > 0 ? 'text-green-700' : 'text-gray-900'}`}>
        {active != null ? active.toLocaleString() : '—'}
      </p>
      <p className="mt-0.5 truncate text-[10px] text-gray-400" title={topPage?.name}>
        {active == null
          ? 'GA4 realtime unavailable'
          : active === 0
          ? 'No one on the site right now'
          : topPage
          ? `Most viewed: ${topPage.name}`
          : 'active in the last 30 min'}
      </p>
    </Card>
  );
}

function OverviewCard({
  label,
  value,
  change,
  changeLabel,
  sub,
  isText,
  sparkData,
  sentiment,
}: {
  label: string;
  value: number | string;
  change?: number | null;
  changeLabel?: string | null;
  sub?: string;
  isText?: boolean;
  sparkData?: number[];
  sentiment?: 'good' | 'neutral' | 'bad';
}) {
  const sentimentColor = sentiment === 'good' ? 'text-green-700' : sentiment === 'bad' ? 'text-red-500' : 'text-gray-900';

  return (
    <Card padding={false} className="relative overflow-hidden p-4">
      {sparkData && sparkData.length > 1 && <Sparkline data={sparkData} />}
      <p className="relative z-10 mb-1 text-[10px] uppercase tracking-wider text-gray-500">{label}</p>
      <p
        className={`relative z-10 font-bold ${isText ? 'truncate text-xs leading-tight text-gray-900' : `text-xl ${sentiment ? sentimentColor : 'text-gray-900'}`}`}
      >
        {typeof value === 'number' ? value.toLocaleString() : value}
      </p>
      {change !== null && change !== undefined && changeLabel && (
        <span
          className={`relative z-10 text-[10px] font-medium ${change >= 0 ? 'text-green-600' : 'text-red-500'}`}
        >
          {change >= 0 ? '↑' : '↓'} {Math.abs(change)}% <span className="font-normal text-gray-400">{changeLabel}</span>
        </span>
      )}
      {sub && <p className="relative z-10 mt-0.5 text-[10px] text-gray-400">{sub}</p>}
    </Card>
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
    <svg className="absolute bottom-0 right-0 opacity-20" width={w} height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      <polyline points={points} fill="none" stroke={BLUE} strokeWidth={2} strokeLinejoin="round" />
    </svg>
  );
}

function TimeseriesChart({ data, range }: { data: TimeseriesData; range: Range }) {
  const [tooltip, setTooltip] = useState<{ x: number; y: number; label: string; views: number; visitors?: number } | null>(null);
  const [showVisitors, setShowVisitors] = useState(true);
  const svgRef = useRef<SVGSVGElement>(null);
  const isToday = range === 'today';
  const count = data.labels.length;

  if (count === 0) {
    return (
      <Card className="mb-6">
        <SectionHeading>Views Over Time</SectionHeading>
        <EmptyState>No data available for this period.</EmptyState>
      </Card>
    );
  }

  const max = Math.max(...data.views, ...(showVisitors && data.visitors ? data.visitors : []), 1);

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
    const views = data.views[idx] ?? 0;
    setTooltip({ x, y, label: data.labels[idx], views, visitors: data.visitors?.[idx] });
  };

  const yTicksRaw = [0, 0.25, 0.5, 0.75, 1].map(frac => ({
    value: Math.round(max * frac),
    y: PAD_TOP + chartH - frac * chartH,
  }));
  const seenTickValues = new Set<number>();
  const yTicks = yTicksRaw.filter(t => {
    if (seenTickValues.has(t.value)) return false;
    seenTickValues.add(t.value);
    return true;
  });

  return (
    <Card className="mb-6">
      <SectionHeading
        actions={
          data.visitors ? (
            <button
              onClick={() => setShowVisitors(!showVisitors)}
              className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                showVisitors
                  ? 'border-amber-300 bg-amber-50 text-amber-700'
                  : 'border-gray-200 text-gray-400 hover:text-gray-600'
              }`}
            >
              {showVisitors ? 'Hide' : 'Show'} Visitors
            </button>
          ) : undefined
        }
      >
        Views Over Time <span className="ml-1 text-xs font-normal text-gray-400">(ET)</span>
      </SectionHeading>
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
              <line x1={PAD_LEFT} x2={W - PAD_RIGHT} y1={tick.y} y2={tick.y} stroke={GRID} strokeWidth={0.5} />
              <text x={PAD_LEFT - 5} y={tick.y + 4} textAnchor="end" fill={AXIS_TEXT} fontSize={9}>
                {tick.value.toLocaleString()}
              </text>
            </g>
          ))}

          {isToday ? (
            data.views.map((v, i) => {
              const h = (v / max) * chartH;
              const x = PAD_LEFT + i * (barWidth + barGap);
              return <rect key={i} x={x} y={PAD_TOP + chartH - h} width={barWidth} height={h} fill={BLUE} opacity={0.85} rx={2} />;
            })
          ) : (
            <>
              <path d={toAreaPath(data.views)} fill={BLUE} opacity={0.08} />
              <polyline points={toPoints(data.views)} fill="none" stroke={BLUE} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
              {data.views.map((v, i) => {
                const x = PAD_LEFT + (i / (count - 1)) * chartW;
                const y = PAD_TOP + chartH - (v / max) * chartH;
                return <circle key={`vd-${i}`} cx={x} cy={y} r={3} fill={BLUE} />;
              })}
              {showVisitors && data.visitors && (
                <>
                  <path d={toAreaPath(data.visitors)} fill={AMBER} opacity={0.06} />
                  <polyline points={toPoints(data.visitors)} fill="none" stroke={AMBER} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" strokeDasharray="6,3" />
                  {data.visitors.map((v, i) => {
                    const x = PAD_LEFT + (i / (count - 1)) * chartW;
                    const y = PAD_TOP + chartH - (v / max) * chartH;
                    return <circle key={`ud-${i}`} cx={x} cy={y} r={2.5} fill={AMBER} />;
                  })}
                </>
              )}
            </>
          )}

          {data.labels.map((label, i) => {
            const step = count > 14 ? Math.ceil(count / 10) : 1;
            if (i % step !== 0) return null;
            const x = isToday ? PAD_LEFT + i * (barWidth + barGap) + barWidth / 2 : PAD_LEFT + (i / (count - 1)) * chartW;
            return <text key={`label-${i}`} x={x} y={H - 5} textAnchor="middle" fill={AXIS_TEXT} fontSize={10}>{label}</text>;
          })}

          {tooltip && (
            <>
              <line x1={tooltip.x} x2={tooltip.x} y1={PAD_TOP} y2={PAD_TOP + chartH} stroke={BLUE} strokeWidth={1} opacity={0.4} strokeDasharray="3,3" />
              <circle cx={tooltip.x} cy={tooltip.y} r={5} fill={BLUE} stroke="#fff" strokeWidth={2} />
            </>
          )}
        </svg>
      </div>

      {tooltip && (
        <div className="mt-1 text-xs text-gray-600">
          <span className="font-medium text-gray-900">{tooltip.label}</span>
          {' — '}
          <span className="font-medium text-sabres-blue">{tooltip.views.toLocaleString()} views</span>
          {tooltip.visitors != null && showVisitors && (
            <span className="ml-2 text-amber-600">{tooltip.visitors.toLocaleString()} visitors</span>
          )}
        </div>
      )}

      <div className="mt-2 flex gap-4 text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded-sm" style={{ backgroundColor: BLUE }} />
          Views
        </span>
        {showVisitors && data.visitors && (
          <span className="flex items-center gap-1">
            <span className="inline-block h-3 w-3 rounded-sm" style={{ backgroundColor: AMBER }} />
            Unique Visitors
          </span>
        )}
      </div>
    </Card>
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
  note,
  ga4Down = false,
}: {
  title: string;
  items: TopItem[];
  className?: string;
  showFlags?: boolean;
  prettify?: (s: string) => string;
  formatName?: (s: string) => string;
  emptyMessage?: string;
  note?: string;
  ga4Down?: boolean;
}) {
  const max = items.length > 0 ? items[0].count : 1;

  return (
    <Card className={className}>
      <SectionHeading>{title}</SectionHeading>
      {note && <p className="-mt-2 mb-3 text-xs text-gray-400">{note}</p>}
      {items.length === 0 ? (
        <p className="py-4 text-sm text-gray-400">
          {ga4Down ? 'Unavailable — GA4 keys missing or invalid (see banner above)' : emptyMessage || 'No data yet'}
        </p>
      ) : (
        <div className="space-y-2">
          {items.map((item, i) => {
            const displayName = prettify ? prettify(item.name) : formatName ? formatName(item.name) : item.name;
            return (
              <div key={i} className="group flex items-center gap-3">
                <span className="w-5 shrink-0 text-right font-mono text-xs text-gray-300">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <div className="mb-0.5 flex justify-between text-sm">
                    <span className="truncate text-gray-700 transition-colors group-hover:text-gray-900" title={item.name}>
                      {showFlags && <span className="mr-1.5">{countryFlag(item.name)}</span>}
                      {displayName}
                    </span>
                    <span className="ml-2 shrink-0 tabular-nums text-gray-500">{item.count.toLocaleString()}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-gray-100">
                    <div
                      className="h-full rounded-full bg-sabres-blue transition-all duration-500"
                      style={{ width: `${(item.count / max) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
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
    <Button variant="ghost" size="sm" onClick={handleExport}>
      Export CSV
    </Button>
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
    <Card className="mb-4">
      <SectionHeading>Search Performance</SectionHeading>
      <div className="overflow-x-auto">
        <svg
          ref={svgRef}
          width={W} height={H} className="w-full cursor-crosshair"
          viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet"
          onMouseMove={handleMouseMove} onMouseLeave={() => setTooltip(null)}
        >
          {/* Grid */}
          {[0.25, 0.5, 0.75, 1].map(f => (
            <line key={f} x1={PAD.left} x2={W - PAD.right} y1={PAD.top + chartH - f * chartH} y2={PAD.top + chartH - f * chartH} stroke={GRID} strokeWidth={0.5} />
          ))}

          {/* Impressions line (right axis) */}
          <polyline
            points={toPoints(daily.map(d => d.impressions), maxImpressions)}
            fill="none" stroke={VIOLET} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" strokeDasharray="6,3"
          />

          {/* Clicks line (left axis) */}
          <polyline
            points={toPoints(daily.map(d => d.clicks), maxClicks)}
            fill="none" stroke={GREEN} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round"
          />
          {daily.map((d, i) => {
            const x = PAD.left + (i / (count - 1)) * chartW;
            const y = PAD.top + chartH - (d.clicks / maxClicks) * chartH;
            return <circle key={i} cx={x} cy={y} r={2.5} fill={GREEN} />;
          })}

          {/* Y-axis labels */}
          {[0, 0.5, 1].map(f => (
            <g key={`y-${f}`}>
              <text x={PAD.left - 5} y={PAD.top + chartH - f * chartH + 4} textAnchor="end" fill={GREEN} fontSize={9}>
                {Math.round(maxClicks * f)}
              </text>
              <text x={W - PAD.right + 5} y={PAD.top + chartH - f * chartH + 4} textAnchor="start" fill={VIOLET} fontSize={9}>
                {Math.round(maxImpressions * f)}
              </text>
            </g>
          ))}

          {/* X-axis labels */}
          {daily.map((d, i) => {
            const step = count > 14 ? Math.ceil(count / 8) : 1;
            if (i % step !== 0) return null;
            const x = PAD.left + (i / (count - 1)) * chartW;
            return <text key={i} x={x} y={H - 5} textAnchor="middle" fill={AXIS_TEXT} fontSize={10}>{d.date}</text>;
          })}

          {/* Tooltip crosshair */}
          {tooltip && (
            <line x1={tooltip.x} x2={tooltip.x} y1={PAD.top} y2={PAD.top + chartH} stroke={GREEN} strokeWidth={1} opacity={0.4} strokeDasharray="3,3" />
          )}
        </svg>
      </div>
      {tooltip && (
        <div className="mt-1 text-xs text-gray-600">
          <span className="font-medium text-gray-900">{tooltip.label}</span>
          {' — '}
          <span className="text-green-700">{tooltip.clicks} clicks</span>
          <span className="ml-2 text-violet-600">{tooltip.impressions.toLocaleString()} impressions</span>
        </div>
      )}
      <div className="mt-2 flex gap-4 text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded-sm" style={{ backgroundColor: GREEN }} />
          Clicks
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded-sm" style={{ backgroundColor: VIOLET }} />
          Impressions
        </span>
      </div>
    </Card>
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
    <Card className="overflow-x-auto">
      <SectionHeading>{title}</SectionHeading>
      {rows.length === 0 ? (
        <p className="py-4 text-sm text-gray-400">No data yet — GSC needs a few days to populate</p>
      ) : (
        <>
          {/* Header */}
          <div className="mb-2 flex min-w-0 items-center gap-2 px-1 text-[10px] uppercase tracking-wider text-gray-400">
            <span className="flex-1">Query</span>
            <span className="w-12 text-right">Clicks</span>
            <span className="hidden w-14 text-right sm:block">Impr</span>
            <span className="hidden w-12 text-right md:block">CTR</span>
            <span className="w-10 text-right">Pos</span>
          </div>
          <div className="space-y-1">
            {rows.map((row, i) => (
              <div key={i} className="group flex items-center gap-2 rounded px-1 py-1.5 text-sm hover:bg-gray-50">
                <span className="w-4 shrink-0 text-right font-mono text-xs text-gray-300">{i + 1}</span>
                <span className="flex-1 truncate text-gray-700 group-hover:text-gray-900" title={row.name}>{row.name}</span>
                <span className="w-12 text-right font-medium tabular-nums text-green-700">{row.clicks}</span>
                <span className="hidden w-14 text-right tabular-nums text-violet-600 sm:block">{row.impressions.toLocaleString()}</span>
                <span className="hidden w-12 text-right tabular-nums text-gray-500 md:block">{row.ctr}%</span>
                <span className={`w-10 text-right font-medium tabular-nums ${row.position <= 10 ? 'text-green-700' : row.position <= 30 ? 'text-amber-600' : 'text-red-500'}`}>
                  {row.position}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </Card>
  );
}
