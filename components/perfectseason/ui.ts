/**
 * Shared UI helpers for the Perfect Season game components. Keeps the
 * presentational pieces sport-agnostic by reading labels and stat columns from
 * the sport config and the era-correct names from the data file.
 */

import type { GameData, Player, Spin, SportConfig } from '@/lib/perfectseason/types';

export { franchiseLogo, franchiseColor } from '@/lib/perfectseason/logos';

/** Era-correct franchise name for a spin. */
export function franchiseName(data: GameData, spin: Spin): string {
  const f = data.franchises.find((fr) => fr.id === spin.franchise);
  return f?.names[spin.decade] ?? spin.franchise;
}

/** Short decade label, e.g. 1970s -> 70s. */
export function shortDecade(decade: string): string {
  return decade.length === 5 ? decade.slice(2) : decade;
}

// Goalies (NHL) carry "gaa"; pitchers (MLB) carry "era". Either marks the
// "specialist" stat column group (statColumns.pitch); everyone else is a
// skater/batter (statColumns.bat).
export function playerKind(player: Player): 'bat' | 'pitch' {
  return 'era' in player.line || 'gaa' in player.line ? 'pitch' : 'bat';
}

const STAT_LABELS: Record<string, string> = {
  // MLB
  hr: 'HR',
  rbi: 'RBI',
  avg: 'AVG',
  ops: 'OPS',
  era: 'ERA',
  whip: 'WHIP',
  // NHL
  g: 'G',
  a: 'A',
  p: 'P',
  plusMinus: '+/-',
  svp: 'SV%',
  gaa: 'GAA',
  // shared
  w: 'W',
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

// Position badge tint for the player list, covering both sports (codes don't
// collide): specialists (goalie / pitcher) amber, the "back"/outfield group
// emerald, everyone else blue.
const POS_AMBER = new Set(['G', 'SP']);
const POS_EMERALD = new Set(['D', 'LF', 'CF', 'RF']);

/** Tailwind classes for a position badge by position code. */
export function posTint(pos: string): string {
  if (POS_AMBER.has(pos)) return 'bg-amber-100 text-amber-700';
  if (POS_EMERALD.has(pos)) return 'bg-emerald-100 text-emerald-700';
  return 'bg-sabres-blue/10 text-sabres-blue';
}
