/**
 * Ko-fi tips. Ko-fi posts every payment to /api/webhook/kofi; we keep a small
 * record of each (no email address) for the admin Earnings tab.
 */

import { kv } from '@vercel/kv';

export interface KofiTip {
  id: string; // Ko-fi message_id
  timestamp: string; // ISO
  type: string; // Donation | Subscription | Commission | Shop Order
  fromName: string;
  amount: number;
  currency: string;
  message: string | null;
  isPublic: boolean;
  isSubscription: boolean;
  isFirstSubscription: boolean;
  tierName: string | null;
}

export interface KofiSummary {
  configured: boolean;
  total: number;
  count: number;
  /** Payments that are part of a monthly membership. */
  monthlyCount: number;
  /** Tips in currencies other than USD aren't added to the totals. */
  otherCurrency: number;
  recent: KofiTip[];
  /** When Ko-fi's test webhook last arrived (ISO), if ever. */
  lastTestAt: string | null;
}

const tipKey = (id: string) => `kofi:tip:${id}`;
const TIPS = 'kofi:tips';
const LAST_TEST = 'kofi:last-test';

/** Ko-fi's test payload proves the webhook is wired up; it isn't a real tip. */
export async function markKofiTest(): Promise<void> {
  await kv.set(LAST_TEST, new Date().toISOString());
}

/** Store one tip; false when this message id was already recorded (Ko-fi retries). */
export async function saveKofiTip(tip: KofiTip): Promise<boolean> {
  const fresh = await kv.set(tipKey(tip.id), tip, { nx: true });
  if (!fresh) return false;
  await kv.zadd(TIPS, { score: Date.parse(tip.timestamp) || Date.now(), member: tip.id });
  return true;
}

/** Tips received between `from` and `to` (default now), newest first, with USD totals. */
export async function getKofiSummary(from: Date, to: Date = new Date()): Promise<KofiSummary> {
  const configured = !!process.env.KOFI_VERIFICATION_TOKEN;
  const lastTestAt = await kv.get<string>(LAST_TEST);
  const ids = (await kv.zrange<string[]>(TIPS, from.getTime(), to.getTime(), { byScore: true })) ?? [];
  const tips = ids.length ? (await kv.mget<(KofiTip | null)[]>(...ids.map(tipKey))).filter((t): t is KofiTip => !!t) : [];
  tips.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  const usd = tips.filter(t => t.currency.toUpperCase() === 'USD');
  return {
    configured,
    total: Math.round(usd.reduce((s, t) => s + t.amount, 0) * 100) / 100,
    count: tips.length,
    monthlyCount: tips.filter(t => t.isSubscription).length,
    otherCurrency: tips.length - usd.length,
    recent: tips.slice(0, 30),
    lastTestAt: lastTestAt ?? null,
  };
}
