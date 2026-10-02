import { google, analyticsdata_v1beta } from 'googleapis';
import type { AnalyticsWindow } from './analyticsRange';

type Schema$Row = analyticsdata_v1beta.Schema$Row;

export function hasGA4Credentials(): boolean {
  return Boolean(
    process.env.GSC_CLIENT_EMAIL &&
    process.env.GSC_PRIVATE_KEY &&
    process.env.GA4_PROPERTY_ID
  );
}

function getGA4Client() {
  const clientEmail = process.env.GSC_CLIENT_EMAIL;
  const privateKey = process.env.GSC_PRIVATE_KEY?.replace(/\\n/g, '\n');
  const propertyId = process.env.GA4_PROPERTY_ID;

  if (!clientEmail || !privateKey) {
    throw new Error('Google service account credentials not configured (GSC_CLIENT_EMAIL / GSC_PRIVATE_KEY)');
  }
  if (!propertyId) {
    throw new Error('GA4_PROPERTY_ID env var not configured');
  }

  const auth = new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ['https://www.googleapis.com/auth/analytics.readonly'],
  });

  const analyticsData = google.analyticsdata({ version: 'v1beta', auth });

  return { analyticsData, propertyId };
}

/** 0-24 -> "7am", "12pm", "midnight". */
function hourLabel(h: number): string {
  if (h === 0 || h === 24) return 'midnight';
  return h < 12 ? `${h}am` : h === 12 ? '12pm' : `${h - 12}pm`;
}

/** Hour and minute right now in Eastern time (the GA4 property's time zone). */
function easternClock(): { hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: 'numeric', hourCycle: 'h23' }).formatToParts(new Date());
  return {
    hour: Number(parts.find((p) => p.type === 'hour')?.value ?? 0),
    minute: Number(parts.find((p) => p.type === 'minute')?.value ?? 0),
  };
}

export async function fetchOverview(w: AnalyticsWindow) {
  const { analyticsData, propertyId } = getGA4Client();
  const property = `properties/${propertyId}`;
  const dateRange = { startDate: w.start, endDate: w.end };
  const prevRange = w.prev ? { startDate: w.prev.start, endDate: w.prev.end } : null;
  // Today is compared with yesterday up to the same point in the day, not all
  // of yesterday (which made every morning look like a big drop). GA4 also
  // processes today a few hours late, so "the same point" is the last hour it
  // has views for today, not the clock.
  const sameTimeYesterday = w.start === 'today';

  const [currentRes, prevRes, topPageRes, topRefRes, todayHoursRes] = await Promise.all([
    analyticsData.properties.runReport({
      property,
      requestBody: {
        dateRanges: [dateRange],
        metrics: [
          { name: 'screenPageViews' },
          { name: 'activeUsers' },
          { name: 'bounceRate' },
          { name: 'averageSessionDuration' },
        ],
      },
    }),
    prevRange
      ? analyticsData.properties.runReport({
          property,
          requestBody: {
            dateRanges: [prevRange],
            ...(sameTimeYesterday ? { dimensions: [{ name: 'hour' }] } : {}),
            metrics: [{ name: 'screenPageViews' }],
          },
        })
      : Promise.resolve(null),
    analyticsData.properties.runReport({
      property,
      requestBody: {
        dateRanges: [dateRange],
        dimensions: [{ name: 'pagePath' }],
        metrics: [{ name: 'screenPageViews' }],
        orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
        limit: '1',
      },
    }),
    analyticsData.properties.runReport({
      property,
      requestBody: {
        dateRanges: [dateRange],
        dimensions: [{ name: 'sessionSource' }],
        metrics: [{ name: 'sessions' }],
        orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
        limit: '5',
      },
    }),
    sameTimeYesterday
      ? analyticsData.properties.runReport({
          property,
          requestBody: { dateRanges: [dateRange], dimensions: [{ name: 'hour' }], metrics: [{ name: 'screenPageViews' }] },
        })
      : Promise.resolve(null),
  ]);

  const row = currentRes.data.rows?.[0];
  const totalViews = parseInt(row?.metricValues?.[0]?.value || '0');
  const uniqueVisitors = parseInt(row?.metricValues?.[1]?.value || '0');
  const bounceRate = parseFloat(row?.metricValues?.[2]?.value || '0');
  const avgDuration = parseFloat(row?.metricValues?.[3]?.value || '0');

  let previousViews = 0;
  let throughHour: number | null = null;
  if (sameTimeYesterday) {
    // Last hour GA4 has views for today; if that's the current hour, count
    // yesterday's matching hour by the minute.
    const hours = (todayHoursRes?.data?.rows || [])
      .filter((r) => parseInt(r.metricValues?.[0]?.value || '0') > 0)
      .map((r) => parseInt(r.dimensionValues?.[0]?.value || '0'));
    throughHour = hours.length ? Math.max(...hours) : null;
    const { hour, minute } = easternClock();
    for (const r of prevRes?.data?.rows || []) {
      if (throughHour == null) break;
      const h = parseInt(r.dimensionValues?.[0]?.value || '0');
      const v = parseInt(r.metricValues?.[0]?.value || '0');
      if (h < throughHour) previousViews += v;
      else if (h === throughHour) previousViews += throughHour === hour ? v * (minute / 60) : v;
    }
  } else {
    const prevRow = prevRes?.data?.rows?.[0];
    previousViews = prevRow ? parseInt(prevRow.metricValues?.[0]?.value || '0') : 0;
  }
  const viewsChange = previousViews > 0 && !(sameTimeYesterday && throughHour == null)
    ? Math.round(((totalViews - previousViews) / previousViews) * 100)
    : null;

  const topPageRow = topPageRes.data.rows?.[0];
  const topPage = topPageRow
    ? { name: topPageRow.dimensionValues?.[0]?.value || '', count: parseInt(topPageRow.metricValues?.[0]?.value || '0') }
    : null;

  // Find first non-direct, non-(not set) referrer
  const refRows = topRefRes.data.rows || [];
  let topReferrer = null;
  for (const r of refRows) {
    const name = r.dimensionValues?.[0]?.value || '';
    if (name && name !== '(direct)' && name !== '(not set)') {
      topReferrer = { name, count: parseInt(r.metricValues?.[0]?.value || '0') };
      break;
    }
  }

  return {
    totalViews,
    uniqueVisitors,
    viewsChange,
    /** What viewsChange compares against, for the label. */
    viewsChangeBasis: sameTimeYesterday
      ? throughHour == null ? null : `yesterday through ${hourLabel(throughHour + 1)}`
      : w.prev ? `previous ${w.days === 1 ? 'day' : `${w.days} days`}` : null,
    bounceRate: Math.round(bounceRate * 100),
    avgDuration: Math.round(avgDuration),
    topPage,
    topReferrer,
  };
}

const GA4_DIMENSION_MAP: Record<string, string> = {
  pages: 'pagePath',
  referrers: 'sessionSource',
  countries: 'country',
  devices: 'deviceCategory',
  browsers: 'browser',
  utm_source: 'firstUserSource',
  utm_medium: 'firstUserMedium',
  utm_campaign: 'firstUserCampaign',
};

const GA4_METRIC_MAP: Record<string, string> = {
  pages: 'screenPageViews',
  referrers: 'sessions',
  countries: 'sessions',
  devices: 'sessions',
  browsers: 'sessions',
  utm_source: 'sessions',
  utm_medium: 'sessions',
  utm_campaign: 'sessions',
};

export async function fetchTopItems(type: string, w: AnalyticsWindow, limit: number | string) {
  // Cities need a second dimension (country) so the flag can render and
  // same-named cities in different countries stay distinct.
  if (type === 'cities') return fetchTopCities(w, limit);

  const dimension = GA4_DIMENSION_MAP[type];
  const metric = GA4_METRIC_MAP[type];
  if (!dimension || !metric) return { items: [] };

  const { analyticsData, propertyId } = getGA4Client();
  const property = `properties/${propertyId}`;
  const dateRange = { startDate: w.start, endDate: w.end };

  const res = await analyticsData.properties.runReport({
    property,
    requestBody: {
      dateRanges: [dateRange],
      dimensions: [{ name: dimension }],
      metrics: [{ name: metric }],
      orderBys: [{ metric: { metricName: metric }, desc: true }],
      limit: String(limit),
    },
  });

  const items = (res.data.rows || []).map((row: Schema$Row) => ({
    name: row.dimensionValues?.[0]?.value || '(unknown)',
    count: parseInt(row.metricValues?.[0]?.value || '0'),
  }));

  return { items };
}

async function fetchTopCities(w: AnalyticsWindow, limit: number | string) {
  const { analyticsData, propertyId } = getGA4Client();
  const property = `properties/${propertyId}`;
  const dateRange = { startDate: w.start, endDate: w.end };

  const res = await analyticsData.properties.runReport({
    property,
    requestBody: {
      dateRanges: [dateRange],
      dimensions: [{ name: 'city' }, { name: 'countryId' }],
      metrics: [{ name: 'sessions' }],
      orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
      // Fetch extra so filtering "(not set)" still fills the list
      limit: String(Number(limit) + 5),
    },
  });

  const items = (res.data.rows || [])
    .map((row: Schema$Row) => ({
      name: row.dimensionValues?.[0]?.value || '(not set)',
      country: row.dimensionValues?.[1]?.value || '',
      count: parseInt(row.metricValues?.[0]?.value || '0'),
    }))
    .filter((i) => i.name !== '(not set)')
    .slice(0, Number(limit));

  return { items };
}

export async function fetchTimeseries(w: AnalyticsWindow) {
  const { analyticsData, propertyId } = getGA4Client();
  const property = `properties/${propertyId}`;
  const dateRange = { startDate: w.start, endDate: w.end };

  if (w.grain === 'hour') {
    const res = await analyticsData.properties.runReport({
      property,
      requestBody: {
        dateRanges: [dateRange],
        dimensions: [{ name: 'hour' }],
        metrics: [{ name: 'screenPageViews' }],
      },
    });

    const hourMap = new Map<number, number>();
    for (const row of res.data.rows || []) {
      const hour = parseInt(row.dimensionValues?.[0]?.value || '0');
      hourMap.set(hour, parseInt(row.metricValues?.[0]?.value || '0'));
    }

    const labels: string[] = [];
    const views: number[] = [];
    for (let h = 0; h < 24; h++) {
      labels.push(h === 0 ? '12am' : h < 12 ? `${h}am` : h === 12 ? '12pm' : `${h - 12}pm`);
      views.push(hourMap.get(h) || 0);
    }

    return { labels, views, visitors: null, timezone: 'ET' };
  }

  // Long windows: monthly breakdown so the chart stays readable
  if (w.grain === 'month') {
    const res = await analyticsData.properties.runReport({
      property,
      requestBody: {
        dateRanges: [dateRange],
        dimensions: [{ name: 'yearMonth' }],
        metrics: [{ name: 'screenPageViews' }, { name: 'activeUsers' }],
        orderBys: [{ dimension: { dimensionName: 'yearMonth' } }],
      },
    });

    const labels: string[] = [];
    const views: number[] = [];
    const visitors: number[] = [];
    const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    for (const row of res.data.rows || []) {
      const ym = row.dimensionValues?.[0]?.value || ''; // YYYYMM
      const m = parseInt(ym.slice(4, 6), 10);
      labels.push(`${MONTHS[m - 1] ?? ym} '${ym.slice(2, 4)}`);
      views.push(parseInt(row.metricValues?.[0]?.value || '0'));
      visitors.push(parseInt(row.metricValues?.[1]?.value || '0'));
    }
    return { labels, views, visitors, timezone: 'ET' };
  }

  // 7d or 30d — daily breakdown
  const res = await analyticsData.properties.runReport({
    property,
    requestBody: {
      dateRanges: [dateRange],
      dimensions: [{ name: 'date' }],
      metrics: [
        { name: 'screenPageViews' },
        { name: 'activeUsers' },
      ],
      orderBys: [{ dimension: { dimensionName: 'date' } }],
    },
  });

  const labels: string[] = [];
  const views: number[] = [];
  const visitors: number[] = [];

  for (const row of res.data.rows || []) {
    const dateStr = row.dimensionValues?.[0]?.value || '';
    // dateStr is YYYYMMDD format
    const m = parseInt(dateStr.slice(4, 6));
    const d = parseInt(dateStr.slice(6, 8));
    labels.push(`${m}/${d}`);
    views.push(parseInt(row.metricValues?.[0]?.value || '0'));
    visitors.push(parseInt(row.metricValues?.[1]?.value || '0'));
  }

  return { labels, views, visitors, timezone: 'ET' };
}

// Live activity (last 30 minutes): active users + top pages, via the GA4
// Realtime API. Realtime dimensions don't include pagePath, so we use
// unifiedScreenName (the page title).
export async function fetchRealtime() {
  const { analyticsData, propertyId } = getGA4Client();
  const property = `properties/${propertyId}`;

  const [totalRes, pagesRes] = await Promise.all([
    analyticsData.properties.runRealtimeReport({
      property,
      requestBody: {
        metrics: [{ name: 'activeUsers' }],
      },
    }),
    analyticsData.properties.runRealtimeReport({
      property,
      requestBody: {
        dimensions: [{ name: 'unifiedScreenName' }],
        metrics: [{ name: 'activeUsers' }],
        orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }],
        limit: '5',
      },
    }),
  ]);

  const activeUsers = parseInt(totalRes.data.rows?.[0]?.metricValues?.[0]?.value || '0');
  const pages = (pagesRes.data.rows || []).map((row: Schema$Row) => ({
    name: row.dimensionValues?.[0]?.value || '(unknown)',
    count: parseInt(row.metricValues?.[0]?.value || '0'),
  }));

  return { activeUsers, pages };
}
