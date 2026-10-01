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
  /** How the account was created. A Google account may have no password (`passwordHash` ''). */
  authProvider: 'password' | 'google';
  /** Main team slug (NHL, MLB or NFL): colors the profile, default for recaps. Always `teams[0]` once My Teams is in use. */
  favoriteTeam?: string;
  /** "My Teams": every team the user follows, in their order. Mirrors the hamburger stars across devices. */
  teams?: string[];
  /** Google account id (`sub`) once Sign in with Google is linked. */
  googleId?: string;
  /** Last password change (reset or settings). Sessions issued before it are rejected. */
  passwordChangedAt?: string;
  /** Set once the user has proven they read this inbox (confirm link, password reset, newsletter confirm). */
  emailVerifiedAt?: string;
  /** New address awaiting confirmation; the account switches only when its link is clicked. */
  pendingEmail?: string;
  /** Last username change (one every 30 days). */
  usernameChangedAt?: string;
}

const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;
// A tiny denylist; usernames are public on the leaderboard.
const USERNAME_DENY = /(admin|moderator|f[u\*]ck|sh[i\*]t|n[i1]gg|c[u\*]nt|rape)/i;

/** An error message for an unusable username, or null if it's fine. */
export function usernameProblem(username: string): string | null {
  return USERNAME_RE.test(username) && !USERNAME_DENY.test(username) ? null : 'Username must be 3–20 letters, numbers, or underscores';
}

/** The safe, public shape returned to the client. */
export interface PublicUser {
  id: string;
  username: string;
  favoriteTeam?: string;
  teams?: string[];
}

/** The account's teams, including the main one (older accounts only have `favoriteTeam`). */
export function userTeams(user: User): string[] {
  const teams = user.teams ?? [];
  return user.favoriteTeam && !teams.includes(user.favoriteTeam) ? [user.favoriteTeam, ...teams] : teams;
}

/** What the client gets back about the signed-in account. */
export function publicUser(user: User): PublicUser {
  return { id: user.id, username: user.username, favoriteTeam: user.favoriteTeam, teams: userTeams(user) };
}

export const userKey = (id: string) => `ps:user:${id}`;
export const userEmailKey = (email: string) => `ps:user:email:${email.toLowerCase()}`;
export const userGoogleKey = (googleId: string) => `ps:user:google:${googleId}`;
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
