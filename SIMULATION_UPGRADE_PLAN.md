# Lindy's Five — Simulation Upgrade Plan
## Replacing Deterministic Formulas with Monte Carlo Season Simulation

---

## Overview

This document is a step-by-step implementation plan for upgrading Lindy's Five (lindysfive.com) from its current deterministic logistic-curve probability model to a **Monte Carlo simulation engine** that runs thousands of season simulations to produce more accurate playoff, series, and Stanley Cup odds.

The core strategy:
- Pull **MoneyPuck team-level xG data** (free, with attribution) as the team strength metric
- Run **5,000 season simulations** server-side on a cron schedule
- Store pre-computed results in **Vercel KV** and serve them to the client
- Keep the existing deterministic model as a fallback

The existing codebase (Next.js, TypeScript, NHL API) is preserved. This is additive, not a rewrite.

---

## Data Sources

### 1. NHL Public API (already in use)
- Standings: `https://api-web.nhle.com/v1/standings/{date}`
- Schedule: `https://api-web.nhle.com/v1/club-schedule-season/{team}/{season}`
- Full league schedule by date: `https://api-web.nhle.com/v1/schedule/{date}`

### 2. MoneyPuck Team Stats (new)
- URL: `https://moneypuck.com/moneypuck/playerData/seasonSummary/{season}/regular/teams.csv`
- Example season string: `20252026`
- Key fields to pull per team:
  - `xGoalsPercentage` — share of expected goals (primary strength metric)
  - `xGoalsFor` — expected goals for
  - `xGoalsAgainst` — expected goals against
  - `corsiPercentage` — possession proxy (secondary/fallback)
- Updated nightly by MoneyPuck
- **Free to use with attribution** — add a "Data: MoneyPuck.com" credit on the odds page

---

## Architecture

### Current Architecture
```
NHL API → standingsCalc.ts → playoffProbability.ts → client renders probabilities
```

### New Architecture
```
NHL API ─────────────────────────────────┐
                                         ▼
MoneyPuck CSV ──→ moneyPuckApi.ts ──→ simulationEngine.ts
                                         │
                                    runs 5,000x
                                         │
                                         ▼
                               app/api/cron/simulate/route.ts
                                         │
                               stores results in Vercel KV
                                         │
                                         ▼
                               client reads pre-computed results
                               (playoff odds page + team tracker pages)
```

---

## Existing Code to Reuse

These files already exist and should be leveraged, NOT rewritten:

| File | What to Reuse |
|------|---------------|
| `lib/services/nhlApi.ts` | `fetchSabresSchedule(season, abbrev, teamId)` works for ANY team. Rate limiter, retry logic, caching. Also `fetchScoresByDate(date)` for league-wide games. |
| `lib/utils/standingsCalc.ts` | `getDivCutLine()`, `getWcCutLine()`, `getProjectedPoints()` for reference. **Note:** the playoff qualification check (`divisionSequence <= 3 || wildcardSequence <= 2`) reads pre-computed NHL API rankings — the sim needs its own ranking logic (see Step 4). |
| `lib/utils/playoffProbability.ts` | `computeSeriesWinProbability()` — the series DP is solid and should be kept. `computePositionAwareProbability()` — keep the function signature, replace internals to read sim results when available. |
| `lib/kv.ts` | Vercel KV patterns: `kv.set()`, `kv.get<T>()`, `kv.zrange()`. Already used extensively for blog, newsletter, analytics. |
| `lib/teamConfig.ts` | All 32 NHL teams with `abbreviation`, `nhlId`, `id` (slug), `colors`. Use for MoneyPuck abbreviation mapping. |
| `app/api/cron/*` | Auth pattern: `Bearer ${process.env.CRON_SECRET}` header check. Manual trigger via `POST /api/cron/trigger`. |

---

## Implementation Steps

---

### Step 1: MoneyPuck Data Fetcher

**File to create:** `lib/services/moneyPuckApi.ts`

Responsibilities:
- Fetch the MoneyPuck teams CSV for the current season
- Parse it into a typed object keyed by NHL team abbreviation
- Cache the result (revalidate every 24 hours — MoneyPuck updates nightly)
- Map MoneyPuck abbreviations to NHL API abbreviations

```typescript
export interface TeamStrength {
  teamAbbrev: string;        // NHL API abbreviation (e.g. "TBL")
  xGoalsPercentage: number;  // e.g. 0.523 = 52.3%
  xGoalsFor: number;         // per-game xGF rate
  xGoalsAgainst: number;     // per-game xGA rate
}

export async function fetchTeamStrengths(): Promise<Map<string, TeamStrength>>;
```

**MoneyPuck → NHL API abbreviation mapping** (teams that differ):
```typescript
const MONEYPUCK_TO_NHL: Record<string, string> = {
  'L.A': 'LAK',
  'N.J': 'NJD',
  'S.J': 'SJS',
  'T.B': 'TBL',
  // Verify full list against MoneyPuck CSV headers
};
```

If MoneyPuck fetch fails, fall back to NHL point percentage as strength metric.

---

### Step 2: Remaining Schedule Builder

**File to modify:** `lib/services/nhlApi.ts` (add new function, don't create separate file)

Add a function that fetches remaining games for all 32 teams:

```typescript
export interface RemainingGame {
  gameId: number;
  date: string;
  homeTeamAbbrev: string;
  awayTeamAbbrev: string;
}

export async function fetchRemainingSchedule(season: string): Promise<RemainingGame[]>;
```

**Implementation approach:**
- Use existing `fetchScoresByDate(date)` to iterate from today through end of season
- OR use existing `fetchSabresSchedule(season, abbrev, teamId)` for each team and deduplicate by gameId
- Filter to `gameState: "FUT"` or `"PRE"` — exclude completed games
- Deduplicate (each game appears in both teams' schedules)

**Important:** Use the existing `fetchWithRetry` and rate limiter in `nhlApi.ts` to respect NHL API limits.

---

### Step 3: Single Game Simulator

**File to create:** `lib/utils/simulateGame.ts`

Given two teams and home/away designation:

1. Look up each team's `xGoalsFor` and `xGoalsAgainst` rates from MoneyPuck
2. Calculate expected goals:
   ```
   homeXGF = (homeTeam.xGoalsFor + awayTeam.xGoalsAgainst) / 2 * HOME_ICE_MULTIPLIER
   awayXGF = (awayTeam.xGoalsFor + homeTeam.xGoalsAgainst) / 2
   ```
3. Sample actual goals from a **Poisson distribution**
4. Handle ties → OT → shootout (coin flip for SO)
5. Return winner and point allocation (2 pts win, 1 pt OT loss, 0 pts regulation loss)

**Home ice multiplier:** `1.05` (historically ~5% boost in NHL xG).

**Poisson sampling:**
```typescript
function poissonSample(lambda: number): number {
  const L = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  do {
    k++;
    p *= Math.random();
  } while (p > L);
  return k - 1;
}
```

---

### Step 4: Full Season Simulator with Playoff Ranking

**File to create:** `lib/utils/simulateSeason.ts`

This runs one complete simulation of the remaining regular season AND playoffs:

**Regular Season Phase:**
1. Start with current real standings (points, GP, W, L, OTL from NHL API `StandingsTeam[]`)
2. Loop through every remaining game in schedule order
3. For each game, call `simulateGame()` to get a result
4. Update both teams' simulated standings

**Playoff Qualification Phase (NEW — must be written from scratch):**

The existing `standingsCalc.ts` reads pre-computed rankings from the NHL API. The simulation needs to **rank teams itself** from raw points. This logic does NOT exist yet:

```typescript
function rankTeamsForPlayoffs(standings: SimulatedStandings[]): PlayoffField {
  // 1. Group teams by division (4 divisions × 8 teams)
  // 2. Within each division, sort by points (tiebreaker: wins, then ROW)
  // 3. Top 3 from each division qualify (12 teams)
  // 4. Remaining teams in each conference, sort by points
  // 5. Top 2 remaining per conference are wildcards (4 teams)
  // 6. Return 16-team playoff field with seeding
}
```

**Division/Conference mapping** is available in `teamConfig.ts` via team properties, but you'll need a hardcoded division structure:
```typescript
const DIVISIONS = {
  'Atlantic': ['BOS', 'BUF', 'DET', 'FLA', 'MTL', 'OTT', 'TBL', 'TOR'],
  'Metropolitan': ['CAR', 'CBJ', 'NJD', 'NYI', 'NYR', 'PHI', 'PIT', 'WSH'],
  'Central': ['CHI', 'COL', 'DAL', 'MIN', 'NSH', 'STL', 'UTA', 'WPG'],
  'Pacific': ['ANA', 'CGY', 'EDM', 'LAK', 'SJS', 'SEA', 'VAN', 'VGK'],
};
const CONFERENCES = {
  'Eastern': ['Atlantic', 'Metropolitan'],
  'Western': ['Central', 'Pacific'],
};
```

**Playoff Simulation Phase (include in v1, not Phase 2):**
Since we already have the 16-team field and the Poisson game engine, simulate 4 rounds of playoffs:
- Use the same `simulateGame()` function
- Best-of-7 series (2-2-1-1-1 home ice format)
- Track which team wins the Cup
- This gives us Cup odds essentially for free

**Return type:**
```typescript
interface SeasonSimResult {
  playoffTeams: string[];          // 16 team abbreviations
  divisionWinners: string[];       // 4 team abbreviations
  cupWinner: string;               // 1 team abbreviation
  finalStandings: Map<string, { points: number; wins: number; losses: number; otLosses: number }>;
}
```

---

### Step 5: Monte Carlo Runner

**File to create:** `lib/utils/monteCarloRunner.ts`

Runs `simulateSeason()` N times (default: **5,000**) and aggregates results:

```typescript
export interface SimulationResults {
  generatedAt: string;
  simulationCount: number;
  teams: {
    [teamAbbrev: string]: {
      playoffProbability: number;        // 0-100
      divisionTitleProbability: number;  // 0-100
      conferenceTitleProbability: number;// 0-100
      cupProbability: number;            // 0-100
      projectedPoints: number;           // average across simulations
      playoffPathBreakdown: {
        viaDivision: number;             // % via division top 3
        viaWildcard: number;             // % via wildcard
      };
    };
  };
}
```

**Performance considerations:**
- 5,000 sims × ~300 remaining games = ~1.5M game sims + ~80K playoff games
- Target: under 30 seconds
- **Vercel serverless function timeout:** Set to 60s in `vercel.json`:
  ```json
  { "functions": { "app/api/cron/simulate/route.ts": { "maxDuration": 60 } } }
  ```
- Start with 1,000 sims during development, scale to 5,000 in production
- If still too slow, split into batches stored in KV and aggregated

---

### Step 6: Cron Job & Vercel KV Storage

**File to create:** `app/api/cron/simulate/route.ts`

Follow existing cron pattern:
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';

export async function GET(request: NextRequest): Promise<NextResponse> {
  // 1. Auth check (same as all other crons)
  const expectedAuth = `Bearer ${process.env.CRON_SECRET}`;
  if (request.headers.get('authorization') !== expectedAuth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 2. Fetch inputs (standings, schedule, MoneyPuck)
  // 3. Run Monte Carlo
  // 4. Store in KV
  await kv.set('sim:results', results);
  await kv.set('sim:generated-at', new Date().toISOString());

  // 5. Return summary
  return NextResponse.json({ success: true, teams: 32, simulations: results.simulationCount });
}
```

**Add to `vercel.json` crons:**
```json
{
  "path": "/api/cron/simulate",
  "schedule": "0 */4 * * *"
}
```

Runs every 4 hours (6x/day). Also manually triggerable from admin dashboard via existing `/api/cron/trigger` endpoint.

**KV key structure:**
| Key | Type | Expiry | Purpose |
|-----|------|--------|---------|
| `sim:results` | String (JSON) | None | Full SimulationResults object |
| `sim:generated-at` | String | None | ISO timestamp of last run |

---

### Step 7: Update Playoff Odds Page

**File to update:** `app/nhl-playoff-odds/page.tsx`

Changes:
- On page load, fetch `sim:results` from KV
- If simulation results are available and fresh (< 6 hours old), use sim probabilities
- If stale or unavailable, fall back to existing deterministic model (no user-facing change)
- Display a badge: "Based on 5,000 simulations · Data: MoneyPuck.com"
- Show `generatedAt` timestamp so users know freshness
- Add Cup odds column to the standings table

---

### Step 8: Update Team Tracker Pages

**File to update:** `app/nhl/[team]/page.tsx` (or the component that calls `computePositionAwareProbability`)

**Important:** The team tracker pages (`/nhl/sabres`, `/nhl/rangers`, etc.) also display playoff probability. These must consume sim results too, or odds will differ between pages.

Changes:
- Fetch `sim:results` from KV (or pass through props)
- If sim data available, use `teams[teamAbbrev].playoffProbability` instead of `computePositionAwareProbability()`
- Fall back to deterministic model if sim data unavailable
- Optionally show Cup odds on team page

---

### Step 9: Update `computePositionAwareProbability` Wrapper

**File to update:** `lib/utils/playoffProbability.ts`

Rather than changing every call site, add a wrapper:

```typescript
export async function getPlayoffProbabilityWithSim(
  teamAbbrev: string,
  fallbackArgs: { projectedPoints: number; gamesPlayed: number; divCutLine: number; wcCutLine: number; isInPlayoffPosition: boolean }
): Promise<{ probability: number; source: 'simulation' | 'deterministic' }> {
  // Try to read sim results from KV
  // If fresh, return sim probability
  // If stale/missing, call computePositionAwareProbability with fallbackArgs
}
```

This keeps the existing function signatures intact and lets each page opt in to sim data gradually.

---

## File Structure Summary

```
lib/
  services/
    moneyPuckApi.ts          ← NEW: fetch + parse MoneyPuck CSV
    nhlApi.ts                ← MODIFY: add fetchRemainingSchedule()
    simulationCache.ts       ← NOT NEEDED: use kv.get/set directly
  utils/
    simulateGame.ts          ← NEW: single game Poisson simulator
    simulateSeason.ts        ← NEW: full season + playoff simulation with ranking logic
    monteCarloRunner.ts      ← NEW: run N simulations, aggregate results
    playoffProbability.ts    ← MODIFY: add sim-aware wrapper function
    standingsCalc.ts         ← KEEP AS-IS (reference only)

app/
  api/
    cron/simulate/route.ts   ← NEW: scheduled simulation trigger
  nhl-playoff-odds/page.tsx  ← MODIFY: consume sim results with fallback
  nhl/[team]/page.tsx        ← MODIFY: consume sim results with fallback

vercel.json                  ← MODIFY: add cron entry + function timeout
```

---

## Known Limitations (v1)

1. **No player-level modeling** — team xG is season-average; doesn't account for injuries, lineup changes, or trade deadline moves.
2. **MoneyPuck xG is 5v5 only** — special teams performance not factored in. Future improvement: incorporate PP% and PK% from NHL API.
3. **Poisson independence assumption** — treats each game as independent. Fatigue, back-to-backs, etc. not modeled.
4. **Schedule fetched once per cron run** — rare mid-season schedule changes won't reflect until next run.
5. **Playoff series use same Poisson model** — no series-specific adjustments (momentum, goalie fatigue, etc.).

---

## Attribution Requirement

MoneyPuck data is free to use with credit. Add the following somewhere visible on any page using simulation results:

> Simulation data powered by [MoneyPuck.com](https://moneypuck.com)

---

## Build Order

1. `moneyPuckApi.ts` + test that you can fetch and parse the CSV, verify all 32 teams map correctly
2. `fetchRemainingSchedule()` in `nhlApi.ts` + verify remaining game count looks right
3. `simulateGame.ts` + test: 10,000 games between equal teams → ~50/50
4. `simulateSeason.ts` with playoff ranking logic + sanity check: 16 teams qualify, standings consistent
5. `monteCarloRunner.ts` + benchmark performance (target < 30s for 5,000 sims)
6. `app/api/cron/simulate/route.ts` + KV storage + add to `vercel.json`
7. Wire up `/nhl-playoff-odds` page with fallback to existing model
8. Wire up `/nhl/[team]` pages with fallback
9. Add MoneyPuck attribution

---

## Testing Checkpoints

- **MoneyPuck fetch:** All 32 teams present, xGoalsPercentage values between 0.40–0.60, abbreviation mapping covers all teams
- **Schedule fetch:** No completed games included, total game count matches expected remaining games, no duplicates
- **Single game sim:** Run 10,000 games between two equal teams → result should be ~50/50 with ~25% OT rate
- **Playoff ranking:** Run 1 simulation → exactly 16 teams qualify (3 per division + 2 WC per conference), no division has <3 or >3 qualifiers
- **Season sim:** Final standings are internally consistent (total points across league = 2 * total games played)
- **Monte Carlo:** After 5,000 runs, probabilities are stable (run twice, compare — values within ~1-2%)
- **Cup odds:** Sum of all 32 teams' Cup probabilities ≈ 100%
- **Page integration:** Fallback to deterministic model works when KV has no sim data
- **Performance:** Cron completes within 60s on Vercel
