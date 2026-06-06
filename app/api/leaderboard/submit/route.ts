import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import { getUserId } from '@/lib/perfectseason/server/session';
import { rateLimit, clientIp } from '@/lib/perfectseason/server/ratelimit';
import { verifySubmission } from '@/lib/perfectseason/server/verify';
import { getDataset } from '@/lib/perfectseason/server/datasets';
import {
  userKey,
  userBoardsKey,
  lbZKey,
  lbEntryKey,
  dailyBoard,
  alltimeBoard,
  tankBoard,
  franchiseBoard,
  compositeScore,
  type ScoreSubmission,
  type LeaderboardEntry,
  type User,
} from '@/lib/perfectseason/leaderboard';

const DAILY_TTL = 400 * 24 * 60 * 60;

/** Which board(s) a submission lands on, or null if the mode isn't ranked. */
function boardsFor(sub: ScoreSubmission): string[] | null {
  if (sub.source === 'daily' && sub.modeType === 'standard' && sub.date) {
    // Counts on the day's board AND the all-time best board (daily only, to stay fair).
    return [dailyBoard(sub.sport, sub.variant, sub.date), alltimeBoard(sub.sport, sub.variant)];
  }
  if (sub.source === 'free' && sub.modeType === 'tank') return [tankBoard(sub.sport, sub.variant)];
  if (sub.source === 'free' && sub.modeType === 'franchise' && sub.franchiseId) {
    return [franchiseBoard(sub.sport, sub.franchiseId, sub.variant)];
  }
  return null;
}

export async function POST(request: NextRequest) {
  const userId = await getUserId(request);
  if (!userId) return NextResponse.json({ error: 'Sign in to post a score' }, { status: 401 });

  const okIp = await rateLimit(`ps:rl:submitip:${clientIp(request)}`, 120, 3600);
  const okUser = await rateLimit(`ps:rl:submit:${userId}`, 60, 3600);
  if (!okIp || !okUser) return NextResponse.json({ error: 'Slow down — too many submissions' }, { status: 429 });

  let sub: ScoreSubmission;
  try {
    sub = (await request.json()) as ScoreSubmission;
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const boards = boardsFor(sub);
  if (!boards) return NextResponse.json({ error: 'This mode is not ranked' }, { status: 400 });

  const verdict = verifySubmission(sub);
  if (!verdict.ok) return NextResponse.json({ error: verdict.error }, { status: 400 });
  const score = verdict.score;

  const user = await kv.get<User>(userKey(userId));
  if (!user) return NextResponse.json({ error: 'Account not found' }, { status: 401 });

  const games = getDataset(sub.sport).config.games;
  const tank = sub.modeType === 'tank';
  const composite = compositeScore(score.rating, score.wins, games, tank);

  const entry: LeaderboardEntry = {
    userId,
    username: user.username,
    sport: sub.sport,
    variant: sub.variant,
    modeType: sub.modeType,
    rating: score.rating,
    grade: score.grade,
    tier: score.tier,
    wins: score.wins,
    losses: score.losses,
    rows: score.rows,
    date: sub.date,
    franchiseId: sub.franchiseId,
    submittedAt: Date.now(),
  };

  // Keep only each user's best per board.
  let improvedAny = false;
  for (const board of boards) {
    const zKey = lbZKey(board);
    const prev = await kv.zscore(zKey, userId);
    if (prev != null && Number(prev) >= composite) continue;
    improvedAny = true;
    await kv.zadd(zKey, { score: composite, member: userId });
    await kv.set(lbEntryKey(board, userId), entry);
    await kv.hset(userBoardsKey(userId), { [board]: composite });
    if (board.startsWith('daily:')) {
      await kv.expire(zKey, DAILY_TTL);
      await kv.expire(lbEntryKey(board, userId), DAILY_TTL);
    }
  }

  // Rank on the primary board (1-based).
  const primary = boards[0];
  const rank = await kv.zrevrank(lbZKey(primary), userId);

  return NextResponse.json({
    board: primary,
    rank: rank == null ? null : rank + 1,
    rating: score.rating,
    grade: score.grade,
    wins: score.wins,
    losses: score.losses,
    improved: improvedAny,
  });
}
