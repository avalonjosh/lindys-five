import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/adminAuth';
import { fetchOverview, hasGA4Credentials } from '@/lib/ga4';

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

  const range = request.nextUrl.searchParams.get('range') || 'today';

  if (!hasGA4Credentials()) {
    return NextResponse.json({
      error: 'GA4 credentials missing (GSC_CLIENT_EMAIL / GSC_PRIVATE_KEY / GA4_PROPERTY_ID)',
      ...EMPTY_OVERVIEW,
    });
  }

  try {
    const data = await fetchOverview(range);
    return NextResponse.json(data);
  } catch (error) {
    console.error('GA4 overview error:', error);
    return NextResponse.json({
      error: 'GA4 credentials missing or invalid',
      ...EMPTY_OVERVIEW,
    });
  }
}
