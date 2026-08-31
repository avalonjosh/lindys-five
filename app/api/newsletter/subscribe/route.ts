import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import { sendVerificationEmail } from '@/lib/email';
import { findSubscriberByEmail } from '@/lib/newsletter';
import { rateLimit, clientIp } from '@/lib/perfectseason/server/ratelimit';
import { NHL_TEAMS, MLB_TEAMS, NFL_TEAMS } from '@/lib/teamConfig';
import type { NewsletterSubscriber, EmailVerificationToken } from '@/lib/types';

const VALID_TEAM_SLUGS = new Set([
  ...Object.keys(NHL_TEAMS),
  ...Object.keys(MLB_TEAMS),
  ...Object.keys(NFL_TEAMS),
]);

export async function POST(request: NextRequest) {
  try {
    const { email, teams, source } = await request.json();

    if (!email || typeof email !== 'string' || !email.includes('@') || email.length > 200) {
      return NextResponse.json({ error: 'Valid email is required' }, { status: 400 });
    }

    if (!teams || !Array.isArray(teams) || teams.length === 0 || teams.length > 10) {
      return NextResponse.json({ error: 'At least one team is required' }, { status: 400 });
    }

    if (!teams.every((t) => typeof t === 'string' && VALID_TEAM_SLUGS.has(t))) {
      return NextResponse.json({ error: 'Unknown team' }, { status: 400 });
    }

    // Same key as quick-subscribe so the two endpoints share one budget
    if (!(await rateLimit(`ps:rl:subscribe:${clientIp(request)}`, 10, 3600))) {
      return NextResponse.json({ error: 'Too many requests. Try again later.' }, { status: 429 });
    }

    // Check if already subscribed (batched email lookup)
    const existing = await findSubscriberByEmail(email);
    if (existing) {
      if (existing.unsubscribedAt) {
        // Re-subscribe: clear unsubscribed, update teams, re-verify
        const updated: NewsletterSubscriber = {
          ...existing,
          teams,
          unsubscribedAt: undefined,
          verified: false,
          source: source || existing.source,
        };
        await kv.set(`email:subscriber:${existing.id}`, updated);
        // Update team indexes
        for (const team of teams) {
          await kv.sadd(`email:subscribers:team:${team}`, existing.id);
        }
        await sendVerificationToken(existing.id, email.toLowerCase());
        return NextResponse.json({ success: true, message: 'Check your email to re-confirm your subscription' });
      }
      if (!existing.verified) {
        // Resend verification
        await sendVerificationToken(existing.id, email.toLowerCase());
        return NextResponse.json({ success: true, message: 'Verification email resent. Check your inbox.' });
      }
      return NextResponse.json({ success: true, message: 'You are already subscribed!' });
    }

    // Create new subscriber
    const id = crypto.randomUUID();
    const subscriber: NewsletterSubscriber = {
      id,
      email: email.toLowerCase(),
      teams,
      createdAt: new Date().toISOString(),
      verified: false,
      source: source || 'unknown',
    };

    await kv.set(`email:subscriber:${id}`, subscriber);
    await kv.sadd('email:subscribers', id);
    for (const team of teams) {
      await kv.sadd(`email:subscribers:team:${team}`, id);
    }

    await sendVerificationToken(id, email.toLowerCase());

    return NextResponse.json({ success: true, message: 'Check your email to confirm your subscription!' });
  } catch (error: unknown) {
    console.error('Subscribe error:', error);
    return NextResponse.json({ error: 'Failed to subscribe' }, { status: 500 });
  }
}

async function sendVerificationToken(subscriberId: string, email: string) {
  const token = crypto.randomUUID();
  const verification: EmailVerificationToken = {
    subscriberId,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
  };
  await kv.set(`email:verification:${token}`, verification, { ex: 24 * 60 * 60 });
  await sendVerificationEmail(email, token);
}
