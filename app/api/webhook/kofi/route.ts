import { NextRequest, NextResponse } from 'next/server';
import { markKofiTest, saveKofiTip } from '@/lib/kofi';

/**
 * Ko-fi payment webhook. Ko-fi posts form data with one field, `data`, a JSON
 * string that carries the verification token from Ko-fi's API settings.
 * Anything without the right token is rejected.
 */
export async function POST(request: NextRequest) {
  const token = process.env.KOFI_VERIFICATION_TOKEN;
  if (!token) return NextResponse.json({ error: 'Not configured' }, { status: 503 });

  let data: Record<string, unknown>;
  try {
    const form = await request.formData();
    data = JSON.parse(String(form.get('data') ?? ''));
  } catch {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  }
  if (data.verification_token !== token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Ko-fi's "send test" button posts a made-up supporter (Jo Example, an
  // example.com address): note that it arrived instead of counting it as a tip.
  if (typeof data.email === 'string' && data.email.toLowerCase().endsWith('@example.com')) {
    await markKofiTest();
    return NextResponse.json({ ok: true, test: true });
  }

  const id = String(data.message_id ?? data.kofi_transaction_id ?? '');
  const amount = Number(data.amount);
  if (!id || !Number.isFinite(amount)) return NextResponse.json({ error: 'Bad request' }, { status: 400 });

  const isPublic = data.is_public !== false;
  await saveKofiTip({
    id,
    timestamp: typeof data.timestamp === 'string' ? data.timestamp : new Date().toISOString(),
    type: String(data.type ?? 'Donation'),
    fromName: String(data.from_name || 'Someone'),
    amount,
    currency: String(data.currency || 'USD'),
    message: typeof data.message === 'string' && data.message.trim() ? data.message.trim().slice(0, 500) : null,
    isPublic,
    isSubscription: data.is_subscription_payment === true,
    isFirstSubscription: data.is_first_subscription_payment === true,
    tierName: typeof data.tier_name === 'string' ? data.tier_name : null,
  });
  return NextResponse.json({ ok: true });
}
