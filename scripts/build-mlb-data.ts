/**
 * build-mlb-data.ts (Perfect Season / 162-0, Phase 1)
 *
 * Reads the Lahman CSV set from raw-data/lahman, groups every player into
 * (player, franchise, decade) stints, applies the spec thresholds and
 * per-162 / per-32-start normalization, era-normalizes the rate stats vs the
 * decade league environment, scores players on a 0 to 100 within-sport
 * percentile scale, and writes data/mlb-data.json in the shared output schema.
 *
 * Run locally with: npx tsx scripts/build-mlb-data.ts
 *
 * Data: Lahman Baseball Database (CC BY-SA), sabr.org. Facts only, no logos.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const RAW = join(process.cwd(), 'raw-data', 'lahman');
const OUT = join(process.cwd(), 'data', 'mlb-data.json');

const DECADES = ['1950s', '1960s', '1970s', '1980s', '1990s', '2000s', '2010s', '2020s'];

// Threshold tuning constants (spec Section 6.1).
const BATTER_MIN_G = 300;
const SP_MIN_GS = 60;
// The 2020 season was 60 games. Scale 2020 workload up to a full schedule so a
// strong but short 2020 stint can still clear the games and starts thresholds.
const SHORT_2020_WEIGHT = 162 / 60;

// ----------------------------------------------------------------------------
// CSV parsing
// ----------------------------------------------------------------------------

/** Minimal RFC-4180 CSV parser. Handles quoted fields, escaped quotes, BOM. */
function parseCSV(text: string): Record<string, string>[] {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const rows: string[][] = [];
  let field = '';
  let row: string[] = [];
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (c !== '\r') {
      field += c;
    }
  }
  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }
  const header = rows[0];
  const out: Record<string, string>[] = [];
  for (let r = 1; r < rows.length; r++) {
    if (rows[r].length !== header.length) continue;
    const obj: Record<string, string> = {};
    for (let c = 0; c < header.length; c++) obj[header[c]] = rows[r][c];
    out.push(obj);
  }
  return out;
}

function load(name: string): Record<string, string>[] {
  return parseCSV(readFileSync(join(RAW, `${name}.csv`), 'utf8'));
}

function num(v: string | undefined): number {
  if (!v) return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function decadeOf(year: number): string | null {
  if (year < 1950 || year > 2029) return null;
  return `${Math.floor(year / 10) * 10}s`;
}

/** Format a rate stat to three decimals, dropping the leading zero (.267). */
function rate3(v: number): string {
  const s = v.toFixed(3);
  return s.startsWith('0') ? s.slice(1) : s;
}

/**
 * Mid-rank percentiles in [0,1]. Ties share the average of their rank span so
 * equal inputs get equal scores.
 */
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

// ----------------------------------------------------------------------------
// Franchise map (teamID + year -> franchID, plus names and active decades)
// ----------------------------------------------------------------------------

const teams = load('Teams');
const teamToFranch = new Map<string, string>(); // `${year}|${teamID}` -> franchID
const franchActive = new Map<string, Set<string>>(); // franchID -> decades within window
const franchNameTally = new Map<string, Map<string, Map<string, number>>>(); // franchID -> decade -> name -> seasons

for (const t of teams) {
  const year = num(t.yearID);
  const franchID = t.franchID;
  teamToFranch.set(`${t.yearID}|${t.teamID}`, franchID);
  const dec = decadeOf(year);
  if (!dec) continue;
  if (!franchActive.has(franchID)) franchActive.set(franchID, new Set());
  franchActive.get(franchID)!.add(dec);
  if (!franchNameTally.has(franchID)) franchNameTally.set(franchID, new Map());
  const byDec = franchNameTally.get(franchID)!;
  if (!byDec.has(dec)) byDec.set(dec, new Map());
  const names = byDec.get(dec)!;
  names.set(t.name, (names.get(t.name) ?? 0) + 1);
}

function franchOf(year: string, teamID: string): string | undefined {
  return teamToFranch.get(`${year}|${teamID}`);
}

/** Most-used team name for a franchise within a decade. */
function nameForDecade(franchID: string, dec: string): string | null {
  const names = franchNameTally.get(franchID)?.get(dec);
  if (!names) return null;
  let best = '';
  let bestN = -1;
  for (const [nm, cnt] of names) {
    if (cnt > bestN) {
      best = nm;
      bestN = cnt;
    }
  }
  return best || null;
}

// ----------------------------------------------------------------------------
// League environment per decade (for era normalization)
// ----------------------------------------------------------------------------

const battingRows = load('Batting');
const pitchingRows = load('Pitching');

const leagueBat = new Map<string, { H: number; AB: number; BB: number; HBP: number; SF: number; B2: number; B3: number; HR: number }>();
for (const b of battingRows) {
  const dec = decadeOf(num(b.yearID));
  if (!dec) continue;
  const acc = leagueBat.get(dec) ?? { H: 0, AB: 0, BB: 0, HBP: 0, SF: 0, B2: 0, B3: 0, HR: 0 };
  acc.H += num(b.H);
  acc.AB += num(b.AB);
  acc.BB += num(b.BB);
  acc.HBP += num(b.HBP);
  acc.SF += num(b.SF);
  acc.B2 += num(b['2B']);
  acc.B3 += num(b['3B']);
  acc.HR += num(b.HR);
  leagueBat.set(dec, acc);
}
const leagueOPS = new Map<string, number>();
for (const [dec, a] of leagueBat) {
  const obp = (a.H + a.BB + a.HBP) / Math.max(1, a.AB + a.BB + a.HBP + a.SF);
  const tb = a.H + a.B2 + 2 * a.B3 + 3 * a.HR;
  const slg = tb / Math.max(1, a.AB);
  leagueOPS.set(dec, obp + slg);
}

const leaguePit = new Map<string, { ER: number; IPouts: number; BB: number; H: number }>();
for (const p of pitchingRows) {
  const dec = decadeOf(num(p.yearID));
  if (!dec) continue;
  const acc = leaguePit.get(dec) ?? { ER: 0, IPouts: 0, BB: 0, H: 0 };
  acc.ER += num(p.ER);
  acc.IPouts += num(p.IPouts);
  acc.BB += num(p.BB);
  acc.H += num(p.H);
  leaguePit.set(dec, acc);
}
const leagueERA = new Map<string, number>();
const leagueWHIP = new Map<string, number>();
for (const [dec, a] of leaguePit) {
  const ip = a.IPouts / 3;
  leagueERA.set(dec, (a.ER * 9) / Math.max(1, ip));
  leagueWHIP.set(dec, (a.BB + a.H) / Math.max(1, ip));
}

// ----------------------------------------------------------------------------
// People (names)
// ----------------------------------------------------------------------------

const people = load('People');
const nameOf = new Map<string, string>();
for (const p of people) {
  const full = `${p.nameFirst ?? ''} ${p.nameLast ?? ''}`.trim();
  nameOf.set(p.playerID, full || p.playerID);
}

// ----------------------------------------------------------------------------
// Batting stints: group by player|franchise|decade
// ----------------------------------------------------------------------------

interface BatAcc {
  G: number;
  thresholdG: number;
  AB: number;
  R: number;
  H: number;
  B2: number;
  B3: number;
  HR: number;
  RBI: number;
  BB: number;
  HBP: number;
  SF: number;
}

const batStints = new Map<string, BatAcc>(); // `${playerID}|${franchID}|${dec}`
for (const b of battingRows) {
  const dec = decadeOf(num(b.yearID));
  if (!dec) continue;
  const franchID = franchOf(b.yearID, b.teamID);
  if (!franchID) continue;
  const key = `${b.playerID}|${franchID}|${dec}`;
  const acc =
    batStints.get(key) ??
    { G: 0, thresholdG: 0, AB: 0, R: 0, H: 0, B2: 0, B3: 0, HR: 0, RBI: 0, BB: 0, HBP: 0, SF: 0 };
  const g = num(b.G);
  acc.G += g;
  acc.thresholdG += num(b.yearID) === 2020 ? g * SHORT_2020_WEIGHT : g;
  acc.AB += num(b.AB);
  acc.R += num(b.R);
  acc.H += num(b.H);
  acc.B2 += num(b['2B']);
  acc.B3 += num(b['3B']);
  acc.HR += num(b.HR);
  acc.RBI += num(b.RBI);
  acc.BB += num(b.BB);
  acc.HBP += num(b.HBP);
  acc.SF += num(b.SF);
  batStints.set(key, acc);
}

// ----------------------------------------------------------------------------
// Pitching stints (starters): group by player|franchise|decade
// ----------------------------------------------------------------------------

interface PitAcc {
  GS: number;
  thresholdGS: number;
  W: number;
  IPouts: number;
  SO: number;
  ER: number;
  BB: number;
  H: number;
}

const pitStints = new Map<string, PitAcc>();
for (const p of pitchingRows) {
  const dec = decadeOf(num(p.yearID));
  if (!dec) continue;
  const franchID = franchOf(p.yearID, p.teamID);
  if (!franchID) continue;
  const key = `${p.playerID}|${franchID}|${dec}`;
  const acc = pitStints.get(key) ?? { GS: 0, thresholdGS: 0, W: 0, IPouts: 0, SO: 0, ER: 0, BB: 0, H: 0 };
  const gs = num(p.GS);
  acc.GS += gs;
  acc.thresholdGS += num(p.yearID) === 2020 ? gs * SHORT_2020_WEIGHT : gs;
  acc.W += num(p.W);
  acc.IPouts += num(p.IPouts);
  acc.SO += num(p.SO);
  acc.ER += num(p.ER);
  acc.BB += num(p.BB);
  acc.H += num(p.H);
  pitStints.set(key, acc);
}

// ----------------------------------------------------------------------------
// Position eligibility from Appearances (20 percent of stint defensive games)
// ----------------------------------------------------------------------------

interface PosAcc {
  def: number;
  C: number;
  B1: number;
  B2: number;
  B3: number;
  SS: number;
  LF: number;
  CF: number;
  RF: number;
}

const posStints = new Map<string, PosAcc>();
for (const a of load('Appearances')) {
  const dec = decadeOf(num(a.yearID));
  if (!dec) continue;
  const franchID = franchOf(a.yearID, a.teamID);
  if (!franchID) continue;
  const key = `${a.playerID}|${franchID}|${dec}`;
  const acc =
    posStints.get(key) ?? { def: 0, C: 0, B1: 0, B2: 0, B3: 0, SS: 0, LF: 0, CF: 0, RF: 0 };
  acc.def += num(a.G_defense);
  acc.C += num(a.G_c);
  acc.B1 += num(a.G_1b);
  acc.B2 += num(a.G_2b);
  acc.B3 += num(a.G_3b);
  acc.SS += num(a.G_ss);
  acc.LF += num(a.G_lf);
  acc.CF += num(a.G_cf);
  acc.RF += num(a.G_rf);
  posStints.set(key, acc);
}

function eligiblePositions(key: string): string[] {
  const a = posStints.get(key);
  if (!a || a.def <= 0) return [];
  const slots: [string, number][] = [
    ['C', a.C],
    ['1B', a.B1],
    ['2B', a.B2],
    ['3B', a.B3],
    ['SS', a.SS],
    ['LF', a.LF],
    ['CF', a.CF],
    ['RF', a.RF],
  ];
  const cut = 0.2 * a.def;
  const elig = slots.filter(([, g]) => g >= cut).map(([p]) => p);
  if (elig.length) return elig;
  // Super-utility with no single position above the cut: keep their busiest one
  // so they remain rosterable somewhere rather than vanishing.
  const top = slots.reduce((best, cur) => (cur[1] > best[1] ? cur : best));
  return top[1] > 0 ? [top[0]] : [];
}

// ----------------------------------------------------------------------------
// Build candidate stints, compute scoring components
// ----------------------------------------------------------------------------

interface Candidate {
  id: string;
  name: string;
  franchID: string;
  dec: string;
  pos: string[];
  kind: 'bat' | 'sp';
  // raw components (pre-percentile)
  c1: number; // normOPS / normERA
  c2: number; // hr162 / normWHIP
  c3: number; // (R+RBI)/162 / SO per 32
  c4: number; // durability
  line: Record<string, string | number>;
}

const candidates: Candidate[] = [];

for (const [key, acc] of batStints) {
  if (acc.thresholdG < BATTER_MIN_G || acc.AB <= 0 || acc.G <= 0) continue;
  const pos = eligiblePositions(key);
  if (pos.length === 0) continue; // no fielding home (pure DH); no slot to fill
  const [playerID, franchID, dec] = key.split('|');
  const obp = (acc.H + acc.BB + acc.HBP) / Math.max(1, acc.AB + acc.BB + acc.HBP + acc.SF);
  const tb = acc.H + acc.B2 + 2 * acc.B3 + 3 * acc.HR;
  const slg = tb / acc.AB;
  const ops = obp + slg;
  const avg = acc.H / acc.AB;
  const per162 = 162 / acc.G;
  const hr162 = acc.HR * per162;
  const rbi162 = acc.RBI * per162;
  const rRbi162 = (acc.R + acc.RBI) * per162;
  const normOPS = ops / (leagueOPS.get(dec) ?? ops);
  candidates.push({
    id: playerID,
    name: nameOf.get(playerID) ?? playerID,
    franchID,
    dec,
    pos,
    kind: 'bat',
    c1: normOPS,
    c2: hr162,
    c3: rRbi162,
    c4: acc.G,
    line: { hr: Math.round(hr162), rbi: Math.round(rbi162), avg: rate3(avg), ops: rate3(ops) },
  });
}

for (const [key, acc] of pitStints) {
  if (acc.thresholdGS < SP_MIN_GS || acc.GS <= 0 || acc.IPouts <= 0) continue;
  const [playerID, franchID, dec] = key.split('|');
  const ip = acc.IPouts / 3;
  const era = (acc.ER * 9) / ip;
  const whip = (acc.BB + acc.H) / ip;
  const per32 = 32 / acc.GS;
  const w32 = acc.W * per32;
  const so32 = acc.SO * per32;
  const normERA = (leagueERA.get(dec) ?? era) / Math.max(0.01, era);
  const normWHIP = (leagueWHIP.get(dec) ?? whip) / Math.max(0.01, whip);
  candidates.push({
    id: playerID,
    name: nameOf.get(playerID) ?? playerID,
    franchID,
    dec,
    pos: ['SP'],
    kind: 'sp',
    c1: normERA,
    c2: normWHIP,
    c3: so32,
    c4: acc.GS,
    line: { w: Math.round(w32), era: era.toFixed(2), whip: whip.toFixed(2), so: Math.round(so32) },
  });
}

// ----------------------------------------------------------------------------
// Scoring: component percentiles within group, then final percentile across sport
// ----------------------------------------------------------------------------

const bats = candidates.filter((c) => c.kind === 'bat');
const sps = candidates.filter((c) => c.kind === 'sp');

function rawScores(group: Candidate[], w1: number, w2: number, w3: number, w4: number): number[] {
  const p1 = percentiles(group.map((c) => c.c1));
  const p2 = percentiles(group.map((c) => c.c2));
  const p3 = percentiles(group.map((c) => c.c3));
  const p4 = percentiles(group.map((c) => c.c4));
  return group.map((_, i) => w1 * p1[i] + w2 * p2[i] + w3 * p3[i] + w4 * p4[i]);
}

// MLB batters: OPS 55, HR/162 20, R+RBI/162 15, durability 10.
const batRaw = rawScores(bats, 0.55, 0.2, 0.15, 0.1);
// MLB SP: ERA 45, WHIP 25, SO/32 20, durability 10.
const spRaw = rawScores(sps, 0.45, 0.25, 0.2, 0.1);

const allRaw = [...batRaw, ...spRaw];
const allCand = [...bats, ...sps];
const finalPct = percentiles(allRaw);
const scoreById: number[] = finalPct.map((p) => Math.round(p * 1000) / 10);

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
  const poolKey = `${c.dec}|${c.franchID}`;
  (pools[poolKey] ??= []).push({
    id: c.id,
    name: c.name,
    pos: c.pos,
    score: scoreById[i],
    line: c.line,
  });
  usedFranch.add(c.franchID);
}
for (const arr of Object.values(pools)) arr.sort((a, b) => b.score - a.score);

const franchises = [...usedFranch].sort().map((franchID) => {
  const active = [...(franchActive.get(franchID) ?? [])].sort();
  const names: Record<string, string> = {};
  for (const dec of active) {
    const nm = nameForDecade(franchID, dec);
    if (nm) names[dec] = nm;
  }
  return { id: franchID, names, activeDecades: active };
});

const output = { sport: 'mlb', decades: DECADES, franchises, pools };
writeFileSync(OUT, JSON.stringify(output));

// ----------------------------------------------------------------------------
// Report: summary plus the ten hand-check pools
// ----------------------------------------------------------------------------

const sizeKB = (JSON.stringify(output).length / 1024).toFixed(0);
const poolKeys = Object.keys(pools);
const totalPlayers = allCand.length;
console.log('--- build-mlb-data summary ---');
console.log(`candidates: ${totalPlayers} (batters ${bats.length}, SP ${sps.length})`);
console.log(`pools: ${poolKeys.length}   franchises: ${franchises.length}`);
console.log(`output: data/mlb-data.json  (~${sizeKB} KB)`);

const HAND_CHECK: [string, string][] = [
  ['1970s|CIN', '70s Reds'],
  ['1950s|NYY', '50s Yankees'],
  ['1990s|SEA', '90s Mariners'],
  ['1960s|SFG', '60s Giants'],
  ['2000s|STL', '00s Cardinals'],
  ['1980s|NYM', '80s Mets'],
  ['2010s|CHC', '10s Cubs'],
  ['1970s|OAK', '70s Athletics'],
  ['1990s|ATL', '90s Braves'],
  ['2020s|LAD', '20s Dodgers'],
];

function fmtLine(p: PlayerOut): string {
  const l = p.line;
  if ('era' in l) return `W ${l.w}  ERA ${l.era}  WHIP ${l.whip}  SO ${l.so}`;
  return `HR ${l.hr}  RBI ${l.rbi}  AVG ${l.avg}  OPS ${l.ops}`;
}

for (const [key, label] of HAND_CHECK) {
  const pool = pools[key] ?? [];
  console.log(`\n=== ${label}  (${key})  ${pool.length} players ===`);
  for (const p of pool.slice(0, 15)) {
    const pos = p.pos.join('/').padEnd(8);
    const score = p.score.toFixed(1).padStart(5);
    console.log(`  ${score}  ${pos} ${p.name.padEnd(22)} ${fmtLine(p)}`);
  }
}
