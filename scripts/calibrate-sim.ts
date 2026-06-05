/**
 * Phase 2 win-curve calibration (spec Section 8.2). Runs the sim against a set
 * of hand-built rosters spanning all-immortal to rock-bottom, plus tank cases,
 * so the curve constants can be judged before the UI is built.
 *
 * Run with: npx tsx scripts/calibrate-sim.ts
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { GameData, ModeDescriptor, SportConfig } from '../lib/perfectseason/types';
import { mlbConfig } from '../lib/perfectseason/config.mlb';
import { nhlConfig } from '../lib/perfectseason/config.nhl';
import { simulate, curveShare } from '../lib/perfectseason/sim';
import { eligible } from '../lib/perfectseason/engine';

// Sport selector: `npx tsx scripts/calibrate-sim.ts [mlb|nhl]`, default mlb.
const SPORT = process.argv[2] === 'nhl' ? 'nhl' : 'mlb';
const config: SportConfig = SPORT === 'nhl' ? nhlConfig : mlbConfig;
const data = JSON.parse(
  readFileSync(join(process.cwd(), 'data', `${SPORT}-data.json`), 'utf8'),
) as GameData;
console.log(`sport: ${SPORT}  (${config.slots.length} slots, ${config.games} games)\n`);

interface Roster {
  label: string;
  scores: number[];
}

// Hand-built standard rosters (one score per slot), best to worst.
const ROSTERS_MLB: Roster[] = [
  { label: 'Nine immortals', scores: [100, 99.9, 99.9, 99.8, 99.6, 99.4, 99, 98.7, 98.6] },
  { label: 'All-time legends', scores: [98, 97, 97, 96, 96, 95, 95, 95, 94] },
  { label: 'Stacked (all 90+)', scores: [94, 93, 92, 92, 91, 91, 90, 90, 90] },
  { label: 'Eight legends + filler', scores: [99, 98, 97, 96, 96, 95, 95, 94, 55] },
  { label: 'Eight legends + scrub', scores: [99, 98, 97, 96, 96, 95, 95, 94, 30] },
  { label: 'Six stars + three avg', scores: [95, 93, 91, 90, 88, 87, 70, 69, 68] },
  { label: 'Balanced good (~85)', scores: [88, 87, 86, 85, 85, 84, 83, 83, 82] },
  { label: 'Balanced solid (~78)', scores: [80, 79, 79, 78, 78, 77, 77, 76, 76] },
  { label: 'Top-heavy, weak tail', scores: [95, 93, 90, 84, 78, 70, 60, 52, 45] },
  { label: 'Average (~65)', scores: [68, 67, 66, 65, 65, 64, 63, 63, 62] },
  { label: 'Mediocre (~55)', scores: [58, 57, 56, 55, 55, 54, 53, 53, 52] },
  { label: 'Below average (~45)', scores: [48, 47, 46, 45, 45, 44, 43, 43, 42] },
  { label: 'Bad (~35)', scores: [38, 37, 36, 35, 35, 34, 33, 33, 32] },
  { label: 'Awful (~20)', scores: [22, 21, 20, 19, 19, 18, 17, 17, 16] },
  { label: 'Rock bottom (~5)', scores: [8, 7, 6, 5, 5, 4, 3, 3, 2] },
];

// Six-slot equivalents for NHL (LW/C/RW/D1/D2/G).
const ROSTERS_NHL: Roster[] = [
  { label: 'Six immortals', scores: [100, 99.8, 99.6, 99.3, 99, 98.6] },
  { label: 'All-time legends', scores: [98, 97, 96, 95, 95, 94] },
  { label: 'Stacked (all 90+)', scores: [94, 93, 92, 91, 90, 90] },
  { label: 'Five legends + filler', scores: [99, 98, 97, 96, 95, 55] },
  { label: 'Five legends + scrub', scores: [99, 98, 97, 96, 95, 30] },
  { label: 'Four stars + two avg', scores: [95, 93, 90, 88, 70, 68] },
  { label: 'Balanced good (~85)', scores: [88, 87, 86, 85, 84, 83] },
  { label: 'Balanced solid (~78)', scores: [80, 79, 78, 78, 77, 76] },
  { label: 'Top-heavy, weak tail', scores: [95, 92, 84, 72, 58, 45] },
  { label: 'Average (~65)', scores: [68, 67, 66, 65, 64, 63] },
  { label: 'Mediocre (~55)', scores: [58, 57, 56, 55, 54, 53] },
  { label: 'Below average (~45)', scores: [48, 47, 46, 45, 44, 43] },
  { label: 'Bad (~35)', scores: [38, 37, 36, 35, 34, 33] },
  { label: 'Awful (~20)', scores: [22, 21, 20, 19, 18, 17] },
  { label: 'Rock bottom (~5)', scores: [8, 7, 6, 5, 4, 3] },
];

const ROSTERS = SPORT === 'nhl' ? ROSTERS_NHL : ROSTERS_MLB;

const STANDARD: ModeDescriptor = { type: 'standard', source: 'free' };
const TANK: ModeDescriptor = { type: 'tank', source: 'free' };

function row(label: string, scores: number[], mode: ModeDescriptor): string {
  const r = simulate(scores, mode, config);
  const rec = `${r.wins}-${r.losses}`.padStart(7);
  const sets = `${r.setsWon}/${r.totalSets}`.padStart(6);
  const perfect = String(r.perfectSets).padStart(2);
  const ts = r.teamScore.toFixed(1).padStart(5);
  return `  ${label.padEnd(24)} score ${ts}  ${rec}  ${sets} sets  ${perfect} perfect   ${r.verdict}`;
}

const perfectGoal = `${config.games}-0`;
console.log(`=== STANDARD MODE (build the best team, chase ${perfectGoal}) ===\n`);
for (const ros of ROSTERS) console.log(row(ros.label, ros.scores, STANDARD));

console.log('\n=== CEILING CHECK ===');
const allMax = new Array<number>(config.slots.length).fill(100);
console.log(`  Perfect 100s roster -> ${simulate(allMax, STANDARD, config).wins} wins`);
console.log(`  Max possible win share (teamScore 100, gate 1.0): ${(curveShare(allMax) * 100).toFixed(1)}%`);
console.log(`  => the apex is ${simulate(allMax, STANDARD, config).wins} wins: only the single best-possible roster reaches ${perfectGoal}.`);

console.log(`\n=== TANK MODE (build the worst team, chase 0-${config.games}; fewer wins is better) ===\n`);
const TANK_CASES_MLB: Roster[] = [
  { label: 'Nine scrubs', scores: [8, 7, 6, 5, 5, 4, 3, 3, 2] },
  { label: 'Eight scrubs + one legend', scores: [8, 7, 6, 5, 5, 4, 3, 3, 99] },
  { label: 'Eight scrubs + one average', scores: [8, 7, 6, 5, 5, 4, 3, 3, 65] },
  { label: 'All below-average (~40)', scores: [44, 43, 42, 41, 40, 39, 38, 38, 37] },
  { label: 'Accidentally good (all 90+)', scores: [94, 93, 92, 92, 91, 91, 90, 90, 90] },
];
const TANK_CASES_NHL: Roster[] = [
  { label: 'Six scrubs', scores: [8, 7, 6, 5, 4, 3] },
  { label: 'Five scrubs + one legend', scores: [8, 7, 6, 5, 4, 99] },
  { label: 'Five scrubs + one average', scores: [8, 7, 6, 5, 4, 65] },
  { label: 'All below-average (~40)', scores: [44, 43, 42, 41, 40, 38] },
  { label: 'Accidentally good (all 90+)', scores: [94, 93, 92, 91, 90, 90] },
];
const TANK_CASES = SPORT === 'nhl' ? TANK_CASES_NHL : TANK_CASES_MLB;
for (const ros of TANK_CASES) console.log(row(ros.label, ros.scores, TANK));
console.log('\n  Tank floor note: the lone legend should raise the win total versus six scrubs (strongest-link gate).');

// A real, namable dream roster pulled from the data, for a concrete sanity read.
console.log('\n=== REAL DREAM ROSTER (best eligible per slot from the data, dedupe enforced) ===\n');
const used = new Set<string>();
const dream: { slot: string; name: string; score: number }[] = [];
for (const slot of config.slots) {
  let best: { id: string; name: string; score: number } | null = null;
  for (const pool of Object.values(data.pools)) {
    for (const p of pool) {
      if (used.has(p.id) || !eligible(p, slot)) continue;
      if (!best || p.score > best.score) best = { id: p.id, name: p.name, score: p.score };
    }
  }
  if (best) {
    used.add(best.id);
    dream.push({ slot: slot.id, name: best.name, score: best.score });
  }
}
for (const d of dream) console.log(`  ${d.slot.padEnd(4)} ${d.name.padEnd(20)} ${d.score.toFixed(1)}`);
const dreamResult = simulate(dream.map((d) => d.score), STANDARD, config);
console.log(`\n  -> ${dreamResult.wins}-${dreamResult.losses}, ${dreamResult.setsWon}/${dreamResult.totalSets} sets, ${dreamResult.perfectSets} perfect. ${dreamResult.verdict}`);
