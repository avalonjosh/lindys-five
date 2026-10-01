import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import { getUserId } from '@/lib/perfectseason/server/session';
import { rateLimit } from '@/lib/perfectseason/server/ratelimit';
import { unsubscribeByEmail } from '@/lib/newsletter';
import { accountOptIn } from '@/lib/perfectseason/server/accountEmail';
import { userKey, type User } from '@/lib/perfectseason/leaderboard';
import { findTeam } from '@/lib/teamConfig';

/**
 * Newsletter opt-in/out for the signed-in account (the settings toggle).
 * Subscribe signs up for the chosen team's recaps (default: the favorite team; with
 * neither, the weekly roundup only): live at
 * once if the account email is confirmed, otherwise held until it is.
 */
export async function POST(request: NextRequest) {
  const userId = await getUserId(request);
  if (!userId) return NextResponse.json({ error: 'Sign in to manage emails' }, { status: 401 });

  let body: { subscribed?: boolean; team?: string };
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

  let pending = false;
  try {
    if (body.subscribed) {
      const team = typeof body.team === 'string' && findTeam(body.team) ? body.team : user.favoriteTeam;
      pending = (await accountOptIn(user, team ? [team] : [], 'account-settings')) === 'pending';
    } else {
      await unsubscribeByEmail(user.email);
    }
  } catch (err) {
    console.error('Account newsletter toggle failed:', err);
    return NextResponse.json({ error: 'Could not update your subscription right now' }, { status: 500 });
  }

  return NextResponse.json({ subscribed: body.subscribed, pending });
}
