/**
 * Shared types + key/score helpers for the Perfect Season leaderboards.
 * Imported by both the client (submit payload, board ids) and the server
 * (KV keys, composite ordering). No server-only imports here.
 */

import type { ModeType, Sport } from './types';
import type { PickRecord } from './engine';
import type { SharedTeamRow, Variant } from './share';

export type { Variant } from './share';

// ---------------------------------------------------------------------------
// Accounts
// ---------------------------------------------------------------------------

export interface User {
  id: string;
  email: string;
  username: string;
  usernameLower: string;
  passwordHash: string;
  createdAt: string;
  authProvider: 'password';
  /** Primary favorite team slug (NHL or MLB), picked at signup or on the profile page. */
  favoriteTeam?: string;
  // Reserved for a later Google OAuth follow-up:
  googleId?: string;
}

/** The safe, public shape returned to the client. */
export interface PublicUser {
  id: string;
  username: string;
  favoriteTeam?: string;
}

export const userKey = (id: string) => `ps:user:${id}`;
export const userEmailKey = (email: string) => `ps:user:email:${email.toLowerCase()}`;
export const userNameKey = (username: string) => `ps:user:uname:${username.toLowerCase()}`;
export const userBoardsKey = (id: string) => `ps:user:boards:${id}`;

// ---------------------------------------------------------------------------
// Submission payload (client -> /api/leaderboard/submit)
// ---------------------------------------------------------------------------

/**
 * What the client posts. Only the picks are trusted as *claims* — the server
 * re-derives the score from them. `date` is required for daily; `franchiseId`
 * for franchise free play. Rounds are NOT sent: daily uses the canonical
 * schedule, free play is validated against the real era pools.
 */
export interface ScoreSubmission {
  sport: Sport;
  variant: Variant;
  modeType: ModeType;
  source: 'daily' | 'free';
  date?: string;
  franchiseId?: string;
  picks: PickRecord[];
}

// ---------------------------------------------------------------------------
// Leaderboard entries
// ---------------------------------------------------------------------------

export interface LeaderboardEntry {
  userId: string;
  username: string;
  sport: Sport;
  variant: Variant;
  modeType: ModeType;
  rating: number;
  grade: string;
  tier: string;
  wins: number;
  losses: number;
  rows: SharedTeamRow[];
  date?: string;
  franchiseId?: string;
  submittedAt: number;
}

/** One ranked row sent to the client by GET /api/leaderboard/[board]. */
export interface RankedEntry extends LeaderboardEntry {
  rank: number;
}

// ---------------------------------------------------------------------------
// Board ids — one string keys both the sorted set and the per-user entry
// ---------------------------------------------------------------------------

export type BoardKind = 'daily' | 'alltime' | 'free' | 'tank' | 'franchise';

export const dailyBoard = (sport: Sport, variant: Variant, date: string) => `daily:${sport}:${variant}:${date}`;
export const alltimeBoard = (sport: Sport, variant: Variant) => `alltime:${sport}:${variant}`;
export const freeBoard = (sport: Sport, variant: Variant) => `free:${sport}:${variant}`;
export const tankBoard = (sport: Sport, variant: Variant) => `tank:${sport}:${variant}`;
export const franchiseBoard = (sport: Sport, franchiseId: string, variant: Variant) =>
  `franchise:${sport}:${franchiseId}:${variant}`;

export const lbZKey = (board: string) => `ps:lb:z:${board}`;
export const lbEntryKey = (board: string, userId: string) => `ps:lb:entry:${board}:${userId}`;

const SPORTS = new Set<string>(['nhl', 'mlb']);
const VARIANTS = new Set<string>(['classic', 'blind']);

/** Allowlist-validate a board id from a URL segment before touching KV. */
export function isValidBoard(board: string): boolean {
  const p = board.split(':');
  if (p[0] === 'daily') return p.length === 4 && SPORTS.has(p[1]) && VARIANTS.has(p[2]) && /^\d{4}-\d{2}-\d{2}$/.test(p[3]);
  if (p[0] === 'alltime' || p[0] === 'free' || p[0] === 'tank') return p.length === 3 && SPORTS.has(p[1]) && VARIANTS.has(p[2]);
  if (p[0] === 'franchise') return p.length === 4 && SPORTS.has(p[1]) && /^[A-Za-z0-9]{2,4}$/.test(p[2]) && VARIANTS.has(p[3]);
  return false;
}

/**
 * Single float for sorted-set ordering: rating is primary (×1000), record is
 * the tiebreak. Tank already inverts rating in rosterRating (higher = better
 * tank), so we only flip the wins tiebreak so fewer wins edges ahead.
 */
export function compositeScore(rating: number, wins: number, games: number, tank: boolean): number {
  return Math.round(rating * 1000) + (tank ? games - wins : wins);
}
