/**
 * Shared "make sure this email is on the newsletter list" helper, reused by the
 * newsletter signup form and the Perfect Season account opt-in. Double opt-in:
 * creates an unverified subscriber and sends the confirmation email — the
 * address only counts once the recipient clicks the verify link.
 */

import { kv } from '@vercel/kv';
import { sendVerificationEmail, sendWelcomeEmail } from '@/lib/email';
import type { NewsletterSubscriber, EmailVerificationToken } from '@/lib/types';

/** Single opt-in acknowledgment. Best-effort — never block signup on a send. */
async function sendWelcome(subscriberId: string, email: string): Promise<void> {
  try {
    await sendWelcomeEmail(email, subscriberId);
  } catch (err) {
    console.error('Welcome email failed:', err);
  }
}

async function sendVerificationToken(subscriberId: string, email: string): Promise<void> {
  const token = crypto.randomUUID();
  const verification: EmailVerificationToken = {
    subscriberId,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  };
  await kv.set(`email:verification:${token}`, verification);
  await sendVerificationEmail(email, token);
}

/**
 * Add an email to the newsletter list (idempotent). `teams` may be empty for a
 * general opt-in (those only receive admin broadcasts/announcements — the recap
 * crons are team-based). No-ops if already verified and active.
 *
 * opts.single = single opt-in: mark verified immediately and skip the
 * confirmation email (use when the email was just actively given via a checkbox
 * or a subscribe button). Otherwise double opt-in (send a verification link).
 */
/** The subscriber record for an email, or null. Linear scan — the list is small
 * and there is no email→id index; same approach as ensureSubscriber below. */
export async function findSubscriberByEmail(email: string): Promise<NewsletterSubscriber | null> {
  const lower = email.toLowerCase();
  const ids = await kv.smembers<string[]>('email:subscribers');
  for (const id of ids ?? []) {
    const sub = await kv.get<NewsletterSubscriber>(`email:subscriber:${id}`);
    if (sub?.email === lower) return sub;
  }
  return null;
}

export async function ensureSubscriber(
  email: string,
  teams: string[],
  source: string,
  opts: { single?: boolean } = {},
): Promise<void> {
  const lower = email.toLowerCase();
  const single = opts.single === true;
  const now = new Date().toISOString();

  const existingIds = await kv.smembers<string[]>('email:subscribers');
  for (const id of existingIds ?? []) {
    const existing = await kv.get<NewsletterSubscriber>(`email:subscriber:${id}`);
    if (!existing || existing.email !== lower) continue;
    if (existing.verified && !existing.unsubscribedAt) return; // already on the list
    const updated: NewsletterSubscriber = {
      ...existing,
      teams: Array.from(new Set([...(existing.teams ?? []), ...teams])),
      unsubscribedAt: undefined,
      verified: single ? true : false,
      verifiedAt: single ? now : existing.verifiedAt,
      source: source || existing.source,
    };
    await kv.set(`email:subscriber:${existing.id}`, updated);
    for (const team of teams) await kv.sadd(`email:subscribers:team:${team}`, existing.id);
    if (single) await sendWelcome(existing.id, lower);
    else await sendVerificationToken(existing.id, lower);
    return;
  }

  const id = crypto.randomUUID();
  const subscriber: NewsletterSubscriber = {
    id,
    email: lower,
    teams,
    createdAt: now,
    verified: single,
    verifiedAt: single ? now : undefined,
    source: source || 'unknown',
  };
  await kv.set(`email:subscriber:${id}`, subscriber);
  await kv.sadd('email:subscribers', id);
  for (const team of teams) await kv.sadd(`email:subscribers:team:${team}`, id);
  if (single) await sendWelcome(id, lower);
  else await sendVerificationToken(id, lower);
}
