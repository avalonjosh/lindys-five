import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { kv } from '@vercel/kv';
import { signUserToken, userCookieOptions, USER_COOKIE } from '@/lib/perfectseason/server/session';
import { rateLimit, clientIp } from '@/lib/perfectseason/server/ratelimit';
import { userKey, userEmailKey, userNameKey, type User } from '@/lib/perfectseason/leaderboard';

export async function POST(request: NextRequest) {
  let body: { emailOrUsername?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const id = (body.emailOrUsername ?? '').trim();
  const password = body.password ?? '';
  const invalid = NextResponse.json({ error: 'Invalid email/username or password' }, { status: 401 });
  if (!id || !password) return invalid;

  if (!(await rateLimit(`ps:rl:login:${clientIp(request)}`, 20, 900))) {
    return NextResponse.json({ error: 'Too many attempts. Try again shortly.' }, { status: 429 });
  }

  // Resolve by email or username, then verify the password (generic 401 either way).
  const lookup = id.includes('@') ? userEmailKey(id) : userNameKey(id);
  const userId = await kv.get<string>(lookup);
  if (!userId) return invalid;
  const user = await kv.get<User>(userKey(userId));
  if (!user?.passwordHash || !(await bcrypt.compare(password, user.passwordHash))) return invalid;

  const token = await signUserToken(user.id);
  const res = NextResponse.json({ user: { id: user.id, username: user.username, favoriteTeam: user.favoriteTeam } });
  res.cookies.set(USER_COOKIE, token, userCookieOptions);
  return res;
}
