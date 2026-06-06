import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import { getUserId } from '@/lib/perfectseason/server/session';
import { userKey, type User } from '@/lib/perfectseason/leaderboard';

export async function GET(request: NextRequest) {
  const userId = await getUserId(request);
  if (!userId) return NextResponse.json({ user: null }, { status: 401 });

  const user = await kv.get<User>(userKey(userId));
  if (!user) return NextResponse.json({ user: null }, { status: 401 });

  return NextResponse.json({ user: { id: user.id, username: user.username } });
}
