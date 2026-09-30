// Media outreach contacts and the two-step sequence (first email, one
// follow-up). Emails are sent by hand; this only tracks where each contact is.

export type OutreachStatus =
  | 'not_contacted'
  | 'contacted'
  | 'responded'
  | 'converted'
  | 'declined'
  | 'bounced';

export type OutreachChannel = 'email' | 'x';

export interface OutreachContact {
  id: string;
  name: string;
  outlet: string;
  type: 'blog' | 'podcast' | 'beat_writer' | 'radio' | 'tv' | 'other';
  team: string;
  email: string;
  twitter: string;
  website: string;
  notes: string;
  status: OutreachStatus;
  /** How the first message went out. */
  channel?: OutreachChannel;
  /** First message sent. */
  contactedAt?: string;
  followupSentAt?: string;
  respondedAt?: string;
  /** Next follow-up date, YYYY-MM-DD (Eastern). Cleared once there is nothing left to do. */
  nextActionAt?: string;
  /** One line on what came of it ("linked it Oct 3", "will mention on the pod"). */
  outcome?: string;
  createdAt: string;
  updatedAt: string;
}

export const FOLLOWUP_DAYS = 7;

/** Today's date in Eastern Time as YYYY-MM-DD. */
export function easternDate(d: Date = new Date()): string {
  return d.toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
}

export function addDays(ymd: string, days: number): string {
  const d = new Date(`${ymd}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export type OutreachEvent =
  | { kind: 'sent'; at?: string; channel?: OutreachChannel }
  | { kind: 'followup'; at?: string }
  | { kind: 'replied'; at?: string; outcome?: string }
  | { kind: 'converted'; outcome?: string }
  | { kind: 'declined'; outcome?: string }
  | { kind: 'bounced' };

/** Apply one thing that happened to a contact and return the updated record. */
export function applyOutreachEvent(contact: OutreachContact, event: OutreachEvent): OutreachContact {
  const now = new Date().toISOString();
  const next: OutreachContact = { ...contact, updatedAt: now };
  switch (event.kind) {
    case 'sent': {
      const at = event.at ?? now;
      next.status = 'contacted';
      next.contactedAt = contact.contactedAt ?? at;
      next.channel = event.channel ?? contact.channel ?? (contact.email ? 'email' : 'x');
      next.nextActionAt = addDays(easternDate(new Date(at)), FOLLOWUP_DAYS);
      break;
    }
    case 'followup':
      next.followupSentAt = event.at ?? now;
      next.nextActionAt = undefined;
      break;
    case 'replied':
      next.status = 'responded';
      next.respondedAt = contact.respondedAt ?? event.at ?? now;
      next.nextActionAt = undefined;
      if (event.outcome) next.outcome = event.outcome;
      break;
    case 'converted':
    case 'declined':
      next.status = event.kind;
      next.respondedAt = contact.respondedAt ?? now;
      next.nextActionAt = undefined;
      if (event.outcome) next.outcome = event.outcome;
      break;
    case 'bounced':
      next.status = 'bounced';
      next.nextActionAt = undefined;
      break;
  }
  return next;
}

/** Waiting on a reply to the first message, follow-up not sent yet, and its date has arrived. */
export function isFollowupDue(c: OutreachContact, today: string = easternDate()): boolean {
  return c.status === 'contacted' && !c.followupSentAt && !!c.nextActionAt && c.nextActionAt <= today;
}

/** Short description of where a contact is in the sequence, or '' before the first message. */
export function sequenceLabel(c: OutreachContact): string {
  const short = (iso: string) =>
    new Date(iso.length === 10 ? `${iso}T12:00:00Z` : iso).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', timeZone: 'America/New_York',
    });
  if (!c.contactedAt) return '';
  const parts = [`${c.channel === 'x' ? 'X message' : 'Email 1'} ${short(c.contactedAt)}`];
  if (c.followupSentAt) parts.push(`follow-up ${short(c.followupSentAt)}`);
  else if (c.status === 'contacted' && c.nextActionAt) parts.push(`follow-up due ${short(c.nextActionAt)}`);
  if (c.respondedAt) parts.push(`replied ${short(c.respondedAt)}`);
  return parts.join(' · ');
}
