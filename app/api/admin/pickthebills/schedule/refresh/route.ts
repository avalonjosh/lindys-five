import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/utils/adminAuth';
import { ingestBillsSchedule } from '@/lib/pickthebills/schedule';

// On-demand schedule ingest (same logic the cron runs). Idempotent.
export async function POST(request: NextRequest) {
  if (!(await verifyAdmin(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await ingestBillsSchedule();
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('Schedule refresh failed:', error);
    return NextResponse.json({ error: 'Failed to refresh schedule' }, { status: 500 });
  }
}
