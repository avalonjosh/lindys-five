import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { kv } from '@vercel/kv';
import { getUserId } from '@/lib/perfectseason/server/session';
import { rateLimit } from '@/lib/perfectseason/server/ratelimit';
import { findSubscriberByEmail } from '@/lib/newsletter';
import { userKey, userEmailKey, type User } from '@/lib/perfectseason/leaderboard';

export async function POST(request: NextRequest) {
  const userId = await getUserId(request);
  if (!userId) return NextResponse.json({ error: 'Sign in to change your email' }, { status: 401 });

  let body: { password?: string; newEmail?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const newEmail = (body.newEmail ?? '').trim().toLowerCase();
  const password = body.password ?? '';
  if (!newEmail.includes('@') || newEmail.length > 200) {
    return NextResponse.json({ error: 'Enter a valid email' }, { status: 400 });
  }

  if (!(await rateLimit(`ps:rl:chemail:${userId}`, 5, 3600))) {
    return NextResponse.json({ error: 'Too many attempts. Try again later.' }, { status: 429 });
  }

  const user = await kv.get<User>(userKey(userId));
  if (!user) return NextResponse.json({ error: 'Account not found' }, { status: 401 });
  if (!(await bcrypt.compare(password, user.passwordHash))) {
    return NextResponse.json({ error: 'Password is incorrect' }, { status: 403 });
  }

  if (newEmail === user.email) {
    return NextResponse.json({ error: 'That is already your email' }, { status: 400 });
  }
  if (await kv.get<string>(userEmailKey(newEmail))) {
    return NextResponse.json({ error: 'An account with that email already exists' }, { status: 409 });
  }

  const oldEmail = user.email;
  const updated: User = { ...user, email: newEmail };
  // New index before dropping the old one, so a crash mid-way never strands the account.
  await kv.set(userEmailKey(newEmail), userId);
  await kv.set(userKey(userId), updated);
  await kv.del(userEmailKey(oldEmail));

  // Newsletter follows the account: move an active subscription to the new address.
  try {
    const sub = await findSubscriberByEmail(oldEmail);
    if (sub && !sub.unsubscribedAt) {
      await kv.set(`email:subscriber:${sub.id}`, { ...sub, email: newEmail });
    }
  } catch (err) {
    console.error('Newsletter email follow failed:', err);
  }

  return NextResponse.json({ email: newEmail });
}
