import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/adminAuth';
import { fetchTimeseries, hasGA4Credentials } from '@/lib/ga4';

const EMPTY_TIMESERIES = { labels: [], views: [], visitors: null, timezone: 'ET' };

export async function GET(request: NextRequest) {
  if (!(await verifyAdmin(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const range = request.nextUrl.searchParams.get('range') || 'today';

  if (!hasGA4Credentials()) {
    return NextResponse.json({
      error: 'GA4 credentials missing (GSC_CLIENT_EMAIL / GSC_PRIVATE_KEY / GA4_PROPERTY_ID)',
      ...EMPTY_TIMESERIES,
    });
  }

  try {
    const data = await fetchTimeseries(range);
    return NextResponse.json(data);
  } catch (error) {
    console.error('GA4 timeseries error:', error);
    return NextResponse.json({
      error: 'GA4 credentials missing or invalid',
      ...EMPTY_TIMESERIES,
    });
  }
}
