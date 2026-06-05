/**
 * Phase 2 test suite for the deterministic skip-replacement tree (spec 7.3).
 * Non-negotiable: this must pass before anything ships.
 *
 *   (a) enumerate all skip paths for a sample schedule and assert every
 *       reachable state is valid (fail-state and no-duplicate-franchise),
 *   (b) two simulated players taking identical actions see identical spins,
 *   (c) replacement spins never duplicate a franchise seen in the primaries.
 *
 * Run with: npx tsx scripts/test-skip-tree.ts
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import assert from 'node:assert/strict';

import type { GameData, Player, RoundTree, Spin, SportConfig } from '../lib/perfectseason/types';
import { mlbConfig } from '../lib/perfectseason/config.mlb';
import { nhlConfig } from '../lib/perfectseason/config.nhl';
import { dailyRng } from '../lib/perfectseason/seed';
import {
  enumeratePaths,
  generateDay,
  poolKey,
  validateSchedule,
  MIN_POOL,
} from '../lib/perfectseason/schedule';
import {
  availablePlayers,
  canSkipTeam,
  createGame,
  currentSpin,
  eligible,
  legalSlots,
  reduce,
  type EngineState,
} from '../lib/perfectseason/engine';

// Sport selector: `npx tsx scripts/test-skip-tree.ts [mlb|nhl]`, default mlb.
const SPORT = process.argv[2] === 'nhl' ? 'nhl' : 'mlb';
const config: SportConfig = SPORT === 'nhl' ? nhlConfig : mlbConfig;
const data = JSON.parse(
  readFileSync(join(process.cwd(), 'data', `${SPORT}-data.json`), 'utf8'),
) as GameData;
console.log(`sport: ${SPORT}  (${config.slots.length} slots, ${config.games} games)`);

let passed = 0;
function check(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  ok  ${name}`);
  } catch (err) {
    console.error(`FAIL  ${name}`);
    console.error(`      ${(err as Error).message}`);
    process.exitCode = 1;
  }
}

function rosterable(pool: Player[]): Player[] {
  return pool.filter((p) => config.slots.some((s) => eligible(p, s)));
}

/** Backtracking full roster build for a fixed spin path, honoring dedupe. */
function autoComplete(spins: Spin[]): { round: number; playerId: string; slotId: string }[] | null {
  const pools = spins.map((s) => rosterable(data.pools[poolKey(s)] ?? []));
  const used = new Set<string>();
  const filledSlots = new Set<string>();
  const out: { round: number; playerId: string; slotId: string }[] = [];
  const solve = (round: number): boolean => {
    if (round === spins.length) return true;
    for (const player of pools[round]) {
      if (used.has(player.id)) continue;
      for (const slot of config.slots) {
        if (filledSlots.has(slot.id) || !eligible(player, slot)) continue;
        used.add(player.id);
        filledSlots.add(slot.id);
        out.push({ round, playerId: player.id, slotId: slot.id });
        if (solve(round + 1)) return true;
        out.pop();
        used.delete(player.id);
        filledSlots.delete(slot.id);
      }
    }
    return false;
  };
  return solve(0) ? out : null;
}

// Find a date whose generated schedule validates, so the suite is reproducible.
function sampleSchedule(): { date: string; rounds: RoundTree[] } {
  for (let i = 0; i < 40; i++) {
    const date = `2026-07-${String(10 + i).padStart(2, '0')}`;
    try {
      const sched = generateDay(data, config, date, dailyRng(SPORT, date));
      return { date, rounds: sched.rounds };
    } catch {
      // try the next date
    }
  }
  throw new Error('could not generate any valid sample schedule');
}

const sample = sampleSchedule();
console.log(`sample schedule: ${sample.date}`);
const rounds = sample.rounds;

console.log('\n(a) all reachable skip paths are valid');
check('validateSchedule reports valid', () => {
  const res = validateSchedule(rounds, data, config);
  assert.ok(res.valid, `invalid: ${res.reasons.join('; ')}`);
});
check('every enumerated path keeps >= MIN_POOL eligible per spin', () => {
  for (const path of enumeratePaths(rounds)) {
    for (const spin of path.spins) {
      const n = rosterable(data.pools[poolKey(spin)] ?? []).length;
      assert.ok(n >= MIN_POOL, `path t${path.team} d${path.decade}: pool ${poolKey(spin)} has ${n}`);
    }
  }
});
check('every enumerated path admits a full legal roster', () => {
  for (const path of enumeratePaths(rounds)) {
    assert.ok(autoComplete(path.spins), `path t${path.team} d${path.decade} has no full roster`);
  }
});

console.log('\n(c) replacements never duplicate a primary franchise');
check('no franchise-changing replacement reuses a primary franchise', () => {
  const primaries = new Set(rounds.map((r) => r.primary.franchise));
  for (let r = 0; r < rounds.length; r++) {
    for (const node of [rounds[r].teamSkip, rounds[r].teamThenDecade, rounds[r].decadeThenTeam]) {
      if (!node) continue;
      if (node.franchise !== rounds[r].primary.franchise) {
        assert.ok(!primaries.has(node.franchise), `round ${r}: ${node.franchise} duplicates a primary`);
      }
    }
  }
});
check('decade skip keeps the franchise, changes the decade', () => {
  for (let r = 0; r < rounds.length; r++) {
    const d = rounds[r].decadeSkip;
    if (!d) continue;
    assert.equal(d.franchise, rounds[r].primary.franchise);
    assert.notEqual(d.decade, rounds[r].primary.decade);
  }
});

console.log('\n(b) identical actions produce identical spins (determinism)');

/** Drive the engine greedily: top available player into its first finishable slot. */
function playGreedy(sched: RoundTree[]): { spins: Spin[]; final: EngineState } {
  let s = createGame(data, config, sched, { type: 'standard', source: 'daily' });
  const spins: Spin[] = [];
  let guard = 0;
  while (!s.done && guard++ < 50) {
    const players = availablePlayers(s);
    if (players.length === 0) break;
    const slot = legalSlots(s, players[0])[0];
    if (!slot) break;
    spins.push(currentSpin(s));
    s = reduce(reduce(s, { type: 'SELECT_PLAYER', id: players[0].id }), { type: 'ASSIGN_SLOT', slotId: slot.id });
  }
  return { spins, final: s };
}

const a = playGreedy(rounds);
const b = playGreedy(rounds);
check('two players, same actions, identical spin sequence', () => {
  assert.deepEqual(a.spins, b.spins);
});
check('two players, same actions, identical record and verdict', () => {
  assert.deepEqual(a.final.result, b.final.result);
  assert.ok(a.final.done && a.final.result, 'greedy no-skip playthrough completes');
});
check('dedupe held: one distinct player per slot rostered', () => {
  const n = config.slots.length;
  assert.equal(new Set(a.final.usedPlayerIds).size, n);
  assert.equal(a.final.picks.length, n);
});
check('a team skip reroll changes the current spin', () => {
  let s = createGame(data, config, rounds, { type: 'standard', source: 'daily' });
  assert.ok(canSkipTeam(s), 'team skip should be offered at round 0');
  s = reduce(s, { type: 'SKIP_TEAM' });
  assert.deepEqual(currentSpin(s), rounds[0].teamSkip);
  assert.notDeepEqual(currentSpin(s), rounds[0].primary);
});

console.log('\ncompletability: a player can never strand');
check('30 sample days all complete via greedy no-skip play', () => {
  let played = 0;
  for (let i = 0; i < 30; i++) {
    const date = `2026-08-${String(1 + i).padStart(2, '0')}`;
    let sched: RoundTree[];
    try {
      sched = generateDay(data, config, date, dailyRng(SPORT, date)).rounds;
    } catch {
      continue;
    }
    played++;
    assert.ok(playGreedy(sched).final.done, `greedy play stranded on ${date}`);
  }
  assert.ok(played >= 25, `expected most days to generate, only ${played} did`);
});

console.log('\nengine guards');
check('illegal slot assignment is rejected', () => {
  let s = createGame(data, config, rounds, { type: 'standard', source: 'daily' });
  const players = availablePlayers(s);
  const player = players[0];
  // Find a slot the player is NOT eligible for, if any.
  const badSlot = config.slots.find((sl) => !eligible(player, sl));
  s = reduce(s, { type: 'SELECT_PLAYER', id: player.id });
  if (badSlot) {
    const after = reduce(s, { type: 'ASSIGN_SLOT', slotId: badSlot.id });
    assert.equal(after.picks.length, 0, 'illegal assignment should not record a pick');
  }
  const good = legalSlots(s, player)[0];
  const ok = reduce(s, { type: 'ASSIGN_SLOT', slotId: good.id });
  assert.equal(ok.picks.length, 1);
});
check('undo reverts the last assignment', () => {
  let s = createGame(data, config, rounds, { type: 'standard', source: 'daily' });
  const p = availablePlayers(s)[0];
  s = reduce(s, { type: 'SELECT_PLAYER', id: p.id });
  s = reduce(s, { type: 'ASSIGN_SLOT', slotId: legalSlots(s, p)[0].id });
  assert.equal(s.picks.length, 1);
  assert.equal(s.round, 1);
  const undone = reduce(s, { type: 'UNDO' });
  assert.equal(undone.picks.length, 0);
  assert.equal(undone.round, 0);
});

console.log(`\n${passed} checks passed`);
if (process.exitCode === 1) console.error('SUITE FAILED');
