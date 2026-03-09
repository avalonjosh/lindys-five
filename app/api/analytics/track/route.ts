import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import {
  isBot,
  parseUserAgent,
  hashVisitorId,
  hashPersistentId,
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
    const city = request.headers.get('x-vercel-ip-city') || 'unknown';
    const salt = process.env.ANALYTICS_SALT || 'default-salt';
    const dateKey = getDateKey();
    const hourKey = getHourKey();
    const { device, browser } = parseUserAgent(ua);
    const visitorId = await hashVisitorId(ip, ua, dateKey, salt);
    const persistentId = await hashPersistentId(ip, ua, salt);
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
      pipeline.zincrby(`analytics:top:browsers:${dateKey}`, 1, browser);
      pipeline.zincrby(`analytics:top:countries:${dateKey}`, 1, country);
      if (city !== 'unknown') {
        pipeline.zincrby(`analytics:top:cities:${dateKey}`, 1, city);
      }

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

      // Live presence: set visitor key with 60s TTL
      pipeline.set(`analytics:live:${visitorId}`, path, { ex: 60 });

      // Live feed: push event to list (capped at 50)
      const feedEntry = JSON.stringify({
        path,
        country,
        city: city !== 'unknown' ? city : '',
        device,
        time: new Date().toISOString(),
      });
      pipeline.lpush('analytics:livefeed', feedEntry);
      pipeline.ltrim('analytics:livefeed', 0, 49);

      // New vs returning: check if persistent ID seen before
      // We use a set of all-time persistent IDs
      pipeline.sismember('analytics:visitors:seen', persistentId);
      pipeline.sadd('analytics:visitors:seen', persistentId);

      // UTM tracking
      if (utm?.source) {
        pipeline.zincrby(`analytics:top:utm_source:${dateKey}`, 1, utm.source);
      }
      if (utm?.medium) {
        pipeline.zincrby(`analytics:top:utm_medium:${dateKey}`, 1, utm.medium);
      }
      if (utm?.campaign) {
        pipeline.zincrby(`analytics:top:utm_campaign:${dateKey}`, 1, utm.campaign);
      }

      // Bounce tracking: if sessionPages === 1, this is potentially a bounce
      // We track total sessions and bounces separately
      if (sessionPages === 1) {
        pipeline.incr(`analytics:sessions:${dateKey}`);
      }
    } else if (type === 'exit') {
      // Duration tracking
      if (duration && duration > 0 && duration < 3600) {
        // Add to duration sum and count for averaging
        pipeline.incrby(`analytics:duration:sum:${dateKey}`, duration);
        pipeline.incr(`analytics:duration:count:${dateKey}`);
      }

      // Bounce detection: if user exits with sessionPages === 1, it's a bounce
      if (sessionPages === 1) {
        pipeline.incr(`analytics:bounces:${dateKey}`);
      }

      // Refresh live presence
      pipeline.set(`analytics:live:${visitorId}`, path, { ex: 60 });
    } else if (type === 'click' && target) {
      const clickKey = label ? `${target}:${label}` : target;
      pipeline.zincrby(`analytics:clicks:${dateKey}`, 1, clickKey);
      pipeline.zincrby(`analytics:clicks:alltime`, 1, clickKey);
    }

    const results = await pipeline.exec();

    // For pageview: check new vs returning from sismember result
    if (type === 'pageview') {
      // sismember result is at a variable position — we need to find it
      // Instead, fire a separate command after pipeline
      // The sismember was already in the pipeline; if result is 0, it's new
      // We track new/returning in a separate pipeline to avoid index complexity
      const isSeen = await kv.sismember('analytics:visitors:seen', persistentId);
      // isSeen will be 1 now (we just added), but we check if the PREVIOUS state was 0
      // Since we sadd in the pipeline, we need the sismember result from pipeline
      // Let's simplify: track daily new visitors via HyperLogLog
      // and track "first seen today" via a daily set
      const pipeline2 = kv.pipeline();
      pipeline2.sadd(`analytics:new_visitors:${dateKey}`, persistentId);
      pipeline2.scard(`analytics:new_visitors:${dateKey}`);
      await pipeline2.exec();
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
