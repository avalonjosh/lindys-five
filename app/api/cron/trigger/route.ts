import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

// Import GET handlers from each cron route
import { GET as weeklyRoundupHandler } from '@/app/api/cron/weekly-roundup/route';
import { GET as newsScanHandler } from '@/app/api/cron/news-scan/route';
import { GET as gameRecapHandler } from '@/app/api/cron/game-recap/route';
import { GET as setRecapHandler } from '@/app/api/cron/set-recap/route';
import { GET as playoffGameRecapHandler } from '@/app/api/cron/playoff-game-recap/route';
import { GET as seriesRecapHandler } from '@/app/api/cron/series-recap/route';
import { GET as billsNewsScanHandler } from '@/app/api/cron/bills-news-scan/route';
import { GET as billsWeeklyRoundupHandler } from '@/app/api/cron/bills-weekly-roundup/route';
import { GET as billsGameRecapHandler } from '@/app/api/cron/bills-game-recap/route';
import { GET as weeklyDigestHandler } from '@/app/api/cron/weekly-digest/route';
import { GET as mlbGameRecapHandler } from '@/app/api/cron/email-mlb-game-recap/route';
import { GET as mlbSetRecapHandler } from '@/app/api/cron/email-mlb-set-recap/route';
import { GET as emailGameRecapHandler } from '@/app/api/cron/email-game-recap/route';
import { GET as emailSetRecapHandler } from '@/app/api/cron/email-set-recap/route';
import { GET as analyticsCleanupHandler } from '@/app/api/cron/analytics-cleanup/route';

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

const handlers: Record<string, (request: NextRequest) => Promise<NextResponse>> = {
  // Sabres
  'weekly': weeklyRoundupHandler,
  'news': newsScanHandler,
  'game-recap': gameRecapHandler,
  'set-recap': setRecapHandler,
  'playoff-game-recap': playoffGameRecapHandler,
  'series-recap': seriesRecapHandler,
  // Bills
  'bills-news': billsNewsScanHandler,
  'bills-weekly': billsWeeklyRoundupHandler,
  'bills-game-recap': billsGameRecapHandler,
  // Email programs (newsletter admin)
  'weekly-digest': weeklyDigestHandler,
  'email-mlb-game-recap': mlbGameRecapHandler,
  'email-mlb-set-recap': mlbSetRecapHandler,
  'email-game-recap': emailGameRecapHandler,
  'email-set-recap': emailSetRecapHandler,
  // Maintenance
  'analytics-cleanup': analyticsCleanupHandler,
};

// Trigger types whose route directory differs from the type name.
const PATH_ALIASES: Record<string, string> = {
  'weekly': 'weekly-roundup',
  'news': 'news-scan',
  'bills-news': 'bills-news-scan',
  'bills-weekly': 'bills-weekly-roundup',
};

const validTypes = Object.keys(handlers);

export async function POST(request: NextRequest) {
  const isAdmin = await verifyAdmin(request);
  if (!isAdmin) {
    return NextResponse.json({ error: 'Unauthorized - admin access required' }, { status: 401 });
  }

  const body = await request.json();
  const { type, setNumber, force, test, preview } = body;

  if (!type || !validTypes.includes(type)) {
    return NextResponse.json({ error: 'Invalid trigger type', validTypes }, { status: 400 });
  }

  try {
    const cronHandler = handlers[type];

    // Build a URL with query params for set-recap
    const url = new URL(request.url);
    url.pathname = `/api/cron/${PATH_ALIASES[type] ?? type}`;
    if (type === 'set-recap' && setNumber) {
      url.searchParams.set('setNumber', String(setNumber));
    }
    if (['set-recap', 'playoff-game-recap', 'series-recap'].includes(type) && force) {
      url.searchParams.set('force', 'true');
    }
    // Email-program crons: test sends to a single address; preview renders without sending.
    if (test) {
      url.searchParams.set('test', String(test));
    }
    if (preview) {
      url.searchParams.set('preview', '1');
    }

    // Create a new NextRequest with the cron authorization header
    const cronRequest = new NextRequest(url, {
      method: 'GET',
      headers: new Headers({
        'authorization': `Bearer ${process.env.CRON_SECRET}`
      })
    });

    // Call the cron handler directly
    const response = await cronHandler(cronRequest);
    const responseData = await response.json();

    return NextResponse.json({
      triggered: type,
      ...responseData
    }, { status: response.status });

  } catch (error: any) {
    console.error(`Failed to trigger ${type}:`, error);
    return NextResponse.json({
      error: `Failed to trigger ${type}`,
      message: error.message
    }, { status: 500 });
  }
}
