import { and, asc, desc, eq, gt, max } from 'drizzle-orm';
import { db } from '@/lib/db';
import { games, windows, type Window, type Game } from '@/lib/db/schema';

// Window administration. See PICKTHEBILLS_SPEC.md section 2.
//
// Invariants enforced here:
// - At most one window is `open` at a time (the claim flow needs one target).
// - A window's locks_at must be at or before the next kickoff (nobody picks a
//   game they've already watched begin).

// The active season is the latest one we have games for.
export async function getActiveSeason(): Promise<number | null> {
  const rows = await db.select({ s: max(games.season) }).from(games);
  return rows[0]?.s ?? null;
}

// Earliest kickoff among games that have not started yet, for a season.
export async function getNextKickoff(season: number, now: Date): Promise<Date | null> {
  const rows = await db
    .select({ k: games.kickoffAt })
    .from(games)
    .where(and(eq(games.season, season), eq(games.status, 'scheduled'), gt(games.kickoffAt, now)))
    .orderBy(asc(games.kickoffAt))
    .limit(1);
  return rows[0]?.k ?? null;
}

export async function listWindows(season: number): Promise<Window[]> {
  return db.select().from(windows).where(eq(windows.season, season)).orderBy(desc(windows.opensAt));
}

export async function listGames(season: number): Promise<Game[]> {
  return db.select().from(games).where(eq(games.season, season)).orderBy(asc(games.kickoffAt));
}

export interface CreateWindowInput {
  label: string;
  type: 'baseline' | 'scheduled' | 'event';
  locksAt?: Date; // defaults to next kickoff
}

export interface CreateWindowResult {
  window?: Window;
  error?: string;
}

// Open a new window. Auto-computes locks_at = next kickoff when not given,
// validates locks_at <= next kickoff, and locks any other open window first
// to preserve the single-open invariant.
export async function createWindow(input: CreateWindowInput, now: Date): Promise<CreateWindowResult> {
  const season = await getActiveSeason();
  if (season === null) return { error: 'No season loaded. Refresh the schedule first.' };

  const nextKickoff = await getNextKickoff(season, now);
  if (!nextKickoff) return { error: 'No upcoming games. The season may be over.' };

  const locksAt = input.locksAt ?? nextKickoff;
  if (locksAt.getTime() > nextKickoff.getTime()) {
    return { error: `locks_at must be at or before the next kickoff (${nextKickoff.toISOString()}).` };
  }
  if (locksAt.getTime() <= now.getTime()) {
    return { error: 'locks_at is already in the past.' };
  }

  // Enforce single-open invariant: lock any currently-open window first.
  await db.update(windows).set({ status: 'locked' }).where(and(eq(windows.season, season), eq(windows.status, 'open')));

  const [created] = await db
    .insert(windows)
    .values({
      season,
      label: input.label,
      type: input.type,
      opensAt: now,
      locksAt,
      status: 'open',
    })
    .returning();

  return { window: created };
}

export async function lockWindow(id: string): Promise<Window | null> {
  const [updated] = await db.update(windows).set({ status: 'locked' }).where(eq(windows.id, id)).returning();
  return updated ?? null;
}

// The single currently-open, not-yet-locked window for the active season.
// Used by the pick-submit path to resolve where picks are written.
export async function getOpenWindow(season: number, now: Date): Promise<Window | null> {
  const rows = await db
    .select()
    .from(windows)
    .where(and(eq(windows.season, season), eq(windows.status, 'open'), gt(windows.locksAt, now)))
    .orderBy(desc(windows.opensAt))
    .limit(1);
  return rows[0] ?? null;
}
