import { pgTable, uuid, text, integer, boolean, timestamp, index } from 'drizzle-orm/pg-core';

// Pick the Bills data model. See PICKTHEBILLS_SPEC.md.
// This is isolated from the rest of the site (which uses Vercel KV + Blob).

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  displayName: text('display_name'),
  image: text('image'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const games = pgTable(
  'games',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    // ESPN event id. Not in the original spec, but required: it makes the
    // schedule ingest idempotent and maps ESPN results back to a row at grading.
    espnId: text('espn_id').notNull().unique(),
    season: integer('season').notNull(),
    weekLabel: text('week_label').notNull(),
    opponent: text('opponent').notNull(),
    home: boolean('home').notNull(),
    kickoffAt: timestamp('kickoff_at', { withTimezone: true }).notNull(),
    status: text('status').notNull().default('scheduled'), // 'scheduled' | 'final'
    result: text('result'), // 'W' | 'L' | 'T' | null (Bills perspective)
  },
  (t) => [
    index('idx_games_status').on(t.status),
    index('idx_games_season_kickoff').on(t.season, t.kickoffAt),
  ],
);

export const windows = pgTable('windows', {
  id: uuid('id').primaryKey().defaultRandom(),
  season: integer('season').notNull(),
  label: text('label').notNull(),
  type: text('type').notNull(), // 'baseline' | 'scheduled' | 'event' (badging only)
  opensAt: timestamp('opens_at', { withTimezone: true }).notNull(),
  locksAt: timestamp('locks_at', { withTimezone: true }).notNull(), // must be <= next kickoff
  status: text('status').notNull().default('open'), // 'open' | 'locked'
});

export const picks = pgTable(
  'picks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    gameId: uuid('game_id')
      .notNull()
      .references(() => games.id),
    windowId: uuid('window_id')
      .notNull()
      .references(() => windows.id),
    predicted: text('predicted').notNull(), // 'W' | 'L'
    // Ships now, unused in v1. Impossible to backfill, cheap to add now.
    // Enables conviction-weighted scoring and confidence-drift charts later.
    confidence: integer('confidence'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // Effective-pick lookup: latest pick per (user, game) before kickoff.
    index('idx_picks_user_game_created').on(t.userId, t.gameId, t.createdAt.desc()),
    // Leaderboard / grading scans all picks for final games.
    index('idx_picks_game_created').on(t.gameId, t.createdAt.desc()),
  ],
);

export type User = typeof users.$inferSelect;
export type Game = typeof games.$inferSelect;
export type Window = typeof windows.$inferSelect;
export type Pick = typeof picks.$inferSelect;
