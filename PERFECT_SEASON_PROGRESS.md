# Perfect Season (162-0 / 82-0) — Build Progress and Handoff

This file is the durable "where we left off" record for the Perfect Season games.
It is committed to git so it survives local file loss. Read this first when
resuming. Last updated: 2026-06-04 (Section 12: Phase 7 plan + NHL data sources).

---

## 1. What this is

Two daily roster-puzzle games living inside lindysfive.com, sharing one engine:

- **162-0** (MLB) at `lindysfive.com/162-0` — being built now.
- **82-0** (NHL) at `lindysfive.com/82-0` — later (Phase 7).

You draft an all-time roster from decade + franchise "spins," and a deterministic
engine projects your season record, framed five games at a time (the Lindy's Five
signature). Differentiator vs the inspirations (82-0.com NBA, nhl82.ca): a shared
**Daily** puzzle with streaks and a spoiler-safe share grid, plus Tank and
Franchise free-play modes.

Full spec lives in the repo: `perfect_season_build_spec_v3.md`.

---

## 2. Operating rules (do not break these)

- **One phase per session, hard stop at every checkpoint** for Josh's review.
- **Never commit to `main`.** All work is on branch `feature/perfect-season`.
  Merge only after the feature is fully tested.
- **Always ask before `git push`.**
- **Never use em dashes** in code comments, UI copy, or docs.
- **Derive all styling from the existing codebase** (the team tracker UI), do not
  invent a new design system.
- Type-check with `npx tsc --noEmit` before committing.

---

## 3. How to run it

```
npm run dev            # then open http://localhost:3000/162-0  (the board)
npx tsx scripts/test-skip-tree.ts    # engine + skip-tree test suite (12 checks)
npx tsx scripts/calibrate-sim.ts     # win-curve calibration table
npx tsx scripts/build-mlb-data.ts    # regenerate data/mlb-data.json from Lahman CSVs
```

**Data dependency:** `scripts/build-mlb-data.ts` reads Lahman CSVs from
`raw-data/lahman/` (People, Batting, Pitching, Appearances, Teams,
TeamsFranchises). That folder is **gitignored** (not committed). The source
files came from `~/Downloads/lahman_1871-2025_csv` and are freely
re-downloadable from sabr.org (Lahman Baseball Database, CC BY-SA). The
generated `data/mlb-data.json` IS committed, so you only need the raw CSVs if you
want to rebuild the data.

---

## 4. Repo facts and deviations from the spec's Section 9

- **App Router**, Next.js 16, React 19, Tailwind v4 (theme in `app/globals.css`
  `@theme` block, no `tailwind.config`). Path alias `@/*` to repo root.
- **No `src/` directory** and `tsconfig.json` excludes `src/`, so the spec's
  `src/` prefix is dropped. Real layout used:
  - routes: `app/162-0/`
  - components: `components/perfectseason/`
  - engine/config: `lib/perfectseason/`
  - data: `data/`
  - scripts: `scripts/`
- The 5-game-set component family in the existing tracker is called "chunk"
  (`components/ChunkCard.tsx`, `GameBox.tsx`); the game's result set dots reuse
  that visual family.

---

## 5. Phase status

| Phase | What | Status |
|---|---|---|
| 1 | MLB data pipeline | DONE, approved 2026-06-04 |
| 2 | Engine, sim, deterministic skip tree, calibration | DONE, approved 2026-06-04 |
| 3 | Free Play Standard UI | DONE; nhl82.ca-style one-page board, logos, spin animation |
| 4 | Daily plumbing and quiet ship | DONE; daily-first landing, lockout, streaks, share grid, OG card. Awaiting launch call |
| 5 | Tank and Franchise (free play) | DONE; mode picker, red tank, decade-only franchise spins, franchise picker |
| 6 | Blind mode (BallIQ) | DONE; live Classic/BallIQ daily toggle, hides stats, parallel streak/lockout |
| 7 | NHL edition (82-0) | not started; needs Kaggle NHL dataset in `raw-data/nhl/` |

**v1 definition of done = end of Phase 4** (MLB daily Classic + Free Play
Standard, deterministic skips, set result card, share grid + OG, streaks,
onboarding, attribution).

---

## 6. What is built (file by file)

**Engine / logic (`lib/perfectseason/`):**
- `types.ts` — shared types (Player, Spin, RoundTree, SportConfig, ModeDescriptor, SimResult, etc.)
- `seed.ts` — hashString + mulberry32, Eastern-time date, `DAILY_EPOCH` (placeholder `2026-07-01`), day numbering.
- `config.mlb.ts` — slots (C, IF1, IF2, OF1, OF2, SP), 162 games, 32 sets + 2-game finale, stat columns, standard + tank verdict bands.
- `sim.ts` — win curve, tank inversion (strongest-link gate), set spreading, verdict lookup. **Calibrated constants live in the exported `CURVE` object.**
- `schedule.ts` — skip-replacement tree generator and the all-paths validator (fail-state, slot-quality, no-duplicate-franchise). `generateDay()`, `hasPerfectMatching()`, `poolPlayers()`.
- `engine.ts` — pure reducer state machine: dedupe rule, deterministic skip resolution, **completability guard** (you can never strand), undo. Selectors: `availablePlayers`, `legalSlots`, `canSkipTeam`, `canSkipDecade`, `currentSpin`.

**UI (`components/perfectseason/`):**
- `PlayClient.tsx` — the one-page board orchestrator (mode-agnostic). Header shell, manual SPIN, variant toggle, undo toast.
- `SpinReveal.tsx` — slot-machine tiles + segmented progress; blank until spun.
- `RosterList.tsx` — vertical 6-slot roster (display only).
- `PlayerList.tsx` — search box, position filters, inline slot-assign buttons, blind-mode aware.
- `ResultCard.tsx` — hero record + win-pace bar + stat cards + set chips + verdict pill + roster recap + share.
- `HowToPlay.tsx` — collapsible accordion.
- `ui.ts` — shared helpers (franchiseName, shortDecade, statCells, playerKind).

**Routes (`app/162-0/`):**
- `layout.tsx` — metadata + attribution footer (trademark + not-affiliated notice).
- `page.tsx` — renders the board (`PlayClient`). The board IS the landing.
- `play/page.tsx` — redirects to `/162-0` (old deep link).
- `next.config.js` — `/162 -> /162-0` and `/82 -> /82-0` redirects.

**Scripts:** `build-mlb-data.ts`, `test-skip-tree.ts`, `calibrate-sim.ts`.
**Data:** `data/mlb-data.json` (~575 KB, 207 pools, 30 franchises) committed.

---

## 7. Key decisions and owner overrides (do NOT silently revert)

- **MLB shield logo in the game header**: Josh chose to add it, overriding spec
  11.4/15 (which said no league logos in-game). Footer carries a trademark +
  not-affiliated/not-endorsed notice. Uses `mlbstatic.com/team-logos/league-on-dark/1.svg`.
- **Header palette is MLB blue** (`#002D72` background, `#041E42` border-b-4,
  white text), matching `/mlb/playoff-odds`, NOT Sabres navy/gold.
- **Header hierarchy**: "Lindy's Five" big Bebas wordmark, "162-0 [MLB shield]"
  subtitle. "The Perfect Season" tagline removed from the visible header (still in
  the SEO/metadata title in `layout.tsx`; remove there too if desired).
- **Calibration constants locked** (`sim.ts` CURVE): baseFloor 0.22 / baseSpan
  0.78 so only the single best-possible roster reaches 162-0 and the worst
  rosters bottom near 37 wins; set spreader clusters losses in slumps
  (SLUMP_LEN 3) so sets-won / perfect-set counts carry signal.
- **Board redesign to nhl82.ca one-page style**: `/162-0` is the playable board
  (no hub), manual SPIN button, vertical roster, search + position filters,
  inline slot-assign buttons.
- **Launch sequencing REVERSED (owner override, 2026-06-04)**: the spec
  (Section 16) said NHL waits until the MLB game ships. Josh overrode this. MLB
  (`162-0`) stays private/quiet-shipped as-is and must NOT go live until NHL
  (`82-0`) is finished; the two launch together. So NHL development is NOT gated
  on an MLB launch anymore. 7a (`build-nhl-data.ts`) is unblocked except for
  Josh's explicit go-ahead to start coding (currently on a "do not code" hold).

---

## 8. Agreed plan for Phase 4 (the Daily)

- **Daily-first landing** (Wordle-style): land directly on today's Daily board,
  ready to SPIN, with a small **Free Play** option. If today's Daily is already
  played, show the result + share grid instead of the board.
- The board is already mode-agnostic, so the Daily reuses `PlayClient` with a
  daily mode + the committed schedule + lockout/streaks/share.
- Phase 4 work: make `/162-0` default to the Daily; `localStorage` lockout (one
  attempt per sport/date/variant); streaks + personal stats; spoiler-safe share
  grid; OG link-preview cards; commit a pre-validated 60-90 day schedule
  (`scripts/build-daily-schedule.ts`, not yet written); add the nav link.
- The deterministic seed + skip tree this depends on already exist and pass tests.

---

## 9. Engine facts worth remembering

- **Determinism**: a date seed (`hashString("L5-mlb-YYYY-MM-DD")`) produces the
  same board for everyone. Free Play uses a random seed per game.
- **Deterministic skip tree** (spec 7.3): every reachable skip path is
  pre-generated and validated. Skip Team rerolls franchise (keeps decade); Skip
  Decade rerolls decade (keeps franchise). Only one franchise-changing event per
  game, so replacements just avoid the 6 primary franchises.
- **Completability guard** (engine): `legalSlots` / `availablePlayers` /
  `canSkipTeam` / `canSkipDecade` only offer moves that keep a primary completion
  matchable. A player can never strand. Soak: 150/150 random games complete.
- **Dedupe**: a player (by playerID) can fill only one slot, even across stints.

---

## 10. Known caveats / TODO

- Claude has **not visually click-tested** the UI (no browser tool in-session);
  the phone walkthrough is the real check at each UI checkpoint.
- `data/mlb-data.json` is **imported into the client bundle** (~575 KB); optimize
  to a hashed immutable asset per spec 12.3 (later).
- Pure DHs are excluded from MLB pools (no DH slot); prime David Ortiz is missing.
  Fix deferred to the backlog "Full Nine" / UT slot.
- "The Perfect Season" still appears in the page metadata/title (not the header).
- Raw Lahman CSVs are gitignored; re-download from sabr.org if rebuilding data.

---

## 11. Commit history (feature/perfect-season, off main)

```
c19eb74  Phase 1: MLB data pipeline
9e195eb  Phase 2: engine, sim, deterministic skip tree
59c8f34  Phase 2: calibrate win curve and set spreader
875ea95  Phase 3: Free Play Standard UI
0bad07c  Phase 3: restyle UI to match the Lindys Five tracker
1eb5613  Phase 3: recolor 162-0 header to MLB palette
098bd60  Phase 3: MLB shield in header, drop subtitle
5e183cb  Board redesign to nhl82.ca-style one-page Free Play
```

Also tracked in Claude's memory at
`~/.claude/projects/.../memory/perfect-season-project.md`.

---

## 12. Phase 7 plan (NHL edition, 82-0) — scoped 2026-06-04

### 12.1 Owner decisions (locked)

- **NHL data source (single source, decided 2026-06-04)**: the **NHL stats REST
  API** for ALL decades (1950-51..2025-26). Two earlier plans were dropped: the
  flynn28 Kaggle dump (career-aggregate, no team/season) and the two-source
  Kaggle-databank + MoneyPuck plan (MoneyPuck blocks scraping; and testing showed
  the NHL API alone covers every season back to 1917 with one schema). Net win:
  no Kaggle login, no manual download, no cross-source stitch, no boundary dedup.
  - `scripts/fetch-nhl-api.ts` pulls per-(player, team, season) summaries from
    `api.nhle.com/stats/rest/en/{skater,goalie}/summary` and caches to
    `raw-data/nhl/nhlapi/{seasonId}/` (gitignored). See 12.5 for the API
    mechanics (per-team loop for trade splits, `queriedTri` tagging, era caveats).
  - **The Kaggle databank is NOT needed and should NOT be added.** If a
    `raw-data/nhl/databank/` folder appears, ignore it.
- **Logos**: mirror the MLB override. Add the NHL shield in the 82-0 header
  (NHL-blue palette) and modern team logos on filled roster slots, parallel to
  162-0. Footer carries the NHL/NHLPA + Kaggle attribution.
- **Refactor approach**: parameterize one shared client (thin wrapper injects
  config/data/schedule/sport) so 162-0 and 82-0 render the SAME client. Do NOT
  fork a second copy.

### 12.2 What is already sport-agnostic (no work needed)

- `sim.ts` — win curve is dimensionless (0-100 scores) and scales by
  `config.games`; no MLB constants baked in. Calibration still needs
  re-verification for 82 games / 6 slots (see 12.3 step 7b).
- `engine.ts`, `schedule.ts` — pure reducers driven entirely by `SportConfig` +
  `GameData`. Untouched.
- `seed.ts` (`dailyRng(sport, ...)`) and `storage.ts` (all keys take a `sport`
  arg) — already parameterized; NHL gets its own daily/streak/stats keys free.
- `share.ts` — reads slot labels from result cells; title already switches
  162-0/82-0.
- `ogImage.tsx` — `sportHubTemplate` already has an `isNHL` branch with NHL
  colors. Just pass `sport=nhl`.
- `next.config.js` — `/82 -> /82-0` redirect already exists.

### 12.3 Build sequence (sub-checkpoints; one stop per checkpoint)

**Prerequisite (Josh):** drop the Kaggle NHL CSVs into `raw-data/nhl/`. Inspect
the real column names BEFORE writing the parser.

- **7a — Data pipeline. DONE, approved 2026-06-04.** `scripts/build-nhl-data.ts`
  + committed `data/nhl-data.json`. Stints by (player, franchise, decade); per-82
  skater stats (>= 150 GP), era-normalized goalie SV%/GAA (>= 80 GP); >= 20%
  position eligibility; franchise lineage per Section 12.6 hardcoded in the
  script. Output: 5,219 players (4,718 skaters, 501 goalies), 175 pools, 32
  franchises, ~580 KB. All 10 hand-check pools approved (Gretzky/Dryden/Orr/
  Bossy/Jagr/Roy/Brodeur/Kane/French Connection all resolve correctly). Scoring
  is stat-based: durability weighting puts Lemieux (98.2, missed 90s seasons)
  just behind Jagr (100); 80s goalie GAAs read high but era-normalization keeps
  cross-decade scoring fair.

- **7b — Config + calibration. DONE, approved 2026-06-04.**
  `lib/perfectseason/config.nhl.ts`: slots LW/C/RW/D1/D2/G (generic D pair, both
  accept "D"), 82 games, 16x5 + 2 finale, NHL stat columns (skater g/a/p/+-,
  goalie svp/gaa/w/so), §12.7 verdict copy, `blindLabel` 'IceIQ', `shareIcon` 🏒.
  `calibrate-sim.ts` and `test-skip-tree.ts` parameterized by a `sport` arg
  (default mlb). Results: NHL skip-tree 12/12 pass, MLB regression 12/12 pass;
  NHL calibration clean (perfect roster -> 82-0, real dream roster 81-1, .500 at
  ~43-39, tank works). **CURVE left shared/unchanged** — it is dimensionless and
  6 slots / 82 games produced a good curve with zero constant changes, so it was
  NOT promoted to sport-aware. Engine/sim/schedule untouched. tsc clean. (Minor:
  the standard min:0 "Historically bad" band is unreachable in standard play, win
  floor ~18-19; harmless safety floor, matches MLB.)

- **7c — Parameterize the shared client. DONE, approved 2026-06-04.**
  `PlayClient` is now props-driven (`{sport, data, config, schedule,
  defaultSpin}`); thin per-sport wrappers `MlbBoard.tsx` / `NhlBoard.tsx` each
  import only their own dataset so route bundles stay separate (no doubling the
  ~575 KB). `ui.ts`: `playerKind` detects goalies via `'gaa' in line`,
  `franchiseLogo(id, sport)` resolves NHL logos from
  `assets.nhle.com/logos/nhl/svg/{id}_dark.svg`, `STAT_LABELS` gained
  g/a/p/plusMinus/svp/gaa. Sport-aware header chrome via a `SPORT_UI` map (NHL
  navy + `NHL_light.svg` shield), banners ("chase 0-82"), `config.blindLabel`
  (IceIQ), HowToPlay goal, PlayerList HEADLINE (P, SV%). statColumns reuses the
  shared {bat,pitch} keys (bat=skater, pitch=goalie). Routes: `/162-0` ->
  MlbBoard, new `/82-0` -> NhlBoard. Verified: `/162-0` 200 MLB chrome
  (regression clean), `/82-0` 200 NHL chrome, tsc clean, no dev-server errors.
  Engine/sim/schedule untouched. NOTE: NHL Daily falls back to Free Play until
  the committed schedule lands in 7d (NhlBoard passes an empty `{days:{}}`).

- **7d — NHL routes + daily schedule.** `app/82-0/{layout,page,play}.tsx`
  mirroring 162-0 with NHL metadata, NHL/NHLPA + Kaggle footer attribution,
  `sport=nhl` OG. Generate committed `data/nhl-daily-schedule.json` (extend
  `build-daily-schedule.ts`). Cross-link result screens to the other sport's
  daily. CHECKPOINT: phone walkthrough of `/82-0` daily Classic, free play, share
  grid, OG unfurl.

- **7e — Mode parity + ship.** Verify Tank, Franchise, and IceIQ blind mode work
  for NHL (engine supports them via flags already). Final `npx tsc --noEmit`,
  mark Phase 7 done here. CHECKPOINT: full mode walkthrough, then Josh's launch
  call.

### 12.4 Coupling points to fix (the spec under-budgets these)

The engine/sim/schedule are clean, but the presentation layer is hardcoded to
MLB. Files needing sport-parameterizing in 7c:

- `components/perfectseason/PlayClient.tsx` — hardcoded `mlbDataJson`,
  `scheduleJson`, `mlbConfig`, `config`, MLB-blue header + MLB shield,
  `DEFAULT_SPIN = {1950s, NYY}`.
- `components/perfectseason/ui.ts` — `playerKind` discriminator, `STAT_LABELS`,
  `franchiseLogo` / `MLB_FRANCHISE_ID`.
- `components/perfectseason/PlayerList.tsx:88` — same `'era' in line`
  discriminator for the row key.
- Scripts `calibrate-sim.ts`, `test-skip-tree.ts`, `build-daily-schedule.ts` all
  import `mlbConfig` / read `mlb-data.json` directly; add NHL variants or
  parameterize.

### 12.5 NHL data: RESOLVED, single source NHL API (2026-06-04)

History: MoneyPuck (an early pick) blocks automated fetching (license-notice HTML
behind Cloudflare, then 429); not evaded, dropped, `fetch-moneypuck.sh` deleted.
The Kaggle "Professional Hockey Database" was the planned 1950s-2000s source, but
testing showed the **NHL stats REST API covers every season back to 1917**, so it
became the single source for all decades. No Kaggle needed.

`scripts/fetch-nhl-api.ts`:
- Endpoints: `api.nhle.com/stats/rest/en/{skater,goalie}/summary`,
  `cayenneExp=seasonId=YYYYYYYY and gameTypeId=2 and teamId=N`,
  `isAggregate=false`. Note: `api.nhle.com/stats/rest` host, NOT the
  `api-web.nhle.com` the app proxies; the script is local, no proxy/CORS issue.
- **Per-team loop is required**: with `isAggregate=false` a traded player returns
  ONE combined row (`teamAbbrevs "PIT,CAR"`, merged totals). Filtering `teamId`
  returns the split stint stats, so the script loops every team ID active since
  1950 (~46 incl. defunct: Nordiques, Whalers, North Stars, Seals/Barons,
  Rockies, Scouts, Atlanta Flames, original Jets) per season and tags each row
  with `queriedTri` / `queriedTeamId`. The row's own `teamAbbrevs` is the
  cosmetic full-season label; DO NOT use it for attribution, use `queriedTri`.
- Fields: skaters -> playerId, skaterFullName, positionCode (C/L/R/D), GP, G, A,
  P, plusMinus. Goalies -> goalieFullName, GP, wins, savePct,
  goalsAgainstAverage, shutouts, saves, shotsAgainst, goalsAgainst.
- Era caveats (handle in 7a): plusMinus null before 1967-68; goalie savePct null
  in the very early 1950s (use GAA there).
- Verified: Guentzel 2023-24 splits to CAR 17GP + PIT 50GP; McDavid 2023-24 EDM
  76GP/132P/+35; Beliveau 55-56 88P; Gretzky 85-86 215P/+71; positionCode set is
  exactly {C,L,R,D} (confirms D1/D2).
- Output cached to `raw-data/nhl/nhlapi/{seasonId}/{skaters,goalies}.json`
  (gitignored). Full pull DONE 2026-06-04: 76 seasons (1950-51..2025-26),
  47,816 skater rows, 4,873 goalie rows, 25 MB. Only empty season is 2004-05
  (the lockout, correct). One transient HTTP 502 on a guaranteed-empty query
  (NJD 1963-64, franchise did not exist) caused exit code 1; re-checked and
  confirmed 0 rows, no data lost. Verified pools: 1950s MTL (Richard/Beliveau/
  Plante) and DET (Howe/Sawchuk); 1980s EDM (Gretzky 1532 P, Kurri, Messier,
  Coffey).

**7a is no longer gated on MLB shipping** (sequencing reversed; see Section 7
override 2026-06-04: MLB holds until NHL is finished, then both launch together).
The data is in hand; the only hold on 7a is Josh's explicit go-ahead to start
coding.

Position note for 7a: the NHL API gives one positionCode per player-season, not
appearance splits, so the spec's "20% of appearances" eligibility rule does not
apply. Map L->LW, R->RW, C->C, D->D1/D2; a player listed under different codes
across seasons naturally becomes multi-position.

### 12.6 NHL franchise lineage & era-correct names (finalized 2026-06-04)

This is the hand-maintained mapping `build-nhl-data.ts` (7a) must implement. It
maps each source triCode (`queriedTri`) to a canonical franchise ID, and gives
the era-correct display name per decade. 32 franchises total (every current NHL
franchise; no defunct ones).

**Owner decisions (locked):**
1. **Jets 1.0 / Coyotes / Utah = ONE franchise** (relocation continuity), era
   names per decade. Canonical ID `UTA`.
2. **Seals/Barons DROPPED entirely.** triCodes `OAK`, `CGS`, `CLE` are excluded
   (folded 1978, thin pools, no modern successor).
3. **"Winnipeg Jets" kept era-accurate under BOTH franchises** (original under the
   `UTA` lineage in the 70s-90s; modern under the `WPG`/Thrashers lineage in the
   2010s+). They never share a decade, so no in-game collision.

**Mid-decade-rename rule:** when a relocation/rename splits a decade, name that
decade by the identity held for MOST of it (verified against stint-row counts in
the data). Exception: the current decade uses the current identity.

**triCode -> canonical franchise ID** (drop OAK/CGS/CLE):
- Stable (id = own triCode): BOS, CHI, DET, MTL, NYR, TOR, LAK, PHI, PIT, STL,
  BUF, VAN, NYI, WSH, EDM, SJS, TBL, OTT, ANA, FLA, NSH, CBJ, MIN, VGK, SEA.
- Merged lineages:
  - MNS -> DAL
  - AFM -> CGY
  - KCS, CLR -> NJD
  - HFD -> CAR
  - QUE -> COL
  - WIN, PHX, ARI, UTA -> UTA   (Jets 1.0 / Coyotes / Utah)
  - ATL, WPG -> WPG             (Thrashers / Jets 2.0)

**Era-correct name per decade** (only franchises whose name changes are listed;
all others use their single modern name for every decade they were active):

| Franchise | 1950s | 1960s | 1970s | 1980s | 1990s | 2000s | 2010s | 2020s |
|---|---|---|---|---|---|---|---|---|
| DAL | - | Minnesota North Stars | Minnesota North Stars | Minnesota North Stars | Dallas Stars | Dallas Stars | Dallas Stars | Dallas Stars |
| CGY | - | - | Atlanta Flames | Calgary Flames | Calgary Flames | Calgary Flames | Calgary Flames | Calgary Flames |
| NJD | - | - | Colorado Rockies | New Jersey Devils | New Jersey Devils | New Jersey Devils | New Jersey Devils | New Jersey Devils |
| CAR | - | - | Hartford Whalers | Hartford Whalers | Hartford Whalers | Carolina Hurricanes | Carolina Hurricanes | Carolina Hurricanes |
| COL | - | - | Quebec Nordiques | Quebec Nordiques | Quebec Nordiques | Colorado Avalanche | Colorado Avalanche | Colorado Avalanche |
| UTA | - | - | Winnipeg Jets | Winnipeg Jets | Winnipeg Jets | Phoenix Coyotes | Arizona Coyotes | Utah |
| WPG | - | - | - | - | Atlanta Thrashers | Atlanta Thrashers | Winnipeg Jets | Winnipeg Jets |
| CHI | Chicago Black Hawks | Chicago Black Hawks | Chicago Black Hawks | Chicago Black Hawks | Blackhawks | Blackhawks | Blackhawks | Blackhawks |
| ANA | - | - | - | - | Mighty Ducks of Anaheim | Mighty Ducks of Anaheim | Anaheim Ducks | Anaheim Ducks |

Notes:
- 1990s COL kept as "Quebec Nordiques" (177 vs 158 stint-rows; also keeps the
  2000s pool distinct as the Avalanche). 1990s CAR "Hartford Whalers", 1990s UTA
  "Winnipeg Jets", 1990s DAL "Dallas Stars" by majority.
- 2020s UTA "Utah" overrides raw majority (ARI 138 vs UTA 54) to use the current
  identity. Display string TBD in 7a ("Utah Hockey Club" vs "Utah Mammoth" vs
  just "Utah"); the franchise spans both 2024-25 and 2025-26.
- CHI "Black Hawks" (two words pre-1986) and ANA "Mighty Ducks" are minor
  era-spellings, easy to change if undesired.
- Thin partial-decade pools (e.g. 1970s EDM/HFD/QUE/WIN = a single 1979-80
  season; 1990s NSH/ATL) are naturally excluded by the existing schedule
  pool-size guard; no special handling needed.

### 12.7 NHL verdict copy (finalized 2026-06-04)

Drop-in copy for `config.nhl.ts` `verdict.standard` / `verdict.tank`. Same band
shape as MLB (11 standard, 7 tank). Rescaled to 82 games and anchored to NHL
benchmarks: all-time wins record 62 (1995-96 DET, 2018-19 TBL), playoff cutline
~44-46 wins, .500 = 41. Tank references kept timeless (the lottery, a
generational prospect) so they do not age. No em dashes (project rule). Lower
bands list higher `min` first; "first band whose min is met wins."

Standard (higher wins better):
- 82: "PERFECTION. 82-0. Nobody has ever done this."
- 75: "Immortal. The greatest season ever assembled."
- 67: "A dynasty. They will tell stories about this team."
- 62: "A juggernaut. You matched the all-time wins record."
- 55: "A powerhouse. The Presidents' Trophy is a formality."
- 48: "A real contender. Home ice is locked up."
- 42: "Right around .500. A playoff push that could go either way."
- 36: "On the wrong side of the bubble. Golf in April."
- 28: "Lottery-bound. The playoffs start without you."
- 18: "A brutal winter. Bottom of the league."
- 0: "Historically bad. Mercifully, it is over."

Tank (fewer wins better):
- 66: "You accidentally tried. This roster is too good to lose."
- 50: "Too competitive. The veterans keep stealing two points."
- 38: "Middling. The tank stalled in the standings."
- 26: "Now we are tanking. The lottery is in sight."
- 14: "A generational lottery position. Beautiful."
- 1: "Historic futility. The front office is thrilled."
- 0: "0-82. The Perfect Tank. This should be impossible."
