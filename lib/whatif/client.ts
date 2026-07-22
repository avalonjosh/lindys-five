/**
 * Client fetch helpers for saved What-If picks. Mirrors
 * lib/perfectseason/account.ts.
 */

import type { WhatIfSave, WhatIfSubmission } from './types';

export interface SavePicksResult {
  save: WhatIfSave;
  replacedToday: boolean;
}

export async function saveWhatIfPicks(
  sub: WhatIfSubmission
): Promise<{ ok: true; data: SavePicksResult } | { ok: false; error: string; needsAuth?: boolean }> {
  try {
    const res = await fetch('/api/whatif/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sub),
      credentials: 'include',
    });
    const data = await res.json();
    if (!res.ok) return { ok: false, error: data.error || 'Save failed', needsAuth: res.status === 401 };
    return { ok: true, data };
  } catch {
    return { ok: false, error: 'Network error' };
  }
}

/** Delete one saved pick set. Returns whether anything was removed. */
export async function deleteWhatIfSave(
  sport: string,
  teamId: string,
  season: string,
  savedDate: string
): Promise<{ ok: true; deleted: boolean } | { ok: false; error: string }> {
  try {
    const res = await fetch('/api/whatif/save', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sport, teamId, season, savedDate }),
      credentials: 'include',
    });
    const data = await res.json();
    if (!res.ok) return { ok: false, error: data.error || 'Delete failed' };
    return { ok: true, deleted: data.deleted === true };
  } catch {
    return { ok: false, error: 'Network error' };
  }
}

/** All of the signed-in user's saves, newest first. */
export async function fetchWhatIfSaves(): Promise<WhatIfSave[] | null> {
  try {
    const res = await fetch('/api/whatif/saves', { credentials: 'include' });
    if (!res.ok) return null;
    const data = await res.json();
    return data.saves ?? [];
  } catch {
    return null;
  }
}

/** The most recent save for one team, or null. */
export async function fetchLatestWhatIfSave(
  sport: string,
  teamId: string,
  season: string
): Promise<WhatIfSave | null> {
  try {
    const params = new URLSearchParams({ sport, team: teamId, season, latest: '1' });
    const res = await fetch(`/api/whatif/saves?${params}`, { credentials: 'include' });
    if (!res.ok) return null;
    const data = await res.json();
    return data.saves?.[0] ?? null;
  } catch {
    return null;
  }
}
