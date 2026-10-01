'use client';

import { useEffect, useState } from 'react';

/**
 * The signed-in account's newsletter standing, shared by every signup surface
 * on a page (one request per page load). Signed-out visitors get
 * { signedIn: false } and surfaces fall back to their browser-flag behavior.
 */
export interface NewsletterStatus {
  loading: boolean;
  signedIn: boolean;
  email?: string;
  subscribed: boolean;
  unsubscribed: boolean;
  teams: string[];
}

const SIGNED_OUT: NewsletterStatus = { loading: false, signedIn: false, subscribed: false, unsubscribed: false, teams: [] };

let pending: Promise<NewsletterStatus> | null = null;
const listeners = new Set<(s: NewsletterStatus) => void>();
let current: NewsletterStatus | null = null;

function load(): Promise<NewsletterStatus> {
  if (!pending) {
    pending = fetch('/api/newsletter/status', { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : { signedIn: false }))
      .then((d) => (d.signedIn
        ? { loading: false, signedIn: true, email: d.email, subscribed: !!d.subscribed, unsubscribed: !!d.unsubscribed, teams: d.teams ?? [] }
        : SIGNED_OUT))
      .catch(() => SIGNED_OUT)
      .then((s) => {
        current = s;
        return s;
      });
  }
  return pending;
}

/** After a one-tap signup, update every surface on the page at once. */
export function markSubscribed(team?: string) {
  const base = current ?? SIGNED_OUT;
  current = { ...base, subscribed: true, unsubscribed: false, teams: team && !base.teams.includes(team) ? [...base.teams, team] : base.teams };
  pending = Promise.resolve(current);
  for (const l of listeners) l(current);
}

export function useNewsletterStatus(): NewsletterStatus {
  const [status, setStatus] = useState<NewsletterStatus>(current ?? { ...SIGNED_OUT, loading: true });
  useEffect(() => {
    let alive = true;
    load().then((s) => alive && setStatus(s));
    listeners.add(setStatus);
    return () => {
      alive = false;
      listeners.delete(setStatus);
    };
  }, []);
  return status;
}

/** Subscribe the signed-in account's own email (optionally to a team).
 * 'pending' = recorded, but starts only once the account email is confirmed. */
export async function accountSubscribe(team?: string, source?: string): Promise<'active' | 'pending' | false> {
  try {
    const res = await fetch('/api/newsletter/account-subscribe', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ team, source }),
    });
    if (!res.ok) return false;
    const data = await res.json().catch(() => ({}));
    markSubscribed(team);
    try {
      localStorage.setItem('newsletter-subscribed', '1');
    } catch {
      /* ignore */
    }
    return data.pending ? 'pending' : 'active';
  } catch {
    return false;
  }
}
