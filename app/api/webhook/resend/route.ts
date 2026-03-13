import { NextRequest, NextResponse } from 'next/server';
import { getSendRecordIdForResendEmail, incrementSendStat } from '@/lib/email';

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
    const body = await request.json();
    const { type, data } = body;

    if (!type || !data) {
      return NextResponse.json({ received: true });
    }

    // Only process events we care about
    if (!VALID_EVENTS.includes(type)) {
      return NextResponse.json({ received: true });
    }

    const resendEmailId = data.email_id;
    if (!resendEmailId) {
      return NextResponse.json({ received: true });
    }

    // Look up which send record this email belongs to
    const sendRecordId = await getSendRecordIdForResendEmail(resendEmailId);
    if (!sendRecordId) {
      return NextResponse.json({ received: true });
    }

    // Increment the stat
    const stat = EVENT_TO_STAT[type as ResendEventType];
    await incrementSendStat(sendRecordId, stat);

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Resend webhook error:', error);
    return NextResponse.json({ received: true });
  }
}
