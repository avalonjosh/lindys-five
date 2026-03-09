import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import {
  isBot,
  parseUserAgent,
  hashVisitorId,
  parseReferrerDomain,
  extractTeamFromPath,
  getDateKey,
  getHourKey,
} from '@/lib/analytics';
import type { AnalyticsEvent } from '@/lib/analytics';

export async function POST(request: NextRequest) {
  try {
    const body: AnalyticsEvent = await request.json();
    const { type, path, referrer, target, label } = body;

    if (!path) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }

    const ua = request.headers.get('user-agent') || '';
    if (isBot(ua)) {
      return NextResponse.json({ ok: true });
    }

    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '0.0.0.0';
    const country = request.headers.get('x-vercel-ip-country') || 'unknown';
    const salt = process.env.ANALYTICS_SALT || 'default-salt';
    const dateKey = getDateKey();
    const hourKey = getHourKey();
    const { device, browser } = parseUserAgent(ua);
    const visitorId = await hashVisitorId(ip, ua, dateKey, salt);
    const referrerDomain = parseReferrerDomain(referrer);

    const pipeline = kv.pipeline();

    if (type === 'pageview') {
      // Time-series
      pipeline.incr(`analytics:pv:${dateKey}`);
      // HyperLogLog for unique visitors
      pipeline.pfadd(`analytics:uv:${dateKey}`, visitorId);
      // Hourly views
      pipeline.incr(`analytics:pv:hourly:${dateKey}:${hourKey}`);

      // Leaderboards (daily sorted sets)
      pipeline.zincrby(`analytics:top:pages:${dateKey}`, 1, path);
      pipeline.zincrby(`analytics:top:devices:${dateKey}`, 1, device);
      pipeline.zincrby(`analytics:top:browsers:${dateKey}`, 1, browser);
      pipeline.zincrby(`analytics:top:countries:${dateKey}`, 1, country);

      if (referrerDomain !== 'direct') {
        pipeline.zincrby(`analytics:top:referrers:${dateKey}`, 1, referrerDomain);
        pipeline.zincrby(`analytics:top:referrers:alltime`, 1, referrerDomain);
      }

      // Team tracking
      const team = extractTeamFromPath(path);
      if (team) {
        pipeline.zincrby(`analytics:top:teams:${dateKey}`, 1, team);
      }

      // All-time aggregates
      pipeline.incr(`analytics:total:pv`);
      pipeline.zincrby(`analytics:top:pages:alltime`, 1, path);
    } else if (type === 'click' && target) {
      const clickKey = label ? `${target}:${label}` : target;
      pipeline.zincrby(`analytics:clicks:${dateKey}`, 1, clickKey);
      pipeline.zincrby(`analytics:clicks:alltime`, 1, clickKey);
    }

    await pipeline.exec();

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
