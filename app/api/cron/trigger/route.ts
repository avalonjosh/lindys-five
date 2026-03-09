import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

// Import GET handlers from each cron route
import { GET as weeklyRoundupHandler } from '@/app/api/cron/weekly-roundup/route';
import { GET as newsScanHandler } from '@/app/api/cron/news-scan/route';
import { GET as gameRecapHandler } from '@/app/api/cron/game-recap/route';
import { GET as setRecapHandler } from '@/app/api/cron/set-recap/route';
import { GET as billsNewsScanHandler } from '@/app/api/cron/bills-news-scan/route';
import { GET as billsWeeklyRoundupHandler } from '@/app/api/cron/bills-weekly-roundup/route';
import { GET as billsGameRecapHandler } from '@/app/api/cron/bills-game-recap/route';

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
  // Bills
  'bills-news': billsNewsScanHandler,
  'bills-weekly': billsWeeklyRoundupHandler,
  'bills-game-recap': billsGameRecapHandler
};

const validTypes = Object.keys(handlers);

export async function POST(request: NextRequest) {
  const isAdmin = await verifyAdmin(request);
  if (!isAdmin) {
    return NextResponse.json({ error: 'Unauthorized - admin access required' }, { status: 401 });
  }

  const body = await request.json();
  const { type, setNumber, force } = body;

  if (!type || !validTypes.includes(type)) {
    return NextResponse.json({ error: 'Invalid trigger type', validTypes }, { status: 400 });
  }

  try {
    const cronHandler = handlers[type];

    // Build a URL with query params for set-recap
    const url = new URL(request.url);
    url.pathname = `/api/cron/${type === 'weekly' ? 'weekly-roundup' : type === 'news' ? 'news-scan' : type}`;
    if (type === 'set-recap' && setNumber) {
      url.searchParams.set('setNumber', String(setNumber));
    }
    if (type === 'set-recap' && force) {
      url.searchParams.set('force', 'true');
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
