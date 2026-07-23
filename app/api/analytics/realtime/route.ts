import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/adminAuth';
import { fetchRealtime, hasGA4Credentials } from '@/lib/ga4';

export async function GET(request: NextRequest) {
  if (!(await verifyAdmin(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!hasGA4Credentials()) {
    return NextResponse.json({
      error: 'GA4 credentials missing (GSC_CLIENT_EMAIL / GSC_PRIVATE_KEY / GA4_PROPERTY_ID)',
      activeUsers: 0,
      pages: [],
    });
  }

  try {
    const data = await fetchRealtime();
    return NextResponse.json(data);
  } catch (error) {
    console.error('GA4 realtime error:', error);
    return NextResponse.json({
      error: 'GA4 credentials missing or invalid',
      activeUsers: 0,
      pages: [],
    });
  }
}
