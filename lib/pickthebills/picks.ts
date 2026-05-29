import { and, eq, inArray } from 'drizzle-orm';
import { db } from '@/lib/db';
import { games, picks } from '@/lib/db/schema';
import { getActiveSeason, getOpenWindow } from './windows';

// Authenticated pick submission. See PICKTHEBILLS_SPEC.md sections 2 and 4.
//
// Picks are append-only. "Overwriting" an earlier pick (within the open window)
// is done by appending a newer row, never deleting; the effective-pick query
// supersedes by created_at. We only block on first submit when the user already
// has picks in the open window (the confirmOverwrite handshake) so a re-submit
// is a deliberate choice, not a silent clobber.

export interface SubmitPickInput {
  gameId: string;
  predicted: 'W' | 'L';
  confidence?: number | null;
}

export interface SubmitResult {
  ok: boolean;
  error?: string;
  requiresConfirmation?: boolean;
  conflictingGameIds?: string[];
  savedGameIds?: string[];
  rejectedGameIds?: string[];
  windowId?: string;
}

export async function submitPicks(
  userId: string,
  inputs: SubmitPickInput[],
  confirmOverwrite: boolean,
  now: Date,
): Promise<SubmitResult> {
  if (!Array.isArray(inputs) || inputs.length === 0) {
    return { ok: false, error: 'No picks submitted' };
  }
  for (const p of inputs) {
    if (p.predicted !== 'W' && p.predicted !== 'L') {
      return { ok: false, error: `Invalid prediction "${p.predicted}"` };
    }
  }

  const season = await getActiveSeason();
  if (season === null) return { ok: false, error: 'No season loaded' };

  const openWindow = await getOpenWindow(season, now);
  if (!openWindow) return { ok: false, error: 'No open window. Picks are locked right now.' };

  const gameIds = [...new Set(inputs.map((i) => i.gameId))];
  const gameRows = await db.select().from(games).where(inArray(games.id, gameIds));
  const gameById = new Map(gameRows.map((g) => [g.id, g]));

  // Reject games that don't exist, are from another season, or have kicked off.
  const valid: SubmitPickInput[] = [];
  const rejected: string[] = [];
  for (const p of inputs) {
    const g = gameById.get(p.gameId);
    if (!g || g.season !== season || g.kickoffAt.getTime() <= now.getTime()) {
      rejected.push(p.gameId);
    } else {
      valid.push(p);
    }
  }
  if (valid.length === 0) {
    return { ok: false, error: 'None of those games can be picked (already started?)', rejectedGameIds: rejected };
  }

  // Confirmation handshake: existing picks in THIS window for the same games.
  if (!confirmOverwrite) {
    const validIds = valid.map((v) => v.gameId);
    const existing = await db
      .select({ gameId: picks.gameId })
      .from(picks)
      .where(and(eq(picks.userId, userId), eq(picks.windowId, openWindow.id), inArray(picks.gameId, validIds)));
    if (existing.length > 0) {
      return { ok: false, requiresConfirmation: true, conflictingGameIds: [...new Set(existing.map((e) => e.gameId))] };
    }
  }

  await db.insert(picks).values(
    valid.map((v) => ({
      userId,
      gameId: v.gameId,
      windowId: openWindow.id,
      predicted: v.predicted,
      confidence: v.confidence ?? null,
      createdAt: now,
    })),
  );

  return { ok: true, savedGameIds: valid.map((v) => v.gameId), rejectedGameIds: rejected, windowId: openWindow.id };
}
