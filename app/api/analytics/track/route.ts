import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import {
  isBot,
  extractTeamFromPath,
  getDateKey,
} from '@/lib/analytics';
import type { AnalyticsEvent } from '@/lib/analytics';

export async function POST(request: NextRequest) {
  try {
    const body: AnalyticsEvent = await request.json();
    const { type, path, target, label } = body;

    if (!path) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }

    const ua = request.headers.get('user-agent') || '';
    if (isBot(ua)) {
      return NextResponse.json({ ok: true });
    }

    const dateKey = getDateKey();

    // Only write KV-exclusive data (team views + clicks).
    // GA4 handles pageviews, visitors, devices, countries, referrers, UTM, bounce, duration.
    const pipeline = kv.pipeline();
    let hasCommands = false;

    if (type === 'pageview') {
      const team = extractTeamFromPath(path);
      if (team) {
        pipeline.zincrby(`analytics:top:teams:${dateKey}`, 1, team);
        hasCommands = true;
      }
    } else if (type === 'click' && target) {
      const clickKey = label ? `${target}:${label}` : target;
      pipeline.zincrby(`analytics:clicks:${dateKey}`, 1, clickKey);
      hasCommands = true;
    }

    if (hasCommands) {
      await pipeline.exec();
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
