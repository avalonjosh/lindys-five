# Project Status, Reminders & Open Work

Last updated: 2026-09-30. This is the single source of truth for what is in flight, what is due, and where to resume. Keep it current: update it (commit + push) whenever an item ships, a date passes, or a new follow-up appears. Detailed roadmaps live in `docs/whatif-picks-roadmap.md` and `docs/nhl-offseason-plan.md`.

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
| Josh, open | Request Indexing in GSC, remaining 9 (daily quota hit 2026-09-30): MLB `/mlb/{giants,dodgers,whitesox,mariners,rockies,twins,diamondbacks,orioles,rays}`. Done 2026-09-30: `/nhl-playoff-odds`, `/nhl`, `/how-playoff-odds-work`, NHL `/nhl/{rangers,kings,kraken,lightning,predators,avalanche}`, `/mlb/nationals`. Optional: check the Datasets "non-critical issues" warning on `/nhl-playoff-odds` |
| Done 2026-09-30 | League opener check: all 32 team pages and the odds page flipped to live; Sabres at 0 GP show 59% and Projected "—". Fixed opening-week display bugs found in the check (odds flash before cut lines load, NaN PTS% and 0 pace at 0 GP, swapped set record order, early-season summary copy) |
| ~2026-10-25 (with the SEO re-measure) | GSC Page indexing: Soft 404 was 278 on 2026-09-30 (273 box scores with ~200 chars of server HTML, plus `/nhl/scores` from the offseason). Server summaries shipped 2026-09-30; check the count is falling, then click Validate Fix. Crawled-not-indexed (410) is 328 JS chunks (noise) plus noindexed recaps, box scores and the MLB team pages |
| 2026-10-01 | Sabres open at CBJ. Sabres' first game: check odds move continuously from the preseason number (Sabres preseason 59%, ~65% after a win, ~49% after a regulation loss) |
| 2026-10-02 noon UTC | Verify no game recap email went out for a preseason game |
| 2026-10-05 (email) | StubHub re-harvest: MLB postseason events (how-to below). Wild Card (12 games) done 2026-09-28. Division Series listings show opponent "TBD" until Wild Cards finish (~Oct 2), so harvest DS then, and LCS/WS as each is set; until then those buttons use the team ticket page |
| ~2026-10-10 | Check home page pass 1 in GA4: new-visitor engagement 61% -> 70%+ target; tracker/odds/scores share of home clicks ~21% -> 35%+ |
| 2026-10-10 (email) | Odds model check-in routine (computes all 32 teams, spot-checks live pages). Its prompt still says "30-game prior"; the model is 40 games plus team-specific priors now, ignore that wording |
| Oct 2026 | Re-check GSC after opening night. What-If picks season-start dry run (verify grading UX against real results) |
| 2026-11-04 (email) | Home page pass 2 due; build early-to-mid Nov |
| By 2026-11-23 | Send a gift guide test (`/api/cron/email-gift-guide?test=you@email&team=sabres`), then turn on Holiday Gift Guide in Admin > Newsletter (it sends Nov 24) |
| By Mar 2027 | Turn on NHL Clinch in Admin > Newsletter before the first clinches |
| 2026-12-07 (email) | StubHub re-harvest: MLB 2027 regular season |
| 2027-04-12 (email) | StubHub re-harvest: NHL playoffs (as each round is set) |
| First playoff night, Apr 2027 | Playoff crons (`playoff-game-recap`, `series-recap`) have never run for real; verify them. Bracket fetch fixed in a25ddd0 |
| Mid-Apr 2027 | Set 17 (4-game final set) recap fires once game 84 is final |
| Each NHL offseason | Regenerate the odds model's team priors: `npx tsx scripts/build-nhl-prior-pace.ts` (after the prior season ends). If skipped, the model silently falls back to league average and the preseason-to-game-1 jump returns |

## Open items (no date)

- **X auto-posting** (working since 2026-08-17): enable Auto Recharge with a spend cap on the X pay-per-use credits (~$0.20 per post with a URL), or posts fail silently ("X failed" badges in /admin/posts). Auto-publish toggles at /admin/posts may still be off.
- **Admin What-If tab**: click "Backfill Index" once on prod.
- **What-If account checks** on prod: post-save email prompt, /account hero on mobile and with no favorite, cross-device favorite sync.
- **Odds model**: one early-season game still swings odds ~15 pts (backtest does not support flattening more). League sum of odds early season is ~14.5 of 16 (cut-line floors). MLB pace-vs-talent display tension untouched.
- **Deliberately not changed** (flag only if it becomes a problem): quick-subscribe/account-signup are single opt-in; `incrementSendStat` read-modify-write race (stats only).
- **Possible future**: TeamTracker hydration refactor (~1.2s main thread on team pages).
- **Dev-only React warning** on NHL team pages: "Each child in a list should have a unique key" (render method of TeamTracker). Checked 2026-09-29: TeamTracker's own lists, the server summary and FAQ are all keyed; not found without a component stack (use React DevTools in a real browser). No production impact.
- **NHL Shop affiliate**: applied on Impact 2026-08-25, not needed (same inventory/rate as Fanatics). Ignore unless approved; don't nag.

## In-progress projects

### Where to watch (streaming affiliates, started 2026-09-28)
Built: `lib/watch/nhlWatch.ts` maps NHL API `tvBroadcasts` codes to networks and streaming services; `WhereToWatch` card on NHL box scores (upcoming/live); `/nhl/{team}/watch` guide pages (in sitemap, llms.txt, "How to Watch" button in team header); NHL recap email next-game block shows TV + links to the guide (on-site, so no affiliate links in email). Links go direct until `NEXT_PUBLIC_WATCH_{ESPN,MAX,PRIME,FUBO,YOUTUBETV,SLING,DIRECTV,SPORTSNETPLUS,TSNPLUS}_URL` is set in Vercel.
- **Josh to apply (no-betting vetted):** DirecTV / DirecTV Stream (CJ, biggest payouts), Fubo (Impact, US+CA, sportsbook shut 2022), Sling TV (CJ), Amazon Associates Prime Video bounties (Prime is local streaming home for CAR, ANA, CBJ, DAL, MIN, STL, SEA). Secondary: Max (Partnerize). YouTube TV has no program. Never ESPN (DraftKings exclusive sportsbook since Dec 2025, betting in the ESPN app): ESPN+ stays a plain informational link.
- **Status 2026-09-30:** Prime Video LIVE (`NEXT_PUBLIC_WATCH_PRIME_URL` set in Vercel to `https://www.amazon.com/b/?node=2858778011&tag=lindysfive-20`, Amazon Associates bounty; Amazon disclosure line shows on the Where to Watch card). DirecTV: applied on CJ, waiting to hear back. Sling: NOT listed on CJ (find its current network before retrying). Fubo: blocked, Impact declined the account's Marketplace access (no brand can be applied to); Impact home also flags a bank beneficiary name vs tax document mismatch and Finance setup 0%, which blocks payouts (Fanatics included). Josh to fix the finance details, then ask Impact support to re-review Marketplace access.
- NFL (shipped): `lib/watch/nflWatch.ts` maps ESPN broadcast names (CBS, FOX, NBC, ESPN/ABC, Prime Video, Netflix); Sunday afternoon CBS/FOX flagged regional with NFL Sunday Ticket. `/nfl/{pickSlug}/watch` guides (sitemap, llms.txt, How to Watch button on Pick the Team pages); NFL weekly email shows next game TV + guide link. Extra env vars: `NEXT_PUBLIC_WATCH_PARAMOUNT_URL`, `NEXT_PUBLIC_WATCH_PEACOCK_URL` (Paramount+ on Impact; Peacock program may be paused). FOX One not linked (unverified).
- MLB (shipped 2026-09-28, postseason): `lib/watch/mlbWatch.ts` parses Stats API `broadcasts` (combined names like "TBS/HBO MAX"; Spanish shown as a note). Where to Watch card on MLB box scores (upcoming/live; broadcasts fetched from the schedule endpoint). `/mlb/watch` "How to Watch the MLB Playoffs" guide (all rounds, FAQ), linked from /mlb, /mlb/playoff-odds (banner + footer), sitemap, llms.txt, and a "Playoffs on TV" button on MLB team headers Sep 20 to Nov 15. `NEXT_PUBLIC_WATCH_FOXONE_URL` added (FOX One lives at fox.com).
- MLB postseason mode (shipped 2026-09-28, mirrors NHL Playoff Journey): `MLBPlayoffJourney` replaces the regular-season view for playoff teams: "Road to the World Series" hero (postseason wins of 13 via Wild Card or 11 with a bye, World Series odds + rank, segmented per-round bar), one card per series (series score, series win odds, wins to clinch, regular-season H2H, game boxes with TV/tickets, next-game where to watch, gear after a series win). Regular season collapses under a toggle. Live refresh every 20s during games via `/api/mlb/postseason/{team}`. Odds: `lib/utils/mlbPostseasonOdds.ts` (win % + Pythagorean blend, 75% regression, small home edge, bracket walk); backtest `npx tsx scripts/backtest-mlb-postseason.ts` (2015-25, 101 series, Brier 0.2391 vs 0.2500 coin flip).
- Not done: regular-season MLB watch guides (next spring), regional network streaming specifics (team apps vary, we don't guess).

### NFL playoff odds (shipped 2026-09-28)
`lib/utils/nflOdds.ts` (opponent-adjusted point-margin rating, 10% carryover from last season faded over 14 games, 2-pt home field, 13.5-pt game SD, 10,000-sim season with NFL seeding; tiebreakers approximated), `lib/services/nflLeague.ts` (ESPN weekly scoreboards, 10-min cache; sim seeded by games-final so numbers only move after games). `/nfl/playoff-odds` (AFC/NFC tables, FAQ, Dataset JSON-LD; sitemap, llms.txt, SiteFooter) and a playoff-odds strip in each Pick the {Team} Season Outlook. Backtest `npx tsx scripts/backtest-nfl-odds.ts [--grid]` (2021-25, weeks 3-15): Brier 0.1307 vs 0.2461 base rate. Not yet: What-If picks moving the odds (would need client-side sims), NFL odds in emails/home card.

### Email affiliate conversion (started 2026-09-28)
Baseline (all emails ever, to 2026-09-28): 30 active subscribers (15 Sabres, 8 NFL fans, 2 Habs, 1 Yankees, 1 Nats, 3 no team); 738 delivered, 29 clicks, 0 tracked affiliate clicks. Site-wide ~25 affiliate clicks per 30 days. List size is the main lever.
- **Phase 1 (shipped):** email placements on every affiliate link (StubHub pubref suffix `_email-recap` etc., Fanatics subId2), webhook counts direct StubHub/Fanatics clicks, Partnerize placement report reads email placements. Gear card (`lib/emailOffers.ts`) in NHL game/set/playoff recaps, MLB recaps, digest (replaces footer link), welcome. Win recaps feature the star player (Fanatics player search). Ticket CTA points to the next home game. Welcome email now also sends after double opt-in and shows team gear + next home game.
- **Phase 2 (shipped, ON since 2026-09-28):** `email-nfl-weekly` cron, Tuesdays 14:00 UTC, one email per NFL team with subscribers after a game week (skips byes): score, record, gear card, Pick the {Team} link, next home game StubHub search. Gated by `blog:settings:nfl-weekly-enabled` (toggle in Admin > Newsletter). Preview: `?preview=1&team=packers`.
- **Phase 3 (shipped):** 82-0 / 162-0 result prompt now asks for a team (prefilled from favorites), so signups join a team recap list (source `ps-result`) instead of the general list. Team-colored inline "Get {Team} recaps" signup above Game Sets on NHL and MLB team pages (source `team-inline`, hidden once subscribed). Watch signups by source in Admin > Newsletter. Signed-in accounts (2026-09-29): every signup surface (team pages, home, blog, 82-0/162-0 prompt) checks `/api/newsletter/status` via `lib/useNewsletterStatus.ts`; hidden if already on that team's list or unsubscribed on purpose, otherwise a one-tap button that subscribes the account's own email (`/api/newsletter/account-subscribe`, source `account-one-tap` / `ps-result`). Signed-in path not yet click-tested on prod.
- **Phase 4 (shipped, off until enabled):** `email-gift-guide` (Nov 24 15:00 UTC yearly, once per team per year; gear card, category buttons, next home game tickets) and `email-clinch` (daily 12:30 UTC, NHL, first clinch per team per season; playoff gear + playoff tickets). Toggles `gift-guide-enabled` / `clinch-enabled` in Admin > Newsletter; both support `?preview=1&team=` and `?test=`.
- Measure: Admin > Newsletter affiliate clicks, Admin > Affiliates placements `email-*`.

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
