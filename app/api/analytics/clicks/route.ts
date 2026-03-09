import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import { jwtVerify } from 'jose';
import { getDateKey } from '@/lib/analytics';

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

export async function GET(request: NextRequest) {
  if (!(await verifyAdmin(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const params = request.nextUrl.searchParams;
  const range = params.get('range') || 'today';
  const limit = Math.min(parseInt(params.get('limit') || '20'), 100);

  if (range === 'alltime') {
    const data = await kv.zrange('analytics:clicks:alltime', 0, limit - 1, { rev: true, withScores: true }) as (string | number)[];
    const items = parseZrangeResult(data);
    return NextResponse.json({ items });
  }

  const days = range === '7d' ? 7 : range === '30d' ? 30 : 1;

  if (days === 1) {
    const dateKey = getDateKey();
    const data = await kv.zrange(`analytics:clicks:${dateKey}`, 0, limit - 1, { rev: true, withScores: true }) as (string | number)[];
    const items = parseZrangeResult(data);
    return NextResponse.json({ items });
  }

  // Multi-day merge
  const merged = new Map<string, number>();
  const pipeline = kv.pipeline();
  for (let i = 0; i < days; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    pipeline.zrange(`analytics:clicks:${getDateKey(d)}`, 0, -1, { rev: true, withScores: true });
  }

  const results = await pipeline.exec();
  for (const result of results) {
    const data = result as (string | number)[];
    if (!data || !Array.isArray(data)) continue;
    for (let i = 0; i < data.length; i += 2) {
      const name = String(data[i]);
      const count = Number(data[i + 1]) || 0;
      merged.set(name, (merged.get(name) || 0) + count);
    }
  }

  const items = Array.from(merged.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);

  return NextResponse.json({ items });
}

function parseZrangeResult(data: (string | number)[]): { name: string; count: number }[] {
  const items: { name: string; count: number }[] = [];
  if (!data || !Array.isArray(data)) return items;
  for (let i = 0; i < data.length; i += 2) {
    items.push({ name: String(data[i]), count: Number(data[i + 1]) || 0 });
  }
  return items;
}
