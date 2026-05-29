import { NextRequest, NextResponse } from 'next/server';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { games, windows } from '@/lib/db/schema';
import { ingestBillsSchedule } from '@/lib/pickthebills/schedule';
import { getActiveSeason, getNextKickoff, getOpenWindow, createWindow } from '@/lib/pickthebills/windows';
import { computeLeaderboard } from '@/lib/pickthebills/queries';
import { setCachedLeaderboard } from '@/lib/pickthebills/leaderboardCache';

// Consolidated Pick the Bills cron. One pass does three things:
//   1. Ingest the Bills schedule (idempotent upsert by espn_id, which also
//      flips games to final and records their result).
//   2. Recompute the accuracy leaderboard and cache it in KV so public reads
//      are a single KV get.
//   3. Auto-manage the pick window: once the open window's lock has passed,
//      open the next "After <week>" checkpoint locking at the next kickoff.
//      No new window is opened after the season's final game.
//
// The per-game kickoff guard in the submit route makes this timing forgiving,
// so the cron need not run on a second-accurate cadence.
export async function GET(request: NextRequest) {
  if (request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date();

  // 1. Schedule ingest (also captures finals + results).
  const ingest = await ingestBillsSchedule();

  const season = await getActiveSeason();
  if (season === null) {
    return NextResponse.json({ ok: true, ingest, leaderboard: null, window: 'no-season' });
  }

  // 2. Recompute + cache the leaderboard.
  const leaderboard = await computeLeaderboard(season, now.toISOString());
  await setCachedLeaderboard(leaderboard);

  // 3. Auto-window management.
  let windowAction = 'none';
  const nextKickoff = await getNextKickoff(season, now);
  if (!nextKickoff) {
    // Season over: lock any window still flagged open so nothing lingers.
    const locked = await db
      .update(windows)
      .set({ status: 'locked' })
      .where(and(eq(windows.season, season), eq(windows.status, 'open')))
      .returning({ id: windows.id });
    windowAction = locked.length > 0 ? 'season-over-locked' : 'season-over';
  } else {
    const open = await getOpenWindow(season, now);
    if (!open) {
      // No live window but games remain. Open the next checkpoint only once at
      // least one game has gone final (the season baseline is admin-created).
      // createWindow locks any expired-but-still-open window first.
      const [lastFinal] = await db
        .select({ weekLabel: games.weekLabel })
        .from(games)
        .where(and(eq(games.season, season), eq(games.status, 'final')))
        .orderBy(desc(games.kickoffAt))
        .limit(1);
      if (lastFinal) {
        const result = await createWindow({ label: `After ${lastFinal.weekLabel}`, type: 'scheduled' }, now);
        windowAction = result.window ? `opened:${result.window.label}` : `skip:${result.error}`;
      } else {
        windowAction = 'awaiting-finals';
      }
    }
  }

  return NextResponse.json({
    ok: true,
    ingest,
    leaderboard: {
      finalGames: leaderboard.finalGames,
      threshold: leaderboard.threshold,
      ranked: leaderboard.ranked.length,
      unranked: leaderboard.unranked.length,
    },
    window: windowAction,
  });
}
