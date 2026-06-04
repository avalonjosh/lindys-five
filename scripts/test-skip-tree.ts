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

import type { GameData, Player, RoundTree, Spin } from '../lib/perfectseason/types';
import { mlbConfig } from '../lib/perfectseason/config.mlb';
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
  createGame,
  currentSpin,
  eligible,
  legalSlots,
  reduce,
  type Action,
  type EngineState,
} from '../lib/perfectseason/engine';

const data = JSON.parse(readFileSync(join(process.cwd(), 'data', 'mlb-data.json'), 'utf8')) as GameData;

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
  return pool.filter((p) => mlbConfig.slots.some((s) => eligible(p, s)));
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
      for (const slot of mlbConfig.slots) {
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
      const sched = generateDay(data, mlbConfig, date, dailyRng('mlb', date));
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
  const res = validateSchedule(rounds, data, mlbConfig);
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

/** Build an action list that team-skips round 0, decade-skips round 1, fills all six. */
function scriptedActions(): { actions: Action[]; expectedSpins: Spin[] } | null {
  const path = enumeratePaths(rounds).find((p) => p.team === 0 && p.decade === 1 && p.order === null);
  if (!path) return null;
  const plan = autoComplete(path.spins);
  if (!plan) return null;
  const actions: Action[] = [];
  for (let r = 0; r < rounds.length; r++) {
    if (r === 0) actions.push({ type: 'SKIP_TEAM' });
    if (r === 1) actions.push({ type: 'SKIP_DECADE' });
    const step = plan.find((p) => p.round === r)!;
    actions.push({ type: 'SELECT_PLAYER', id: step.playerId });
    actions.push({ type: 'ASSIGN_SLOT', slotId: step.slotId });
  }
  return { actions, expectedSpins: path.spins };
}

function runRecordingSpins(actions: Action[]): { spins: Spin[]; final: EngineState } {
  let s = createGame(data, mlbConfig, rounds, { type: 'standard', source: 'daily' });
  const spins: Spin[] = [];
  for (const a of actions) {
    if (a.type === 'ASSIGN_SLOT') spins.push(currentSpin(s));
    s = reduce(s, a);
  }
  return { spins, final: s };
}

const scripted = scriptedActions();
check('a deterministic full playthrough script exists', () => {
  assert.ok(scripted, 'could not script a full playthrough on the sample schedule');
});

if (scripted) {
  const a = runRecordingSpins(scripted.actions);
  const b = runRecordingSpins(scripted.actions);
  check('two players, same actions, identical spin sequence', () => {
    assert.deepEqual(a.spins, b.spins);
  });
  check('recorded spins match the intended skip path', () => {
    assert.deepEqual(a.spins, scripted.expectedSpins);
  });
  check('two players, same actions, identical record and verdict', () => {
    assert.deepEqual(a.final.result, b.final.result);
    assert.ok(a.final.done && a.final.result);
  });
  check('dedupe held: six distinct players rostered', () => {
    assert.equal(new Set(a.final.usedPlayerIds).size, 6);
    assert.equal(a.final.picks.length, 6);
  });
  check('skipping changes the spin (round 0 is not the primary)', () => {
    assert.notDeepEqual(a.spins[0], rounds[0].primary);
    assert.deepEqual(a.spins[0], rounds[0].teamSkip);
  });
}

console.log('\nengine guards');
check('illegal slot assignment is rejected', () => {
  let s = createGame(data, mlbConfig, rounds, { type: 'standard', source: 'daily' });
  const players = availablePlayers(s);
  const player = players[0];
  // Find a slot the player is NOT eligible for, if any.
  const badSlot = mlbConfig.slots.find((sl) => !eligible(player, sl));
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
  let s = createGame(data, mlbConfig, rounds, { type: 'standard', source: 'daily' });
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
