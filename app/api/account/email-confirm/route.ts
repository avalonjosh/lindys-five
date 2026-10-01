import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import { rateLimit, clientIp } from '@/lib/perfectseason/server/ratelimit';
import { consumeEmailToken } from '@/lib/perfectseason/server/emailTokens';
import { markAccountEmailVerified } from '@/lib/perfectseason/server/accountEmail';
import { findSubscriberByEmail } from '@/lib/newsletter';
import { userKey, userEmailKey, type User } from '@/lib/perfectseason/leaderboard';

/**
 * Confirm-email links (verify the current address, or finish an email change).
 * Doesn't sign anyone in: the link may be opened on any device.
 */
export async function POST(request: NextRequest) {
  let body: { token?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  if (!(await rateLimit(`ps:rl:emailconfirm:${clientIp(request)}`, 30, 3600))) {
    return NextResponse.json({ error: 'Too many attempts. Try again later.' }, { status: 429 });
  }

  const expired = NextResponse.json({ error: 'This link has expired or was already used.', expired: true }, { status: 400 });
  const record = await consumeEmailToken(body.token ?? '');
  if (!record) return expired;
  const user = await kv.get<User>(userKey(record.userId));
  if (!user) return expired;

  if (record.kind === 'verify') {
    // A link for an address the account has since moved away from proves nothing.
    if (record.email !== user.email) return expired;
    await markAccountEmailVerified(user);
    return NextResponse.json({ kind: 'verify', email: user.email });
  }

  // Email change: only the latest requested address can complete it.
  const newEmail = record.email;
  if (user.pendingEmail !== newEmail) return expired;
  const owner = await kv.get<string>(userEmailKey(newEmail));
  if (owner && owner !== user.id) {
    await kv.set(userKey(user.id), { ...user, pendingEmail: undefined });
    return NextResponse.json({ error: 'Another account now uses that email.' }, { status: 409 });
  }

  const oldEmail = user.email;
  const updated: User = {
    ...user,
    email: newEmail,
    pendingEmail: undefined,
    // The click just proved the new inbox.
    emailVerifiedAt: new Date().toISOString(),
  };
  // New index before dropping the old one, so a crash mid-way never strands the account.
  await kv.set(userEmailKey(newEmail), user.id);
  await kv.set(userKey(user.id), updated);
  await kv.del(userEmailKey(oldEmail));

  // The newsletter follows the account. The new address is proven, so an
  // active subscription keeps its standing.
  try {
    const sub = await findSubscriberByEmail(oldEmail);
    if (sub && !sub.unsubscribedAt) {
      const existing = await findSubscriberByEmail(newEmail);
      if (!existing) {
        await kv.set(`email:subscriber:${sub.id}`, { ...sub, email: newEmail });
      } else {
        // The new address already has its own record: fold the teams into it and
        // retire the old one, so nobody ends up with two copies of each recap.
        const teams = Array.from(new Set([...(existing.teams ?? []), ...(sub.teams ?? [])]));
        await kv.set(`email:subscriber:${existing.id}`, { ...existing, teams, unsubscribedAt: undefined, verified: true, verifiedAt: existing.verifiedAt ?? new Date().toISOString() });
        for (const team of teams) await kv.sadd(`email:subscribers:team:${team}`, existing.id);
        await kv.set(`email:subscriber:${sub.id}`, { ...sub, unsubscribedAt: new Date().toISOString() });
        for (const team of sub.teams ?? []) await kv.srem(`email:subscribers:team:${team}`, sub.id);
      }
    }
  } catch (err) {
    console.error('Newsletter email follow failed:', err);
  }

  return NextResponse.json({ kind: 'change', email: newEmail });
}
