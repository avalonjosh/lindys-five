/**
 * Dev verification harness for Pick the Bills (Phases 1 + 2).
 *
 * 1. Runs the real ESPN schedule ingest into `games` (season 2026).
 * 2. Runs a fully self-contained, self-cleaning verification of the
 *    effective-pick and leaderboard logic under a throwaway season (9999),
 *    so it never touches real data.
 *
 * Run with: DATABASE_URL=... npx tsx scripts/ptb-verify.ts
 */
import { and, eq, like, inArray } from 'drizzle-orm';
import { db } from '../lib/db';
import { games, windows, picks, users } from '../lib/db/schema';
import { ingestBillsSchedule } from '../lib/pickthebills/schedule';
import { getEffectivePicks, getPickHistory, computeLeaderboard } from '../lib/pickthebills/queries';

const TEST_SEASON = 9999;
let failures = 0;

function check(label: string, cond: boolean, detail?: string) {
  const mark = cond ? 'PASS' : 'FAIL';
  if (!cond) failures++;
  console.log(`  [${mark}] ${label}${detail ? ` — ${detail}` : ''}`);
}

async function cleanup() {
  const testUsers = await db.select({ id: users.id }).from(users).where(like(users.email, 'ptbtest+%'));
  const ids = testUsers.map((u) => u.id);
  if (ids.length) await db.delete(picks).where(inArray(picks.userId, ids));
  await db.delete(windows).where(eq(windows.season, TEST_SEASON));
  await db.delete(games).where(eq(games.season, TEST_SEASON));
  if (ids.length) await db.delete(users).where(inArray(users.id, ids));
}

async function main() {
  console.log('\n=== Phase 1: real schedule ingest ===');
  const res = await ingestBillsSchedule();
  console.log(`  fetched=${res.fetched} upserted=${res.upserted} skipped=${res.skipped}`);
  const realGames = await db.select().from(games).where(eq(games.season, 2026));
  check('ingested 2026 games', realGames.length > 0, `${realGames.length} games`);
  const sample = realGames.sort((a, b) => +a.kickoffAt - +b.kickoffAt)[0];
  if (sample) console.log(`  first game: ${sample.weekLabel} vs ${sample.opponent} home=${sample.home} ${sample.kickoffAt.toISOString()}`);

  console.log('\n=== Phase 2: effective-pick + leaderboard (season 9999, synthetic) ===');
  await cleanup(); // clean any leftover from a prior run

  // Two synthetic games with known kickoffs.
  const [g1, g2] = await db
    .insert(games)
    .values([
      { espnId: 'TEST-9999-1', season: TEST_SEASON, weekLabel: 'Week 1', opponent: 'Test A', home: true, kickoffAt: new Date('2026-09-13T17:00:00Z'), status: 'final', result: 'W' },
      { espnId: 'TEST-9999-2', season: TEST_SEASON, weekLabel: 'Week 2', opponent: 'Test B', home: false, kickoffAt: new Date('2026-09-20T17:00:00Z'), status: 'final', result: 'L' },
    ])
    .returning();

  const [w1] = await db
    .insert(windows)
    .values({ season: TEST_SEASON, label: 'Baseline', type: 'baseline', opensAt: new Date('2026-08-01T00:00:00Z'), locksAt: new Date('2026-09-13T17:00:00Z'), status: 'open' })
    .returning();

  const [alice, bob] = await db
    .insert(users)
    .values([
      { email: 'ptbtest+alice@example.com', displayName: 'Alice' },
      { email: 'ptbtest+bob@example.com', displayName: 'Bob' },
    ])
    .returning();

  // Alice on g1: W (early) then L (later, still pre-kickoff) then W (AFTER kickoff, must be ignored).
  await db.insert(picks).values([
    { userId: alice.id, gameId: g1.id, windowId: w1.id, predicted: 'W', createdAt: new Date('2026-08-01T00:00:00Z') },
    { userId: alice.id, gameId: g1.id, windowId: w1.id, predicted: 'L', createdAt: new Date('2026-09-01T00:00:00Z') },
    { userId: alice.id, gameId: g1.id, windowId: w1.id, predicted: 'W', createdAt: new Date('2026-10-01T00:00:00Z') }, // after kickoff
    { userId: alice.id, gameId: g2.id, windowId: w1.id, predicted: 'L', createdAt: new Date('2026-08-01T00:00:00Z') },
  ]);
  // Bob: only g1 = W (pre-kickoff). No pick on g2.
  await db.insert(picks).values([
    { userId: bob.id, gameId: g1.id, windowId: w1.id, predicted: 'W', createdAt: new Date('2026-08-15T00:00:00Z') },
  ]);

  // --- effective-pick assertions ---
  const aliceEff = await getEffectivePicks(alice.id);
  const aliceG1 = aliceEff.find((p) => p.game_id === g1.id);
  const aliceG2 = aliceEff.find((p) => p.game_id === g2.id);
  check('Alice g1 effective = L (latest pre-kickoff, ignores post-kickoff W)', aliceG1?.predicted === 'L', `got ${aliceG1?.predicted}`);
  check('Alice g2 effective = L', aliceG2?.predicted === 'L', `got ${aliceG2?.predicted}`);
  check('Alice has exactly 2 effective picks', aliceEff.length === 2, `got ${aliceEff.length}`);

  const bobEff = await getEffectivePicks(bob.id);
  check('Bob g1 effective = W', bobEff.find((p) => p.game_id === g1.id)?.predicted === 'W');
  check('Bob has no effective pick on g2 (never picked)', !bobEff.find((p) => p.game_id === g2.id));

  const aliceHist = await getPickHistory(alice.id);
  check('Alice history has all 4 rows', aliceHist.length === 4, `got ${aliceHist.length}`);
  check('Alice history flags the post-kickoff row', aliceHist.some((r) => !r.before_kickoff), 'one row before_kickoff=false expected');

  // --- leaderboard assertions ---
  // g1 result=W, g2 result=L. Alice: g1 picked L (wrong), g2 picked L (correct) -> 1/2 = 50%.
  // Bob: g1 picked W (correct), g2 no pick -> 1/1 = 100%.
  const lb = await computeLeaderboard(TEST_SEASON, new Date('2026-12-01T00:00:00Z').toISOString());
  console.log(`  finalGames=${lb.finalGames} threshold=${lb.threshold} ranked=${lb.ranked.length} unranked=${lb.unranked.length}`);
  const all = [...lb.ranked, ...lb.unranked];
  const aliceRow = all.find((e) => e.userId === alice.id);
  const bobRow = all.find((e) => e.userId === bob.id);
  check('finalGames = 2', lb.finalGames === 2, `got ${lb.finalGames}`);
  check('threshold = 1 (ceil 2/2)', lb.threshold === 1, `got ${lb.threshold}`);
  check('Alice graded=2 correct=1 (50%)', aliceRow?.graded === 2 && aliceRow?.correct === 1, `graded=${aliceRow?.graded} correct=${aliceRow?.correct}`);
  check('Bob graded=1 correct=1 (100%)', bobRow?.graded === 1 && bobRow?.correct === 1, `graded=${bobRow?.graded} correct=${bobRow?.correct}`);
  check('Bob ranked #1 (higher accuracy)', bobRow?.rank === 1, `got rank ${bobRow?.rank} acc ${bobRow?.accuracy}`);
  check('Alice ranked #2', aliceRow?.rank === 2, `got rank ${aliceRow?.rank}`);

  console.log('\n=== cleanup ===');
  await cleanup();
  const leftover = await db.select().from(games).where(eq(games.season, TEST_SEASON));
  check('synthetic data removed', leftover.length === 0, `${leftover.length} test games remain`);

  console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}\n`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch(async (err) => {
  console.error('Verification crashed:', err);
  try {
    await cleanup();
  } catch {
    // best effort
  }
  process.exit(1);
});
