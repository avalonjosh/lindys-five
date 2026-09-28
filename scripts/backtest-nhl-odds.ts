/**
 * Backtest the NHL playoff-odds model against a completed season.
 *
 * Replays the season by pulling the NHL standings every N days, running the
 * live model (lib/utils/standingsCalc + playoffProbability) on each snapshot,
 * and scoring the predictions against who actually finished in a playoff spot.
 *
 * Reports Brier score and log loss overall and by season phase, a calibration
 * table (predicted bucket vs observed playoff rate), and two baselines:
 *   - "position": 100% if the team currently holds a playoff spot, else 0%
 *   - "pace vs 96": raw pace projection against the fixed Lindy's Five target
 *
 * Run with: npx tsx scripts/backtest-nhl-odds.ts [--season 20252026] [--step 3] [--prior team|league]
 *
 * --prior team (default) regresses early pace toward each team's preseason
 * estimate from the prior season's final standings, as the live site does;
 * --prior league regresses every team toward the league average instead.
 *
 * Tuning loop: edit PACE_PRIOR_GAMES / K_FULL_SEASON / path multipliers /
 * position bonus in lib/utils/playoffProbability.ts, re-run, compare Brier.
 * Lower is better; 0.25 is a coin flip, ~0.10 is a decent midseason model.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import type { StandingsTeam } from '../lib/types/boxscore';
import {
  getCutLines,
  getModelProjectedPoints,
  getPlayoffProbability,
  getProjectedPoints,
  isInPlayoffPosition,
} from '../lib/utils/standingsCalc';
import { computePositionAwareProbability, probabilityForFinalPoints } from '../lib/utils/playoffProbability';
import { LEAGUE_AVG_PACE, priorPaceFromLastSeason, setPriorPaceOverride } from '../lib/utils/nhlPriorPace';
import { computeLeaguePreseasonOdds } from '../lib/utils/preseasonOdds';
import { getRegularSeasonGameCount, previousNHLSeason, getCurrentNHLSeason } from '../lib/utils/season';

const NHL_API = 'https://api-web.nhle.com/v1';

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const season = arg('season', previousNHLSeason(getCurrentNHLSeason()));
const stepDays = Math.max(1, parseInt(arg('step', '3'), 10));
const priorMode = arg('prior', 'team');
const carry = arg('carry', '');
const totalGames = getRegularSeasonGameCount(season);
const startYear = parseInt(season.slice(0, 4), 10);

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

// Snapshots are cached on disk so tuning reruns don't refetch the season.
const CACHE_DIR = join(process.cwd(), 'node_modules', '.cache', 'nhl-backtest');

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchJson(url: string, cacheKey: string): Promise<any> {
  const cachePath = join(CACHE_DIR, `${cacheKey}.json`);
  if (existsSync(cachePath)) return JSON.parse(readFileSync(cachePath, 'utf8'));
  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await fetch(url);
    await sleep(150);
    if (res.ok && (res.headers.get('content-type') || '').includes('json')) {
      const data = await res.json();
      mkdirSync(CACHE_DIR, { recursive: true });
      writeFileSync(cachePath, JSON.stringify(data));
      return data;
    }
    if (res.status === 404) return null;
    await sleep(1000 * 2 ** attempt);
  }
  throw new Error(`Failed to fetch ${url}`);
}

async function fetchStandings(date: string): Promise<StandingsTeam[]> {
  const data = await fetchJson(`${NHL_API}/standings/${date}`, `standings-${date}`);
  return Array.isArray(data?.standings) ? data.standings : [];
}

async function fetchFinalStandings(forSeason: string): Promise<StandingsTeam[]> {
  const data = await fetchJson(`${NHL_API}/standings-season`, `standings-season-${getCurrentNHLSeason()}`);
  const end = data.seasons?.find((s: { id: number }) => String(s.id) === forSeason)?.standingsEnd;
  return end ? fetchStandings(end) : [];
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

interface Sample {
  date: string;
  abbrev: string;
  gamesPlayed: number;
  model: number;     // 0-1
  position: number;  // 0-1
  pace96: number;    // 0-1
}

interface Score { brier: number; logLoss: number; n: number }

function score(samples: Sample[], key: keyof Pick<Sample, 'model' | 'position' | 'pace96'>, outcome: Map<string, number>): Score {
  let brier = 0;
  let logLoss = 0;
  for (const s of samples) {
    const y = outcome.get(s.abbrev) ?? 0;
    const p = Math.min(0.999, Math.max(0.001, s[key]));
    brier += (p - y) ** 2;
    logLoss += -(y * Math.log(p) + (1 - y) * Math.log(1 - p));
  }
  return { brier: brier / samples.length, logLoss: logLoss / samples.length, n: samples.length };
}

async function main() {
  console.log(`Backtesting NHL ${season.slice(0, 4)}-${season.slice(6)} (${totalGames} games), every ${stepDays} days, prior: ${priorMode}\n`);

  // Preseason estimates from last season's final standings: the live model's
  // prior (when --prior team) and the preseason odds shown before game 1.
  const lastFinal = await fetchFinalStandings(previousNHLSeason(season));
  const preseasonOdds = new Map<string, number>();
  const priors: Record<string, number> = {};
  const leagueOdds = computeLeaguePreseasonOdds(lastFinal, totalGames);
  for (const t of lastFinal) {
    priors[t.teamAbbrev.default] = carry
      ? LEAGUE_AVG_PACE + parseFloat(carry) * (t.points / t.gamesPlayed - LEAGUE_AVG_PACE)
      : priorPaceFromLastSeason(t.points, t.gamesPlayed);
    preseasonOdds.set(t.teamAbbrev.default, leagueOdds.get(t.teamAbbrev.default)!.playoffProbability / 100);
  }
  setPriorPaceOverride(priorMode === 'team' ? priors : {});

  // Walk from Oct 1 of the start year to May 1 of the end year.
  const samples: Sample[] = [];
  let finalStandings: StandingsTeam[] | null = null;
  let firstStandings: StandingsTeam[] = [];
  const cursor = new Date(Date.UTC(startYear, 9, 1));
  const stop = new Date(Date.UTC(startYear + 1, 4, 1));

  while (cursor <= stop) {
    const date = isoDate(cursor);
    const standings = await fetchStandings(date);
    cursor.setUTCDate(cursor.getUTCDate() + stepDays);
    if (standings.length < 30) continue;

    const maxGp = Math.max(...standings.map(t => t.gamesPlayed));
    if (maxGp === 0) continue;

    const complete = standings.filter(t => t.gamesPlayed >= totalGames).length >= standings.length - 2;
    if (complete) {
      finalStandings = standings;
      break;
    }

    if (!firstStandings.length) firstStandings = standings;
    for (const team of standings) {
      if (team.gamesPlayed === 0) continue;
      samples.push({
        date,
        abbrev: team.teamAbbrev.default,
        gamesPlayed: team.gamesPlayed,
        model: getPlayoffProbability(team, standings, totalGames) / 100,
        position: isInPlayoffPosition(team) ? 1 : 0,
        pace96: probabilityForFinalPoints(
          getProjectedPoints(team.points, team.gamesPlayed, totalGames),
          team.gamesPlayed,
          Math.round(96 * totalGames / 82),
          'default',
          totalGames
        ) / 100,
      });
    }
    process.stdout.write(`\r  ${date}: ${samples.length} samples`);
  }
  console.log();

  if (!finalStandings) {
    // Season may not have a "complete" snapshot on a sampled day; grab the last one.
    finalStandings = await fetchFinalStandings(season);
  }
  if (!finalStandings || finalStandings.length < 30) {
    console.error('Could not load final standings for the season.');
    process.exit(1);
  }

  const outcome = new Map<string, number>();
  for (const t of finalStandings) {
    const madeIt = ['x', 'y', 'z', 'p'].includes(t.clinchIndicator || '') || isInPlayoffPosition(t);
    outcome.set(t.teamAbbrev.default, madeIt ? 1 : 0);
  }
  const playoffTeams = [...outcome.entries()].filter(([, v]) => v === 1).map(([k]) => k);
  console.log(`Playoff teams (${playoffTeams.length}): ${playoffTeams.sort().join(' ')}\n`);

  // ── Overall + by phase ──
  const phases: [string, (gp: number) => boolean][] = [
    ['1-10 GP', gp => gp <= 10],
    ['11-20 GP', gp => gp > 10 && gp <= 20],
    ['21-41 GP', gp => gp > 20 && gp <= 41],
    ['42-60 GP', gp => gp > 41 && gp <= 60],
    ['61-72 GP', gp => gp > 60 && gp <= 72],
    ['73+ GP', gp => gp > 72],
  ];
  const fmt = (s: Score) => `${s.brier.toFixed(4)} / ${s.logLoss.toFixed(3)}`;
  console.log('Brier / log loss (lower is better)');
  console.log('| Phase     |    n | Model          | Position only  | Pace vs 96     |');
  console.log('|-----------|------|----------------|----------------|----------------|');
  const rows: [string, Sample[]][] = [['All', samples], ...phases.map(([label, f]) => [label, samples.filter(s => f(s.gamesPlayed))] as [string, Sample[]])];
  for (const [label, subset] of rows) {
    if (subset.length === 0) continue;
    const m = score(subset, 'model', outcome);
    const p = score(subset, 'position', outcome);
    const b = score(subset, 'pace96', outcome);
    console.log(`| ${label.padEnd(9)} | ${String(subset.length).padStart(4)} | ${fmt(m).padEnd(14)} | ${fmt(p).padEnd(14)} | ${fmt(b).padEnd(14)} |`);
  }

  // ── Preseason to live jump ──
  const firstByTeam = new Map<string, Sample>();
  for (const smp of samples) if (!firstByTeam.has(smp.abbrev)) firstByTeam.set(smp.abbrev, smp);
  const jumps = [...firstByTeam.values()]
    .filter(f => preseasonOdds.has(f.abbrev))
    .map(f => ({ abbrev: f.abbrev, gp: f.gamesPlayed, pre: preseasonOdds.get(f.abbrev)!, live: f.model }));
  if (jumps.length) {
    const preScore = jumps.reduce((a, j) => a + (j.pre - (outcome.get(j.abbrev) ?? 0)) ** 2, 0) / jumps.length;
    const meanJump = jumps.reduce((a, j) => a + Math.abs(j.live - j.pre), 0) / jumps.length;
    const maxJump = jumps.reduce((m, j) => (Math.abs(j.live - j.pre) > Math.abs(m.live - m.pre) ? j : m));
    const liveSum = [...firstByTeam.values()].reduce((a, f) => a + f.model, 0);
    console.log(`\nPreseason odds Brier: ${preScore.toFixed(4)}`);
    console.log(`Preseason -> first live snapshot: mean |jump| ${(meanJump * 100).toFixed(1)} pts, max ${maxJump.abbrev} ${(maxJump.pre * 100).toFixed(0)}% -> ${(maxJump.live * 100).toFixed(0)}% (GP ${maxJump.gp})`);
    console.log(`First snapshot league sum: ${liveSum.toFixed(1)} of 16 spots`);
    const swings = [...firstByTeam.values()].map(f => {
      const st = firstStandings.find(t => t.teamAbbrev.default === f.abbrev)!;
      const { divCutLine, wcCutLine } = getCutLines(st, firstStandings, totalGames);
      const p = (pts: number) => computePositionAwareProbability(
        getModelProjectedPoints(pts, st.gamesPlayed + 1, f.abbrev, totalGames), st.gamesPlayed + 1,
        divCutLine, wcCutLine, isInPlayoffPosition(st), undefined, totalGames).probability;
      return p(st.points + 2) - p(st.points);
    });
    console.log(`Next-game swing (win vs regulation loss) at first snapshot: mean ${(swings.reduce((a, b) => a + b, 0) / swings.length).toFixed(1)} pts`);
  }

  // ── Calibration ──
  console.log('\nCalibration (model): predicted bucket vs observed playoff rate');
  console.log('| Bucket   |    n | Mean pred | Observed | Gap    |');
  console.log('|----------|------|-----------|----------|--------|');
  for (let lo = 0; lo < 100; lo += 10) {
    const hi = lo + 10;
    const bucket = samples.filter(s => s.model * 100 >= lo && (s.model * 100 < hi || (hi === 100 && s.model * 100 <= 100)));
    if (bucket.length === 0) continue;
    const meanPred = bucket.reduce((a, s) => a + s.model, 0) / bucket.length;
    const observed = bucket.reduce((a, s) => a + (outcome.get(s.abbrev) ?? 0), 0) / bucket.length;
    const gap = observed - meanPred;
    console.log(`| ${`${lo}-${hi}%`.padEnd(8)} | ${String(bucket.length).padStart(4)} | ${(meanPred * 100).toFixed(1).padStart(8)}% | ${(observed * 100).toFixed(1).padStart(7)}% | ${(gap >= 0 ? '+' : '') + (gap * 100).toFixed(1)}${' '.repeat(Math.max(0, 5 - (gap * 100).toFixed(1).length))} |`);
  }

  // ── Worst misses (late-season confident errors) ──
  const late = samples.filter(s => s.gamesPlayed >= 60);
  const misses = late
    .map(s => ({ ...s, err: Math.abs(s.model - (outcome.get(s.abbrev) ?? 0)) }))
    .sort((a, b) => b.err - a.err)
    .slice(0, 8);
  if (misses.length) {
    console.log('\nBiggest late-season misses (60+ GP)');
    for (const m of misses) {
      console.log(`  ${m.date} ${m.abbrev.padEnd(4)} GP ${m.gamesPlayed}  model ${(m.model * 100).toFixed(0).padStart(3)}%  actual ${outcome.get(m.abbrev) ? 'IN' : 'OUT'}`);
    }
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
