import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/adminAuth';
import { fetchTimeseries, hasGA4Credentials } from '@/lib/ga4';
import { resolveAnalyticsWindow } from '@/lib/analyticsRange';

const EMPTY_TIMESERIES = { labels: [], views: [], visitors: null, timezone: 'ET' };

export async function GET(request: NextRequest) {
  if (!(await verifyAdmin(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const window = resolveAnalyticsWindow(request.nextUrl.searchParams);
  if ('error' in window) return NextResponse.json({ error: window.error, ...EMPTY_TIMESERIES }, { status: 400 });

  if (!hasGA4Credentials()) {
    return NextResponse.json({
      error: 'GA4 credentials missing (GSC_CLIENT_EMAIL / GSC_PRIVATE_KEY / GA4_PROPERTY_ID)',
      ...EMPTY_TIMESERIES,
    });
  }

  try {
    const data = await fetchTimeseries(window);
    return NextResponse.json(data);
  } catch (error) {
    console.error('GA4 timeseries error:', error);
    return NextResponse.json({
      error: 'GA4 credentials missing or invalid',
      ...EMPTY_TIMESERIES,
    });
  }
}
