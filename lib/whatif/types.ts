/**
 * Shared types + KV key helpers for saved What-If picks. Imported by both the
 * client (save payload, account page) and the server (KV keys). No server-only
 * imports here — mirrors lib/perfectseason/leaderboard.ts.
 */

export type WhatIfSport = 'nhl'; // 'mlb' / 'nfl' are planned follow-ups
export type WhatIfOutcome = 'W' | 'OTL' | 'L';

/** One simulated game inside a save. Enough to render history without a schedule fetch. */
export interface WhatIfPick {
  gameId: number;
  date: string; // game date, YYYY-MM-DD
  opponentAbbrev: string;
  isHome: boolean;
  outcome: WhatIfOutcome;
}

/** Snapshot of what the tracker showed at save time. */
export interface WhatIfSummary {
  gamesPicked: number;
  record: string; // "8-2-1" W-L-OTL of the picks themselves
  projectedPoints: number;
  playoffOdds: number; // 0-100, whatIfProbability at save time
  totalPoints: number;
  gamesPlayed: number; // real games played at save time
  setsCovered: { set: number; picked: number; of: number }[];
}

export interface WhatIfSave {
  userId: string;
  sport: WhatIfSport;
  teamId: string; // slug, e.g. 'sabres'
  season: string; // e.g. '20262027'
  savedDate: string; // YYYY-MM-DD Eastern — the locked date; one save per team per day
  savedAt: number; // ms timestamp; last write wins on same-day overwrite
  picks: WhatIfPick[];
  summary: WhatIfSummary;
}

/** What the client posts to /api/whatif/save. Server stamps userId + savedDate. */
export interface WhatIfSubmission {
  sport: WhatIfSport;
  teamId: string;
  season: string;
  picks: WhatIfPick[];
  summary: WhatIfSummary;
}

// ---------------------------------------------------------------------------
// KV keys
// ---------------------------------------------------------------------------

/** Full save record. Same-day re-save hits the same key = overwrite. */
export const whatIfSaveKey = (userId: string, sport: string, teamId: string, season: string, savedDate: string) =>
  `whatif:save:${userId}:${sport}:${teamId}:${season}:${savedDate}`;

/**
 * Per-user index: sorted set of `${sport}:${teamId}:${season}:${savedDate}`
 * members scored by savedAt. zadd on an existing member just updates the
 * score, so same-day overwrite is free here too.
 */
export const whatIfIndexKey = (userId: string) => `whatif:index:${userId}`;

export const whatIfIndexMember = (sport: string, teamId: string, season: string, savedDate: string) =>
  `${sport}:${teamId}:${season}:${savedDate}`;
