/**
 * Sign in with Google (OAuth 2.0 authorization code + PKCE), on our own
 * session cookie: no auth library. Needs AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET
 * and the redirect URI {site}/api/auth/callback/google on the Google client.
 */

import { createHash, randomBytes } from 'crypto';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { kv } from '@vercel/kv';
import { userKey, userEmailKey, userNameKey, userGoogleKey, usernameProblem, type User } from '../leaderboard';

export const GOOGLE_STATE_COOKIE = 'l5_google_oauth';
const JWKS = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));

export const googleEnabled = () => !!process.env.AUTH_GOOGLE_ID && !!process.env.AUTH_GOOGLE_SECRET;

export const redirectUri = (origin: string) => `${origin}/api/auth/callback/google`;

/** Only same-site paths survive the round trip (no open redirects). */
export function safeNext(next: string | null | undefined): string {
  return next && next.startsWith('/') && !next.startsWith('//') ? next : '/account';
}

export function startState() {
  const state = randomBytes(16).toString('base64url');
  const verifier = randomBytes(32).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  return { state, verifier, challenge };
}

export function authorizeUrl(origin: string, state: string, challenge: string): string {
  const u = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  u.searchParams.set('client_id', process.env.AUTH_GOOGLE_ID!);
  u.searchParams.set('redirect_uri', redirectUri(origin));
  u.searchParams.set('response_type', 'code');
  u.searchParams.set('scope', 'openid email profile');
  u.searchParams.set('state', state);
  u.searchParams.set('code_challenge', challenge);
  u.searchParams.set('code_challenge_method', 'S256');
  u.searchParams.set('prompt', 'select_account');
  return u.toString();
}

export interface GoogleProfile {
  sub: string;
  email: string;
  emailVerified: boolean;
  name?: string;
}

/** Trade the code for an ID token and verify it against Google's keys. */
export async function exchangeCode(origin: string, code: string, verifier: string): Promise<GoogleProfile> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.AUTH_GOOGLE_ID!,
      client_secret: process.env.AUTH_GOOGLE_SECRET!,
      redirect_uri: redirectUri(origin),
      grant_type: 'authorization_code',
      code_verifier: verifier,
    }),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`token exchange ${res.status}`);
  const { id_token } = (await res.json()) as { id_token?: string };
  if (!id_token) throw new Error('no id_token');
  const { payload } = await jwtVerify(id_token, JWKS, {
    audience: process.env.AUTH_GOOGLE_ID,
    issuer: ['https://accounts.google.com', 'accounts.google.com'],
  });
  if (typeof payload.sub !== 'string' || typeof payload.email !== 'string') throw new Error('missing claims');
  return {
    sub: payload.sub,
    email: payload.email.toLowerCase(),
    emailVerified: payload.email_verified === true,
    name: typeof payload.name === 'string' ? payload.name : undefined,
  };
}

/** A free username from the Google name or email ("josh_r", "josh_r2", ...). */
async function pickUsername(profile: GoogleProfile): Promise<string> {
  const raw = (profile.name ?? profile.email.split('@')[0]).normalize('NFD').replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  let base = raw.slice(0, 16) || 'fan';
  if (base.length < 3) base = `${base}_fan`;
  for (let i = 0; i < 50; i++) {
    const candidate = i === 0 ? base : `${base.slice(0, 16)}${i + 1}`;
    if (usernameProblem(candidate)) continue;
    if (await kv.set(userNameKey(candidate), '__pending__', { nx: true })) return candidate;
  }
  const fallback = `fan_${randomBytes(4).toString('hex')}`;
  await kv.set(userNameKey(fallback), '__pending__');
  return fallback;
}

/**
 * The account for this Google profile: already linked, or an existing account
 * with the same (Google-verified) email gets linked, or a new account is made.
 */
export async function findOrCreateGoogleUser(profile: GoogleProfile): Promise<{ user: User; created: boolean }> {
  const linkedId = await kv.get<string>(userGoogleKey(profile.sub));
  if (linkedId) {
    const user = await kv.get<User>(userKey(linkedId));
    if (user) return { user, created: false };
  }
  if (!profile.emailVerified) throw new Error('Google email not verified');

  const now = new Date().toISOString();
  const existingId = await kv.get<string>(userEmailKey(profile.email));
  if (existingId) {
    const existing = await kv.get<User>(userKey(existingId));
    if (existing) {
      const user: User = { ...existing, googleId: profile.sub, emailVerifiedAt: existing.emailVerifiedAt ?? now };
      await kv.set(userKey(existing.id), user);
      await kv.set(userGoogleKey(profile.sub), existing.id);
      return { user, created: false };
    }
  }

  const id = crypto.randomUUID();
  const username = await pickUsername(profile);
  const user: User = {
    id,
    email: profile.email,
    username,
    usernameLower: username.toLowerCase(),
    passwordHash: '',
    createdAt: now,
    authProvider: 'google',
    googleId: profile.sub,
    emailVerifiedAt: now,
  };
  await Promise.all([
    kv.set(userKey(id), user),
    kv.set(userEmailKey(profile.email), id),
    kv.set(userNameKey(username), id),
    kv.set(userGoogleKey(profile.sub), id),
  ]);
  return { user, created: true };
}
