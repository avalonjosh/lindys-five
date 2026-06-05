# The Perfect Season Games: 162-0 (MLB) and 82-0 (NHL)
## Lindys Five Build Spec v3 (Build-Ready)

Replaces v2. Changes in v3: final mode structure locked (Daily is one sacred puzzle; Tank and Franchise are Free Play game types), Tank mode rules, Franchise mode rules including expansion-team handling, the roster dedupe rule, the skip-replacement tree fully specified with test requirements, the slot-quality rule added to the daily generator, and the daily epoch defined.

---

## 0. How to Run This Spec (instructions for the Claude Code build session)

1. Execute one phase per session (Section 16). Stop at each phase's checkpoint for Josh's review. Do not proceed past Phase 1 until the player pool hand-checks are approved.
2. Prerequisite: the Lahman CSV set must already be in the repo at `/raw-data/lahman/` before Phase 1. The Kaggle NHL dataset goes in `/raw-data/nhl/` before Phase 7.
3. Before any UI work, inventory the existing Lindys Five theme (Section 11) and reuse its tokens and components. Do not invent a new design system.
4. If the repo uses the pages router instead of the app router, adapt the route structure in Section 9 accordingly and note the deviation.
5. Never use em dashes in any code comments, UI copy, or documentation.

---

## 1. Overview

Two daily roster-puzzle games living inside lindysfive.com, sharing one engine:

- **162-0** (MLB) at `lindysfive.com/162-0`
- **82-0** (NHL) at `lindysfive.com/82-0`

Redirects: `/162` and `/82` 301 to the hyphenated routes (four lines in next.config) so loosely typed links still land.

Players draft an all-time roster from decade + franchise spins, and a deterministic engine projects their season record.

**The mode structure (locked):**

- **Daily**: ONE concept, never diluted. All franchises, all decades, build the best team. Everyone on Earth gets the same spins each day. One attempt. Two variants, each its own daily with its own streak: **Classic** (stats visible) and the **blind IQ mode** (stats hidden). Nothing else ever appears in the Daily.
- **Free Play**: unlimited random spins, instant replay, three game types: **Standard** (same rules as the daily), **Tank** (build the worst team, Section 4), and **Franchise** (one team, all eras, Section 5).

The daily shared seed is our differentiator: neither 82-0.com nor nhl82.ca has a shared puzzle, streaks, or a share format. We keep their proven core loop and add the Wordle retention layer. Tank and Franchise are differentiators neither site has at all.

**Naming note**: "82-0" as a game title is used by 82-0.com (NBA) and nhl82.ca. Records are not protectable, but consider a suite brand ("The Perfect Season by Lindys Five") with 162-0 / 82-0 as labels. Name-agnostic spec; decide before launch.

---

## 2. Competitive Analysis (verified from the live sites, June 2026)

### 2.1 82-0.com (NBA, the viral original)

- 5 rounds, 5 spots, no positional restrictions; the constraint is era diversity (no two players from the same decade; pool 1960s to 2020s).
- Slot machine assigns team + decade per round; pick from that pool.
- Skips: one Team skip and one Decade skip per game (two distinct currencies).
- Engine: cumulative strength across 5 stats, explicitly era-adjusted, run through a non-linear win curve where each added win is harder and a deficiency in one category blocks perfection. Deterministic; no true simulation.
- Modes: Classic / HoopIQ (blind). Monetization: Ko-fi plus feedback form, no ads. PWA meta tags.
- Weakness we exploit: infinite replay only; no shared daily, no streaks, no share grid.

### 2.2 nhl82.ca (the hockey fast-follow)

- 6 rounds, 6 positional slots (LW, C, RW, LD, RD, G) with natural-position eligibility; players sorted by per-82 averages within the decade.
- Skips: Skip Team and Skip Decade, one each. Modes: Classic / IceIQ. Kaggle NHL data, credited; independent fan project disclaimer.
- Same weakness: no daily, no streaks, no share format.

### 2.3 Load-bearing vs. incidental

Must keep: the slot machine reveal, sorted pick lists, two-currency skips, positional scarcity, blind-mode flex, the near-impossible perfect record, era adjustment, 2 to 3 minute sessions, no login.

Ours to improve (their gaps, our v1): shared daily, streaks, spoiler-safe share grid, set-based result framing, cross-content ecosystem, Tank and Franchise free play.

---

## 3. Core Game Design (Standard rules: Daily and Free Play Standard)

### 3.1 Roster Structures

**MLB (162-0)**, six rounds:

| Slot | Eligible Positions |
|------|-------------------|
| C    | Catcher |
| IF 1 | 1B, 2B, 3B, SS |
| IF 2 | 1B, 2B, 3B, SS |
| OF 1 | LF, CF, RF |
| OF 2 | LF, CF, RF |
| SP   | Starting pitcher |

**NHL (82-0)**, six rounds:

| Slot | Eligible Positions |
|------|-------------------|
| LW   | Left wing |
| C    | Center |
| RW   | Right wing |
| D1   | Defense (generic pair, mirrors IF1/IF2) |
| D2   | Defense (generic pair, mirrors IF1/IF2) |
| G    | Goaltender |

Amended 2026-06-04: the original LD/RD split is replaced by a generic D1/D2
defense pair (like the IF1/IF2 buckets), because both data sources record only
"D" without a left/right split. Two distinct defensemen fill the pair; the
dedupe rule prevents the same player filling both.

Eligibility: a player qualifies at any position making up 20 percent or more of appearances in that decade-franchise stint. Multi-position players (Banks, Coffey, Ohtani) are a feature.

### 3.2 The Dedupe Rule (engine-wide)

The same human can never occupy two roster slots, even via different decade-franchise stints (90s Mariners Griffey and 00s Reds Griffey are the same person). Rostering any stint of a player removes all their other stints from later pools. Keyed on the canonical playerID, which already spans stints. In Franchise mode this rule is doing heavy lifting (Section 5); in Standard play it is a rare but necessary guard.

### 3.3 Eras

Both sports: 1950s through 2020s, eight decades. Pre-1950 excluded (normalization chaos, recognition cliff).

### 3.4 The Spin Loop

Each round: slot machine reveals decade + franchise (decade tile flips, 250ms beat, franchise tile flips), the sorted player list appears, player taps a name then taps a legal open slot, next round. After round six, the season simulates.

### 3.5 Skips: Two Currencies

Per game: **Skip Team** (1, rerolls franchise, keeps decade) and **Skip Decade** (1, rerolls decade, keeps franchise). Daily skips are deterministic (Section 7.3); Free Play skips are true random.

### 3.6 Fail States

Every reachable spin must leave at least 4 eligible players for the remaining open slots (enforced at schedule generation for Daily, at reroll time for Free Play). The UI blocks illegal assignments; a 4-second undo toast covers misfires; no confirm dialogs.

---

## 4. Tank Mode (Free Play only)

Goal inverted: build the WORST team and chase 0-162 (or 0-82). Same spins, slots, skips, eligibility, and dedupe rule. Three rule changes:

1. **Alphabetical sort.** The pick list sorts A to Z, not by score (stats remain visible in Classic-style display). Best-to-worst sorting would reduce tanking to "tap the bottom name"; alphabetical restores the hunt and rewards knowing genuinely bad rosters. This also makes Tank a natural on-ramp toward the blind mode.
2. **Inverted sim with a strongest-link gate.** Mirror of the standard engine: lower scores produce fewer wins, and the BEST player on the roster sets a floor on wins. Five anonymous scrubs plus one accidental legend cannot approach 0-162, exactly like the real-life veteran who keeps winning games the front office does not want. Implementation: run the standard curve on inverted scores (100 minus score) with the gate reading max(player scores). 0-162 stays as unreachable as 162-0.
3. **Tank verdict lines.** Own set per sport ("12-150: a generational lottery position", "54-108: you accidentally tried", NHL lines referencing the draft lottery and the play-in). Result card uses a distinct treatment (red/orange accent) so screenshots are visually distinct from standard results.

Known limitation, accepted for v1: pool minimums (Section 6) exclude true short-career disasters, so Tank picks among "least good regulars." If the mode needs more juice later, add a lower-threshold tank-only pool tier (backlog).

---

## 5. Franchise Mode (Free Play only)

Goal: build the best all-time team for ONE franchise. The player picks a franchise; spins then assign decades only.

1. **Decade-only spins.** The slot machine spins a single reel. All other standard rules apply, including skips (Skip Decade only; Skip Team is disabled and hidden in this mode).
2. **Dedupe rule is central.** Franchise legends span decades (Perreault is a 70s and an 80s Sabre). One human, one slot: taking 70s Perreault removes 80s Perreault. Choosing WHICH decade's version of a legend to roster is the mode's signature decision.
3. **History-depth handling** (computed per franchise from the data):
   - 6+ decades of history: full experience, spins draw distinct decades.
   - 3 to 5 decades: spins may repeat decades (a repeated decade re-offers the remaining unrostered pool).
   - Fewer than 3 decades (Kraken, Golden Knights early on): no slot machine; the mode presents a straight draft ("Build the all-time Kraken six from their full history"). Same engine, same sim, no fake spin theater.
4. **Calibrated expectations.** Scores are league-wide percentiles, so young or historically thin franchises cap low by design. A perfect Kraken draft might land 46-36. Verdict lines lean into it ("38-44: hey, it is a young franchise"). Never rescale scores per franchise; cross-franchise comparability is the bragging-rights point ("best possible Sabres team vs. best possible Bruins team" arguments are the content).
5. **Staleness is accepted and contained.** A franchise pool is finite; devoted fans will learn their team's optimal six. That is why this mode is Free Play only and never a per-user daily. (A rotating shared "Franchise of the Day" event remains in the backlog if the audience earns it.)

---

## 6. Data Pipelines

### 6.1 MLB: Lahman Database

Source: Lahman Baseball Database (1871 to 2025) CSVs from sabr.org, CC BY-SA, footer attribution. Tables: People, Batting, Pitching, Appearances, Teams. Build script `scripts/build-mlb-data.ts`, run locally, output committed:

```
Lahman CSVs -> join on playerID -> group by (player, franchise, decade)
  -> filter (batters >= 300 G per stint, SP >= 60 GS)
  -> per-162 lines (batters) and per-32-start lines (SP)
  -> era normalization vs decade league average
  -> position eligibility (Appearances, 20%)
  -> player scores -> src/data/mlb-data.json (< 1.5 MB raw)
```

Per-162 math: sum counting stats across the stint, scale to 162 G; rate stats from summed components. 2020 weighted at 60/162 for thresholds. Pitchers normalized to 32 GS (W, IP, SO), ERA and WHIP from summed components.

### 6.2 NHL: single source, the NHL stats REST API (amended 2026-06-04)

Two prior plans were abandoned. The originally-credited Kaggle dump (flynn28
"NHL player database") is career-aggregate only (no team, no per-season rows) and
cannot produce (player, franchise, decade) stints. The two-source fallback
(Kaggle "Professional Hockey Database" for 1950s-2000s + MoneyPuck for
2010s-2020s) was also dropped: MoneyPuck blocks scraping, and testing showed the
NHL API alone covers every season back to 1917 with one consistent schema. So
the NHL is the single source. No Kaggle account, no manual download, no
cross-source stitch or boundary dedup.

**NHL stats REST API**, per-(player, team, season) regular-season summaries from
`api.nhle.com/stats/rest/en/{skater,goalie}/summary`, seasons 1950-51 through
2025-26, fetched by `scripts/fetch-nhl-api.ts` and cached to
`raw-data/nhl/nhlapi/{seasonId}/` (gitignored). This is the `api.nhle.com/stats/
rest` host, NOT the `api-web.nhle.com` the app proxies; the fetch is a local
script, so no proxy/CORS concern.

- The summary report returns ONE combined row for a traded player (teamAbbrevs
  "PIT,CAR", merged totals). The fetch loops per team (filtering `teamId`) to get
  split per-stint stats and tags each row with `queriedTri` / `queriedTeamId`.
  The row's own `teamAbbrevs` is cosmetic; use `queriedTri` for attribution.
- Fields: skaters give playerId, skaterFullName, positionCode (C/L/R/D), GP, G,
  A, P, plusMinus. Goalies give GP, wins, savePct, goalsAgainstAverage,
  shutouts, saves, shotsAgainst.
- Era caveats handled in the build: plusMinus is null before 1967-68; goalie
  savePct is null in the very early 1950s (GAA is the fallback there).

Credit the NHL as the data source in the footer.

Script `scripts/build-nhl-data.ts`:

- Skaters: per-82 G, A, P (plus plus-minus where available); >= 150 GP per stint.
  Goalies: era-normalized SV% primary, GAA secondary; >= 80 GP per stint.
- Era normalization vs decade league scoring environment.
- Franchise mapping via hand-maintained table (Nordiques to Avalanche, Whalers
  to Hurricanes, Jets 1.0 lineage decided once, documented in the script).
- Output: `data/nhl-data.json` (no `src/` in this repo; see progress Section 4).

### 6.3 Shared Output Schema

```json
{
  "sport": "mlb",
  "decades": ["1950s", "...", "2020s"],
  "franchises": [{ "id": "WSN", "names": { "1980s": "Montreal Expos" }, "activeDecades": ["1970s", "..."] }],
  "pools": {
    "1970s|CIN": [{
      "id": "benchjo01", "name": "Johnny Bench", "pos": ["C"], "score": 91.4,
      "line": { "hr": 33, "rbi": 108, "avg": ".267", "ops": ".838" }
    }]
  }
}
```

Identical shape for both sports; `line` keys differ per sport config. `franchises[].activeDecades` drives Franchise mode's history-depth handling.

---

## 7. Daily Seed and Schedule

### 7.1 Seed, Rollover, Epoch

```ts
const seed = hashString(`L5-${sport}-${dateString}`);   // date in America/New_York
const rng  = mulberry32(seed);
```

Midnight Eastern rollover. **Epoch**: `DAILY_EPOCH` is a config constant set to the public launch date; the displayed day number is days since epoch plus 1 ("Daily #47"). Defined once, never changed (it is baked into every shared grid).

### 7.2 Pre-Generated Schedule (required)

`scripts/build-daily-schedule.ts` generates a validated `{sport}-daily-schedule.json` 60 to 90 days ahead, committed to the repo. Constraints per day:

1. 6 primary spins; no repeated franchise among primaries; max two primaries per decade.
2. **Slot-quality rule**: across the day's primary spins, every roster slot must be fillable by at least one player scored 75 or higher. No days where every available goalie or SP is a 45; hard days are allowed, hopeless slots are not.
3. At least one spin containing a 85+ player (every day deserves a star). Difficulty banded so brutal days are deliberate, not accidental.
4. Special dates may be hand-juiced (Opening Day, deadline day, Hall of Fame announcements, a Sabres-heavy puzzle when warranted).

### 7.3 The Skip-Replacement Tree (fully specified)

Deterministic skips require pre-generating every reachable spin, not one backup list. The state space: at each round 1 through 6, the player may hold both skips, have spent Team only, Decade only, or both. The generator must therefore produce, for each round:

- the primary spin,
- the Team-skip replacement of that spin,
- the Decade-skip replacement of that spin,
- and, because a player can skip the replacement too (Team-skip then Decade-skip the result, or vice versa, while currencies last), the replacement of each replacement.

Per round that is a small bounded tree (primary, 2 first-order replacements, 2 second-order replacements; deeper is impossible with one of each currency). Every node in every round's tree must independently satisfy the fail-state rule (3.6) and collectively the slot-quality rule (7.2) must hold along EVERY reachable path, not just the no-skip path. The generator validates by walking all paths.

**Test requirement (Phase 2, non-negotiable)**: unit tests that (a) enumerate all skip paths for a sample schedule and assert every reachable state is valid, (b) assert two simulated players taking identical actions see identical spins, and (c) assert replacement spins never duplicate a franchise already seen in that game's primaries. This is the most bug-prone component in the build; it does not ship without these tests passing.

### 7.4 One Attempt

localStorage flag per sport per date per variant. Clearing storage allows replays; Wordle proved this does not matter. No accounts.

---

## 8. Player Value Model and Simulation

### 8.1 Player Score (0 to 100, percentile-scaled within sport)

MLB batters: normalized OPS 55%, HR/162 20%, R+RBI/162 15%, durability 10%. MLB SP: normalized ERA (inverted) 45%, WHIP (inverted) 25%, SO/32GS 20%, durability 10%.

NHL skaters: normalized P/82 60%, G/82 25%, durability 15% (defensemen scored within position). NHL goalies: normalized SV% 70%, GAA (inverted) 20%, durability 10%.

### 8.2 Wins: Non-Linear Curve with a Weakest-Link Gate

```
teamScore = mean(six player scores)
basePct   = 0.30 + 0.62 * (teamScore/100)^1.6     // each win harder as you climb
gate      = clamp(min(player scores) / 90, 0, 1)   // weakest link caps the ceiling
winPct    = min(basePct, 0.80 + 0.20 * gate)       // gate bites only near the top
wins      = round(games * winPct)
```

Six legends required for a shot at perfection; five legends plus filler tops out around a 138 to 145 pace (MLB). Constants are placeholders; Phase 2 calibrates against 15 hand-built rosters per sport (all-legends, five-plus-filler, balanced-good, deliberately bad). **Tank mode** runs the same curve on inverted scores with the gate reading the maximum score (Section 4). **Determinism**: identical rosters always yield identical records; zero randomness in the Daily; Free Play may show a cosmetic plus-or-minus 2 wobble, Standard mode only.

### 8.3 Result Framing: 5-Game Sets (the Lindys Five signature)

The result screen presents the season the way the whole site does, five games at a time:

> **151-11** · You won 29 of 33 five-game sets · 14 perfect sets

MLB: 32 sets plus a 2-game finale (33 displayed). NHL: 16 sets plus a finale. Set results derive deterministically from the win total (a simple spreading function, no randomness). Verdict lines per win band per sport per mode ("162-0: PERFECTION", "149-13: Dynasty", "96-66: October, then heartbreak", "71-91: Sell at the deadline"; NHL lines referencing the Presidents' Trophy, the play-in, the lottery; Tank and Franchise sets per Sections 4 and 5). This framing teaches new visitors the site's core concept and links naturally to the live trackers.

---

## 9. Two-Sport Architecture

One engine, thin sport configs, mode flags:

```
src/
  app/
    162-0/                    // MLB game routes
      layout.tsx  page.tsx  play/page.tsx
    82-0/                     // NHL game routes
      layout.tsx  page.tsx  play/page.tsx
  components/perfectseason/   // ALL components sport-agnostic, take config
    SpinReveal.tsx PlayerList.tsx PlayerRow.tsx RosterStrip.tsx
    ResultCard.tsx ShareSheet.tsx HowToPlay.tsx StatsPanel.tsx ModePicker.tsx
  lib/perfectseason/
    config.mlb.ts             // slots, games=162, stat columns, verdict lines, labels
    config.nhl.ts             // slots, games=82, stat columns, verdict lines, labels
    seed.ts schedule.ts engine.ts sim.ts storage.ts share.ts
  data/
    mlb-data.json nhl-data.json
    mlb-daily-schedule.json nhl-daily-schedule.json
scripts/
  build-mlb-data.ts build-nhl-data.ts build-daily-schedule.ts
```

`engine.ts` is a pure-function state machine driven by `useReducer`, zero new dependencies, fully unit-testable. It takes a mode descriptor: `{ type: 'standard' | 'tank' | 'franchise', source: 'daily' | 'free', franchiseId? }`. Tank and Franchise are engine flags plus config (sort order, sim inversion, spin reel count, skip availability), not forks. Sport config supplies slots, season length, stat columns, blind-mode branding, verdict line sets, and share labels. The NHL edition after MLB works is config plus data script, budget half a day. Cross-links: each game's result screen links to the other sport's daily.

---

## 10. Share Grid

Daily results only (Free Play results get a clearly labeled, downplayed share without day numbers or streaks):

```
162-0 ⚾ Daily #47
🏆 151-11 · 29/33 sets

C  🟩 70s Reds
IF 🟩 50s Yankees
IF 🟨 10s Cubs
OF 🟩 90s Mariners
OF 🟨 80s Mets
SP 🟩 60s Giants
⏭️ team skip used

lindysfive.com/162-0
```

Green = top-scored option for that spin, yellow = top three, gray = below. Spoiler-safe. Blind mode adds 🧠. NHL uses 🏒 and LW/C/RW/LD/RD/G. Copy via `navigator.clipboard` with textarea fallback; native share sheet via `navigator.share` on mobile. The URL line is the growth mechanism and is never optional. **Social unfurl**: reuse the existing Lindys Five `/api/og` endpoint pattern for game OG cards ("Can you go 162-0?" plus day number).

---

## 11. Visual Design: Native to Lindys Five

Method, not mockup. Build instruction for the implementation session:

1. Inventory the existing theme: global CSS variables or Tailwind tokens (colors, radii, shadows, spacing), loaded fonts, and the component patterns on the team tracker pages (stat summary cards, 5-game set chips, win pace displays, tables).
2. Reuse those tokens and patterns directly. The games should read as Lindys Five pages at a glance: same header/footer, type, chip and card vocabulary. The tracker's set chips and the game's result set dots should be the same component family.
3. The game layer adds at most one accent treatment for the slot machine moment and the verdict stamp (plus the Tank red/orange variant), scoped via route-layout CSS variables. Distinctive where the dopamine is, native everywhere else.
4. Era-correct team names as text only inside game UI and share images. No MLB/NHL logos in the games or share cards regardless of what the live tracker pages do elsewhere.

---

## 12. Mobile-First UX Spec

Assume 70 to 80 percent phone traffic from social links. Basis: Wordle's instant no-login play and timed reveals; the documented clone failure mode (bad touch targets, scroll jank); 82-0.com shipping PWA meta tags.

### 12.1 Layout

Single column, max width 480px; desktop is the afterthought. Three screen states (Spin, Pick, Result); nothing except the player list scrolls on a 667pt viewport. Sticky bottom action bar in the thumb zone (SPIN / CONFIRM / SHARE, full width, 56px). Roster strip of six slot chips pinned under the header, always visible; legal open chips pulse during assignment; tapping a filled chip previews the player. No horizontal scrolling. Player rows show max 4 stats on mobile (MLB batters: HR, RBI, AVG, OPS; SP: W, ERA, WHIP, SO; NHL skaters: G, A, P, +/-; goalies: SV%, GAA, W, SO).

### 12.2 Touch

44px minimum targets; 56px player rows, full row tappable. Tap-tap selection (player, then slot), never drag. Auto-assign when one legal slot remains, with the undo toast. No hover-only information.

### 12.3 Performance

Statically generated pages; data JSONs as hashed immutable assets; no third-party scripts on game routes beyond existing analytics; no ads. Interactive under 2 seconds on a mid-tier phone on 4G. Fully playable offline after first load.

### 12.4 Feedback and Motion

The spin reveal is the signature beat (CSS-only sequential tile flips; Franchise mode flips a single decade tile). Win total counts up over 1.2 seconds with set dots filling beneath, then the verdict stamps. Haptic tick (`navigator.vibrate(10)`) on pick confirm where supported. `prefers-reduced-motion` collapses everything to instant fades.

### 12.5 Onboarding and Retention

One-time How To Play sheet (3 bullets plus the slot diagram), reopenable via "?". Free Play mode picker explains Tank and Franchise in one line each. Streaks and personal stats per sport per daily variant from localStorage (played, average wins, best record, green-pick rate, perfect sets). Result screen: countdown to next daily, the other sport's daily, and Free Play.

### 12.6 Accessibility

Plain-text alternative alongside the emoji grid. Color signals paired with text or icons. Full keyboard operability, logical focus order, aria-live announcements for spins.

---

## 13. localStorage Schema

```json
{
  "l5ps.version": 1,
  "l5ps.mlb.daily.2026-06-04.classic": { "done": true, "wins": 151, "picks": ["..."], "skips": { "team": true, "decade": false } },
  "l5ps.mlb.streak.classic": { "current": 12, "best": 23, "lastPlayed": "2026-06-04" },
  "l5ps.mlb.stats.classic": { "played": 47, "totalWins": 6204, "best": 158, "greenPicks": 31, "perfectSets": 102 },
  "l5ps.mlb.freeplay.tank": { "played": 9, "best": 14 },
  "l5ps.mlb.freeplay.franchise": { "played": 4, "bestByFranchise": { "BUF": 121 } },
  "l5ps.onboarded": true
}
```

Parallel keys per sport and per daily variant; lightweight aggregate keys for Free Play modes. Versioned prefix for migrations.

---

## 14. Cross-Promotion, Content Loop, Monetization

1. Result screen CTA into the live trackers in the site's own language: "Your dynasty won 29 of 33 sets. The real Yankees are on set 13: see the tracker."
2. Main nav entries plus cards on both sport hubs; "NEW" badge first month.
3. Daily social ritual: post both share grids each morning from @joshrabenold and the site account.
4. Editorial loop: each day's puzzle seeds a short blog post targeting long-tail team-history queries, internal-linked to team pages. Franchise mode generates evergreen debate posts ("the best possible all-time Sabres six").
5. Game pages link to franchise pages; franchise pages link back ("draft this team's legends" deep-links into Franchise mode with that team preselected).
6. Monetization posture: match the category norm, no ads, optional support link plus a feedback form. The games' job is audience and backlinks. Revisit only after retention data exists.

---

## 15. Legal and Attribution

Footer on every game screen:

> An independent fan game by Lindys Five. Not affiliated with Major League Baseball, the MLBPA, the National Hockey League, or the NHLPA. MLB data: Lahman Baseball Database (CC BY-SA), sabr.org. NHL data: [Kaggle NHL Player Database], credited per its license.

Facts (names, stats) are not copyrightable. No league logos, wordmarks, or photos in game UI or share cards.

---

## 16. Build Phases (one Claude Code session per phase, checkpoint at each end)

**Phase 1: MLB data.** Run build-mlb-data.ts; output the ten hand-check pools for review (70s Reds, 50s Yankees, 90s Mariners, 60s Giants, 00s Cardinals, 80s Mets, 10s Cubs, 70s A's, 90s Braves, 20s Dodgers). CHECKPOINT: Josh approves the pools. Nothing proceeds until they pass the eye test.

**Phase 2: engine and sim.** seed, engine (including the dedupe rule and mode descriptor), sim (standard plus tank inversion) as pure functions. The skip-tree test suite from Section 7.3 (a, b, c) must pass. Calibrate the win curve against 15 hand-built rosters. CHECKPOINT: calibration table reviewed.

**Phase 3: UI.** Token/component inventory from the repo first (Section 11). Free Play Standard before Daily. Test on a real phone. CHECKPOINT: phone walkthrough.

**Phase 4: Daily plumbing and quiet ship.** Schedule generator with slot-quality and skip-tree validation, lockout, streaks, share grid, OG cards. Deploy `/162-0` with no nav link, self-test 2 to 3 days, then nav link and first share grid post. CHECKPOINT: launch call.

**Phase 5: Tank and Franchise (Free Play).** Engine flags, alphabetical sort, inverted sim, decade-only spins, history-depth handling, mode picker, verdict line sets. CHECKPOINT: mode walkthrough.

**Phase 6: blind mode (BallIQ).** Hide stats, parallel storage keys, daily variant live. CHECKPOINT: first blind daily.

**Phase 7: NHL edition.** build-nhl-data.ts plus config.nhl.ts; hand-check ten pools (80s Oilers, 70s Canadiens, 70s Bruins, 90s Red Wings, 00s Avalanche, 80s Islanders, 90s Penguins, 00s Devils, 10s Blackhawks, and the 70s Sabres, obviously); recalibrate for 82 games; ship `/82-0` with all modes. Engine untouched.

**Definition of done, v1 (end of Phase 4)**: MLB daily (Classic) plus Free Play Standard, two-currency deterministic skips with passing tree tests, set-based result card, share grid with OG unfurl, streaks, onboarding, attribution.

---

## 17. Backlog (do not build yet)

- Tank Tuesday and rotating Franchise of the Day as scheduled shared events (promote from Free Play only if the audience earns it)
- Lower-threshold tank-only player pool tier
- Puzzle archive (past dailies, marked as archive results)
- Friends leaderboard via result-encoded share URLs (still no accounts)
- "Full Nine" MLB special (9 slots)
- Hard mode: no skips, 30-second pick clock
- Theme skin toggle (retro scoreboard look)
- NBA edition only if the originals fade; otherwise stay in our two lanes
