/**
 * Email confirmation links for accounts: "verify" proves the account's current
 * address, "change" proves a new address before the account switches to it.
 * Same shape as password reset links: random token in the link's fragment,
 * only its SHA-256 hash in KV, single use, one live link per account and kind.
 */

import { createHash, randomBytes } from 'crypto';
import { kv } from '@vercel/kv';

export type EmailTokenKind = 'verify' | 'change';

export interface EmailTokenRecord {
  userId: string;
  /** The address the link was sent to (and is proving). */
  email: string;
  kind: EmailTokenKind;
}

export const EMAIL_TOKEN_TTL_SEC: Record<EmailTokenKind, number> = {
  verify: 7 * 24 * 60 * 60,
  change: 24 * 60 * 60,
};

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');
const tokenKey = (hash: string) => `ps:emailtoken:${hash}`;
const userTokenKey = (userId: string, kind: EmailTokenKind) => `ps:emailtoken:user:${userId}:${kind}`;

export async function createEmailToken(record: EmailTokenRecord): Promise<string> {
  const ttl = EMAIL_TOKEN_TTL_SEC[record.kind];
  const previous = await kv.get<string>(userTokenKey(record.userId, record.kind));
  if (previous) await kv.del(tokenKey(previous));

  const token = randomBytes(32).toString('base64url');
  const hash = hashToken(token);
  await kv.set(tokenKey(hash), record, { ex: ttl });
  await kv.set(userTokenKey(record.userId, record.kind), hash, { ex: ttl });
  return token;
}

/** Use up a token: the record, or null if it's unknown, used or expired. */
export async function consumeEmailToken(token: string): Promise<EmailTokenRecord | null> {
  if (!/^[A-Za-z0-9_-]{20,100}$/.test(token)) return null;
  const record = await kv.getdel<EmailTokenRecord>(tokenKey(hashToken(token)));
  if (!record) return null;
  await kv.del(userTokenKey(record.userId, record.kind));
  return record;
}

/** Drop an account's outstanding link of one kind (e.g. a superseded email change). */
export async function cancelEmailToken(userId: string, kind: EmailTokenKind): Promise<void> {
  const previous = await kv.get<string>(userTokenKey(userId, kind));
  if (previous) await kv.del(tokenKey(previous), userTokenKey(userId, kind));
}

export function confirmEmailUrl(siteUrl: string, token: string): string {
  return `${siteUrl}/account/confirm-email#token=${token}`;
}
