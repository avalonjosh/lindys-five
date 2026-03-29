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
    const { type, path, referrer, target, label, duration, sessionPages, utm } = body;

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
    const { device } = parseUserAgent(ua);
    const visitorId = await hashVisitorId(ip, ua, dateKey, salt);
    const referrerDomain = parseReferrerDomain(referrer);

    const pipeline = kv.pipeline();

    if (type === 'pageview') {
      // Time-series
      pipeline.incr(`analytics:pv:${dateKey}`);
      pipeline.pfadd(`analytics:uv:${dateKey}`, visitorId);
      pipeline.incr(`analytics:pv:hourly:${dateKey}:${hourKey}`);

      // Leaderboards (daily sorted sets)
      pipeline.zincrby(`analytics:top:pages:${dateKey}`, 1, path);
      pipeline.zincrby(`analytics:top:devices:${dateKey}`, 1, device);
      pipeline.zincrby(`analytics:top:countries:${dateKey}`, 1, country);

      if (referrerDomain !== 'direct') {
        pipeline.zincrby(`analytics:top:referrers:${dateKey}`, 1, referrerDomain);
      }

      // Team tracking
      const team = extractTeamFromPath(path);
      if (team) {
        pipeline.zincrby(`analytics:top:teams:${dateKey}`, 1, team);
      }

      // All-time total pageviews (single counter, cheap)
      pipeline.incr(`analytics:total:pv`);

      // UTM tracking (source only)
      if (utm?.source) {
        pipeline.zincrby(`analytics:top:utm_source:${dateKey}`, 1, utm.source);
      }

      // Bounce tracking: if sessionPages === 1, this is potentially a bounce
      if (sessionPages === 1) {
        pipeline.incr(`analytics:sessions:${dateKey}`);
      }
    } else if (type === 'exit') {
      // Duration tracking
      if (duration && duration > 0 && duration < 3600) {
        pipeline.incrby(`analytics:duration:sum:${dateKey}`, duration);
        pipeline.incr(`analytics:duration:count:${dateKey}`);
      }

      // Bounce detection: if user exits with sessionPages === 1, it's a bounce
      if (sessionPages === 1) {
        pipeline.incr(`analytics:bounces:${dateKey}`);
      }
    } else if (type === 'click' && target) {
      const clickKey = label ? `${target}:${label}` : target;
      pipeline.zincrby(`analytics:clicks:${dateKey}`, 1, clickKey);
    }

    await pipeline.exec();

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
