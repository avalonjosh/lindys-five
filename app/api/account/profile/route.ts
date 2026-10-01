import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import { getUserId } from '@/lib/perfectseason/server/session';
import { easternDateString } from '@/lib/perfectseason/seed';
import { findTeam } from '@/lib/teamConfig';
import {
  userKey,
  userTeams,
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
  emailVerified: boolean;
  /** New address waiting on its confirm link, if an email change is in progress. */
  pendingEmail?: string;
  createdAt: string;
  favoriteTeam?: string;
  teams: string[];
  perfectSeason: {
    boards: ProfileBoard[];
    /** Daily plays only keep a composite score in the boards hash; entries expire. */
    daily: {
      count: number;
      bestRating: number | null;
      playedToday: { nhl: boolean; mlb: boolean };
      /** Consecutive-day play streak (any sport), derived from board keys. */
      streak: { current: number; best: number };
    };
    /** Recent daily plays (unique sport+date), newest first, for the activity feed. */
    recentDaily: { date: string; sport: string }[];
  };
}

/** YYYY-MM-DD arithmetic without timezone drift. */
function addDays(iso: string, delta: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + delta)).toISOString().slice(0, 10);
}

/** Current and best consecutive-day runs. Current counts back from today, and
 * survives if today just hasn't been played yet (yesterday keeps it alive). */
function computeStreak(dates: Set<string>, today: string): { current: number; best: number } {
  let current = 0;
  let day = dates.has(today) ? today : addDays(today, -1);
  while (dates.has(day)) {
    current += 1;
    day = addDays(day, -1);
  }

  let best = 0;
  for (const date of dates) {
    if (dates.has(addDays(date, -1))) continue; // not a run start
    let run = 0;
    let cursor = date;
    while (dates.has(cursor)) {
      run += 1;
      cursor = addDays(cursor, 1);
    }
    if (run > best) best = run;
  }
  return { current, best };
}

export async function GET(request: NextRequest) {
  const userId = await getUserId(request);
  if (!userId) return NextResponse.json({ error: 'Sign in to view your profile' }, { status: 401 });

  const user = await kv.get<User>(userKey(userId));
  if (!user) return NextResponse.json({ error: 'Account not found' }, { status: 401 });

  // Board hash: `${board}` -> composite score (rating×1000 + wins tiebreak).
  const boardsHash = (await kv.hgetall<Record<string, number>>(userBoardsKey(userId))) ?? {};

  const today = easternDateString();
  const playedToday = { nhl: false, mlb: false };
  const dailyComposites: number[] = [];
  const dailyDates = new Set<string>();
  const dailyPlays = new Map<string, { date: string; sport: string }>(); // `${sport}:${date}` dedup
  const persistentBoards: string[] = [];
  for (const board of Object.keys(boardsHash)) {
    if (board.startsWith('daily:')) {
      dailyComposites.push(Number(boardsHash[board]));
      // daily:{sport}:{variant}:{date}
      const [, sport, , date] = board.split(':');
      if (date === today && (sport === 'nhl' || sport === 'mlb')) playedToday[sport] = true;
      if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        dailyDates.add(date);
        dailyPlays.set(`${sport}:${date}`, { date, sport });
      }
    } else {
      persistentBoards.push(board);
    }
  }
  const recentDaily = [...dailyPlays.values()]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 10);

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
    emailVerified: !!user.emailVerifiedAt,
    pendingEmail: user.pendingEmail,
    createdAt: user.createdAt,
    favoriteTeam: user.favoriteTeam,
    teams: userTeams(user),
    perfectSeason: {
      boards,
      daily: {
        count: dailyComposites.length,
        // composite = round(rating×1000) + wins, so /1000 recovers the rating
        // to well within its one-decimal display precision.
        bestRating: dailyComposites.length
          ? Math.round(Math.max(...dailyComposites) / 100) / 10
          : null,
        playedToday,
        streak: computeStreak(dailyDates, today),
      },
      recentDaily,
    },
  };

  return NextResponse.json(profile);
}

/**
 * Update My Teams. `teams` replaces the followed-teams list (unknown slugs
 * dropped, max 20); `favoriteTeam` makes that team the main one by moving it to
 * the front. The main team is always the first team (none when the list is
 * empty). Recap emails are switched per team on the profile, so changing teams
 * here never touches subscriptions.
 */
export async function PATCH(request: NextRequest) {
  const userId = await getUserId(request);
  if (!userId) return NextResponse.json({ error: 'Sign in to update your profile' }, { status: 401 });

  let body: { favoriteTeam?: string; teams?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const user = await kv.get<User>(userKey(userId));
  if (!user) return NextResponse.json({ error: 'Account not found' }, { status: 401 });

  let teams = userTeams(user);
  if (Array.isArray(body.teams)) {
    teams = Array.from(new Set(body.teams.filter((t): t is string => typeof t === 'string' && !!findTeam(t)))).slice(0, 20);
  }

  if (typeof body.favoriteTeam === 'string') {
    const main = body.favoriteTeam;
    if (!findTeam(main)) return NextResponse.json({ error: 'Unknown team' }, { status: 400 });
    teams = [main, ...teams.filter((t) => t !== main)].slice(0, 20);
  }
  const favoriteTeam = teams[0];

  const updated: User = { ...user, teams };
  if (favoriteTeam) updated.favoriteTeam = favoriteTeam;
  else delete updated.favoriteTeam;
  await kv.set(userKey(userId), updated);

  return NextResponse.json({ favoriteTeam: updated.favoriteTeam ?? null, teams });
}
