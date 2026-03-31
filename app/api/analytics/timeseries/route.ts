import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { fetchTimeseries } from '@/lib/ga4';

async function verifyAdmin(request: NextRequest): Promise<boolean> {
  const token = request.cookies.get('admin_token')?.value;
  if (!token) return false;
  try {
    const secret = new TextEncoder().encode(process.env.ADMIN_SESSION_SECRET);
    await jwtVerify(token, secret);
    return true;
  } catch {
    return false;
  }
}

export async function GET(request: NextRequest) {
  if (!(await verifyAdmin(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const range = request.nextUrl.searchParams.get('range') || 'today';

  try {
    const data = await fetchTimeseries(range);
    return NextResponse.json(data);
  } catch (error) {
    console.error('GA4 timeseries error:', error);
    return NextResponse.json({ labels: [], views: [], visitors: null, timezone: 'ET' });
  }
}
