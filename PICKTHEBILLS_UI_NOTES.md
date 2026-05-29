# Pick the Bills — UI / Layout Notes (not yet implemented)

Working notes for the next session. The 8-phase build is code-complete and on
`feature/pickthebills`. This file captures the UI/layout ideas we reviewed but
have NOT built yet, so the work can continue on another machine.

## Where the feature stands

- All 8 build phases committed and pushed to `origin/feature/pickthebills`.
- `npx tsc --noEmit` clean.
- Read path verified live against the Neon DB: 2026 schedule ingested (17 games),
  all three public routes return correct shapes, leaderboard cold-cache fallback
  computes, `/pickthebills` renders.
- A real **Season Baseline** window was created in the DB (id starts `a70d0183`,
  locks at Week 1 kickoff 2026-09-13). The pick screen now surfaces it as the
  open window.
- NOT yet verified (needs a browser + reversible writes): the Google-login
  pick/claim flow, the 409 overwrite modal, grading end-to-end (flip a game to
  final, trigger cron, revert), and the past-kickoff lock guard.

## UI problems found (from screenshots of the current page)

1. **Mobile (390px) layout bug — must fix.** The Win/Loss buttons and the
   "Create a free account" CTA clip off the right edge. The row content overflows
   the viewport. Fix: stack each game row to two lines on mobile (matchup on top,
   full-width segmented Win/Loss pill below); make the CTA full-width.
2. **Desktop dead space.** The Win/Loss buttons float far right with a large
   empty gap from the team name (card is `max-w-3xl`). The 17-row list is
   monotonous.

## Decided polish pass (lightweight)

Keep current structure (header, tabs, one card), refine it:

- Narrow the card (`max-w-3xl` -> `max-w-2xl`) so the control sits near the matchup.
- Replace the two separate Win/Loss buttons with **one segmented pill** (selected
  half fills Bills blue `#00338D` for Win, red `#C60C30` for Loss).
- Cleaner window banner with a lock icon.
- Row hover + tighter vertical rhythm.

Desktop mockup (polish only):

```
╭────────────────────────────────────────────────────────────╮
│  🔓 Season Baseline                  locks Sun Sep 13, 1:00 PM│
├────────────────────────────────────────────────────────────┤
│  WK 1                                  ┌─────────┬─────────┐ │
│  @ Houston Texans                      │   WIN   │  LOSS   │ │
│  Sun Sep 13 · 1:00 PM ET               └─────────┴─────────┘ │
├────────────────────────────────────────────────────────────┤
│  WK 2   vs Detroit Lions  ...          ┌─────────┬─────────┐ │
╰────────────────────────────────────────────────────────────╯
```

## Bigger idea: borrow the team-tracker design language

Reference: `components/TeamTracker.tsx`. Its design DNA:

1. Bold team-colored header: solid `team.colors.primary` background, thick
   `border-b-4` in the secondary color, centered **logo**, "Lindy's Five" in
   Bebas Neue, a subtitle, and a tagline. `max-w-7xl mx-auto px-4 py-3 md:py-4`.
2. A **hero summary bar** right under the header (the `ProgressBar`): the season
   story at a glance (projected points vs the playoff target) with a share button.
3. A vertical stack of `rounded-lg border-2` cards, content grouped into
   **5-game "sets"** (the "Lindy's Five" concept).
4. Team colors everywhere; mobile-first with `md:` breakpoints.

How each maps onto Pick the Bills:

| Tracker element | Pick the Bills version |
|---|---|
| Team-colored header + logo + Bebas wordmark + tagline | Bills-blue header, red `border-b-4`, Bills logo, "Pick the Bills" wordmark, tagline. Aligns it with the rest of the site (today it is a one-off gradient). |
| Hero `ProgressBar` | **Projected-record hero bar** ("You're calling 13-4") that updates live as you toggle picks. The radio-segment hook, and the single strongest borrow. |
| 5-game-set card grouping | Group the 17 picks into sets/chunks as cards instead of one flat 17-row list. Mirrors "Lindy's Five" literally and breaks up the monotony. |
| `border-2` rounded cards, team colors | Same card treatment plus the segmented Win/Loss pill. |

Desktop mockup (full tracker-style version):

```
┌────────────────────────────────────────────────────────────────┐
│                          🦬 (Bills logo)                         │   solid Bills-blue
│                        PICK THE BILLS                            │   header, red border-b-4
│              Call every game. Climb the leaderboard.             │   Bebas Neue wordmark
└────────────────────────────────────────────────────────────────┘
   ┌ Make Picks ┐  ┌ Leaderboard ┐

   ╭──────────────────────────────────────────────────────────────╮
   │  YOUR CALL          Projected record  ▸  13 – 4               │   hero summary bar
   │  ████████████████████████████░░░░  Season Baseline · locks 9/13│   (mirrors ProgressBar)
   ╰──────────────────────────────────────────────────────────────╯

   SET 1 · WEEKS 1–5                                                    set grouping
   ╭──────────────────────────────────────────────────────────────╮
   │  WK 1   @ Houston Texans      Sep 13   ┌────────┬────────┐     │
   │                                        │  WIN   │  LOSS  │     │
   │  WK 2   vs Detroit Lions      Sep 17   ┌────────┬────────┐     │
   │  … weeks 3–5 …                                                 │
   ╰──────────────────────────────────────────────────────────────╯
   SET 2 · WEEKS 6–10  … (sets 3 & 4 follow; playoffs are their own slot)

   ╔══════════════════════════════════════════════════════════════╗
   ║            Create a free account to save your picks            ║
   ╚══════════════════════════════════════════════════════════════╝
```

## Open decisions before building the bigger version

- **Scope:** Josh selected "fix mobile + polish layout." The set-grouping and
  projected-record bar are NEW features, not just layout. Decide whether to do
  the full tracker-style version or just the header restyle + card treatment.
- **Bills logo asset:** the tracker pulls NHL logos from `assets.nhle.com`. Bills
  is NFL, so the header needs a local file in `public/` or an ESPN CDN URL.
  Confirm which logo to use.
- **Which pieces to adopt:** header restyle / projected-record hero bar /
  5-game-set grouping / card treatment / all of it.

## Product defaults still to confirm (baked into code already)

- Ties (`T`) excluded from grading entirely.
- Qualification threshold = `ceil(final games / 2)`.
- Pick history pages are fully public (`/pickthebills/u/{userId}`).

## Relevant files

- Page: `app/pickthebills/page.tsx`, `app/pickthebills/u/[userId]/page.tsx`
- Client UI to change: `components/pickthebills/PickTheBillsClient.tsx`,
  `components/pickthebills/PickHistoryClient.tsx`
- Reference design: `components/TeamTracker.tsx` (header ~720-905, ProgressBar
  usage ~906-936), `components/scores/...`, `lib/teamConfig.ts` (NHL only).
- Public routes: `app/api/pickthebills/{games,leaderboard,history}/route.ts`

## Environment note

Local `DATABASE_URL` points at the single Neon DB `neon-teal-lighthouse` (Free
tier) — the same one production will use once merged. There is no separate dev
branch, so treat writes as semi-permanent. Disk on the dev machine was nearly
full (~2 GB free); clear `.next` cache and Chrome caches if tooling fails.
