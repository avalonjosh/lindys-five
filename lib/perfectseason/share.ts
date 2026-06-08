/**
 * Snapshot + share-payload helpers for a completed roster. Powers the share-card
 * OG image and the /share landing page; the URL line is the growth mechanism.
 */

import type { GameData, ModeType, Sport, SportConfig } from './types';
import type { DailyRecord } from './storage';
import type { EngineState } from './engine';
import { rosterRating } from './rating';

export type Variant = 'classic' | 'blind';

/** KV key for a stored shared team. */
export const shareKey = (id: string) => `ps:share:${id}`;

/** One roster row on a shared 82-0.com-style team card. */
export interface SharedTeamRow {
  slot: string;
  playerName: string;
  franchise: string;
  franchiseId: string;
  decade: string;
}

/**
 * A self-contained snapshot of a completed roster, stored in KV under a short id
 * and used to render the share-card OG image and the /share landing page. Holds
 * everything those need so neither has to re-run the engine.
 */
export interface SharedTeam {
  sport: Sport;
  variant: Variant;
  modeType: ModeType;
  source: 'daily' | 'free';
  wins: number;
  losses: number;
  rating: number;
  grade: string;
  tier: string;
  rows: SharedTeamRow[];
  createdAt: number;
}

/** Build the shareable snapshot from a locked Daily record (no engine state kept). */
export function sharedTeamFromRecord(record: DailyRecord, config: SportConfig, variant: Variant, createdAt: number): SharedTeam {
  return {
    sport: config.sport,
    variant,
    modeType: 'standard',
    source: 'daily',
    wins: record.wins,
    losses: record.losses,
    rating: record.rating ?? 0,
    grade: record.grade ?? '',
    tier: record.tier ?? '',
    rows: record.grid.map((c) => ({
      slot: c.slot,
      // Pre-fix records have no player name; fall back to the team name.
      playerName: c.playerName || c.franchise,
      franchise: c.franchise,
      franchiseId: c.franchiseId ?? '',
      decade: c.decade,
    })),
    createdAt,
  };
}

/** The mode pill shown on the card, e.g. "CLASSIC MODE" / "IQ MODE". */
export function modeBadgeLabel(variant: Variant, modeType: ModeType): string {
  if (variant === 'blind') return 'IQ MODE';
  if (modeType === 'tank') return 'TANK MODE';
  if (modeType === 'franchise') return 'FRANCHISE';
  return 'CLASSIC MODE';
}

/**
 * Build the shareable snapshot from a finished engine state. Works for any
 * completed game, daily or free play.
 */
export function buildSharePayload(
  data: GameData,
  config: SportConfig,
  state: EngineState,
  variant: Variant,
  createdAt: number,
): SharedTeam | null {
  if (!state.done || !state.result) return null;
  const rows: SharedTeamRow[] = state.picks.map((p) => {
    const slot = config.slots.find((s) => s.id === p.slotId);
    const f = data.franchises.find((fr) => fr.id === p.spin.franchise);
    return {
      slot: slot?.label ?? p.slotId,
      playerName: p.playerName,
      franchise: f?.names[p.spin.decade] ?? p.spin.franchise,
      franchiseId: p.spin.franchise,
      decade: p.spin.decade,
    };
  });
  const { rating, grade, tier } = rosterRating(data, config, state.picks, state.mode.type);
  return {
    sport: config.sport,
    variant,
    modeType: state.mode.type,
    source: state.mode.source,
    wins: state.result.wins,
    losses: state.result.losses,
    rating,
    grade,
    tier,
    rows,
    createdAt,
  };
}
