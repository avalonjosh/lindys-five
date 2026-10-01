import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { kv } from '@vercel/kv';
import { signUserToken, userCookieOptions, USER_COOKIE } from '@/lib/perfectseason/server/session';
import { rateLimit, clientIp } from '@/lib/perfectseason/server/ratelimit';
import { consumeResetToken } from '@/lib/perfectseason/server/passwordReset';
import { userKey, type User } from '@/lib/perfectseason/leaderboard';
import { sendPasswordChangedEmail } from '@/lib/email';
import { markAccountEmailVerified } from '@/lib/perfectseason/server/accountEmail';

export async function POST(request: NextRequest) {
  let body: { token?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const token = body.token ?? '';
  const password = body.password ?? '';
  if (password.length < 8 || password.length > 100) {
    return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
  }

  if (!(await rateLimit(`ps:rl:pwreset:confirm:${clientIp(request)}`, 20, 3600))) {
    return NextResponse.json({ error: 'Too many attempts. Try again later.' }, { status: 429 });
  }

  const userId = await consumeResetToken(token);
  const user = userId ? await kv.get<User>(userKey(userId)) : null;
  if (!user) {
    return NextResponse.json({ error: 'This reset link has expired or was already used.', expired: true }, { status: 400 });
  }

  const updated: User = {
    ...user,
    passwordHash: await bcrypt.hash(password, 10),
    passwordChangedAt: new Date().toISOString(),
  };
  await kv.set(userKey(user.id), updated);
  // Opening the emailed link proves they read this inbox.
  await markAccountEmailVerified(updated);

  try {
    await sendPasswordChangedEmail(user.email);
  } catch (err) {
    console.error('Password-changed notice failed:', err);
  }

  // Every older session is now rejected; this device gets a fresh one.
  const res = NextResponse.json({ user: { id: user.id, username: user.username, favoriteTeam: user.favoriteTeam } });
  res.cookies.set(USER_COOKIE, await signUserToken(user.id), userCookieOptions);
  return res;
}
