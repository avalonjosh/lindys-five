import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import { getUserId } from '@/lib/perfectseason/server/session';
import { rateLimit } from '@/lib/perfectseason/server/ratelimit';
import { sendAccountVerification } from '@/lib/perfectseason/server/accountEmail';
import { userKey, type User } from '@/lib/perfectseason/leaderboard';

/** Send a fresh "confirm your email" link to the signed-in account's address. */
export async function POST(request: NextRequest) {
  const userId = await getUserId(request);
  if (!userId) return NextResponse.json({ error: 'Sign in first' }, { status: 401 });
  const user = await kv.get<User>(userKey(userId));
  if (!user) return NextResponse.json({ error: 'Sign in first' }, { status: 401 });
  if (user.emailVerifiedAt) return NextResponse.json({ alreadyVerified: true });

  if (!(await rateLimit(`ps:rl:verifyresend:${userId}`, 3, 3600))) {
    return NextResponse.json({ error: 'We just sent a few. Check your inbox (and spam), or try again in an hour.' }, { status: 429 });
  }
  try {
    await sendAccountVerification(user, request.nextUrl.origin);
  } catch (err) {
    console.error('Resend account confirmation failed:', err);
    return NextResponse.json({ error: "We couldn't send the email right now. Try again in a few minutes." }, { status: 500 });
  }
  return NextResponse.json({ sent: true, email: user.email });
}
