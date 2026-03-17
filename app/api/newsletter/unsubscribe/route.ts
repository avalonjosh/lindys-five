import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import type { NewsletterSubscriber } from '@/lib/types';

export async function GET(request: NextRequest) {
  const subscriberId = request.nextUrl.searchParams.get('id');

  if (!subscriberId) {
    return renderUnsubscribePage('Missing subscriber ID', false);
  }

  try {
    const subscriber = await kv.get<NewsletterSubscriber>(`email:subscriber:${subscriberId}`);

    if (!subscriber) {
      return renderUnsubscribePage('Subscriber not found', false);
    }

    if (subscriber.unsubscribedAt) {
      return renderUnsubscribePage('You have already been unsubscribed.', true);
    }

    // Soft delete — mark as unsubscribed
    const updated: NewsletterSubscriber = {
      ...subscriber,
      unsubscribedAt: new Date().toISOString(),
    };
    await kv.set(`email:subscriber:${subscriberId}`, updated);

    // Remove from team indexes
    for (const team of subscriber.teams) {
      await kv.srem(`email:subscribers:team:${team}`, subscriberId);
    }

    return renderUnsubscribePage('You have been unsubscribed. Sorry to see you go!', true);
  } catch (error) {
    console.error('Unsubscribe error:', error);
    return renderUnsubscribePage('Something went wrong. Please try again.', false);
  }
}

function renderUnsubscribePage(message: string, success: boolean) {
  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Unsubscribe — Lindy's Five</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:500px;margin:80px auto;text-align:center;padding:40px 20px;">
    <h1 style="color:#003087;font-size:28px;margin-bottom:16px;font-family:'Bebas Neue',Impact,sans-serif;">Lindy's Five</h1>
    <div style="background:white;padding:32px;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,0.1);">
      <p style="font-size:${success ? '48px' : '48px'};margin:0 0 16px;">${success ? '✓' : '!'}</p>
      <p style="color:#334155;font-size:16px;line-height:1.6;margin:0 0 24px;">${message}</p>
      <a href="${process.env.NEXT_PUBLIC_SITE_URL || 'https://www.lindysfive.com'}"
         style="display:inline-block;background:#003087;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">
        Back to Lindy's Five
      </a>
    </div>
  </div>
</body>
</html>`;

  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html' },
  });
}
