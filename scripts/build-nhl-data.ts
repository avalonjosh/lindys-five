/**
 * build-nhl-data.ts (Perfect Season / 82-0, Phase 7)
 *
 * Reads the cached NHL stats API season summaries from raw-data/nhl/nhlapi,
 * groups every player into (player, franchise, decade) stints, applies the spec
 * thresholds and per-82 normalization, era-normalizes the rate stats vs the
 * decade league environment, scores players on a 0 to 100 within-sport
 * percentile scale, and writes data/nhl-data.json in the shared output schema.
 *
 * Mirrors build-mlb-data.ts (Phase 1) so the engine reads both identically.
 *
 * Franchise lineage and era-correct names: progress doc Section 12.6.
 * Scoring weights: spec Section 13 (skaters P/82 60, G/82 25, durability 15;
 * goalies SV% 70, GAA inverted 20, durability 10).
 *
 * Run locally with: npx tsx scripts/build-nhl-data.ts
 *
 * Data: NHL stats REST API (api.nhle.com/stats/rest). Facts only, no logos.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const RAW = join(process.cwd(), 'raw-data', 'nhl', 'nhlapi');
const OUT = join(process.cwd(), 'data', 'nhl-data.json');

const DECADES = ['1950s', '1960s', '1970s', '1980s', '1990s', '2000s', '2010s', '2020s'];
const FIRST_START = 1950;
const LAST_START = 2025;

// Per-stint games thresholds (spec Section 6.2).
const SKATER_MIN_GP = 150;
const GOALIE_MIN_GP = 80;

// ----------------------------------------------------------------------------
// Franchise lineage (progress doc Section 12.6)
// ----------------------------------------------------------------------------

// Defunct Bay Area lineage, dropped entirely (folded 1978, thin pools).
const DROP = new Set(['OAK', 'CGS', 'CLE']);

// Source triCode -> canonical franchise ID. Anything not listed maps to itself.
const FRANCHISE_OF: Record<string, string> = {
  MNS: 'DAL',
  AFM: 'CGY',
  KCS: 'NJD',
  CLR: 'NJD',
  HFD: 'CAR',
  QUE: 'COL',
  WIN: 'UTA',
  PHX: 'UTA',
  ARI: 'UTA',
  ATL: 'WPG',
};

function franchOf(tri: string): string | null {
  if (DROP.has(tri)) return null;
  return FRANCHISE_OF[tri] ?? tri;
}

// Modern (default) franchise names, one per canonical ID. 32 franchises.
const MODERN: Record<string, string> = {
  BOS: 'Boston Bruins', CHI: 'Chicago Blackhawks', DET: 'Detroit Red Wings',
  MTL: 'Montreal Canadiens', NYR: 'New York Rangers', TOR: 'Toronto Maple Leafs',
  LAK: 'Los Angeles Kings', PHI: 'Philadelphia Flyers', PIT: 'Pittsburgh Penguins',
  STL: 'St. Louis Blues', BUF: 'Buffalo Sabres', VAN: 'Vancouver Canucks',
  NYI: 'New York Islanders', WSH: 'Washington Capitals', EDM: 'Edmonton Oilers',
  SJS: 'San Jose Sharks', TBL: 'Tampa Bay Lightning', OTT: 'Ottawa Senators',
  ANA: 'Anaheim Ducks', FLA: 'Florida Panthers', NSH: 'Nashville Predators',
  CBJ: 'Columbus Blue Jackets', MIN: 'Minnesota Wild', VGK: 'Vegas Golden Knights',
  SEA: 'Seattle Kraken', DAL: 'Dallas Stars', CGY: 'Calgary Flames',
  NJD: 'New Jersey Devils', CAR: 'Carolina Hurricanes', COL: 'Colorado Avalanche',
  UTA: 'Utah', WPG: 'Winnipeg Jets',
};

// Per-decade era-correct name overrides (Section 12.6). Decades not listed use
// the modern name above.
const OVERRIDES: Record<string, Record<string, string>> = {
  DAL: { '1960s': 'Minnesota North Stars', '1970s': 'Minnesota North Stars', '1980s': 'Minnesota North Stars' },
  CGY: { '1970s': 'Atlanta Flames' },
  NJD: { '1970s': 'Colorado Rockies' },
  CAR: { '1970s': 'Hartford Whalers', '1980s': 'Hartford Whalers', '1990s': 'Hartford Whalers' },
  COL: { '1970s': 'Quebec Nordiques', '1980s': 'Quebec Nordiques', '1990s': 'Quebec Nordiques' },
  UTA: { '1970s': 'Winnipeg Jets', '1980s': 'Winnipeg Jets', '1990s': 'Winnipeg Jets', '2000s': 'Phoenix Coyotes', '2010s': 'Arizona Coyotes' },
  WPG: { '1990s': 'Atlanta Thrashers', '2000s': 'Atlanta Thrashers' },
  CHI: { '1950s': 'Chicago Black Hawks', '1960s': 'Chicago Black Hawks', '1970s': 'Chicago Black Hawks', '1980s': 'Chicago Black Hawks' },
  ANA: { '1990s': 'Mighty Ducks of Anaheim', '2000s': 'Mighty Ducks of Anaheim' },
};

function nameFor(id: string, dec: string): string {
  return OVERRIDES[id]?.[dec] ?? MODERN[id] ?? id;
}

// Map an NHL API positionCode to the game's roster vocabulary.
const POS_MAP: Record<string, string> = { C: 'C', L: 'LW', R: 'RW', D: 'D' };

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

function num(v: unknown): number {
  if (v === null || v === undefined) return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function decadeOf(startYear: number): string {
  return `${Math.floor(startYear / 10) * 10}s`;
}

/** Format a rate stat to three decimals, dropping the leading zero (.915). */
function rate3(v: number): string {
  const s = v.toFixed(3);
  return s.startsWith('0') ? s.slice(1) : s;
}

function signed(n: number): string {
  return n > 0 ? `+${n}` : String(n);
}

/** Mid-rank percentiles in [0,1]; ties share their averaged rank. */
function percentiles(values: number[]): number[] {
  const n = values.length;
  const out = new Array<number>(n).fill(0.5);
  if (n < 2) return out;
  const order = values.map((v, i) => [v, i] as [number, number]).sort((a, b) => a[0] - b[0]);
  let i = 0;
  while (i < n) {
    let j = i;
    while (j + 1 < n && order[j + 1][0] === order[i][0]) j++;
    const pct = ((i + j) / 2) / (n - 1);
    for (let k = i; k <= j; k++) out[order[k][1]] = pct;
    i = j + 1;
  }
  return out;
}

function loadSeason(seasonId: number, kind: 'skaters' | 'goalies'): any[] {
  const f = join(RAW, String(seasonId), `${kind}.json`);
  if (!existsSync(f)) return [];
  return JSON.parse(readFileSync(f, 'utf8')) as any[];
}

// ----------------------------------------------------------------------------
// Accumulate stints + league environment in one pass over the seasons
// ----------------------------------------------------------------------------

interface SkaterAcc {
  name: string;
  GP: number;
  G: number;
  A: number;
  P: number;
  pmSum: number;
  pmGP: number; // games from seasons where plusMinus was tracked
  pos: Map<string, number>; // mapped position -> games
}

interface GoalieAcc {
  name: string;
  GP: number;
  W: number;
  SO: number;
  saves: number;
  shots: number;
  GA: number;
  toi: number; // seconds
}

const skaterStints = new Map<string, SkaterAcc>(); // playerId|franch|dec
const goalieStints = new Map<string, GoalieAcc>();
const franchDecades = new Map<string, Set<string>>(); // franch -> decades with any data

// League environment per decade.
const leagueSk = new Map<string, { P: number; G: number; GP: number }>();
const leagueGo = new Map<string, { saves: number; shots: number; GA: number; toi: number }>();

for (let start = FIRST_START; start <= LAST_START; start++) {
  const seasonId = start * 10000 + (start + 1);
  const dec = decadeOf(start);

  for (const r of loadSeason(seasonId, 'skaters')) {
    const franch = franchOf(r.queriedTri);
    if (!franch) continue;
    const gp = num(r.gamesPlayed);
    if (gp <= 0) continue;
    const pos = POS_MAP[r.positionCode];
    if (!pos) continue; // unknown position code, skip

    // league environment (all rows, pre-threshold)
    const le = leagueSk.get(dec) ?? { P: 0, G: 0, GP: 0 };
    le.P += num(r.points);
    le.G += num(r.goals);
    le.GP += gp;
    leagueSk.set(dec, le);

    (franchDecades.get(franch) ?? franchDecades.set(franch, new Set()).get(franch)!).add(dec);

    const key = `${r.playerId}|${franch}|${dec}`;
    const a =
      skaterStints.get(key) ??
      { name: r.skaterFullName, GP: 0, G: 0, A: 0, P: 0, pmSum: 0, pmGP: 0, pos: new Map<string, number>() };
    a.GP += gp;
    a.G += num(r.goals);
    a.A += num(r.assists);
    a.P += num(r.points);
    if (r.plusMinus !== null && r.plusMinus !== undefined) {
      a.pmSum += num(r.plusMinus);
      a.pmGP += gp;
    }
    a.pos.set(pos, (a.pos.get(pos) ?? 0) + gp);
    skaterStints.set(key, a);
  }

  for (const r of loadSeason(seasonId, 'goalies')) {
    const franch = franchOf(r.queriedTri);
    if (!franch) continue;
    const gp = num(r.gamesPlayed);
    if (gp <= 0) continue;

    const lg = leagueGo.get(dec) ?? { saves: 0, shots: 0, GA: 0, toi: 0 };
    lg.saves += num(r.saves);
    lg.shots += num(r.shotsAgainst);
    lg.GA += num(r.goalsAgainst);
    lg.toi += num(r.timeOnIce);
    leagueGo.set(dec, lg);

    (franchDecades.get(franch) ?? franchDecades.set(franch, new Set()).get(franch)!).add(dec);

    const key = `${r.playerId}|${franch}|${dec}`;
    const a =
      goalieStints.get(key) ??
      { name: r.goalieFullName, GP: 0, W: 0, SO: 0, saves: 0, shots: 0, GA: 0, toi: 0 };
    a.GP += gp;
    a.W += num(r.wins);
    a.SO += num(r.shutouts);
    a.saves += num(r.saves);
    a.shots += num(r.shotsAgainst);
    a.GA += num(r.goalsAgainst);
    a.toi += num(r.timeOnIce);
    goalieStints.set(key, a);
  }
}

// Decade league baselines.
const leagueP82 = new Map<string, number>();
const leagueG82 = new Map<string, number>();
for (const [dec, a] of leagueSk) {
  leagueP82.set(dec, (a.P / Math.max(1, a.GP)) * 82);
  leagueG82.set(dec, (a.G / Math.max(1, a.GP)) * 82);
}
const leagueSV = new Map<string, number>();
const leagueGAA = new Map<string, number>();
for (const [dec, a] of leagueGo) {
  leagueSV.set(dec, a.shots > 0 ? a.saves / a.shots : 0.9);
  leagueGAA.set(dec, a.toi > 0 ? (a.GA * 3600) / a.toi : 3.0);
}

// ----------------------------------------------------------------------------
// Build candidates with scoring components and display lines
// ----------------------------------------------------------------------------

interface Candidate {
  id: string;
  name: string;
  franch: string;
  dec: string;
  pos: string[];
  kind: 'skater' | 'goalie';
  c1: number;
  c2: number;
  c3: number;
  line: Record<string, string | number>;
}

const candidates: Candidate[] = [];

for (const [key, a] of skaterStints) {
  if (a.GP < SKATER_MIN_GP) continue;
  const [id, franch, dec] = key.split('|');
  const per82 = 82 / a.GP;
  const p82 = a.P * per82;
  const g82 = a.G * per82;
  const a82 = a.A * per82;
  const pm82 = a.pmGP > 0 ? Math.round((a.pmSum * 82) / a.pmGP) : null;
  // Eligible positions: those >= 20 percent of the stint's games.
  const cut = 0.2 * a.GP;
  let pos = [...a.pos.entries()].filter(([, g]) => g >= cut).map(([p]) => p);
  if (pos.length === 0) pos = [[...a.pos.entries()].reduce((b, c) => (c[1] > b[1] ? c : b))[0]];
  candidates.push({
    id,
    name: a.name,
    franch,
    dec,
    pos,
    kind: 'skater',
    c1: p82 / (leagueP82.get(dec) || p82 || 1),
    c2: g82 / (leagueG82.get(dec) || g82 || 1),
    c3: a.GP,
    line: { g: Math.round(g82), a: Math.round(a82), p: Math.round(p82), plusMinus: pm82 === null ? 'NA' : signed(pm82) },
  });
}

for (const [key, a] of goalieStints) {
  if (a.GP < GOALIE_MIN_GP) continue;
  const [id, franch, dec] = key.split('|');
  const svpct = a.shots > 0 ? a.saves / a.shots : null;
  const gaa = a.toi > 0 ? (a.GA * 3600) / a.toi : null;
  if (gaa === null) continue; // no usable rate stat at all
  const per82 = 82 / a.GP;
  // SV% normalized vs era; missing shot data -> neutral (ratio 1.0).
  const normSV = svpct === null ? 1 : svpct / (leagueSV.get(dec) || svpct || 1);
  const invGAA = (leagueGAA.get(dec) || gaa) / Math.max(0.01, gaa);
  candidates.push({
    id,
    name: a.name,
    franch,
    dec,
    pos: ['G'],
    kind: 'goalie',
    c1: normSV,
    c2: invGAA,
    c3: a.GP,
    line: {
      svp: svpct === null ? 'NA' : rate3(svpct),
      gaa: gaa.toFixed(2),
      w: Math.round(a.W * per82),
      so: Math.round(a.SO * per82),
    },
  });
}

// ----------------------------------------------------------------------------
// Scoring: component percentiles within group, then final percentile sport-wide
// ----------------------------------------------------------------------------

const skaters = candidates.filter((c) => c.kind === 'skater');
const goalies = candidates.filter((c) => c.kind === 'goalie');

function rawScores(group: Candidate[], w1: number, w2: number, w3: number): number[] {
  const p1 = percentiles(group.map((c) => c.c1));
  const p2 = percentiles(group.map((c) => c.c2));
  const p3 = percentiles(group.map((c) => c.c3));
  return group.map((_, i) => w1 * p1[i] + w2 * p2[i] + w3 * p3[i]);
}

// Skaters: P/82 60, G/82 25, durability 15. Goalies: SV% 70, GAA inv 20, dur 10.
const skRaw = rawScores(skaters, 0.6, 0.25, 0.15);
const goRaw = rawScores(goalies, 0.7, 0.2, 0.1);

const allCand = [...skaters, ...goalies];
const allRaw = [...skRaw, ...goRaw];
const finalPct = percentiles(allRaw);
const scoreById = finalPct.map((p) => Math.round(p * 1000) / 10);

// ----------------------------------------------------------------------------
// Assemble pools and franchises
// ----------------------------------------------------------------------------

interface PlayerOut {
  id: string;
  name: string;
  pos: string[];
  score: number;
  line: Record<string, string | number>;
}

const pools: Record<string, PlayerOut[]> = {};
const usedFranch = new Set<string>();
for (let i = 0; i < allCand.length; i++) {
  const c = allCand[i];
  const poolKey = `${c.dec}|${c.franch}`;
  (pools[poolKey] ??= []).push({ id: c.id, name: c.name, pos: c.pos, score: scoreById[i], line: c.line });
  usedFranch.add(c.franch);
}
for (const arr of Object.values(pools)) arr.sort((a, b) => b.score - a.score);

const franchises = [...usedFranch].sort().map((id) => {
  const active = [...(franchDecades.get(id) ?? [])].sort();
  const names: Record<string, string> = {};
  for (const dec of active) names[dec] = nameFor(id, dec);
  return { id, names, activeDecades: active };
});

const output = { sport: 'nhl', decades: DECADES, franchises, pools };
writeFileSync(OUT, JSON.stringify(output));

// ----------------------------------------------------------------------------
// Report: summary plus the ten hand-check pools
// ----------------------------------------------------------------------------

const sizeKB = (JSON.stringify(output).length / 1024).toFixed(0);
console.log('--- build-nhl-data summary ---');
console.log(`candidates: ${allCand.length} (skaters ${skaters.length}, goalies ${goalies.length})`);
console.log(`pools: ${Object.keys(pools).length}   franchises: ${franchises.length}`);
console.log(`output: data/nhl-data.json  (~${sizeKB} KB)`);

const HAND_CHECK: [string, string][] = [
  ['1980s|EDM', '80s Oilers'],
  ['1970s|MTL', '70s Canadiens'],
  ['1970s|BOS', '70s Bruins'],
  ['1990s|DET', '90s Red Wings'],
  ['2000s|COL', '00s Avalanche'],
  ['1980s|NYI', '80s Islanders'],
  ['1990s|PIT', '90s Penguins'],
  ['2000s|NJD', '00s Devils'],
  ['2010s|CHI', '10s Blackhawks'],
  ['1970s|BUF', '70s Sabres'],
];

function fmtLine(p: PlayerOut): string {
  const l = p.line;
  if ('gaa' in l) return `SV% ${l.svp}  GAA ${l.gaa}  W ${l.w}  SO ${l.so}`;
  return `G ${l.g}  A ${l.a}  P ${l.p}  +/- ${l.plusMinus}`;
}

for (const [key, label] of HAND_CHECK) {
  const pool = pools[key] ?? [];
  console.log(`\n=== ${label}  (${key})  ${pool.length} players ===`);
  for (const p of pool.slice(0, 15)) {
    const pos = p.pos.join('/').padEnd(7);
    const score = p.score.toFixed(1).padStart(5);
    console.log(`  ${score}  ${pos} ${p.name.padEnd(22)} ${fmtLine(p)}`);
  }
}
