import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import { verifyAdmin } from '@/lib/adminAuth';
import { HEALTH_LAST_KEY, runAndStoreHealthReport, type HealthReport } from '@/lib/health/report';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/** Latest site health results for the admin Overview. */
export async function GET(request: NextRequest) {
  if (!(await verifyAdmin(request))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return NextResponse.json((await kv.get<HealthReport>(HEALTH_LAST_KEY)) ?? null);
}

/** Run the checks now (no email). */
export async function POST(request: NextRequest) {
  if (!(await verifyAdmin(request))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return NextResponse.json(await runAndStoreHealthReport());
}
