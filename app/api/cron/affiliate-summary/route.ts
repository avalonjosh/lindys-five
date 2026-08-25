import { NextRequest, NextResponse } from 'next/server';
import { sendAffiliateWeeklySummary, loadAffiliateWeeklyData, renderAffiliateWeeklyEmail } from '@/lib/affiliateSummaryEmail';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Weekly affiliate summary email to the site owner (Mondays, 9am ET via vercel.json).
 * `?preview=1` returns the rendered HTML instead of sending, for checking the layout.
 */
export async function GET(request: NextRequest) {
  if (request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    if (request.nextUrl.searchParams.get('preview') === '1') {
      const { html } = renderAffiliateWeeklyEmail(await loadAffiliateWeeklyData());
      return new NextResponse(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    }
    const result = await sendAffiliateWeeklySummary();
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('affiliate-summary failed:', error);
    return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 });
  }
}
