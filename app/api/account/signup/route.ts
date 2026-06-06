import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { kv } from '@vercel/kv';
import { signUserToken, userCookieOptions, USER_COOKIE } from '@/lib/perfectseason/server/session';
import { rateLimit, clientIp } from '@/lib/perfectseason/server/ratelimit';
import { ensureSubscriber } from '@/lib/newsletter';
import { userKey, userEmailKey, userNameKey, type User } from '@/lib/perfectseason/leaderboard';

const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;
// A tiny denylist; usernames are public on the leaderboard.
const DENY = /(admin|moderator|f[u\*]ck|sh[i\*]t|n[i1]gg|c[u\*]nt|rape)/i;

export async function POST(request: NextRequest) {
  let body: { email?: string; username?: string; password?: string; subscribe?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const email = (body.email ?? '').trim().toLowerCase();
  const username = (body.username ?? '').trim();
  const password = body.password ?? '';

  if (!email.includes('@') || email.length > 200) return NextResponse.json({ error: 'Enter a valid email' }, { status: 400 });
  if (!USERNAME_RE.test(username) || DENY.test(username)) {
    return NextResponse.json({ error: 'Username must be 3–20 letters, numbers, or underscores' }, { status: 400 });
  }
  if (password.length < 8 || password.length > 100) return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });

  if (!(await rateLimit(`ps:rl:signup:${clientIp(request)}`, 5, 86400))) {
    return NextResponse.json({ error: 'Too many signups from this network. Try again later.' }, { status: 429 });
  }

  if (await kv.get<string>(userEmailKey(email))) return NextResponse.json({ error: 'An account with that email already exists' }, { status: 409 });
  if (await kv.get<string>(userNameKey(username))) return NextResponse.json({ error: 'That username is taken' }, { status: 409 });

  const id = crypto.randomUUID();
  const user: User = {
    id,
    email,
    username,
    usernameLower: username.toLowerCase(),
    passwordHash: await bcrypt.hash(password, 10),
    createdAt: new Date().toISOString(),
    authProvider: 'password',
  };

  await Promise.all([
    kv.set(userKey(id), user),
    kv.set(userEmailKey(email), id),
    kv.set(userNameKey(username), id),
  ]);

  // Optional, consented newsletter opt-in (double opt-in via verification email).
  // Best-effort: never fail account creation on a newsletter/email hiccup.
  if (body.subscribe) {
    try {
      await ensureSubscriber(email, [], 'perfectseason', { single: true });
    } catch (err) {
      console.error('Newsletter opt-in failed during signup:', err);
    }
  }

  const token = await signUserToken(id);
  const res = NextResponse.json({ user: { id, username } });
  res.cookies.set(USER_COOKIE, token, userCookieOptions);
  return res;
}
