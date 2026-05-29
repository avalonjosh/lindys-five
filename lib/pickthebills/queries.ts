import { sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { countFinalGames } from './schedule';

// The correctness heart of Pick the Bills. See PICKTHEBILLS_SPEC.md section 2.
//
// Effective pick: the most recent PICKS row for a (user, game) whose created_at
// is before that game's kickoff_at. Picks are append-only and never copied
// between windows, so "the pick that counts" is always computed, not stored.

// db.execute return shape varies (array vs { rows }); normalize defensively.
async function rawRows<T = any>(query: ReturnType<typeof sql>): Promise<T[]> {
  const res: any = await db.execute(query);
  return (Array.isArray(res) ? res : res?.rows ?? []) as T[];
}

export interface EffectivePick {
  game_id: string;
  predicted: 'W' | 'L';
  confidence: number | null;
  created_at: string;
  window_id: string;
}

// Current effective pick per game for one user. Used to prefill the pick screen.
export async function getEffectivePicks(userId: string): Promise<EffectivePick[]> {
  return rawRows<EffectivePick>(sql`
    SELECT DISTINCT ON (p.game_id)
           p.game_id, p.predicted, p.confidence, p.created_at, p.window_id
    FROM picks p
    JOIN games g ON g.id = p.game_id
    WHERE p.user_id = ${userId}
      AND p.created_at < g.kickoff_at
    ORDER BY p.game_id, p.created_at DESC
  `);
}

export interface PickHistoryRow {
  game_id: string;
  week_label: string;
  opponent: string;
  predicted: 'W' | 'L';
  confidence: number | null;
  created_at: string;
  window_label: string;
  window_type: string;
  before_kickoff: boolean;
}

// Full append-only history for one user, joined to window labels and games.
// This powers the v1 lightweight "your pick over time" view. The most recent
// row per game with before_kickoff = true is the effective pick.
export async function getPickHistory(userId: string): Promise<PickHistoryRow[]> {
  return rawRows<PickHistoryRow>(sql`
    SELECT p.game_id,
           g.week_label,
           g.opponent,
           p.predicted,
           p.confidence,
           p.created_at,
           w.label AS window_label,
           w.type  AS window_type,
           (p.created_at < g.kickoff_at) AS before_kickoff
    FROM picks p
    JOIN games g ON g.id = p.game_id
    JOIN windows w ON w.id = p.window_id
    WHERE p.user_id = ${userId}
    ORDER BY g.kickoff_at, p.created_at
  `);
}

interface LeaderboardQueryRow {
  id: string;
  display_name: string | null;
  correct_count: number;
  graded_count: number;
  accuracy: number;
}

export interface LeaderboardEntry {
  userId: string;
  displayName: string | null;
  correct: number;
  graded: number;
  accuracy: number; // 0..1
  rank: number | null; // null when not yet qualified
  qualified: boolean;
}

export interface Leaderboard {
  season: number;
  finalGames: number;
  threshold: number;
  ranked: LeaderboardEntry[];
  unranked: LeaderboardEntry[];
  computedAt: string;
}

// Grade every user's effective picks against final games and rank by accuracy.
// Tie handling (default): a 'T' result is excluded from grading entirely, so
// graded_count only counts W/L games. Qualification threshold: a user must be
// graded on at least half the Bills games that have gone final to be ranked.
export async function computeLeaderboard(season: number, nowIso: string): Promise<Leaderboard> {
  const rows = await rawRows<LeaderboardQueryRow>(sql`
    WITH effective AS (
      SELECT DISTINCT ON (p.user_id, p.game_id)
             p.user_id, p.game_id, p.predicted
      FROM picks p
      JOIN games g ON g.id = p.game_id
      WHERE p.created_at < g.kickoff_at
        AND g.status = 'final'
        AND g.season = ${season}
      ORDER BY p.user_id, p.game_id, p.created_at DESC
    ),
    graded AS (
      SELECT e.user_id,
             COUNT(*) FILTER (WHERE g.result IN ('W','L')) AS graded_count,
             COUNT(*) FILTER (WHERE g.result = e.predicted) AS correct_count
      FROM effective e
      JOIN games g ON g.id = e.game_id
      GROUP BY e.user_id
    )
    SELECT u.id,
           u.display_name,
           gr.correct_count::int AS correct_count,
           gr.graded_count::int  AS graded_count,
           CASE WHEN gr.graded_count > 0
                THEN gr.correct_count::float / gr.graded_count
                ELSE 0 END AS accuracy
    FROM graded gr
    JOIN users u ON u.id = gr.user_id
    ORDER BY accuracy DESC, gr.correct_count DESC
  `);

  const finalGames = await countFinalGames(season);
  const threshold = Math.ceil(finalGames / 2);

  const entries: Omit<LeaderboardEntry, 'rank'>[] = rows.map((r) => ({
    userId: r.id,
    displayName: r.display_name,
    correct: r.correct_count,
    graded: r.graded_count,
    accuracy: r.accuracy,
    qualified: r.graded_count >= threshold && threshold > 0,
  }));

  // Rank only qualified users. Shared rank when accuracy and correct count tie.
  const ranked: LeaderboardEntry[] = [];
  let lastKey = '';
  let lastRank = 0;
  entries
    .filter((e) => e.qualified)
    .forEach((e, i) => {
      const key = `${e.accuracy}:${e.correct}`;
      const rank = key === lastKey ? lastRank : i + 1;
      lastKey = key;
      lastRank = rank;
      ranked.push({ ...e, rank });
    });

  const unranked: LeaderboardEntry[] = entries
    .filter((e) => !e.qualified)
    .map((e) => ({ ...e, rank: null }));

  return {
    season,
    finalGames,
    threshold,
    ranked,
    unranked,
    computedAt: nowIso,
  };
}
