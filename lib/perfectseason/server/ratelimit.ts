/**
 * Minimal KV-backed fixed-window rate limiter for the account/leaderboard
 * routes. Matches the repo's lightweight approach — no extra dependencies.
 */

import { kv } from '@vercel/kv';
import type { NextRequest } from 'next/server';

/** Returns true if the action is allowed, false once the window limit is hit. */
export async function rateLimit(key: string, limit: number, windowSec: number): Promise<boolean> {
  const n = await kv.incr(key);
  if (n === 1) await kv.expire(key, windowSec);
  return n <= limit;
}

export function clientIp(request: NextRequest): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
}
