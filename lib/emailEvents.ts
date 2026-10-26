/**
 * Newsletter opt-in / opt-out log, so the admin Subscribers tab can show which
 * emails people leave from. Every unsubscribe link carries the send record id
 * (`&s=`), which names the program (weekly digest, game recap, ...) the person
 * was reading when they left. Best-effort: logging never blocks the action.
 */

import { kv } from '@vercel/kv';
import type { EmailSendRecord, NewsletterSubscriber } from './types';

export type EmailEventKind =
  | 'subscribed'    // signed up (unconfirmed until 'confirmed' unless single opt-in)
  | 'confirmed'     // clicked the verify link / account email confirmed
  | 'resubscribed'
  | 'unsubscribed'  // everything off
  | 'kind-off'      // one kind of email switched off (detail = kind)
  | 'kind-on'
  | 'team-off'      // one team's recaps dropped
  | 'team-on'
  | 'complained'    // marked as spam (also unsubscribes)
  | 'bounced';      // hard bounce (also unsubscribes)

export type EmailEventVia = 'email-link' | 'one-click' | 'account' | 'signup' | 'webhook' | 'account-delete';

export interface EmailEvent {
  at: string;
  kind: EmailEventKind;
  subscriberId: string;
  via: EmailEventVia;
  /** Program of the email the action came from (from the send record). */
  campaign?: string;
  sendId?: string;
  /** Days between confirming and this event (opt-outs only). */
  daysSubscribed?: number;
  team?: string;
  /** Email kind for kind-on/off, signup source for subscribed. */
  detail?: string;
}

const KEY = 'email:events';
const MAX_EVENTS = 5000;

export interface EventContext {
  via: EmailEventVia;
  sendId?: string | null;
}

export async function logEmailEvent(
  sub: Pick<NewsletterSubscriber, 'id' | 'createdAt' | 'verifiedAt'>,
  kind: EmailEventKind,
  ctx: EventContext,
  extra: { team?: string; detail?: string } = {},
): Promise<void> {
  try {
    const sendId = ctx.sendId && /^[\w-]{8,64}$/.test(ctx.sendId) ? ctx.sendId : undefined;
    const send = sendId ? await kv.get<EmailSendRecord>(`email:send:${sendId}`) : null;
    const since = sub.verifiedAt || sub.createdAt;
    const event: EmailEvent = {
      at: new Date().toISOString(),
      kind,
      subscriberId: sub.id,
      via: ctx.via,
      ...(send ? { sendId, campaign: send.campaign ?? 'other' } : {}),
      ...(since && !['subscribed', 'confirmed', 'resubscribed'].includes(kind)
        ? { daysSubscribed: Math.max(0, Math.floor((Date.now() - Date.parse(since)) / 86_400_000)) }
        : {}),
      ...extra,
    };
    await kv.zadd(KEY, { score: Date.now(), member: JSON.stringify({ ...event, n: crypto.randomUUID().slice(0, 8) }) });
    await kv.zremrangebyrank(KEY, 0, -(MAX_EVENTS + 1));
  } catch (err) {
    console.error('Email event log failed:', err);
  }
}

export async function getEmailEvents(sinceMs: number): Promise<EmailEvent[]> {
  const rows = (await kv.zrange<(string | EmailEvent)[]>(KEY, sinceMs, Date.now(), { byScore: true })) ?? [];
  return rows
    .map((r) => (typeof r === 'string' ? (JSON.parse(r) as EmailEvent) : r))
    .reverse();
}
