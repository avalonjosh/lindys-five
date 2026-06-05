/**
 * fetch-nhl-api.ts (Perfect Season / 82-0, Phase 7)
 *
 * Pulls per-(player, team, season) regular-season summaries from the NHL stats
 * REST API for ALL decades the game uses: seasons 1950-51 through 2025-26. The
 * NHL API is the single source for the NHL data (the Kaggle databank / MoneyPuck
 * two-source plan was dropped; the API covers everything back to 1917 with one
 * consistent schema, no login, no boundary stitch). Caches the raw rows to
 * raw-data/nhl/nhlapi/{seasonId}/{skaters,goalies}.json so the build step
 * (build-nhl-data.ts) stays offline and reproducible.
 *
 * Why loop per team: with isAggregate=false the summary report returns ONE
 * combined row for a traded player (teamAbbrevs "PIT,CAR", merged totals).
 * Filtering by teamId returns the split stats for that stint, so we query each
 * team per season and tag every row with the team we asked for (the row's own
 * teamAbbrevs stays the cosmetic full-season label and must not be trusted for
 * attribution).
 *
 * Caveats by era (handled downstream in build-nhl-data.ts):
 * - plusMinus is null before 1967-68 (not tracked then).
 * - goalie savePct is null in the very early 1950s (shots-against not recorded);
 *   GAA is the fallback for those seasons.
 *
 * Run with: npx tsx scripts/fetch-nhl-api.ts
 * Idempotent: overwrites the cache each run. Polite, sleeps between requests.
 *
 * Source: NHL stats REST API (api.nhle.com/stats/rest). Credit the NHL as the
 * data source in the game footer.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const OUT_ROOT = join(process.cwd(), 'raw-data', 'nhl', 'nhlapi');
const BASE = 'https://api.nhle.com/stats/rest/en';

// 1950-51 through 2025-26 (76 seasons). Matches the game's decade range
// (1950s-2020s), same as the MLB data.
const FIRST_START = 1950;
const LAST_START = 2025;

// Every team ID active at any point from 1950-51 on, with triCode for tagging.
// Pre-1950-only franchises (Brooklyn/NY Americans, Montreal Maroons/Wanderers,
// old Ottawa Senators, the 1920s Toronto/Detroit/Pittsburgh names, etc.) and
// the junk "NHL"/"TBD" rows are omitted so we don't make guaranteed-empty calls.
// Original Six teams that played every season carry no comment. Franchise
// lineage (Seals->Barons, Scouts->Rockies->NJD, ATL->CGY, QUE->COL, HFD->CAR,
// WIN->PHX->ARI->UTA, etc.) is resolved later in build-nhl-data.ts; here we just
// record the triCode that played that season.
const TEAMS: Array<{ id: number; tri: string }> = [
  // Original Six (continuous since before 1950):
  { id: 6, tri: 'BOS' }, { id: 16, tri: 'CHI' }, { id: 17, tri: 'DET' },
  { id: 8, tri: 'MTL' }, { id: 3, tri: 'NYR' }, { id: 10, tri: 'TOR' },
  // 1967 expansion onward (modern + still active):
  { id: 7, tri: 'BUF' }, { id: 20, tri: 'CGY' }, { id: 21, tri: 'COL' },
  { id: 25, tri: 'DAL' }, { id: 22, tri: 'EDM' }, { id: 26, tri: 'LAK' },
  { id: 30, tri: 'MIN' }, { id: 1, tri: 'NJD' }, { id: 2, tri: 'NYI' },
  { id: 4, tri: 'PHI' }, { id: 5, tri: 'PIT' }, { id: 19, tri: 'STL' },
  { id: 23, tri: 'VAN' }, { id: 15, tri: 'WSH' }, { id: 24, tri: 'ANA' },
  { id: 13, tri: 'FLA' }, { id: 18, tri: 'NSH' }, { id: 9, tri: 'OTT' },
  { id: 28, tri: 'SJS' }, { id: 14, tri: 'TBL' }, { id: 29, tri: 'CBJ' },
  { id: 12, tri: 'CAR' }, // was Hartford Whalers
  // Relocations / expansions / rebrands:
  { id: 11, tri: 'ATL' }, // Thrashers 1999-2010 (-> WPG)
  { id: 52, tri: 'WPG' }, // Jets 2.0, 2011-12+
  { id: 27, tri: 'PHX' }, // Phoenix Coyotes 1996-2013 (was WIN -> ARI)
  { id: 53, tri: 'ARI' }, // Arizona Coyotes 2014-2023 (-> UTA)
  { id: 54, tri: 'VGK' }, // Vegas, 2017-18+
  { id: 55, tri: 'SEA' }, // Seattle, 2021-22+
  { id: 59, tri: 'UTA' }, // Utah Hockey Club, 2024-25
  { id: 68, tri: 'UTA' }, // Utah Mammoth, 2025-26 (rebrand)
  // Defunct/relocated historical teams (1950+):
  { id: 47, tri: 'AFM' }, // Atlanta Flames 1972-1980 (-> CGY)
  { id: 56, tri: 'CGS' }, // California Golden Seals 1970-1976
  { id: 46, tri: 'OAK' }, // Oakland Seals 1967-1970 (-> CGS)
  { id: 49, tri: 'CLE' }, // Cleveland Barons 1976-1978
  { id: 35, tri: 'CLR' }, // Colorado Rockies 1976-1982 (-> NJD)
  { id: 48, tri: 'KCS' }, // Kansas City Scouts 1974-1976 (-> CLR)
  { id: 34, tri: 'HFD' }, // Hartford Whalers 1979-1997 (-> CAR)
  { id: 31, tri: 'MNS' }, // Minnesota North Stars 1967-1993 (-> DAL)
  { id: 32, tri: 'QUE' }, // Quebec Nordiques 1979-1995 (-> COL)
  { id: 33, tri: 'WIN' }, // Winnipeg Jets 1.0 1979-1996 (-> PHX)
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
