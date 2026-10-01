import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import { getUserId } from '@/lib/perfectseason/server/session';
import { rateLimit } from '@/lib/perfectseason/server/ratelimit';
import {
  userKey,
  userNameKey,
  userBoardsKey,
  lbEntryKey,
  publicUser,
  usernameProblem,
  type User,
  type LeaderboardEntry,
} from '@/lib/perfectseason/leaderboard';

const COOLDOWN_DAYS = 30;

/** Change the signed-in account's username (public on leaderboards and cards). Once every 30 days. */
export async function POST(request: NextRequest) {
  const userId = await getUserId(request);
  if (!userId) return NextResponse.json({ error: 'Sign in to change your username' }, { status: 401 });

  let body: { username?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
  const username = (body.username ?? '').trim();
  const problem = usernameProblem(username);
  if (problem) return NextResponse.json({ error: problem }, { status: 400 });

  if (!(await rateLimit(`ps:rl:uname:${userId}`, 10, 3600))) {
    return NextResponse.json({ error: 'Too many attempts. Try again later.' }, { status: 429 });
  }

  const user = await kv.get<User>(userKey(userId));
  if (!user) return NextResponse.json({ error: 'Account not found' }, { status: 401 });
  if (username === user.username) return NextResponse.json({ error: 'That is already your username' }, { status: 400 });

  const caseOnly = username.toLowerCase() === user.usernameLower;
  if (!caseOnly && user.usernameChangedAt) {
    const next = Date.parse(user.usernameChangedAt) + COOLDOWN_DAYS * 86400000;
    if (Date.now() < next) {
      const when = new Date(next).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'America/New_York' });
      return NextResponse.json({ error: `You can change your username again on ${when}.` }, { status: 429 });
    }
  }

  if (!caseOnly) {
    // Claim the new name atomically so two people can't take it at once.
    const claimed = await kv.set(userNameKey(username), userId, { nx: true });
    if (!claimed) return NextResponse.json({ error: 'That username is taken' }, { status: 409 });
  }

  const updated: User = {
    ...user,
    username,
    usernameLower: username.toLowerCase(),
    ...(caseOnly ? {} : { usernameChangedAt: new Date().toISOString() }),
  };
  await kv.set(userKey(userId), updated);
  if (!caseOnly) await kv.del(userNameKey(user.username));

  // Leaderboard entries carry the name they were posted under; bring them up to date.
  try {
    const boards = (await kv.hkeys(userBoardsKey(userId))) ?? [];
    for (const board of boards) {
      const entry = await kv.get<LeaderboardEntry>(lbEntryKey(board, userId));
      if (entry) await kv.set(lbEntryKey(board, userId), { ...entry, username }, { keepTtl: true });
    }
  } catch (err) {
    console.error('Leaderboard username update failed:', err);
  }

  return NextResponse.json({ user: publicUser(updated) });
}
