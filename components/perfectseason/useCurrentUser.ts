'use client';

import { useCallback, useEffect, useState } from 'react';
import { me } from '@/lib/perfectseason/account';
import type { PublicUser } from '@/lib/perfectseason/leaderboard';

/** Tracks the opt-in leaderboard account (or null). Re-checkable via refresh(). */
export function useCurrentUser() {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setUser(await me());
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { user, loading, refresh, setUser };
}
