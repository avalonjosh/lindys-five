import { NextRequest, NextResponse } from 'next/server';
import { runAndStoreHealthReport, sendHealthEmail, renderHealthEmail } from '@/lib/health/report';
import { withCronHealth } from '@/lib/health/cronRuns';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/**
 * Daily site health check (11:30am ET via vercel.json). Emails the owner when
 * any check fails, and on Mondays always (the weekly all-clear; if it doesn't
 * arrive, this job itself has stopped). `?preview=1` returns the email HTML
 * without sending; `?email=0` runs without emailing.
 */
async function handler(request: NextRequest) {
  if (request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const report = await runAndStoreHealthReport();
  const params = request.nextUrl.searchParams;
  if (params.get('preview') === '1') {
    return new NextResponse(renderHealthEmail(report).html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  }
  const monday = new Date().toLocaleDateString('en-US', { timeZone: 'America/New_York', weekday: 'short' }) === 'Mon';
  const shouldEmail = params.get('email') !== '0' && (report.counts.fail > 0 || monday);
  const emailId = shouldEmail ? await sendHealthEmail(report) : undefined;
  return NextResponse.json({ success: true, counts: report.counts, emailed: !!emailId });
}

export const GET = withCronHealth('health-check', handler);
