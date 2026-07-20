import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import { getUserId } from '@/lib/perfectseason/server/session';
import { rateLimit } from '@/lib/perfectseason/server/ratelimit';
import { ensureSubscriber, unsubscribeByEmail } from '@/lib/newsletter';
import { userKey, type User } from '@/lib/perfectseason/leaderboard';

/**
 * Newsletter opt-in/out for the signed-in account (the settings toggle).
 * Subscribe is single opt-in — the address is verified by the account itself —
 * and signs up for the favorite team's recaps when one is set.
 */
export async function POST(request: NextRequest) {
  const userId = await getUserId(request);
  if (!userId) return NextResponse.json({ error: 'Sign in to manage emails' }, { status: 401 });

  let body: { subscribed?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
  if (typeof body.subscribed !== 'boolean') {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  if (!(await rateLimit(`ps:rl:nl-toggle:${userId}`, 10, 3600))) {
    return NextResponse.json({ error: 'Too many changes. Try again later.' }, { status: 429 });
  }

  const user = await kv.get<User>(userKey(userId));
  if (!user) return NextResponse.json({ error: 'Account not found' }, { status: 401 });

  try {
    if (body.subscribed) {
      await ensureSubscriber(user.email, user.favoriteTeam ? [user.favoriteTeam] : [], 'account-settings', { single: true });
    } else {
      await unsubscribeByEmail(user.email);
    }
  } catch (err) {
    console.error('Account newsletter toggle failed:', err);
    return NextResponse.json({ error: 'Could not update your subscription right now' }, { status: 500 });
  }

  return NextResponse.json({ subscribed: body.subscribed });
}
