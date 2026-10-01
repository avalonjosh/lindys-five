/**
 * Account email confirmation: sending the links, and the rule that an account's
 * newsletter opt-in only goes live once its email is confirmed.
 */

import { kv } from '@vercel/kv';
import { ensureSubscriber, activateSubscriberByEmail } from '@/lib/newsletter';
import { sendAccountVerifyEmail } from '@/lib/email';
import { createEmailToken, confirmEmailUrl } from './emailTokens';
import { userKey, userEmailKey, type User } from '../leaderboard';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.lindysfive.com';

/** Email a "confirm your email" link for the account's current address. */
export async function sendAccountVerification(user: User, devOrigin?: string): Promise<void> {
  const link = confirmEmailUrl(SITE_URL, await createEmailToken({ userId: user.id, email: user.email, kind: 'verify' }));
  if (process.env.NODE_ENV !== 'production') console.log(`[confirm email] ${user.email}: ${devOrigin ? link.replace(SITE_URL, devOrigin) : link}`);
  await sendAccountVerifyEmail(user.email, user.username, link);
}

/**
 * Opt the account's email into recaps. Confirmed account: on immediately
 * (single opt-in). Unconfirmed: recorded but held until the email is confirmed,
 * so an account can never sign up an address its owner doesn't control.
 */
export async function accountOptIn(user: User, teams: string[], source: string): Promise<'active' | 'pending'> {
  if (user.emailVerifiedAt) {
    await ensureSubscriber(user.email, teams, source, { single: true });
    return 'active';
  }
  await ensureSubscriber(user.email, teams, source, { held: true });
  return 'pending';
}

/** The address is proven: mark the account confirmed and switch on any held opt-in. */
export async function markAccountEmailVerified(user: User): Promise<User> {
  const updated: User = user.emailVerifiedAt ? user : { ...user, emailVerifiedAt: new Date().toISOString() };
  if (updated !== user) await kv.set(userKey(user.id), updated);
  try {
    await activateSubscriberByEmail(user.email);
  } catch (err) {
    console.error('Activating held subscription failed:', err);
  }
  return updated;
}

/** A newsletter confirmation proves the inbox too: confirm the matching account, if any. */
export async function markAccountVerifiedForEmail(email: string): Promise<void> {
  const userId = await kv.get<string>(userEmailKey(email));
  const user = userId ? await kv.get<User>(userKey(userId)) : null;
  if (user && !user.emailVerifiedAt) await kv.set(userKey(user.id), { ...user, emailVerifiedAt: new Date().toISOString() });
}
