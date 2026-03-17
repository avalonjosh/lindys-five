import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import type { NewsletterSubscriber, EmailVerificationToken } from '@/lib/types';

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token');

  if (!token) {
    return redirectWithMessage('error', 'Missing verification token');
  }

  try {
    const verification = await kv.get<EmailVerificationToken>(`email:verification:${token}`);

    if (!verification) {
      return redirectWithMessage('error', 'Invalid or expired verification link');
    }

    if (new Date(verification.expiresAt) < new Date()) {
      await kv.del(`email:verification:${token}`);
      return redirectWithMessage('error', 'Verification link has expired. Please subscribe again.');
    }

    const subscriber = await kv.get<NewsletterSubscriber>(`email:subscriber:${verification.subscriberId}`);
    if (!subscriber) {
      return redirectWithMessage('error', 'Subscriber not found');
    }

    // Mark as verified
    const updated: NewsletterSubscriber = {
      ...subscriber,
      verified: true,
      verifiedAt: new Date().toISOString(),
    };
    await kv.set(`email:subscriber:${subscriber.id}`, updated);

    // Clean up token
    await kv.del(`email:verification:${token}`);

    return redirectWithMessage('success', 'Email verified! You will now receive game recaps.');
  } catch (error) {
    console.error('Verification error:', error);
    return redirectWithMessage('error', 'Something went wrong. Please try again.');
  }
}

function redirectWithMessage(status: string, message: string) {
  const url = new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://www.lindysfive.com');
  url.searchParams.set('newsletter', status);
  url.searchParams.set('message', message);
  return NextResponse.redirect(url.toString());
}
