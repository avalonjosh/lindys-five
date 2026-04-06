# Lindy's Five — Probability System Explainer

## Overview

Lindy's Five (lindysfive.com) is an NHL playoff odds tracker built with Next.js. It computes three types of probabilities:

1. **Playoff Probability** — will a team make the playoffs? (0-100%)
2. **Series Win Probability** — will a team win a best-of-7 playoff series? (0-100%)
3. **Stanley Cup Odds** — will a team win the Cup? (0-100%)

All probabilities are computed client-side or at build/request time using **deterministic formulas** (no simulation). Data comes from the NHL's public API.

---

## Data Source

All standings data is fetched from `https://api-web.nhle.com/v1/standings/{date}`.

Key fields used per team:
- `points`, `gamesPlayed` — for pace/projection
- `divisionName`, `divisionSequence` — division rank (1-3 = division playoff spots)
- `conferenceName`, `wildcardSequence` — wildcard rank (1-2 = wildcard playoff spots)
- `pointPctg` — used for series/Cup calculations
- `clinchIndicator` — "e" for eliminated, etc.

---

## 1. Playoff Probability

### How Projected Points Work

A team's projected final point total is a simple linear extrapolation of current pace:

```
projectedPoints = round((points / gamesPlayed) * 82)
```

Example: 52 points in 40 games → (52/40) × 82 ≈ 107 projected points.

### How Cut Lines Are Determined

Two cut lines are calculated dynamically from current standings:

**Division Cut Line:**
- Takes the 3rd and 4th place teams in the team's division
- Averages their projected final points
- Floor of 90 points (historical minimum)

**Wildcard Cut Line:**
- Identifies all teams ranked 4th+ in their division within the conference (the wildcard pool)
- Takes the 2nd and 3rd wildcard teams (the bubble)
- Averages their projected final points
- Floor of 94 points (historical minimum)

### The Probability Model (Logistic S-Curve)

The core formula is a **logistic function** that converts "distance from cut line" into a probability:

```
P = 100 / (1 + e^(-k * (projectedPoints - cutLine)))
```

- At the cut line (diff = 0): probability = 50%
- Above the cut line: curves toward 100%
- Below the cut line: curves toward 0%

**Steepness (k)** varies by two factors:

1. **Path type** — Division path uses a steeper curve (fewer competitors, less volatility) vs. wildcard path (flatter curve, more competitors)
   - Division: k ranges from 0.18 to 0.40
   - Wildcard: k ranges from 0.14 to 0.32

2. **Season progress** — k increases as games are played (more confidence = more extreme probabilities)
   - `confidenceFactor = min(gamesPlayed / 82, 1)`
   - k = baseK + (confidenceFactor × scaleK)

### Dual-Path Analysis

A team can make the playoffs via **division** (top 3) OR **wildcard** (top 2 in conference among non-top-3 teams). The model:

1. Calculates probability for the division path (vs. division cut line)
2. Calculates probability for the wildcard path (vs. wildcard cut line)
3. Takes the **maximum** of the two — the team only needs one path

### Position Bonus

Teams currently holding a playoff spot get a small bonus (up to 1.5 points subtracted from the cut line), scaling with season progress. Rationale: teams in a playoff position have a structural advantage (tiebreakers, schedule, etc.).

```
positionBonus = 1.5 * (gamesPlayed / 82)  // max 1.5 points, only if gamesPlayed >= 25
```

### Output

Always clamped to 1-99% unless a team is mathematically clinched (100%) or eliminated (0%).

### Worked Example

```
Team: 52 points in 40 games, 2nd in division (in playoff position)
Projected Points: 107

Division Cut Line: 96 (from 3rd/4th place pace)
Wildcard Cut Line: 98 (from WC2/WC3 pace)

Position Bonus: 1.5 × (40/82) ≈ 0.73

Adjusted Division Cut Line: 96 - 0.73 ≈ 95.3
Adjusted Wildcard Cut Line: 98 - 0.73 ≈ 97.3

Division Path:
  k = 0.18 + (0.488 × 0.22) ≈ 0.287
  diff = 107 - 95.3 = 11.7
  P = 100 / (1 + e^(-0.287 × 11.7)) ≈ 97%

Wildcard Path:
  k = 0.14 + (0.488 × 0.18) ≈ 0.228
  diff = 107 - 97.3 = 9.7
  P = 100 / (1 + e^(-0.228 × 9.7)) ≈ 90%

Final Probability: max(97%, 90%) = 97% via division path
```

---

## 2. Series Win Probability

Used during the playoffs for active and projected matchups.

### Single-Game Win Probability

Uses a logistic function on the difference in regular-season point percentages:

```
baseP = 1 / (1 + e^(-6 * (teamPtPctg - oppPtPctg)))
```

The constant `6` is tuned so a .600 team vs. a .500 team has roughly a 58% chance per game.

**Home-ice adjustment:** ±4% (reflects historical NHL home advantage)
- Home games: `baseP + 0.04`
- Away games: `baseP - 0.04`
- Capped between 5% and 95%

### Series Probability via Dynamic Programming

The model enumerates all possible remaining game outcomes in a best-of-7 using dynamic programming:

- **Format:** 2-2-1-1-1 (higher seed hosts games 1, 2, 5, 7)
- For each remaining game, the probability of winning depends on whether the team is home or away
- Recursively calculates: P(reaching 4 wins before opponent does)

This correctly accounts for the current series state (e.g., down 2-1 vs. tied 1-1) and the specific home/away schedule of remaining games.

### Output

Always 1-99% unless the series is already decided (0% or 100%).

### Worked Example

```
Toronto (.615 ptPctg) vs Tampa (.585 ptPctg), series 0-0, Toronto has home ice

baseP = 1 / (1 + e^(-6 × 0.030)) ≈ 0.544

Toronto at home (games 1, 2, 5, 7): 58.4% win probability
Toronto away (games 3, 4, 6): 50.4% win probability

DP result: Toronto ≈ 57% to win the series
```

---

## 3. Stanley Cup Odds

### During Regular Season

For each of the 16 projected playoff teams, the model chains 4 rounds of series-win probability:

```
cupProb = P(win R1) × P(win R2) × P(win CF) × P(win Final)
```

Each round assumes the opponent has a 0.500 point percentage (league average) and the team has home ice. This is a rough estimate since actual opponents aren't known yet.

### During Playoffs

Uses actual bracket data:
- For the current round: uses real series state (wins/losses) and actual opponent
- For future rounds: assumes 0.500 opponent with home ice determined by seed

```
cupProb = P(win current series from current state) × P(win remaining rounds vs avg opponent)
```

---

## 4. Playoff Impact (Box Score Pages)

Each box score page shows how the game result affects both teams' playoff probabilities.

### For Completed Games

Shows **before** and **after** probability:
- **Before:** Recalculates probability by subtracting the game's result (undo the game)
  - Win → subtract 2 points and 1 GP
  - OT Loss → subtract 1 point and 1 GP
  - Regulation Loss → subtract 0 points and 1 GP
- **After:** Current probability with game included
- **Delta:** The change

### For Live/Future Games

Shows **what's at stake** scenarios:
- **Win scenario:** Current stats + 2 points + 1 GP
- **Loss scenario:** Current stats + 0 points + 1 GP
- Displays both probabilities and the delta between them

### For Playoff Series Games

Replaces standings impact with series-win probability impact, using the same before/after pattern but with `computeSeriesWinProbability()`.

---

## Known Limitations of the Current Approach

1. **No simulation** — Uses deterministic formulas, not Monte Carlo. Same inputs always produce the same output.

2. **No schedule strength** — A team playing 10 remaining games against top teams is treated the same as one playing 10 games against bottom teams.

3. **Linear pace projection** — Assumes current points-per-game pace continues unchanged. Doesn't account for hot/cold streaks, injuries, or trade deadline moves.

4. **Independent calculations** — Each team's probability is calculated independently. In reality, standings are a zero-sum system (team A winning directly affects team B's chances). The probabilities across all teams don't sum to exactly 16 (the number of playoff spots).

5. **Cut lines are current-pace snapshots** — The cut line is based on current pace of bubble teams, not a forward-looking projection.

6. **Cup odds use average opponents** — Future playoff rounds assume a .500 opponent rather than projecting likely matchups.

7. **No home/away splits for regular season** — Playoff probability doesn't factor in remaining home vs. away games.

8. **Point percentage as sole strength metric** — Series and Cup odds use only regular-season point percentage. No adjustment for recent form, goal differential, special teams, goaltending, etc.

---

## Key Files

| File | Purpose |
|------|---------|
| `lib/utils/playoffProbability.ts` | Core probability functions (logistic model, series DP, Cup odds) |
| `lib/utils/standingsCalc.ts` | Cut line calculation, projected points, glue between standings data and probability functions |
| `lib/types/boxscore.ts` | `StandingsTeam` interface (lines 232-265) |
| `lib/services/boxscoreApi.ts` | Fetches standings from NHL API |
| `app/nhl-playoff-odds/page.tsx` | Playoff odds page (server component, builds team data) |
| `app/playoffs/page.tsx` | Playoff bracket page with series and Cup odds |
| `components/PlayoffOddsClient.tsx` | Interactive standings/odds table |
| `components/scores/boxscore/PlayoffImpact.tsx` | Box score playoff impact display |
| `components/playoffs/SeriesCard.tsx` | Series win probability display |
| `components/playoffs/StanleyCupOdds.tsx` | Cup odds visualization |
