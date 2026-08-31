import { NextRequest, NextResponse } from 'next/server';
import { Webhook } from 'svix';
import { getSendRecordIdForResendEmail, incrementSendStat } from '@/lib/email';
import { unsubscribeByEmail } from '@/lib/newsletter';

const VALID_EVENTS = ['email.delivered', 'email.opened', 'email.clicked', 'email.bounced', 'email.complained'] as const;

type ResendEventType = typeof VALID_EVENTS[number];

const EVENT_TO_STAT: Record<ResendEventType, 'delivered' | 'opened' | 'clicked' | 'bounced' | 'complained'> = {
  'email.delivered': 'delivered',
  'email.opened': 'opened',
  'email.clicked': 'clicked',
  'email.bounced': 'bounced',
  'email.complained': 'complained',
};

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();

    // Resend signs webhooks via svix. Without verification anyone can forge
    // open/click/bounce events. Falls back to unverified processing only while
    // RESEND_WEBHOOK_SECRET is unset so stats don't silently stop.
    const secret = process.env.RESEND_WEBHOOK_SECRET;
    if (secret) {
      try {
        new Webhook(secret).verify(rawBody, {
          'svix-id': request.headers.get('svix-id') ?? '',
          'svix-timestamp': request.headers.get('svix-timestamp') ?? '',
          'svix-signature': request.headers.get('svix-signature') ?? '',
        });
      } catch {
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
      }
    } else {
      console.warn('Resend webhook: RESEND_WEBHOOK_SECRET not set — processing unverified event');
    }

    const body = JSON.parse(rawBody);
    const { type, data } = body;

    if (!type || !data) {
      return NextResponse.json({ received: true });
    }

    // Only process events we care about
    if (!VALID_EVENTS.includes(type)) {
      return NextResponse.json({ received: true });
    }

    // Suppress addresses that hard-bounce or complain — continuing to mail them
    // is what damages sender reputation. Transient bounces (full inbox etc.)
    // are left alone.
    if (type === 'email.bounced' || type === 'email.complained') {
      const bounceType: string = data.bounce?.type ?? '';
      const isTransientBounce = type === 'email.bounced' && bounceType.toLowerCase() === 'transient';
      if (!isTransientBounce) {
        const recipients: string[] = Array.isArray(data.to) ? data.to : [data.to].filter(Boolean);
        for (const recipient of recipients) {
          try {
            await unsubscribeByEmail(recipient);
          } catch (err) {
            console.error(`Resend webhook: failed to suppress ${type} recipient:`, err);
          }
        }
      }
    }

    const resendEmailId = data.email_id;
    if (!resendEmailId) {
      return NextResponse.json({ received: true });
    }

    // Look up which send record this email belongs to
    const sendRecordId = await getSendRecordIdForResendEmail(resendEmailId);
    if (!sendRecordId) {
      console.warn(`Resend webhook: no send record found for email ID ${resendEmailId} (event: ${type})`);
      return NextResponse.json({ received: true });
    }

    // Increment the stat
    const stat = EVENT_TO_STAT[type as ResendEventType];
    await incrementSendStat(sendRecordId, stat);

    // On a click, also attribute gear/tickets hub links as affiliate clicks —
    // an owned proxy for email-driven affiliate traffic. Resend puts the clicked
    // URL on data.click.link.
    if (type === 'email.clicked') {
      const link: string = data.click?.link || data.link || '';
      if (/\/(gear|tickets)(\/|\?|$)/.test(link)) {
        await incrementSendStat(sendRecordId, 'affiliateClicks');
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Resend webhook error:', error);
    return NextResponse.json({ received: true });
  }
}
