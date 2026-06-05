import type { GameData, ModeType, SportConfig } from './types';
import type { PickRecord } from './engine';
import { poolPlayers } from './schedule';

export interface Rating {
  rating: number; // 0-100, one decimal
  grade: string; // 'A+', 'B', ...
  tier: string; // one-word tier, e.g. 'CONTENDER'
}

interface Band {
  min: number;
  grade: string;
  tier: string;
  tankTier: string;
}

// Grade bands keyed off the 0-100 roster rating (mirrors 82-0.com: B sits in the low 80s).
const BANDS: Band[] = [
  { min: 97, grade: 'A+', tier: 'PERFECTION', tankTier: 'HISTORIC TANK' },
  { min: 93, grade: 'A', tier: 'DYNASTY', tankTier: 'TANK MASTER' },
  { min: 90, grade: 'A-', tier: 'DYNASTY', tankTier: 'TANK MASTER' },
  { min: 87, grade: 'B+', tier: 'CONTENDER', tankTier: 'TANK COMMANDER' },
  { min: 83, grade: 'B', tier: 'CONTENDER', tankTier: 'TANK COMMANDER' },
  { min: 80, grade: 'B-', tier: 'CONTENDER', tankTier: 'TANKING HARD' },
  { min: 75, grade: 'C+', tier: 'PLAYOFF TEAM', tankTier: 'TANKING' },
  { min: 70, grade: 'C', tier: 'PLAYOFF TEAM', tankTier: 'SOFT TANK' },
  { min: 60, grade: 'D', tier: 'PRETENDER', tankTier: 'NOT BAD ENOUGH' },
  { min: 0, grade: 'F', tier: 'LOTTERY BOUND', tankTier: 'TOO GOOD' },
];

export function gradeAndTier(rating: number, tank: boolean): { grade: string; tier: string } {
  const b = BANDS.find((x) => rating >= x.min) ?? BANDS[BANDS.length - 1];
  return { grade: b.grade, tier: tank ? b.tankTier : b.tier };
}

/**
 * 0-100 roster rating: for each pick, how close it was to the best option in
 * that round's pool (or the worst, in Tank), averaged across the roster. A
 * perfect draft (always the top option) approaches 100.
 */
export function rosterRating(data: GameData, config: SportConfig, picks: PickRecord[], modeType: ModeType): Rating {
  const tank = modeType === 'tank';
  let sum = 0;
  let n = 0;
  for (const p of picks) {
    const scores = poolPlayers(data, p.spin, config).map((pl) => pl.score);
    if (scores.length === 0) continue;
    const max = Math.max(...scores);
    const min = Math.min(...scores);
    const span = max - min;
    const q = span === 0 ? 1 : tank ? (max - p.score) / span : (p.score - min) / span;
    sum += q;
    n += 1;
  }
  const rating = n === 0 ? 0 : Math.round((sum / n) * 1000) / 10;
  return { rating, ...gradeAndTier(rating, tank) };
}
