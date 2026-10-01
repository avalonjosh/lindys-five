'use client';

import { useCallback, useEffect, useState } from 'react';
import { me, saveAccountTeams } from '@/lib/perfectseason/account';
import { setFavoritesRemote, syncAccountTeams } from '@/lib/favorites';
import type { PublicUser } from '@/lib/perfectseason/leaderboard';

// Stars toggled in quick succession go up as one save.
let pushTimer: ReturnType<typeof setTimeout> | null = null;
function pushTeams(list: string[]) {
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    pushTimer = null;
    saveAccountTeams(list);
  }, 600);
}

/** Point the local favorites list at the account (or detach it when signed out). */
function connectFavorites(user: PublicUser | null) {
  if (user) {
    syncAccountTeams(user, pushTeams);
    setFavoritesRemote(pushTeams);
  } else {
    setFavoritesRemote(null);
  }
}

/** Tracks the opt-in leaderboard account (or null). Re-checkable via refresh().
 * Whenever the account loads, the local favorites (hamburger stars) and the
 * account's My Teams are reconciled so the two never drift apart. */
const USER_EVENT = 'l5-user-change';

export function useCurrentUser() {
  const [user, setUserState] = useState<PublicUser | null>(null);
  const [loading, setLoading] = useState(true);

  const setUser = useCallback((next: PublicUser | null) => {
    connectFavorites(next);
    setUserState(next);
    // Other components on the page (the header's account chip) follow sign-in/out.
    window.dispatchEvent(new CustomEvent<PublicUser | null>(USER_EVENT, { detail: next }));
  }, []);

  const refresh = useCallback(async () => {
    const current = await me();
    connectFavorites(current);
    setUserState(current);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
    const onChange = (e: Event) => setUserState((e as CustomEvent<PublicUser | null>).detail);
    window.addEventListener(USER_EVENT, onChange);
    return () => window.removeEventListener(USER_EVENT, onChange);
  }, [refresh]);

  return { user, loading, refresh, setUser };
}
