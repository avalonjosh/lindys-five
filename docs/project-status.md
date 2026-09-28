# Project Status, Reminders & Open Work

Last updated: 2026-09-28. This is the single source of truth for what is in flight, what is due, and where to resume. Keep it current: update it (commit + push) whenever an item ships, a date passes, or a new follow-up appears. Detailed roadmaps live in `docs/whatif-picks-roadmap.md` and `docs/nhl-offseason-plan.md`.

## Working conventions (for Claude)

- **"lets continue"** (or "pick up where we left off") with no other context: open this file, verify repo state with `git log -1` and `git status`, report the current resume point briefly, then work its to-do list in order. Anything needing Josh's approval (push, KV write) still gets asked; everything else proceeds.
- **Current resume point:** Home page redesign pass 2 (see below), plus the dated reminders.
- **No em dashes** in any prose written for Josh (plans, commit bodies, docs, UI copy). Use commas, periods, parentheses. Code is unaffected.
- When a new session starts after one of the dates below, remind Josh the item is due and offer to do it.

## Dated reminders

Cloud routines on Josh's claude.ai account email him at 9am ET for the items marked (email). Manage them at https://claude.ai/code/routines.

| Date | Item |
|------|------|
| Done 2026-09-28 | SEO re-measure (GSC 8/27-9/25): 467 clicks / 59k impr / pos 20.9 vs baseline pace ~138 / 39k per 30d (90d: 414 / 118k / 20.8). Prior 30d 245 clicks. Gains mostly /82-0 (173) and /pick-the-* pages. `/nhl-playoff-odds` impr 59 -> 4.6k but pos 36.7. 9 of 10 watched MLB pages plus /nhl/lightning and /nhl/predators still have zero impressions. Next re-measure ~2026-10-25 (baseline: this row) |
| Josh, open | Request Indexing in GSC for `/nhl-playoff-odds`, `/nhl`, `/how-playoff-odds-work`, NHL `/nhl/{rangers,kings,kraken,lightning,predators,avalanche}`, MLB `/mlb/{nationals,giants,dodgers,whitesox,mariners,rockies,twins,diamondbacks,orioles,rays}` |
| 2026-09-29 | League opener (MTL at TOR) |
| 2026-10-01 | Sabres open at CBJ. First live day of the 84-game season: watch team pages flip preseason -> live, and check odds look continuous (Sabres preseason 59%, ~65% after a win, ~49% after a regulation loss) |
| 2026-10-02 noon UTC | Verify no game recap email went out for a preseason game |
| 2026-10-05 (email) | StubHub re-harvest: MLB postseason events (how-to below) |
| ~2026-10-10 | Check home page pass 1 in GA4: new-visitor engagement 61% -> 70%+ target; tracker/odds/scores share of home clicks ~21% -> 35%+ |
| 2026-10-10 (email) | Odds model check-in routine (computes all 32 teams, spot-checks live pages). Its prompt still says "30-game prior"; the model is 40 games plus team-specific priors now, ignore that wording |
| Oct 2026 | Re-check GSC after opening night. What-If picks season-start dry run (verify grading UX against real results) |
| 2026-11-04 (email) | Home page pass 2 due; build early-to-mid Nov |
| 2026-12-07 (email) | StubHub re-harvest: MLB 2027 regular season |
| 2027-04-12 (email) | StubHub re-harvest: NHL playoffs (as each round is set) |
| First playoff night, Apr 2027 | Playoff crons (`playoff-game-recap`, `series-recap`) have never run for real; verify them. Bracket fetch fixed in a25ddd0 |
| Mid-Apr 2027 | Set 17 (4-game final set) recap fires once game 84 is final |
| Each NHL offseason | Regenerate the odds model's team priors: `npx tsx scripts/build-nhl-prior-pace.ts` (after the prior season ends). If skipped, the model silently falls back to league average and the preseason-to-game-1 jump returns |

## Open items (no date)

- **X auto-posting** (working since 2026-08-17): enable Auto Recharge with a spend cap on the X pay-per-use credits (~$0.20 per post with a URL), or posts fail silently ("X failed" badges in /admin/posts). Auto-publish toggles at /admin/posts may still be off. Consider adding "no em dashes" to `TWEET_SYSTEM_PROMPT` in `lib/utils/postToX.ts`.
- **`RESEND_WEBHOOK_SECRET`**: set in Vercel (from Resend webhook settings) to activate webhook signature verification. From the 2026-08-31 audit; not confirmed done.
- **Admin What-If tab**: click "Backfill Index" once on prod.
- **What-If account checks** on prod: post-save email prompt, /account hero on mobile and with no favorite, cross-device favorite sync.
- **Odds model**: one early-season game still swings odds ~15 pts (backtest does not support flattening more). League sum of odds early season is ~14.5 of 16 (cut-line floors). MLB pace-vs-talent display tension untouched.
- **Old ~8 stranded June 2026 blog drafts** (two with leaked `<cite>` tags in titles) from when content generation was down.
- **Deliberately not changed** (flag only if it becomes a problem): quick-subscribe/account-signup are single opt-in; `incrementSendStat` read-modify-write race (stats only).
- **Possible future**: TeamTracker hydration refactor (~1.2s main thread on team pages).
- **NHL Shop affiliate**: applied on Impact 2026-08-25, not needed (same inventory/rate as Fanatics). Ignore unless approved; don't nag.

## In-progress projects

### Home page redesign
Pass 1 + polish shipped (3683e04, d6afd42, 770de48). Mockup canvas: https://claude.ai/artifact/LaBeaTyxRko4H3SERSqASK (re-read for Josh's comments before building).

**Pass 2 to do:** a "race right now" block with an auto-written headline, and a season-aware lead block (`resolveSeasonContext`). Measure pass 1 first (targets above).

Agreed layout: slim header + pitch; Today's puzzles; Your team card; "The race right now" (seasonal); Tonight strip; NHL / MLB / NFL pick-the-team row; personalized email signup (hidden if subscribed); SiteFooter. Blocks render only with real content; server-render shared blocks, hydrate per-visitor blocks into reserved space (protect Lighthouse ~94).

Unbuilt review ideas: puzzle cards stretch to Your Team height, scoreboard link into header row, bigger logo, footer 7px misalignment.

Data behind it (GA4 + GSC, 90d to 2026-09-23): ~75% of home clicks go to /82-0 + /162-0, ~14% to /nhl + /mlb cards, ~7% to /nhl/scores. Returning visitors 93% engaged vs new 61%.

### NHL odds model (see CLAUDE.md "Common Patterns")
Rebuilt 2026-09-08 (3603b74), retuned 2026-09-09, and made continuous preseason-to-live 2026-09-28 (465fe09): team-specific priors (`lib/data/nhlPriorPace.ts`, 30% carryover of last season), early talent-uncertainty widening (0.12), projection-ranked cut lines, preseason odds = live model at 0 GP. Backtest Brier 2023-24/24-25/25-26: 0.0993 / 0.1151 / 0.1596. Always backtest 2+ seasons before tuning (`scripts/backtest-nhl-odds.ts`, supports `--prior league|team` and `--carry`). Rejected variants: carry 0.62, talent sd 0.16-0.20, prior games 30/55, K 0.13/0.17, flat path multipliers, union-of-paths.

### NHL 84-game season
2026-27 is 84 games (CBA). Constants scale by season length (73d11d1). Remaining risk is behavioral: watch opening week.

### What-If picks
Full roadmap in `docs/whatif-picks-roadmap.md` (source of truth). Next options: settings phase 2, MLB port, Bills picks page, save nudge.

### Perfect Season games (/162-0, /82-0)
Spec: `perfect_season_build_spec_v3.md`. Owner overrides of the spec (do not revert): MLB shield logo in the 162-0 header with trademark/not-affiliated footer; MLB-blue header palette. Rebuilding MLB data needs the gitignored Lahman CSVs in `raw-data/lahman/` (not in git; copy from the old computer if needed).

## Recurring task: StubHub event re-harvest

Game "Get Tickets" buttons deep-link to exact StubHub events via `lib/affiliate/stubhubEvents.ts`, generated by `scripts/build-stubhub-events.mjs` from `scripts/data/stubhub-{nhl,mlb}-YYYY-YY.txt`. Fallback: StubHub search, then team page. Coverage: NHL 2026-27 all US venues (7 Canadian venues use search fallback); MLB 2026 through Sep 27.

How to harvest (StubHub blocks server fetches, so use Claude in Chrome on Josh's browser):
- Open `https://www.stubhub.com/{city-team}-tickets` per team (Athletics: `oakland-athletics-tickets`; Utah: `utah-hockey-club-tickets/performer/150310185`). One team per browser_batch call; three tabs in parallel works.
- In-page JS: collect `a[href*="/event/"]`, parse `tickets-M-D-YYYY/event/ID`; team text patterns like `CBJBlue Jackets@BUFSabresHome` (NHL) and `Sep8TueRockies@YankeesHome` (MLB). Click "Next page" until stale. Accumulate in localStorage; dump in ~28-line chunks. Skip parking/season-ticket listings.
- Write `id|MMDD|AWAY@HOME[|P]` lines, run `node scripts/build-stubhub-events.mjs`, `npx tsc --noEmit`, commit, ask before push. New MLB season file: `scripts/data/stubhub-mlb-2027-28.txt` (Aug-Dec = start year).
- Josh decided not to ask StubHub for a feed; don't suggest it again.

## Affiliate stack (current, don't re-research)
Tickets: StubHub via Partnerize (4% flat). Merch: Fanatics via Impact (8%, primary; `lib/affiliate/fanaticsTeams.ts`, `NEXT_PUBLIC_FANATICS_DEEPLINK`), Amazon secondary on `/gear`. Reporting: Admin > Affiliates tab (`lib/services/affiliateNetworks.ts`); weekly `affiliate-summary` email Mondays 9am ET.

## Setting up a new computer

- `git clone`, `npm install`.
- Env: `.env` and `.env.local` are not in git. Pull with `npx vercel env pull .env.local` (after `npx vercel link`), or copy from the old machine. `USER_SESSION_SECRET` needs a dev value locally or account flows 500.
- Optional: `raw-data/lahman/` (Perfect Season data rebuilds only).
- Backtest snapshots cache in `node_modules/.cache/nhl-backtest/` (refetched automatically).
- Disk: dev server logs and Lighthouse runs filled the old machine's disk. Run `npx next dev > /dev/null` and check `df -h /` before long sessions.
