# Perfect Season (162-0 / 82-0) — Build Progress and Handoff

This file is the durable "where we left off" record for the Perfect Season games.
It is committed to git so it survives local file loss. Read this first when
resuming. Last updated: 2026-06-04.

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
| 3 | Free Play Standard UI | DONE; restyled + redesigned to nhl82.ca one-page board; awaiting phone walkthrough |
| 4 | Daily plumbing and quiet ship | NOT STARTED (next) |
| 5 | Tank and Franchise (free play) | not started |
| 6 | Blind mode (BallIQ) | not started |
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
