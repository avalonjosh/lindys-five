import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const sendIds = await kv.zrange<string[]>('email:sends', 0, -1);
  for (const id of sendIds) {
    await kv.del(`email:send:${id}`);
  }
  if (sendIds.length > 0) {
    await kv.del('email:sends');
  }

  return NextResponse.json({ cleared: sendIds.length });
}
