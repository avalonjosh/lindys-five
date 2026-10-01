import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { kv } from '@vercel/kv';
import { getUserId } from '@/lib/perfectseason/server/session';
import { rateLimit } from '@/lib/perfectseason/server/ratelimit';
import { userKey, userEmailKey, type User } from '@/lib/perfectseason/leaderboard';
import { createEmailToken, confirmEmailUrl } from '@/lib/perfectseason/server/emailTokens';
import { sendEmailChangeConfirmEmail, sendEmailChangeRequestedNotice } from '@/lib/email';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.lindysfive.com';

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
  if (!user.passwordHash) {
    return NextResponse.json({ error: 'You sign in with Google, so your email follows your Google account. Set a password first to use a different email.' }, { status: 400 });
  }
  if (!(await bcrypt.compare(password, user.passwordHash))) {
    return NextResponse.json({ error: 'Password is incorrect' }, { status: 403 });
  }

  if (newEmail === user.email) {
    return NextResponse.json({ error: 'That is already your email' }, { status: 400 });
  }
  if (await kv.get<string>(userEmailKey(newEmail))) {
    return NextResponse.json({ error: 'An account with that email already exists' }, { status: 409 });
  }

  // Nothing switches yet: the new address has to prove itself first, and the
  // old address hears about the request so a hijacked session can't quietly
  // take the account. The swap happens in /api/account/email-confirm.
  const link = confirmEmailUrl(SITE_URL, await createEmailToken({ userId, email: newEmail, kind: 'change' }));
  if (process.env.NODE_ENV !== 'production') console.log(`[confirm new email] ${newEmail}: ${link.replace(SITE_URL, request.nextUrl.origin)}`);
  try {
    await sendEmailChangeConfirmEmail(newEmail, user.username, link);
  } catch (err) {
    console.error('Email change confirmation failed:', err);
    return NextResponse.json({ error: "We couldn't send the confirmation email right now. Try again in a few minutes." }, { status: 500 });
  }
  await kv.set(userKey(userId), { ...user, pendingEmail: newEmail });
  try {
    await sendEmailChangeRequestedNotice(user.email, newEmail);
  } catch (err) {
    console.error('Email change notice to old address failed:', err);
  }

  return NextResponse.json({ pending: true, pendingEmail: newEmail });
}
