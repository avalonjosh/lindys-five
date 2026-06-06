import { NextResponse } from 'next/server';
import { clearedUserCookie, USER_COOKIE } from '@/lib/perfectseason/server/session';

export async function POST() {
  const res = NextResponse.json({ success: true });
  res.cookies.set(USER_COOKIE, '', clearedUserCookie);
  return res;
}
