import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { kv } from '@vercel/kv';

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

export async function POST(request: NextRequest) {
  if (!(await verifyAdmin(request))) {
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
