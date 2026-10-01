import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { kv } from '@vercel/kv';
import { signUserToken, userCookieOptions, USER_COOKIE } from '@/lib/perfectseason/server/session';
import { rateLimit, clientIp } from '@/lib/perfectseason/server/ratelimit';
import { accountOptIn, sendAccountVerification } from '@/lib/perfectseason/server/accountEmail';
import { userKey, userEmailKey, userNameKey, publicUser, usernameProblem, type User } from '@/lib/perfectseason/leaderboard';
import { findTeam } from '@/lib/teamConfig';


export async function POST(request: NextRequest) {
  let body: { email?: string; username?: string; password?: string; subscribe?: boolean; favoriteTeam?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const email = (body.email ?? '').trim().toLowerCase();
  const username = (body.username ?? '').trim();
  const password = body.password ?? '';

  if (!email.includes('@') || email.length > 200) return NextResponse.json({ error: 'Enter a valid email' }, { status: 400 });
  const nameProblem = usernameProblem(username);
  if (nameProblem) return NextResponse.json({ error: nameProblem }, { status: 400 });
  if (password.length < 8 || password.length > 100) return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });

  if (!(await rateLimit(`ps:rl:signup:${clientIp(request)}`, 5, 86400))) {
    return NextResponse.json({ error: 'Too many signups from this network. Try again later.' }, { status: 429 });
  }

  if (await kv.get<string>(userEmailKey(email))) return NextResponse.json({ error: 'An account with that email already exists' }, { status: 409 });
  if (await kv.get<string>(userNameKey(username))) return NextResponse.json({ error: 'That username is taken' }, { status: 409 });

  // Optional favorite team: silently dropped if it isn't a real team slug.
  const favoriteTeam =
    typeof body.favoriteTeam === 'string' && findTeam(body.favoriteTeam) ? body.favoriteTeam : undefined;

  const id = crypto.randomUUID();
  const user: User = {
    id,
    email,
    username,
    usernameLower: username.toLowerCase(),
    passwordHash: await bcrypt.hash(password, 10),
    createdAt: new Date().toISOString(),
    authProvider: 'password',
    ...(favoriteTeam ? { favoriteTeam, teams: [favoriteTeam] } : {}),
  };

  await Promise.all([
    kv.set(userKey(id), user),
    kv.set(userEmailKey(email), id),
    kv.set(userNameKey(username), id),
  ]);

  // Every new account gets one "confirm your email" link. A consented
  // newsletter opt-in is recorded now but only starts once that's clicked.
  // Best-effort: never fail account creation on a newsletter/email hiccup.
  if (body.subscribe) {
    try {
      await accountOptIn(user, favoriteTeam ? [favoriteTeam] : [], 'perfectseason');
    } catch (err) {
      console.error('Newsletter opt-in failed during signup:', err);
    }
  }
  try {
    await sendAccountVerification(user, request.nextUrl.origin);
  } catch (err) {
    console.error('Account confirmation email failed during signup:', err);
  }

  const token = await signUserToken(id);
  const res = NextResponse.json({ user: publicUser(user) });
  res.cookies.set(USER_COOKIE, token, userCookieOptions);
  return res;
}
