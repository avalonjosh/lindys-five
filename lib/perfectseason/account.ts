/**
 * Client fetch helpers for Perfect Season leaderboard accounts. Mirrors
 * lib/utils/auth.ts (admin) but for the opt-in user session.
 */

import type { PublicUser, ScoreSubmission } from './leaderboard';

type AuthResult = { ok: true; user: PublicUser } | { ok: false; error: string };

async function postAuth(path: string, body: unknown): Promise<AuthResult> {
  try {
    const res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      credentials: 'include',
    });
    const data = await res.json();
    if (!res.ok) return { ok: false, error: data.error || 'Something went wrong' };
    return { ok: true, user: data.user };
  } catch {
    return { ok: false, error: 'Network error' };
  }
}

export const signup = (email: string, username: string, password: string, subscribe: boolean, favoriteTeam?: string) =>
  postAuth('/api/account/signup', { email, username, password, subscribe, favoriteTeam });

export const login = (emailOrUsername: string, password: string) =>
  postAuth('/api/account/login', { emailOrUsername, password });

export async function logout(): Promise<void> {
  await fetch('/api/account/logout', { method: 'POST', credentials: 'include' });
}

export async function me(): Promise<PublicUser | null> {
  try {
    const res = await fetch('/api/account/me', { credentials: 'include' });
    if (!res.ok) return null;
    const data = await res.json();
    return data.user ?? null;
  } catch {
    return null;
  }
}

export interface SubmitResult {
  board: string;
  rank: number | null;
  rating: number;
  grade: string;
  wins: number;
  losses: number;
  improved: boolean;
}

/** UI state for a leaderboard submission, shared by the result components. */
export type SubmitState = { status: 'idle' | 'submitting' | 'done' | 'error'; result?: SubmitResult; error?: string };

export async function submitScore(sub: ScoreSubmission): Promise<{ ok: true; data: SubmitResult } | { ok: false; error: string }> {
  try {
    const res = await fetch('/api/leaderboard/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sub),
      credentials: 'include',
    });
    const data = await res.json();
    if (!res.ok) return { ok: false, error: data.error || 'Submit failed' };
    return { ok: true, data };
  } catch {
    return { ok: false, error: 'Network error' };
  }
}
