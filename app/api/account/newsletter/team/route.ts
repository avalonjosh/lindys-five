import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import { getUserId } from '@/lib/perfectseason/server/session';
import { rateLimit } from '@/lib/perfectseason/server/ratelimit';
import { removeSubscriberTeam } from '@/lib/newsletter';
import { accountOptIn } from '@/lib/perfectseason/server/accountEmail';
import { userKey, type User } from '@/lib/perfectseason/leaderboard';
import { findTeam } from '@/lib/teamConfig';

/** Turn one team's recap emails on or off for the signed-in account (the My Teams switches). */
export async function POST(request: NextRequest) {
  const userId = await getUserId(request);
  if (!userId) return NextResponse.json({ error: 'Sign in to manage emails' }, { status: 401 });

  let body: { team?: string; on?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
  const team = typeof body.team === 'string' && findTeam(body.team) ? body.team : null;
  if (!team || typeof body.on !== 'boolean') return NextResponse.json({ error: 'Invalid request' }, { status: 400 });

  if (!(await rateLimit(`ps:rl:nl-team:${userId}`, 30, 3600))) {
    return NextResponse.json({ error: 'Too many changes. Try again later.' }, { status: 429 });
  }
  const user = await kv.get<User>(userKey(userId));
  if (!user) return NextResponse.json({ error: 'Account not found' }, { status: 401 });

  try {
    if (body.on) {
      const state = await accountOptIn(user, [team], 'my-teams');
      return NextResponse.json({ team, on: true, pending: state === 'pending' });
    }
    await removeSubscriberTeam(user.email, team);
    return NextResponse.json({ team, on: false, pending: false });
  } catch (err) {
    console.error('Team recap toggle failed:', err);
    return NextResponse.json({ error: 'Could not update your emails right now' }, { status: 500 });
  }
}
