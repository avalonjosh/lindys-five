/**
 * Deterministic season simulation. Spec Section 8.
 *
 * Identical rosters always yield identical records. There is zero randomness in
 * the Daily. The standard win curve is a non-linear climb with a weakest-link
 * gate. Tank mode runs the same curve on inverted scores, which turns the
 * weakest link into the roster's best player and makes that player a floor on
 * wins (the veteran who keeps winning games the front office does not want).
 */

import type { ModeDescriptor, SimResult, SportConfig, VerdictBand } from './types';

// Win-curve constants (spec Section 8.2). Placeholders pending calibration.
export const CURVE = {
  baseFloor: 0.3,
  baseSpan: 0.62,
  baseExp: 1.6,
  gateDiv: 90,
  capFloor: 0.8,
  capSpan: 0.2,
};

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function mean(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

/**
 * The core share in [0, 1]. For standard play this is the win share. For tank
 * play it is fed inverted scores and returned as the loss share. The gate reads
 * the minimum of whatever scores are passed in, so on inverted scores the gate
 * is driven by the roster's best original player.
 */
export function curveShare(scores: number[]): number {
  const teamScore = mean(scores);
  const basePct = CURVE.baseFloor + CURVE.baseSpan * Math.pow(teamScore / 100, CURVE.baseExp);
  const gate = clamp(Math.min(...scores) / CURVE.gateDiv, 0, 1);
  const cap = CURVE.capFloor + CURVE.capSpan * gate;
  return Math.min(basePct, cap);
}

/** Wins from six player scores under a given mode, deterministic. */
export function winsFor(scores: number[], type: ModeDescriptor['type'], games: number): number {
  if (type === 'tank') {
    const inverted = scores.map((s) => 100 - s);
    const lossShare = curveShare(inverted);
    return Math.round(games * (1 - lossShare));
  }
  return Math.round(games * curveShare(scores));
}

/**
 * Spread a win total across sets with no randomness. Wins are distributed as
 * evenly as possible across the ordered games (a Bresenham line), then grouped
 * into sets. Even spreading means strong teams rack up perfect sets and weak
 * teams string together lost ones, which reads true to a real season.
 */
export function spreadSets(wins: number, setSizes: number[]): number[] {
  const games = setSizes.reduce((a, b) => a + b, 0);
  const out: number[] = [];
  let g = 0;
  for (const size of setSizes) {
    let w = 0;
    for (let k = 0; k < size; k++) {
      if (Math.floor(((g + 1) * wins) / games) > Math.floor((g * wins) / games)) w++;
      g++;
    }
    out.push(w);
  }
  return out;
}

export function lookupVerdict(bands: VerdictBand[], wins: number): string {
  const sorted = [...bands].sort((a, b) => b.min - a.min);
  for (const band of sorted) if (wins >= band.min) return band.line;
  return sorted[sorted.length - 1]?.line ?? '';
}

export function simulate(scores: number[], mode: ModeDescriptor, config: SportConfig): SimResult {
  const wins = clamp(winsFor(scores, mode.type, config.games), 0, config.games);
  const setWins = spreadSets(wins, config.setSizes);
  let setsWon = 0;
  let perfectSets = 0;
  for (let i = 0; i < setWins.length; i++) {
    if (setWins[i] * 2 > config.setSizes[i]) setsWon++;
    if (setWins[i] === config.setSizes[i]) perfectSets++;
  }
  const bands = mode.type === 'tank' ? config.verdict.tank : config.verdict.standard;
  return {
    wins,
    losses: config.games - wins,
    teamScore: Math.round(mean(scores) * 10) / 10,
    totalSets: config.setSizes.length,
    setsWon,
    perfectSets,
    setWins,
    verdict: lookupVerdict(bands, wins),
  };
}
