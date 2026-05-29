/**
 * Dev verification for Phase 5 window logic. Self-cleaning, uses a throwaway
 * season (9999) so it never touches real data.
 *
 * Run with: DATABASE_URL=... npx tsx scripts/ptb-verify-windows.ts
 */
import { eq } from 'drizzle-orm';
import { db } from '../lib/db';
import { games, windows } from '../lib/db/schema';
import { createWindow, lockWindow, getOpenWindow, getNextKickoff } from '../lib/pickthebills/windows';

const TEST_SEASON = 9999;
let failures = 0;
function check(label: string, cond: boolean, detail?: string) {
  if (!cond) failures++;
  console.log(`  [${cond ? 'PASS' : 'FAIL'}] ${label}${detail ? ` — ${detail}` : ''}`);
}

async function cleanup() {
  await db.delete(windows).where(eq(windows.season, TEST_SEASON));
  await db.delete(games).where(eq(games.season, TEST_SEASON));
}

async function main() {
  await cleanup();
  const now = new Date();
  const kickoff = new Date('2099-09-13T17:00:00Z');

  // Synthetic future game makes 9999 the active season and gives a next kickoff.
  await db.insert(games).values({
    espnId: 'TEST-WIN-9999', season: TEST_SEASON, weekLabel: 'Week 1', opponent: 'Test', home: true,
    kickoffAt: kickoff, status: 'scheduled', result: null,
  });

  const nk = await getNextKickoff(TEST_SEASON, now);
  check('next kickoff resolves', nk?.getTime() === kickoff.getTime(), nk?.toISOString());

  // First window: locks_at should default to next kickoff.
  const r1 = await createWindow({ label: 'Baseline', type: 'baseline' }, now);
  check('window 1 created', !!r1.window, r1.error);
  check('window 1 locks_at defaults to next kickoff', r1.window?.locksAt.getTime() === kickoff.getTime());
  check('window 1 is open', r1.window?.status === 'open');

  // Second window opens and must lock the first (single-open invariant).
  const r2 = await createWindow({ label: 'After news', type: 'event' }, now);
  check('window 2 created', !!r2.window, r2.error);
  const all = await db.select().from(windows).where(eq(windows.season, TEST_SEASON));
  const openCount = all.filter((w) => w.status === 'open').length;
  check('exactly one open window after opening a second', openCount === 1, `${openCount} open`);
  const open = await getOpenWindow(TEST_SEASON, now);
  check('the open window is window 2', open?.id === r2.window?.id);

  // Validation: locks_at after next kickoff is rejected.
  const bad = await createWindow({ label: 'Too late', type: 'scheduled', locksAt: new Date('2100-01-01T00:00:00Z') }, now);
  check('locks_at after next kickoff rejected', !!bad.error, bad.error);

  // Lock the open window -> no open window remains.
  if (r2.window) await lockWindow(r2.window.id);
  const openAfter = await getOpenWindow(TEST_SEASON, now);
  check('no open window after manual lock', openAfter === null);

  await cleanup();
  const leftover = await db.select().from(windows).where(eq(windows.season, TEST_SEASON));
  check('cleaned up', leftover.length === 0);

  console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}\n`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch(async (err) => {
  console.error('crashed:', err);
  try { await cleanup(); } catch {}
  process.exit(1);
});
