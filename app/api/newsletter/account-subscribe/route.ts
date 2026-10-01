import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import { getUserId } from '@/lib/perfectseason/server/session';
import { userKey, type User } from '@/lib/perfectseason/leaderboard';
import { accountOptIn } from '@/lib/perfectseason/server/accountEmail';
import { findTeam } from '@/lib/teamConfig';

/**
 * One-tap signup for a signed-in account: subscribes the account's own email
 * (never an email from the request) to a team's recaps, or the general list.
 * Live at once for a confirmed account email, held until confirmation otherwise.
 */
export async function POST(request: NextRequest) {
  const userId = await getUserId(request);
  if (!userId) return NextResponse.json({ error: 'Sign in first' }, { status: 401 });
  const user = await kv.get<User>(userKey(userId));
  if (!user?.email) return NextResponse.json({ error: 'Sign in first' }, { status: 401 });

  let team: string | undefined;
  let source = 'account-one-tap';
  try {
    const body = await request.json();
    if (typeof body.team === 'string' && findTeam(body.team)) team = body.team;
    if (typeof body.source === 'string') source = body.source.slice(0, 40).replace(/[^a-z0-9-]/gi, '') || source;
  } catch {
    /* empty body = general list */
  }

  let pending = false;
  try {
    pending = (await accountOptIn(user, team ? [team] : [], source)) === 'pending';
  } catch (err) {
    console.error('account-subscribe failed:', err);
    return NextResponse.json({ error: 'Could not subscribe right now' }, { status: 500 });
  }
  return NextResponse.json({ success: true, team: team ?? null, pending });
}
