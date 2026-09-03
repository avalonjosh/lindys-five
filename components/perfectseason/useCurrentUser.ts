'use client';

import { useCallback, useEffect, useState } from 'react';
import { me } from '@/lib/perfectseason/account';
import { syncAccountFavorite } from '@/lib/favorites';
import type { PublicUser } from '@/lib/perfectseason/leaderboard';

/** Tracks the opt-in leaderboard account (or null). Re-checkable via refresh().
 * Whenever the account loads, its favorite team is merged into the local
 * favorites (hamburger stars) so the two never drift apart. */
export function useCurrentUser() {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const current = await me();
    syncAccountFavorite(current?.favoriteTeam);
    setUser(current);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { user, loading, refresh, setUser };
}
