/**
 * Edge-safe lookups for streak cards (no datasets): the share page and the OG
 * image route find a card by its id alone.
 */

import { kv } from '@vercel/kv';
import { userKey, type User } from './leaderboard';
import type { StreakCard } from './cards';

export const cardsKey = (userId: string) => `ps:cards:${userId}`;
/** cardId -> owner's user id, so a shared card link resolves without a sign-in. */
export const cardRefKey = (cardId: string) => `ps:cardref:${cardId}`;

/** A card and its owner's public username, or null (bad id, or the account was deleted). */
export async function getCardById(cardId: string): Promise<{ card: StreakCard; username: string } | null> {
  if (!/^[0-9a-f-]{36}$/i.test(cardId)) return null;
  const userId = await kv.get<string>(cardRefKey(cardId));
  if (!userId) return null;
  const [card, user] = await Promise.all([kv.hget<StreakCard>(cardsKey(userId), cardId), kv.get<User>(userKey(userId))]);
  if (!card || !user) return null;
  return { card, username: user.username };
}
