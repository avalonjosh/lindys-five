import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { fetchRealtime } from '@/lib/ga4';

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

  try {
    const data = await fetchRealtime();
    return NextResponse.json(data);
  } catch (error) {
    console.error('GA4 realtime error:', error);
    return NextResponse.json({
      viewsThisHour: 0,
      viewsLastHour: 0,
      activePages: [],
      liveVisitors: 0,
      liveFeed: [],
    });
  }
}
