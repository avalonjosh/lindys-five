import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import { getDateKey } from '@/lib/analytics';

export async function GET(request: NextRequest) {
  if (request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const deleted: string[] = [];
  const pipeline = kv.pipeline();

  // Delete hourly keys older than 7 days
  for (let i = 8; i <= 14; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateKey = getDateKey(d);
    for (let h = 0; h < 24; h++) {
      const hh = String(h).padStart(2, '0');
      const key = `analytics:pv:hourly:${dateKey}:${hh}`;
      pipeline.del(key);
      deleted.push(key);
    }
  }

  // Delete daily keys older than 90 days
  for (let i = 91; i <= 97; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateKey = getDateKey(d);
    const keysToDelete = [
      `analytics:pv:${dateKey}`,
      `analytics:uv:${dateKey}`,
      `analytics:top:pages:${dateKey}`,
      `analytics:top:referrers:${dateKey}`,
      `analytics:top:countries:${dateKey}`,
      `analytics:top:cities:${dateKey}`,
      `analytics:top:devices:${dateKey}`,
      `analytics:top:browsers:${dateKey}`,
      `analytics:top:teams:${dateKey}`,
      `analytics:top:utm_source:${dateKey}`,
      `analytics:top:utm_medium:${dateKey}`,
      `analytics:top:utm_campaign:${dateKey}`,
      `analytics:clicks:${dateKey}`,
      `analytics:sessions:${dateKey}`,
      `analytics:bounces:${dateKey}`,
      `analytics:duration:sum:${dateKey}`,
      `analytics:duration:count:${dateKey}`,
      `analytics:new_visitors:${dateKey}`,
    ];
    for (const key of keysToDelete) {
      pipeline.del(key);
      deleted.push(key);
    }
  }

  // Trim alltime sorted sets
  pipeline.zremrangebyrank('analytics:top:pages:alltime', 0, -201);
  pipeline.zremrangebyrank('analytics:top:referrers:alltime', 0, -101);
  pipeline.zremrangebyrank('analytics:clicks:alltime', 0, -101);

  await pipeline.exec();

  return NextResponse.json({ ok: true, cleaned: deleted.length });
}
