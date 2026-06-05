/**
 * fetch-nhl-api.ts (Perfect Season / 82-0, Phase 7)
 *
 * Pulls per-(player, team, season) regular-season summaries from the NHL stats
 * REST API for the 2010s and 2020s decades (seasons 2010-11 through 2025-26),
 * the half of the NHL data the Hockey Databank does not cover. Caches the raw
 * rows to raw-data/nhl/nhlapi/{seasonId}/{skaters,goalies}.json so the build
 * step (build-nhl-data.ts) stays offline and reproducible.
 *
 * Why loop per team: with isAggregate=false the summary report returns ONE
 * combined row for a traded player (teamAbbrevs "PIT,CAR", merged totals).
 * Filtering by teamId returns the split stats for that stint, so we query each
 * team per season and tag every row with the team we asked for (the row's own
 * teamAbbrevs stays the cosmetic full-season label and must not be trusted for
 * attribution).
 *
 * Run with: npx tsx scripts/fetch-nhl-api.ts
 * Idempotent: overwrites the cache each run. Polite ~3 req/s.
 *
 * Source: NHL stats REST API (api.nhle.com/stats/rest). Credit the NHL as the
 * data source in the game footer.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const OUT_ROOT = join(process.cwd(), 'raw-data', 'nhl', 'nhlapi');
const BASE = 'https://api.nhle.com/stats/rest/en';

// 2010-11 through 2025-26. The 2010 decade boundary is where the databank hands
// off to the API (databank owns <= 2009 start years).
const FIRST_START = 2010;
const LAST_START = 2025;

// Modern team IDs active at any point 2010-11..2025-26, with triCode for
// tagging. Defunct/pre-2010 teams are omitted to avoid wasted empty calls.
// Franchise lineage (ATL->WPG, PHX/ARI->UTA, etc.) is resolved later in
// build-nhl-data.ts; here we just record the triCode that played that season.
const TEAMS: Array<{ id: number; tri: string }> = [
  { id: 24, tri: 'ANA' }, { id: 6, tri: 'BOS' }, { id: 7, tri: 'BUF' },
  { id: 12, tri: 'CAR' }, { id: 29, tri: 'CBJ' }, { id: 20, tri: 'CGY' },
  { id: 16, tri: 'CHI' }, { id: 21, tri: 'COL' }, { id: 25, tri: 'DAL' },
  { id: 17, tri: 'DET' }, { id: 22, tri: 'EDM' }, { id: 13, tri: 'FLA' },
  { id: 26, tri: 'LAK' }, { id: 30, tri: 'MIN' }, { id: 8, tri: 'MTL' },
  { id: 18, tri: 'NSH' }, { id: 1, tri: 'NJD' }, { id: 2, tri: 'NYI' },
  { id: 3, tri: 'NYR' }, { id: 9, tri: 'OTT' }, { id: 4, tri: 'PHI' },
  { id: 5, tri: 'PIT' }, { id: 28, tri: 'SJS' }, { id: 19, tri: 'STL' },
  { id: 14, tri: 'TBL' }, { id: 10, tri: 'TOR' }, { id: 23, tri: 'VAN' },
  { id: 15, tri: 'WSH' },
  // Relocations / expansions inside the window:
  { id: 11, tri: 'ATL' }, // Thrashers, 2010-11 only (-> WPG)
  { id: 52, tri: 'WPG' }, // Jets 2.0, 2011-12+
  { id: 27, tri: 'PHX' }, // Phoenix Coyotes, through 2013-14
  { id: 53, tri: 'ARI' }, // Arizona Coyotes, 2014-15..2023-24
  { id: 54, tri: 'VGK' }, // Vegas, 2017-18+
  { id: 55, tri: 'SEA' }, // Seattle, 2021-22+
  { id: 59, tri: 'UTA' }, // Utah Hockey Club, 2024-25
  { id: 68, tri: 'UTA' }, // Utah Mammoth, 2025-26 (rebrand)
];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchRows(report: 'skater' | 'goalie', seasonId: number, teamId: number): Promise<any[]> {
  const exp = `seasonId=${seasonId} and gameTypeId=2 and teamId=${teamId}`;
  const url = `${BASE}/${report}/summary?isAggregate=false&isGame=false&start=0&limit=200&cayenneExp=${encodeURIComponent(exp)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${report} ${seasonId} team ${teamId}: HTTP ${res.status}`);
  const json = (await res.json()) as { data?: any[] };
  return json.data ?? [];
}

async function run() {
  mkdirSync(OUT_ROOT, { recursive: true });
  let totalSkaters = 0;
  let totalGoalies = 0;
  const failures: string[] = [];

  for (let start = FIRST_START; start <= LAST_START; start++) {
    const seasonId = start * 10000 + (start + 1);
    const skaters: any[] = [];
    const goalies: any[] = [];

    for (const team of TEAMS) {
      try {
        const s = await fetchRows('skater', seasonId, team.id);
        for (const r of s) skaters.push({ ...r, queriedTri: team.tri, queriedTeamId: team.id });
        await sleep(150);
        const g = await fetchRows('goalie', seasonId, team.id);
        for (const r of g) goalies.push({ ...r, queriedTri: team.tri, queriedTeamId: team.id });
        await sleep(150);
      } catch (err) {
        failures.push((err as Error).message);
      }
    }

    const dir = join(OUT_ROOT, String(seasonId));
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'skaters.json'), JSON.stringify(skaters));
    writeFileSync(join(dir, 'goalies.json'), JSON.stringify(goalies));
    totalSkaters += skaters.length;
    totalGoalies += goalies.length;
    console.log(`  ${seasonId}: ${skaters.length} skater rows, ${goalies.length} goalie rows`);
  }

  console.log(`Done: ${totalSkaters} skater rows, ${totalGoalies} goalie rows across ${LAST_START - FIRST_START + 1} seasons -> ${OUT_ROOT}`);
  if (failures.length) {
    console.error(`FAILURES (${failures.length}):`);
    for (const f of failures.slice(0, 20)) console.error(`  ${f}`);
    process.exitCode = 1;
  }
}

run();
