/**
 * Phase 2 win-curve calibration (spec Section 8.2). Runs the sim against a set
 * of hand-built rosters spanning all-immortal to rock-bottom, plus tank cases,
 * so the curve constants can be judged before the UI is built.
 *
 * Run with: npx tsx scripts/calibrate-sim.ts
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { GameData, ModeDescriptor } from '../lib/perfectseason/types';
import { mlbConfig } from '../lib/perfectseason/config.mlb';
import { simulate, curveShare } from '../lib/perfectseason/sim';
import { eligible } from '../lib/perfectseason/engine';

const data = JSON.parse(readFileSync(join(process.cwd(), 'data', 'mlb-data.json'), 'utf8')) as GameData;

interface Roster {
  label: string;
  scores: number[];
}

// Fifteen hand-built standard rosters (nine players each), best to worst.
const ROSTERS: Roster[] = [
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

const STANDARD: ModeDescriptor = { type: 'standard', source: 'free' };
const TANK: ModeDescriptor = { type: 'tank', source: 'free' };

function row(label: string, scores: number[], mode: ModeDescriptor): string {
  const r = simulate(scores, mode, mlbConfig);
  const rec = `${r.wins}-${r.losses}`.padStart(7);
  const sets = `${r.setsWon}/${r.totalSets}`.padStart(6);
  const perfect = String(r.perfectSets).padStart(2);
  const ts = r.teamScore.toFixed(1).padStart(5);
  return `  ${label.padEnd(24)} score ${ts}  ${rec}  ${sets} sets  ${perfect} perfect   ${r.verdict}`;
}

console.log('=== STANDARD MODE (build the best team, chase 162-0) ===\n');
for (const ros of ROSTERS) console.log(row(ros.label, ros.scores, STANDARD));

console.log('\n=== CEILING CHECK ===');
const allMax = [100, 100, 100, 100, 100, 100, 100, 100, 100];
console.log(`  Perfect 100s roster -> ${simulate(allMax, STANDARD, mlbConfig).wins} wins`);
console.log(`  Max possible win share (teamScore 100, gate 1.0): ${(curveShare(allMax) * 100).toFixed(1)}%`);
console.log(`  => the apex is ${simulate(allMax, STANDARD, mlbConfig).wins} wins: only the single best-possible roster reaches 162-0.`);

console.log('\n=== TANK MODE (build the worst team, chase 0-162; fewer wins is better) ===\n');
const TANK_CASES: Roster[] = [
  { label: 'Nine scrubs', scores: [8, 7, 6, 5, 5, 4, 3, 3, 2] },
  { label: 'Eight scrubs + one legend', scores: [8, 7, 6, 5, 5, 4, 3, 3, 99] },
  { label: 'Eight scrubs + one average', scores: [8, 7, 6, 5, 5, 4, 3, 3, 65] },
  { label: 'All below-average (~40)', scores: [44, 43, 42, 41, 40, 39, 38, 38, 37] },
  { label: 'Accidentally good (all 90+)', scores: [94, 93, 92, 92, 91, 91, 90, 90, 90] },
];
for (const ros of TANK_CASES) console.log(row(ros.label, ros.scores, TANK));
console.log('\n  Tank floor note: the lone legend should raise the win total versus six scrubs (strongest-link gate).');

// A real, namable dream roster pulled from the data, for a concrete sanity read.
console.log('\n=== REAL DREAM ROSTER (best eligible per slot from the data, dedupe enforced) ===\n');
const used = new Set<string>();
const dream: { slot: string; name: string; score: number }[] = [];
for (const slot of mlbConfig.slots) {
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
const dreamResult = simulate(dream.map((d) => d.score), STANDARD, mlbConfig);
console.log(`\n  -> ${dreamResult.wins}-${dreamResult.losses}, ${dreamResult.setsWon}/${dreamResult.totalSets} sets, ${dreamResult.perfectSets} perfect. ${dreamResult.verdict}`);
