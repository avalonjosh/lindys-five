import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import { getUserId } from '@/lib/perfectseason/server/session';
import { findTeam } from '@/lib/teamConfig';
import {
  userKey,
  userBoardsKey,
  lbZKey,
  lbEntryKey,
  type User,
  type LeaderboardEntry,
} from '@/lib/perfectseason/leaderboard';

/**
 * One Perfect Season best for the profile page: the user's entry on a
 * non-daily board plus their current rank there.
 */
export interface ProfileBoard {
  board: string;
  kind: 'alltime' | 'free' | 'tank' | 'franchise';
  sport: string;
  variant: string;
  franchiseId?: string;
  rating: number;
  grade: string;
  wins: number;
  losses: number;
  rank: number | null;
  submittedAt: number;
}

export interface ProfileResponse {
  email: string;
  createdAt: string;
  favoriteTeam?: string;
  perfectSeason: {
    boards: ProfileBoard[];
    /** Daily plays only keep a composite score in the boards hash; entries expire. */
    daily: { count: number; bestRating: number | null };
  };
}

export async function GET(request: NextRequest) {
  const userId = await getUserId(request);
  if (!userId) return NextResponse.json({ error: 'Sign in to view your profile' }, { status: 401 });

  const user = await kv.get<User>(userKey(userId));
  if (!user) return NextResponse.json({ error: 'Account not found' }, { status: 401 });

  // Board hash: `${board}` -> composite score (rating×1000 + wins tiebreak).
  const boardsHash = (await kv.hgetall<Record<string, number>>(userBoardsKey(userId))) ?? {};

  const dailyComposites: number[] = [];
  const persistentBoards: string[] = [];
  for (const board of Object.keys(boardsHash)) {
    if (board.startsWith('daily:')) dailyComposites.push(Number(boardsHash[board]));
    else persistentBoards.push(board);
  }

  const boards: ProfileBoard[] = (
    await Promise.all(
      persistentBoards.map(async (board): Promise<ProfileBoard | null> => {
        const [entry, rank] = await Promise.all([
          kv.get<LeaderboardEntry>(lbEntryKey(board, userId)),
          kv.zrevrank(lbZKey(board), userId),
        ]);
        if (!entry) return null;
        const parts = board.split(':');
        return {
          board,
          kind: parts[0] as ProfileBoard['kind'],
          sport: parts[1],
          variant: parts[parts.length - 1],
          franchiseId: parts[0] === 'franchise' ? parts[2] : undefined,
          rating: entry.rating,
          grade: entry.grade,
          wins: entry.wins,
          losses: entry.losses,
          rank: rank == null ? null : rank + 1,
          submittedAt: entry.submittedAt,
        };
      })
    )
  ).filter((b): b is ProfileBoard => b !== null);

  // All-time first, then free/tank/franchise, best rating first within a kind.
  const KIND_ORDER = { alltime: 0, free: 1, tank: 2, franchise: 3 } as const;
  boards.sort((a, b) => (KIND_ORDER[a.kind] ?? 9) - (KIND_ORDER[b.kind] ?? 9) || b.rating - a.rating);

  const profile: ProfileResponse = {
    email: user.email,
    createdAt: user.createdAt,
    favoriteTeam: user.favoriteTeam,
    perfectSeason: {
      boards,
      daily: {
        count: dailyComposites.length,
        // composite = round(rating×1000) + wins, so /1000 recovers the rating
        // to well within its one-decimal display precision.
        bestRating: dailyComposites.length
          ? Math.round(Math.max(...dailyComposites) / 100) / 10
          : null,
      },
    },
  };

  return NextResponse.json(profile);
}

/** Update profile fields. Currently just the favorite team (slug, or null to clear). */
export async function PATCH(request: NextRequest) {
  const userId = await getUserId(request);
  if (!userId) return NextResponse.json({ error: 'Sign in to update your profile' }, { status: 401 });

  let body: { favoriteTeam?: string | null };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const clear = body.favoriteTeam === null;
  const favoriteTeam = typeof body.favoriteTeam === 'string' && findTeam(body.favoriteTeam) ? body.favoriteTeam : undefined;
  if (!clear && !favoriteTeam) return NextResponse.json({ error: 'Unknown team' }, { status: 400 });

  const user = await kv.get<User>(userKey(userId));
  if (!user) return NextResponse.json({ error: 'Account not found' }, { status: 401 });

  const updated: User = { ...user };
  if (clear) delete updated.favoriteTeam;
  else updated.favoriteTeam = favoriteTeam;
  await kv.set(userKey(userId), updated);

  return NextResponse.json({ favoriteTeam: updated.favoriteTeam ?? null });
}
