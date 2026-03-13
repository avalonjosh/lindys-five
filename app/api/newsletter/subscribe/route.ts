import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import { sendVerificationEmail } from '@/lib/email';
import type { NewsletterSubscriber, EmailVerificationToken } from '@/lib/types';

export async function POST(request: NextRequest) {
  try {
    const { email, teams, source } = await request.json();

    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'Valid email is required' }, { status: 400 });
    }

    if (!teams || !Array.isArray(teams) || teams.length === 0) {
      return NextResponse.json({ error: 'At least one team is required' }, { status: 400 });
    }

    // Check if already subscribed (by email lookup)
    const existingIds = await kv.smembers<string[]>('email:subscribers');
    if (existingIds) {
      for (const id of existingIds) {
        const existing = await kv.get<NewsletterSubscriber>(`email:subscriber:${id}`);
        if (existing && existing.email === email.toLowerCase()) {
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
      }
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
  await kv.set(`email:verification:${token}`, verification);
  await sendVerificationEmail(email, token);
}
