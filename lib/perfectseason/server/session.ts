/**
 * User session helpers for the Perfect Season leaderboard accounts. A separate
 * auth realm from admin: its own cookie (`l5_user`) and secret
 * (`USER_SESSION_SECRET`), so it never grants admin access and is never required
 * anywhere else on the site. Mirrors the admin jose JWT pattern.
 */

import type { NextRequest } from 'next/server';
import { SignJWT, jwtVerify } from 'jose';

export const USER_COOKIE = 'l5_user';
const MAX_AGE = 30 * 24 * 60 * 60; // 30 days

function secret(): Uint8Array {
  return new TextEncoder().encode(process.env.USER_SESSION_SECRET);
}

export async function signUserToken(userId: string): Promise<string> {
  return new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(secret());
}

export const userCookieOptions = {
  path: '/',
  httpOnly: true,
  // lax (not strict) so following a shared leaderboard link keeps you signed in.
  sameSite: 'lax' as const,
  maxAge: MAX_AGE,
  secure: process.env.NODE_ENV === 'production',
};

export const clearedUserCookie = { ...userCookieOptions, maxAge: 0 };

/** The signed-in user id from the request cookie, or null. */
export async function getUserId(request: NextRequest): Promise<string | null> {
  const token = request.cookies.get(USER_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return typeof payload.sub === 'string' ? payload.sub : null;
  } catch {
    return null;
  }
}
