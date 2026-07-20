import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { kv } from '@vercel/kv';
import { getUserId, USER_COOKIE, clearedUserCookie } from '@/lib/perfectseason/server/session';
import { rateLimit } from '@/lib/perfectseason/server/ratelimit';
import { unsubscribeByEmail } from '@/lib/newsletter';
import {
  userKey,
  userEmailKey,
  userNameKey,
  userBoardsKey,
  lbZKey,
  lbEntryKey,
  type User,
} from '@/lib/perfectseason/leaderboard';
import { whatIfIndexKey } from '@/lib/whatif/types';

/**
 * Permanently delete the signed-in account: every leaderboard entry, every
 * saved What-If pick, and the user record itself. Optionally unsubscribes the
 * email from recaps too. Irreversible by design.
 */
export async function POST(request: NextRequest) {
  const userId = await getUserId(request);
  if (!userId) return NextResponse.json({ error: 'Sign in to delete your account' }, { status: 401 });

  let body: { password?: string; unsubscribe?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  if (!(await rateLimit(`ps:rl:delete:${userId}`, 5, 3600))) {
    return NextResponse.json({ error: 'Too many attempts. Try again later.' }, { status: 429 });
  }

  const user = await kv.get<User>(userKey(userId));
  if (!user) return NextResponse.json({ error: 'Account not found' }, { status: 401 });
  if (!(await bcrypt.compare(body.password ?? '', user.passwordHash))) {
    return NextResponse.json({ error: 'Password is incorrect' }, { status: 403 });
  }

  // Leaderboards: drop the user from every board they ever appeared on.
  const boardsHash = (await kv.hgetall<Record<string, number>>(userBoardsKey(userId))) ?? {};
  await Promise.all(
    Object.keys(boardsHash).flatMap((board) => [
      kv.zrem(lbZKey(board), userId),
      kv.del(lbEntryKey(board, userId)),
    ])
  );
  await kv.del(userBoardsKey(userId));

  // What-If picks: index members are the save-key suffixes.
  const members = (await kv.zrange<string[]>(whatIfIndexKey(userId), 0, -1)) ?? [];
  if (members.length > 0) {
    await kv.del(...members.map((m) => `whatif:save:${userId}:${m}`));
  }
  await kv.del(whatIfIndexKey(userId));

  // Newsletter is a separate consent — only unsubscribe if asked.
  if (body.unsubscribe) {
    try {
      await unsubscribeByEmail(user.email);
    } catch (err) {
      console.error('Unsubscribe during account deletion failed:', err);
    }
  }

  // The user record and its lookup indexes last, so a partial failure above
  // leaves a re-runnable delete rather than an orphaned account.
  await Promise.all([
    kv.del(userKey(userId)),
    kv.del(userEmailKey(user.email)),
    kv.del(userNameKey(user.username)),
  ]);

  const res = NextResponse.json({ success: true });
  res.cookies.set(USER_COOKIE, '', clearedUserCookie);
  return res;
}
