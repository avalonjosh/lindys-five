/**
 * Shared UI helpers for the Perfect Season game components. Keeps the
 * presentational pieces sport-agnostic by reading labels and stat columns from
 * the sport config and the era-correct names from the data file.
 */

import type { GameData, Player, Sport, Spin, SportConfig } from '@/lib/perfectseason/types';

/** Era-correct franchise name for a spin. */
export function franchiseName(data: GameData, spin: Spin): string {
  const f = data.franchises.find((fr) => fr.id === spin.franchise);
  return f?.names[spin.decade] ?? spin.franchise;
}

/** Short decade label, e.g. 1970s -> 70s. */
export function shortDecade(decade: string): string {
  return decade.length === 5 ? decade.slice(2) : decade;
}

// Lahman franchID to the modern MLB Stats team id (used for the logo URL).
// Logos are modern, not era-correct, by design.
const MLB_FRANCHISE_ID: Record<string, number> = {
  ANA: 108, ARI: 109, ATL: 144, BAL: 110, BOS: 111, CHC: 112, CHW: 145, CIN: 113, CLE: 114,
  COL: 115, DET: 116, FLA: 146, HOU: 117, KCR: 118, LAD: 119, MIL: 158, MIN: 142, NYM: 121,
  NYY: 147, OAK: 133, PHI: 143, PIT: 134, SDP: 135, SEA: 136, SFG: 137, STL: 138, TBD: 139,
  TEX: 140, TOR: 141, WSN: 120,
};

/**
 * Modern franchise logo URL, or null if the franchise does not map cleanly.
 * NHL franchise ids are the current triCodes, so they resolve straight to the
 * NHL asset CDN; MLB ids go through the Lahman -> MLB Stats id map.
 */
export function franchiseLogo(franchiseId: string, sport: Sport): string | null {
  if (sport === 'nhl') {
    return `https://assets.nhle.com/logos/nhl/svg/${franchiseId}_dark.svg`;
  }
  const id = MLB_FRANCHISE_ID[franchiseId];
  return id ? `https://www.mlbstatic.com/team-logos/${id}.svg` : null;
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

/** Tier of a score for green/yellow/gray treatment, mirrors the share grid. */
export function scoreTier(score: number, poolTopScore: number, poolTop3Score: number): 'green' | 'yellow' | 'gray' {
  if (score >= poolTopScore) return 'green';
  if (score >= poolTop3Score) return 'yellow';
  return 'gray';
}
