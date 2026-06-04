/**
 * Daily schedule generation and validation. Spec Section 7.2 and 7.3.
 *
 * Deterministic skips require pre-generating every reachable spin, not one
 * backup list. For each round we produce the primary plus a bounded tree of
 * replacements: the Team-skip and Decade-skip of the primary, and the
 * second-order replacement of each (since a player can skip the replacement too
 * while currencies last). Skip Team rerolls the franchise and keeps the decade.
 * Skip Decade rerolls the decade and keeps the franchise.
 *
 * Because each currency is one-use, only one franchise-changing event can occur
 * per game, so every franchise-changing replacement simply has to avoid the six
 * primary franchises and no two replacements can ever collide. The generator
 * still validates every reachable path for the fail-state rule, the slot-quality
 * rule, and the no-duplicate-franchise rule.
 */

import type {
  DailySchedule,
  GameData,
  Player,
  RoundTree,
  SlotDef,
  Spin,
  SportConfig,
} from './types';
import { dayNumber } from './seed';

export const MIN_POOL = 4; // fail-state floor: at least 4 eligible players (3.6)
export const STAR_SCORE = 75; // slot-quality floor (7.2.2)
export const HEADLINER_SCORE = 85; // every day deserves a star (7.2.3)
const MAX_ATTEMPTS = 2000;

export function poolKey(spin: Spin): string {
  return `${spin.decade}|${spin.franchise}`;
}

function eligible(player: Player, slot: SlotDef): boolean {
  return player.pos.some((p) => slot.accepts.includes(p));
}

/** Players in a pool that can fill at least one roster slot. */
function rosterable(pool: Player[], config: SportConfig): Player[] {
  return pool.filter((p) => config.slots.some((s) => eligible(p, s)));
}

function poolFor(data: GameData, spin: Spin): Player[] {
  return data.pools[poolKey(spin)] ?? [];
}

/** Players in a spin's pool that can fill at least one roster slot. */
export function poolPlayers(data: GameData, spin: Spin, config: SportConfig): Player[] {
  return rosterable(poolFor(data, spin), config);
}

function poolValid(data: GameData, spin: Spin, config: SportConfig): boolean {
  return rosterable(poolFor(data, spin), config).length >= MIN_POOL;
}

function canFill(pool: Player[], slot: SlotDef): boolean {
  return pool.some((p) => eligible(p, slot));
}

function canFillStar(pool: Player[], slot: SlotDef): boolean {
  return pool.some((p) => p.score >= STAR_SCORE && eligible(p, slot));
}

// ---------------------------------------------------------------------------
// Bipartite perfect matching (fail-state: a full legal roster must be possible)
// ---------------------------------------------------------------------------

export function hasPerfectMatching(pools: Player[][], slots: SlotDef[]): boolean {
  const slotToSpin = new Array<number>(slots.length).fill(-1);
  const assign = (spin: number, seen: boolean[]): boolean => {
    for (let j = 0; j < slots.length; j++) {
      if (seen[j] || !canFill(pools[spin], slots[j])) continue;
      seen[j] = true;
      if (slotToSpin[j] === -1 || assign(slotToSpin[j], seen)) {
        slotToSpin[j] = spin;
        return true;
      }
    }
    return false;
  };
  for (let i = 0; i < pools.length; i++) {
    if (!assign(i, new Array<boolean>(slots.length).fill(false))) return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// RNG-driven helpers
// ---------------------------------------------------------------------------

function shuffle<T>(arr: T[], rng: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function validDecadesFor(data: GameData, franchise: string, config: SportConfig): string[] {
  return data.decades.filter((d) => poolValid(data, { decade: d, franchise }, config));
}

function validFranchisesFor(data: GameData, decade: string, config: SportConfig): string[] {
  return data.franchises
    .map((f) => f.id)
    .filter((fr) => poolValid(data, { decade, franchise: fr }, config));
}

// ---------------------------------------------------------------------------
// Path enumeration and validation
// ---------------------------------------------------------------------------

export interface PathState {
  team: number; // round index where Team skip is applied, or -1
  decade: number; // round index where Decade skip is applied, or -1
  order: 'TD' | 'DT' | null; // order when both applied at the same round
  spins: Spin[];
}

/** Every reachable full-game spin sequence given one-use Team and Decade skips. */
export function enumeratePaths(rounds: RoundTree[]): PathState[] {
  const opts = [-1, ...Array.from({ length: rounds.length }, (_, i) => i)];
  const paths: PathState[] = [];
  const build = (team: number, decade: number, order: 'TD' | 'DT' | null): Spin[] | null => {
    const spins: Spin[] = [];
    for (let r = 0; r < rounds.length; r++) {
      let node: Spin | null = rounds[r].primary;
      if (r === team && r === decade) node = order === 'TD' ? rounds[r].teamThenDecade : rounds[r].decadeThenTeam;
      else if (r === team) node = rounds[r].teamSkip;
      else if (r === decade) node = rounds[r].decadeSkip;
      if (!node) return null;
      spins.push(node);
    }
    return spins;
  };
  for (const team of opts) {
    for (const decade of opts) {
      if (team >= 0 && team === decade) {
        for (const order of ['TD', 'DT'] as const) {
          const spins = build(team, decade, order);
          if (spins) paths.push({ team, decade, order, spins });
        }
      } else {
        const spins = build(team, decade, null);
        if (spins) paths.push({ team, decade, order: null, spins });
      }
    }
  }
  return paths;
}

export interface ValidationResult {
  valid: boolean;
  reasons: string[];
}

export function validateSchedule(
  rounds: RoundTree[],
  data: GameData,
  config: SportConfig,
): ValidationResult {
  const reasons: string[] = [];
  const primaryFranchises = new Set(rounds.map((r) => r.primary.franchise));

  // No-duplicate-franchise (test c): every franchise-changing replacement must
  // avoid the primary franchise set. Decade skips keep the franchise, so only
  // team-driven nodes can introduce a new franchise.
  for (let r = 0; r < rounds.length; r++) {
    for (const node of [rounds[r].teamSkip, rounds[r].teamThenDecade, rounds[r].decadeThenTeam]) {
      if (node && primaryFranchises.has(node.franchise) && node.franchise !== rounds[r].primary.franchise) {
        reasons.push(`round ${r}: replacement franchise ${node.franchise} duplicates a primary`);
      }
    }
  }

  const paths = enumeratePaths(rounds);
  let sawHeadliner = false;
  for (const path of paths) {
    const pools = path.spins.map((s) => rosterable(poolFor(data, s), config));
    // Fail-state: every spin keeps at least MIN_POOL eligible players.
    for (let i = 0; i < pools.length; i++) {
      if (pools[i].length < MIN_POOL) {
        reasons.push(`path t${path.team} d${path.decade}${path.order ?? ''}: round ${i} pool below ${MIN_POOL}`);
      }
    }
    // Fail-state: a full legal roster must be constructible.
    if (!hasPerfectMatching(pools, config.slots)) {
      reasons.push(`path t${path.team} d${path.decade}${path.order ?? ''}: no full roster possible`);
    }
    // Slot-quality: every slot fillable by a 75+ somewhere along the path.
    for (const slot of config.slots) {
      if (!pools.some((pool) => canFillStar(pool, slot))) {
        reasons.push(`path t${path.team} d${path.decade}${path.order ?? ''}: slot ${slot.id} has no 75+`);
      }
    }
    if (path.team === -1 && path.decade === -1) {
      sawHeadliner = pools.some((pool) => pool.some((p) => p.score >= HEADLINER_SCORE));
    }
  }
  if (!sawHeadliner) reasons.push('no 85+ headliner among primaries');

  return { valid: reasons.length === 0, reasons: [...new Set(reasons)] };
}

// ---------------------------------------------------------------------------
// Generation
// ---------------------------------------------------------------------------

function pickPrimaries(data: GameData, config: SportConfig, rng: () => number): Spin[] | null {
  // Only consider franchises deep enough to support a Decade skip.
  const keys: Spin[] = [];
  for (const f of data.franchises) {
    if (validDecadesFor(data, f.id, config).length < 2) continue;
    for (const d of f.activeDecades) {
      if (poolValid(data, { decade: d, franchise: f.id }, config)) keys.push({ decade: d, franchise: f.id });
    }
  }
  const need = config.slots.length;
  const shuffled = shuffle(keys, rng);
  const chosen: Spin[] = [];
  const usedFranchise = new Set<string>();
  const decadeCount = new Map<string, number>();
  for (const spin of shuffled) {
    if (chosen.length === need) break;
    if (usedFranchise.has(spin.franchise)) continue;
    if ((decadeCount.get(spin.decade) ?? 0) >= 2) continue;
    // A Team skip must be possible: another valid franchise exists this decade.
    const altFranchise = validFranchisesFor(data, spin.decade, config).filter((fr) => fr !== spin.franchise);
    if (altFranchise.length === 0) continue;
    chosen.push(spin);
    usedFranchise.add(spin.franchise);
    decadeCount.set(spin.decade, (decadeCount.get(spin.decade) ?? 0) + 1);
  }
  return chosen.length === need ? chosen : null;
}

function buildRound(
  primary: Spin,
  primaryFranchises: Set<string>,
  data: GameData,
  config: SportConfig,
  rng: () => number,
): RoundTree | null {
  // Team skip: new franchise this decade, not in primaries, prefer one deep
  // enough to also support a follow-on Decade skip.
  const teamCandidates = shuffle(
    validFranchisesFor(data, primary.decade, config).filter((fr) => !primaryFranchises.has(fr)),
    rng,
  ).sort((a, b) => validDecadesFor(data, b, config).length - validDecadesFor(data, a, config).length);
  const teamFr = teamCandidates[0];
  if (!teamFr) return null;
  const teamSkip: Spin = { decade: primary.decade, franchise: teamFr };

  // Decade skip: new decade for the same franchise.
  const decadeCandidates = shuffle(
    validDecadesFor(data, primary.franchise, config).filter((d) => d !== primary.decade),
    rng,
  );
  const decadeDec = decadeCandidates[0];
  if (!decadeDec) return null;
  const decadeSkip: Spin = { decade: decadeDec, franchise: primary.franchise };

  // Second order: Team then Decade keeps the new franchise, rerolls decade.
  const ttdDec = shuffle(
    validDecadesFor(data, teamFr, config).filter((d) => d !== primary.decade),
    rng,
  )[0];
  if (!ttdDec) return null;
  const teamThenDecade: Spin = { decade: ttdDec, franchise: teamFr };

  // Second order: Decade then Team keeps the new decade, rerolls franchise.
  const dttFr = shuffle(
    validFranchisesFor(data, decadeDec, config).filter((fr) => !primaryFranchises.has(fr)),
    rng,
  )[0];
  if (!dttFr) return null;
  const decadeThenTeam: Spin = { decade: decadeDec, franchise: dttFr };

  return { primary, teamSkip, decadeSkip, teamThenDecade, decadeThenTeam };
}

export function generateDay(
  data: GameData,
  config: SportConfig,
  date: string,
  rng: () => number,
): DailySchedule {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const primaries = pickPrimaries(data, config, rng);
    if (!primaries) continue;
    const primaryFranchises = new Set(primaries.map((p) => p.franchise));
    const rounds: RoundTree[] = [];
    let ok = true;
    for (const primary of primaries) {
      const round = buildRound(primary, primaryFranchises, data, config, rng);
      if (!round) {
        ok = false;
        break;
      }
      rounds.push(round);
    }
    if (!ok) continue;
    if (validateSchedule(rounds, data, config).valid) {
      return { sport: config.sport, date, dayNumber: dayNumber(date), rounds };
    }
  }
  throw new Error(`generateDay: no valid schedule for ${date} after ${MAX_ATTEMPTS} attempts`);
}
