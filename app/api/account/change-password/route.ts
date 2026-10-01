import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { kv } from '@vercel/kv';
import { getUserId, signUserToken, userCookieOptions, USER_COOKIE } from '@/lib/perfectseason/server/session';
import { rateLimit } from '@/lib/perfectseason/server/ratelimit';
import { userKey, type User } from '@/lib/perfectseason/leaderboard';
import { sendPasswordChangedEmail } from '@/lib/email';

export async function POST(request: NextRequest) {
  const userId = await getUserId(request);
  if (!userId) return NextResponse.json({ error: 'Sign in to change your password' }, { status: 401 });

  let body: { currentPassword?: string; newPassword?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const currentPassword = body.currentPassword ?? '';
  const newPassword = body.newPassword ?? '';
  if (newPassword.length < 8 || newPassword.length > 100) {
    return NextResponse.json({ error: 'New password must be at least 8 characters' }, { status: 400 });
  }

  if (!(await rateLimit(`ps:rl:chpass:${userId}`, 5, 3600))) {
    return NextResponse.json({ error: 'Too many attempts. Try again later.' }, { status: 429 });
  }

  const user = await kv.get<User>(userKey(userId));
  if (!user) return NextResponse.json({ error: 'Account not found' }, { status: 401 });
  if (!(await bcrypt.compare(currentPassword, user.passwordHash))) {
    return NextResponse.json({ error: 'Current password is incorrect' }, { status: 403 });
  }

  const updated: User = { ...user, passwordHash: await bcrypt.hash(newPassword, 10), passwordChangedAt: new Date().toISOString() };
  await kv.set(userKey(userId), updated);

  try {
    await sendPasswordChangedEmail(user.email);
  } catch (err) {
    console.error('Password-changed notice failed:', err);
  }

  // Other devices are now signed out (their sessions predate the change); keep this one.
  const res = NextResponse.json({ success: true });
  res.cookies.set(USER_COOKIE, await signUserToken(userId), userCookieOptions);
  return res;
}
