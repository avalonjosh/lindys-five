/**
 * The spoiler-safe daily share grid (spec Section 10). Shows the slot, a tier
 * emoji (green = top option, yellow = top three, gray = below), and the
 * era-correct team, plus skips used. The URL line is the growth mechanism.
 */

import type { GameData, ModeType, Sport, SportConfig } from './types';
import type { DailyRecord, GridTier } from './storage';
import type { EngineState } from './engine';
import { dailyDateLabel } from './seed';
import { poolPlayers } from './schedule';
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
  tier: GridTier;
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
      tier: c.tier,
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
 * Build the shareable snapshot from a finished engine state. Mirrors the grid
 * tier logic in buildDailyRecord (green = best in pool, yellow = top three, gray
 * = below) but works for any completed game, daily or free play.
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
    const pool = poolPlayers(data, p.spin, config);
    const higher = pool.filter((pl) => pl.score > p.score).length;
    const tier: GridTier = higher === 0 ? 'green' : higher < 3 ? 'yellow' : 'gray';
    const slot = config.slots.find((s) => s.id === p.slotId);
    const f = data.franchises.find((fr) => fr.id === p.spin.franchise);
    return {
      slot: slot?.label ?? p.slotId,
      playerName: p.playerName,
      franchise: f?.names[p.spin.decade] ?? p.spin.franchise,
      franchiseId: p.spin.franchise,
      decade: p.spin.decade,
      tier,
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

const EMOJI = { green: '🟩', yellow: '🟨', gray: '⬜' } as const;

function shortDecade(d: string): string {
  return d.length === 5 ? d.slice(2) : d;
}

export function buildDailyShare(rec: DailyRecord, config: SportConfig, variant: 'classic' | 'blind'): string {
  const title = config.sport === 'mlb' ? '162-0' : '82-0';
  const brain = variant === 'blind' ? ' 🧠' : '';
  const label = rec.date ? dailyDateLabel(rec.date) : `Daily #${rec.dayNumber}`;
  const lines: string[] = [
    `${title} ${config.shareIcon} ${label}${brain}`,
    `🏆 ${rec.wins}-${rec.losses} · ${rec.setsWon}/${rec.totalSets} sets`,
    '',
  ];
  for (const c of rec.grid) {
    lines.push(`${c.slot.padEnd(3)}${EMOJI[c.tier]} ${shortDecade(c.decade)} ${c.franchise}`);
  }
  if (rec.skips.team) lines.push('⏭️ team skip used');
  if (rec.skips.decade) lines.push('⏭️ decade skip used');
  lines.push('', `lindysfive.com/${title}`);
  return lines.join('\n');
}
