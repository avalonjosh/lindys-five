import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import { getUserId } from '@/lib/perfectseason/server/session';
import { findSubscriberByEmail } from '@/lib/newsletter';
import { userKey, type User } from '@/lib/perfectseason/leaderboard';

/**
 * Newsletter standing for the signed-in account, used by the popup to decide
 * whether (and how) to show itself. Anonymous visitors get { signedIn: false }
 * and the popup falls back to its localStorage-only behavior.
 */
export async function GET(request: NextRequest) {
  const userId = await getUserId(request);
  if (!userId) return NextResponse.json({ signedIn: false });

  const user = await kv.get<User>(userKey(userId));
  if (!user) return NextResponse.json({ signedIn: false });

  const sub = await findSubscriberByEmail(user.email);
  // Opted in = has a subscriber record and hasn't unsubscribed. A pending
  // (unverified) opt-in still counts — they said yes; don't nag them again.
  const subscribed = !!sub && !sub.unsubscribedAt;

  return NextResponse.json({
    signedIn: true,
    subscribed,
    email: user.email,
    username: user.username,
    favoriteTeam: user.favoriteTeam ?? null,
  });
}
