import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { jwtVerify } from 'jose';

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

function getSearchConsoleClient() {
  const clientEmail = process.env.GSC_CLIENT_EMAIL;
  const privateKey = process.env.GSC_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!clientEmail || !privateKey) {
    throw new Error('GSC credentials not configured');
  }

  const auth = new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ['https://www.googleapis.com/auth/webmasters.readonly'],
  });

  return google.searchconsole({ version: 'v1', auth });
}

export async function GET(request: NextRequest) {
  if (!(await verifyAdmin(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const range = request.nextUrl.searchParams.get('range') || '7d';
  const siteUrl = process.env.GSC_SITE_URL || 'https://lindysfive.com';

  // Calculate date range
  const endDate = new Date();
  endDate.setDate(endDate.getDate() - 1); // GSC data is delayed ~2 days
  const startDate = new Date(endDate);
  const days = range === '30d' ? 30 : range === '7d' ? 7 : 7;
  startDate.setDate(startDate.getDate() - days);

  // Previous period for comparison
  const prevEndDate = new Date(startDate);
  prevEndDate.setDate(prevEndDate.getDate() - 1);
  const prevStartDate = new Date(prevEndDate);
  prevStartDate.setDate(prevStartDate.getDate() - days);

  const fmt = (d: Date) => d.toISOString().split('T')[0];

  try {
    const searchconsole = getSearchConsoleClient();

    // Fetch current period, previous period, top queries, top pages, and daily breakdown in parallel
    const [currentRes, prevRes, queriesRes, pagesRes, dailyRes] = await Promise.all([
      // Current period totals
      searchconsole.searchanalytics.query({
        siteUrl,
        requestBody: {
          startDate: fmt(startDate),
          endDate: fmt(endDate),
          dimensions: [],
        },
      }),
      // Previous period totals
      searchconsole.searchanalytics.query({
        siteUrl,
        requestBody: {
          startDate: fmt(prevStartDate),
          endDate: fmt(prevEndDate),
          dimensions: [],
        },
      }),
      // Top queries
      searchconsole.searchanalytics.query({
        siteUrl,
        requestBody: {
          startDate: fmt(startDate),
          endDate: fmt(endDate),
          dimensions: ['query'],
          rowLimit: 20,
        },
      }),
      // Top pages
      searchconsole.searchanalytics.query({
        siteUrl,
        requestBody: {
          startDate: fmt(startDate),
          endDate: fmt(endDate),
          dimensions: ['page'],
          rowLimit: 15,
        },
      }),
      // Daily breakdown
      searchconsole.searchanalytics.query({
        siteUrl,
        requestBody: {
          startDate: fmt(startDate),
          endDate: fmt(endDate),
          dimensions: ['date'],
        },
      }),
    ]);

    // Parse current totals
    const current = currentRes.data.rows?.[0] || { clicks: 0, impressions: 0, ctr: 0, position: 0 };
    const prev = prevRes.data.rows?.[0] || { clicks: 0, impressions: 0, ctr: 0, position: 0 };

    // Calculate changes
    const clicksChange = (prev.clicks ?? 0) > 0
      ? Math.round((((current.clicks ?? 0) - (prev.clicks ?? 0)) / (prev.clicks ?? 1)) * 100)
      : null;
    const impressionsChange = (prev.impressions ?? 0) > 0
      ? Math.round((((current.impressions ?? 0) - (prev.impressions ?? 0)) / (prev.impressions ?? 1)) * 100)
      : null;

    // Parse top queries
    const queries = (queriesRes.data.rows || []).map((row) => ({
      query: row.keys?.[0] || '',
      clicks: row.clicks || 0,
      impressions: row.impressions || 0,
      ctr: Math.round((row.ctr || 0) * 100 * 10) / 10,
      position: Math.round((row.position || 0) * 10) / 10,
    }));

    // Parse top pages
    const pages = (pagesRes.data.rows || []).map((row) => {
      const url = row.keys?.[0] || '';
      // Extract path from full URL
      let path = url;
      try { path = new URL(url).pathname; } catch { /* keep as-is */ }
      return {
        page: path,
        clicks: row.clicks || 0,
        impressions: row.impressions || 0,
        ctr: Math.round((row.ctr || 0) * 100 * 10) / 10,
        position: Math.round((row.position || 0) * 10) / 10,
      };
    });

    // Parse daily data for chart
    const daily = (dailyRes.data.rows || [])
      .sort((a, b) => (a.keys?.[0] || '').localeCompare(b.keys?.[0] || ''))
      .map((row) => ({
        date: row.keys?.[0]?.slice(5) || '', // MM-DD
        clicks: row.clicks || 0,
        impressions: row.impressions || 0,
      }));

    return NextResponse.json({
      overview: {
        clicks: current.clicks || 0,
        impressions: current.impressions || 0,
        ctr: Math.round((current.ctr || 0) * 100 * 10) / 10,
        position: Math.round((current.position || 0) * 10) / 10,
        clicksChange,
        impressionsChange,
      },
      queries,
      pages,
      daily,
      dateRange: {
        start: fmt(startDate),
        end: fmt(endDate),
      },
    });
  } catch (error) {
    console.error('GSC API error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed to fetch GSC data', details: message }, { status: 500 });
  }
}
