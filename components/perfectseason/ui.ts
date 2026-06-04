/**
 * Shared UI helpers for the Perfect Season game components. Keeps the
 * presentational pieces sport-agnostic by reading labels and stat columns from
 * the sport config and the era-correct names from the data file.
 */

import type { GameData, Player, Spin, SportConfig } from '@/lib/perfectseason/types';

/** Era-correct franchise name for a spin, text only (no logos, Section 11.4). */
export function franchiseName(data: GameData, spin: Spin): string {
  const f = data.franchises.find((fr) => fr.id === spin.franchise);
  return f?.names[spin.decade] ?? spin.franchise;
}

/** Short decade label, e.g. 1970s -> 70s. */
export function shortDecade(decade: string): string {
  return decade.length === 5 ? decade.slice(2) : decade;
}

export function playerKind(player: Player): 'bat' | 'pitch' {
  return 'era' in player.line ? 'pitch' : 'bat';
}

const STAT_LABELS: Record<string, string> = {
  hr: 'HR',
  rbi: 'RBI',
  avg: 'AVG',
  ops: 'OPS',
  w: 'W',
  era: 'ERA',
  whip: 'WHIP',
  so: 'SO',
};

export interface StatCell {
  label: string;
  value: string;
}

/** The compact stat cells shown on a player row, per the sport config. */
export function statCells(player: Player, config: SportConfig): StatCell[] {
  const keys = playerKind(player) === 'pitch' ? config.statColumns.pitch : config.statColumns.bat;
  return keys.map((k) => ({ label: STAT_LABELS[k] ?? k.toUpperCase(), value: String(player.line[k] ?? '') }));
}

/** Tier of a score for green/yellow/gray treatment, mirrors the share grid. */
export function scoreTier(score: number, poolTopScore: number, poolTop3Score: number): 'green' | 'yellow' | 'gray' {
  if (score >= poolTopScore) return 'green';
  if (score >= poolTop3Score) return 'yellow';
  return 'gray';
}
