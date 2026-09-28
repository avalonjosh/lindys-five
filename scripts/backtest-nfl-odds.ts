/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Backtest the NFL playoff-odds model: for past seasons, take games through a
 * checkpoint week, simulate the rest, and score each team's playoff odds
 * against who actually made it (ESPN playoffSeed <= 7). Usage:
 *   npx tsx scripts/backtest-nfl-odds.ts [--from 2021 --to 2025] [--grid]
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import {
  blendedRatings, simpleRatings, simulateSeason, NFL_DEFAULT_PARAMS, NFL_DIVISION_OF,
  type NFLGame, type NFLOddsParams,
} from '../lib/utils/nflOdds';

const arg = (name: string, def: number) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? Number(process.argv[i + 1]) : def;
};
const FROM = arg('from', 2021);
const TO = arg('to', 2025);
const GRID = process.argv.includes('--grid');
const CACHE = 'node_modules/.cache/nfl-backtest';
mkdirSync(CACHE, { recursive: true });

async function cached(name: string, url: string) {
  const file = `${CACHE}/${name}.json`;
  if (existsSync(file)) return JSON.parse(readFileSync(file, 'utf8'));
  const data = await (await fetch(url)).json();
  writeFileSync(file, JSON.stringify(data));
  return data;
}

async function seasonGames(season: number): Promise<NFLGame[]> {
  const out: NFLGame[] = [];
  for (let week = 1; week <= 18; week++) {
    const d = await cached(`sb-${season}-${week}`, `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?seasontype=2&week=${week}&dates=${season}`);
    for (const e of d.events || []) {
      const c = e.competitions[0];
      const home = c.competitors.find((t: any) => t.homeAway === 'home');
      const away = c.competitors.find((t: any) => t.homeAway === 'away');
      if (!NFL_DIVISION_OF.has(home.team.abbreviation) || !NFL_DIVISION_OF.has(away.team.abbreviation)) continue;
      out.push({
        week,
        home: home.team.abbreviation,
        away: away.team.abbreviation,
        homeScore: Number(home.score || 0),
        awayScore: Number(away.score || 0),
        final: c.status?.type?.name === 'STATUS_FINAL',
        neutral: !!c.neutralSite,
      });
    }
  }
  return out;
}

async function playoffTeams(season: number): Promise<Set<string>> {
  const d = await cached(`st-${season}`, `https://site.api.espn.com/apis/v2/sports/football/nfl/standings?season=${season}`);
  const set = new Set<string>();
  for (const conf of d.children || []) {
    for (const e of conf.standings?.entries || []) {
      const seed = e.stats.find((s: any) => s.name === 'playoffSeed')?.value;
      if (seed && seed <= 7) set.add(e.team.abbreviation);
    }
  }
  return set;
}

(async () => {
  const data: { season: number; games: NFLGame[]; prior: Map<string, number>; truth: Set<string> }[] = [];
  for (let s = FROM; s <= TO; s++) {
    const games = await seasonGames(s);
    const prev = await seasonGames(s - 1);
    data.push({ season: s, games, prior: simpleRatings(prev, NFL_DEFAULT_PARAMS.hfa), truth: await playoffTeams(s) });
    console.log(`${s}: ${games.length} games, ${data[data.length - 1].truth.size} playoff teams`);
  }
  const checkpoints = [3, 6, 9, 12, 15];

  const score = (params: NFLOddsParams, sims: number) => {
    const byWeek = new Map<number, { brier: number; n: number }>();
    let brier = 0;
    let n = 0;
    for (const { games, prior, truth } of data) {
      for (const wk of checkpoints) {
        const asOf = games.map((g) => (g.week <= wk ? g : { ...g, final: false }));
        const ratings = blendedRatings(asOf, prior, params);
        const odds = simulateSeason(asOf, ratings, params, sims);
        for (const [abbr, o] of odds) {
          const e = (o.playoff / 100 - (truth.has(abbr) ? 1 : 0)) ** 2;
          brier += e;
          n++;
          const w = byWeek.get(wk) || { brier: 0, n: 0 };
          w.brier += e;
          w.n++;
          byWeek.set(wk, w);
        }
      }
    }
    return { brier: brier / n, byWeek: [...byWeek.entries()].map(([w, x]) => `wk${w} ${(x.brier / x.n).toFixed(4)}`).join('  ') };
  };

  // Baseline: everyone at the base rate (14 of 32 make it).
  const base = 14 / 32;
  console.log(`base rate: brier ${(base * (1 - base)).toFixed(4)}`);
  const d = score(NFL_DEFAULT_PARAMS, 2000);
  console.log(`default ${JSON.stringify(NFL_DEFAULT_PARAMS)}: brier ${d.brier.toFixed(4)} | ${d.byWeek}`);

  if (GRID) {
    const priorList = (process.env.PRIOR || '3,6,10').split(',').map(Number);
    const carryList = (process.env.CARRY || '0.3,0.5,0.7').split(',').map(Number);
    const hfaList = (process.env.HFA || '1,2').split(',').map(Number);
    for (const priorGames of priorList) {
      for (const carryover of carryList) {
        for (const hfa of hfaList) {
          const p = { ...NFL_DEFAULT_PARAMS, priorGames, carryover, hfa };
          const r = score(p, 1000);
          console.log(`prior ${priorGames} carry ${carryover} hfa ${hfa}: brier ${r.brier.toFixed(4)} | ${r.byWeek}`);
        }
      }
    }
  }
})();
