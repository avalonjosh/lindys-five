/**
 * Password reset links. The link carries a random token; KV stores only its
 * SHA-256 hash, so a leaked KV value can't be used as a link. One live token
 * per account (asking again cancels the previous link), single use, 1 hour.
 */

import { createHash, randomBytes } from 'crypto';
import { kv } from '@vercel/kv';

export const RESET_TTL_SEC = 60 * 60;

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');
const tokenKey = (hash: string) => `ps:pwreset:${hash}`;
const userTokenKey = (userId: string) => `ps:pwreset:user:${userId}`;

/** Create a reset token for the account and return it (raw, for the link only). */
export async function createResetToken(userId: string): Promise<string> {
  const previous = await kv.get<string>(userTokenKey(userId));
  if (previous) await kv.del(tokenKey(previous));

  const token = randomBytes(32).toString('base64url');
  const hash = hashToken(token);
  await kv.set(tokenKey(hash), userId, { ex: RESET_TTL_SEC });
  await kv.set(userTokenKey(userId), hash, { ex: RESET_TTL_SEC });
  return token;
}

/** Use up a token: returns the account id, or null if it's unknown, used or expired. */
export async function consumeResetToken(token: string): Promise<string | null> {
  if (!/^[A-Za-z0-9_-]{20,100}$/.test(token)) return null;
  const hash = hashToken(token);
  const userId = await kv.getdel<string>(tokenKey(hash));
  if (!userId) return null;
  await kv.del(userTokenKey(userId));
  return userId;
}

/** The link sent by email. The token rides in the fragment so it never reaches
 * server logs, analytics or a Referer header. */
export function resetUrl(siteUrl: string, token: string): string {
  return `${siteUrl}/account/reset#token=${token}`;
}
