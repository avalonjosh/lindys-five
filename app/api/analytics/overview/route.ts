import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/adminAuth';
import { fetchOverview, hasGA4Credentials } from '@/lib/ga4';
import { resolveAnalyticsWindow } from '@/lib/analyticsRange';

const EMPTY_OVERVIEW = {
  totalViews: 0,
  uniqueVisitors: 0,
  viewsChange: null,
  bounceRate: null,
  avgDuration: null,
  topPage: null,
  topReferrer: null,
};

export async function GET(request: NextRequest) {
  if (!(await verifyAdmin(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const window = resolveAnalyticsWindow(request.nextUrl.searchParams);
  if ('error' in window) return NextResponse.json({ error: window.error, ...EMPTY_OVERVIEW }, { status: 400 });

  if (!hasGA4Credentials()) {
    return NextResponse.json({
      error: 'GA4 credentials missing (GSC_CLIENT_EMAIL / GSC_PRIVATE_KEY / GA4_PROPERTY_ID)',
      ...EMPTY_OVERVIEW,
    });
  }

  try {
    const data = await fetchOverview(window);
    return NextResponse.json(data);
  } catch (error) {
    console.error('GA4 overview error:', error);
    return NextResponse.json({
      error: 'GA4 credentials missing or invalid',
      ...EMPTY_OVERVIEW,
    });
  }
}
