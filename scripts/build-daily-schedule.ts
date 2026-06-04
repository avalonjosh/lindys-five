/**
 * build-daily-schedule.ts (Perfect Season, Phase 4)
 *
 * Pre-generates a validated daily schedule (spec Section 7.2) so every day is
 * known-valid and the same for everyone, with no runtime generation. Each day's
 * board comes from the deterministic date seed, so this file is reproducible.
 *
 * Run with: npx tsx scripts/build-daily-schedule.ts
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { GameData } from '../lib/perfectseason/types';
import { mlbConfig } from '../lib/perfectseason/config.mlb';
import { generateDay } from '../lib/perfectseason/schedule';
import { dailyRng, dayNumber, DAILY_EPOCH } from '../lib/perfectseason/seed';

const data = JSON.parse(readFileSync(join(process.cwd(), 'data', 'mlb-data.json'), 'utf8')) as GameData;
const OUT = join(process.cwd(), 'data', 'mlb-daily-schedule.json');

const START = DAILY_EPOCH; // first scheduled day
const DAYS = 150; // roughly five months ahead

function addDays(date: string, n: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

const days: Record<string, { dayNumber: number; rounds: unknown }> = {};
let ok = 0;
const failures: string[] = [];
const t0 = Date.now();

for (let i = 0; i < DAYS; i++) {
  const date = addDays(START, i);
  try {
    const sched = generateDay(data, mlbConfig, date, dailyRng('mlb', date));
    days[date] = { dayNumber: dayNumber(date), rounds: sched.rounds };
    ok++;
  } catch (err) {
    failures.push(`${date}: ${(err as Error).message}`);
  }
}

const out = { sport: 'mlb', epoch: DAILY_EPOCH, days };
writeFileSync(OUT, JSON.stringify(out));

const sizeKB = (JSON.stringify(out).length / 1024).toFixed(0);
console.log(`generated ${ok}/${DAYS} daily boards from ${START} (~${sizeKB} KB, ${((Date.now() - t0) / 1000).toFixed(1)}s)`);
if (failures.length) {
  console.error(`FAILURES (${failures.length}):`);
  for (const f of failures) console.error(`  ${f}`);
  process.exitCode = 1;
}
