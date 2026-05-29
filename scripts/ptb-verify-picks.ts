/**
 * Dev verification for Phase 4 submit logic. Self-cleaning, throwaway season.
 * Run with: DATABASE_URL=... npx tsx scripts/ptb-verify-picks.ts
 */
import { eq, like, inArray } from 'drizzle-orm';
import { db } from '../lib/db';
import { games, windows, picks, users } from '../lib/db/schema';
import { submitPicks } from '../lib/pickthebills/picks';
import { getEffectivePicks } from '../lib/pickthebills/queries';

const TEST_SEASON = 9999;
let failures = 0;
function check(label: string, cond: boolean, detail?: string) {
  if (!cond) failures++;
  console.log(`  [${cond ? 'PASS' : 'FAIL'}] ${label}${detail ? ` — ${detail}` : ''}`);
}

async function cleanup() {
  const testUsers = await db.select({ id: users.id }).from(users).where(like(users.email, 'ptbpick+%'));
  const ids = testUsers.map((u) => u.id);
  if (ids.length) await db.delete(picks).where(inArray(picks.userId, ids));
  await db.delete(windows).where(eq(windows.season, TEST_SEASON));
  await db.delete(games).where(eq(games.season, TEST_SEASON));
  if (ids.length) await db.delete(users).where(inArray(users.id, ids));
}

async function main() {
  await cleanup();
  const now = new Date('2026-08-15T00:00:00Z');

  // One future game (pickable) and one already kicked off (not pickable).
  const [future, past] = await db
    .insert(games)
    .values([
      { espnId: 'PICK-F', season: TEST_SEASON, weekLabel: 'Week 1', opponent: 'Future', home: true, kickoffAt: new Date('2026-09-13T17:00:00Z'), status: 'scheduled', result: null },
      { espnId: 'PICK-P', season: TEST_SEASON, weekLabel: 'Week 0', opponent: 'Past', home: false, kickoffAt: new Date('2026-08-01T17:00:00Z'), status: 'scheduled', result: null },
    ])
    .returning();

  const [w] = await db
    .insert(windows)
    .values({ season: TEST_SEASON, label: 'Baseline', type: 'baseline', opensAt: new Date('2026-08-01T00:00:00Z'), locksAt: new Date('2026-09-13T17:00:00Z'), status: 'open' })
    .returning();

  const [u] = await db.insert(users).values({ email: 'ptbpick+u@example.com', displayName: 'U' }).returning();

  // 1. Submit both games: future accepted, past rejected (kickoff guard).
  const r1 = await submitPicks(u.id, [
    { gameId: future.id, predicted: 'W' },
    { gameId: past.id, predicted: 'L' },
  ], false, now);
  check('submit ok', r1.ok, r1.error);
  check('future game saved', r1.savedGameIds?.includes(future.id) === true);
  check('past game rejected (already kicked off)', r1.rejectedGameIds?.includes(past.id) === true);

  // 2. Re-submit the same game without confirm -> requiresConfirmation (409 path).
  const r2 = await submitPicks(u.id, [{ gameId: future.id, predicted: 'L' }], false, now);
  check('re-submit needs confirmation', r2.requiresConfirmation === true && !r2.ok);
  check('conflict names the game', r2.conflictingGameIds?.includes(future.id) === true);

  // 3. Re-submit WITH confirm -> appends a newer row; effective becomes L.
  const later = new Date('2026-08-20T00:00:00Z');
  const r3 = await submitPicks(u.id, [{ gameId: future.id, predicted: 'L' }], true, later);
  check('confirmed re-submit ok', r3.ok, r3.error);
  const allRows = await db.select().from(picks).where(eq(picks.userId, u.id));
  check('append-only: 2 rows exist for the game (not overwritten)', allRows.filter((p) => p.gameId === future.id).length === 2);
  const eff = await getEffectivePicks(u.id);
  check('effective pick is the newer L', eff.find((p) => p.game_id === future.id)?.predicted === 'L');

  await cleanup();
  console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}\n`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch(async (err) => {
  console.error('crashed:', err);
  try { await cleanup(); } catch {}
  process.exit(1);
});
