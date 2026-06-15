# NHL Offseason Mode & Next-Season Prep Plan

**Status:** Not started. Planning only.
**Captured:** 2026-06-08 (during the 2026 Stanley Cup Final).
**Primary build trigger:** the 2026-27 NHL schedule appearing in the NHL API (`club-schedule-season/{team}/20262027`), expected early-to-mid July 2026.

---

## Context / why this exists

The team tracker pages are built around a *live* season (playoff odds, points pace, 5-game sets, live standings). Once the Stanley Cup is awarded and the season ends, that live data is frozen and stale. Leaving "2025-26 playoff odds" up all summer is confusing to users and looks outdated to Google (it also works against the `dateModified` freshness signals we added). We need an explicit offseason state, plus a plan to stand up next season's pages the moment the new schedule data is available.

Important framing: the Cup Final is the **peak** attention moment of the NHL year, not the start of the lull. Do not flip anything to offseason mode until the Cup is actually awarded (typically mid-June). Ride the Final while it is live.

---

## NHL offseason calendar (typical year)

Search demand falls off a cliff once the Cup is handed out. The summer has only two real spikes:

| Window | Event | Traffic |
|--------|-------|---------|
| ~Mid-June | Stanley Cup awarded (Game 7 lands ~June 15-24) | Peak, then drops |
| Late June (~26-28) | NHL Draft | Spike, fanbase-driven |
| **July 1** | Free agency opens | **Biggest offseason spike** (~1 week of signings/trades) |
| July - late Aug | Dead zone | Almost nothing. Build-and-prep time |
| Mid-September | Training camps open | Attention climbing |
| Early October | Regular season opens (1st-2nd week) | Demand snaps back to full |

Treat the summer as a **build-and-position window, not a traffic window**.

---

## Key trigger dates

- **Cup awarded (~mid-June):** flip team pages to season-complete mode.
- **2026-27 full schedule release (~early-to-mid July, varies late June to late July):** the trigger to build/populate next season's tracker pages. Practically: watch for `20262027` data in the NHL API; stage the work so it can flip on the day the data lands.
- **Training camps (~mid-Sept):** start ramping pages back to live.
- **Opening night (~early Oct 2026):** full live tracker mode returns.

The NHL sometimes announces opening night / key dates slightly before the full game-by-game schedule.

---

## Phased offseason mode design

### Phase 1 - Season complete (mid-June to schedule release)
Flip team pages to a clear "season over" framing. No live-odds widgets pretending the season is ongoing.
- Final record, division/conference finish, playoff result.
- Short season-in-review summary.
- Backward-looking and honest.
- Lean the blog into the Draft and free agency (the only summer eyeballs).

### Phase 2 - Next-season prep (July, once schedule is in the API)
Build the 2026-27 tracker pages:
- Schedule grids and 5-game sets for 2026-27.
- "Way-too-early" preseason playoff odds (speculative projections off last year + roster changes).
- Captures early "[team] schedule 2026-27" and "[team] 2026-27 playoff odds" searches, which have low competition in the quiet period.

### Phase 3 - Ramp to live (mid-Sept to early Oct)
- Training camp through opening night: return pages to full live mode for the October start.

---

## Suggested page behavior (auto mode detection)

Rather than toggling modes by hand, the page should detect state from the NHL API and switch automatically:

- **Live:** current season has games in progress / upcoming -> full tracker (current behavior).
- **Complete:** current season schedule is fully played and no next-season schedule yet -> season-complete view.
- **Preseason:** next-season schedule exists in the API but games have not started -> schedule grid + way-too-early odds.

Design the detection so the transitions happen on their own as the API data changes (season ends, new schedule publishes, games start).

---

## SEO rationale (ties to the work done June 2026)

1. **Avoid staleness.** We added `dateModified` freshness signals; pages sitting on dead 2025-26 data all summer make that work against us. The season-complete reframe, then the 2026-27 refresh, keep pages legitimately current.
2. **Free demand in the quiet season.** "[team] schedule 2026-27" and way-too-early odds rank more easily in July-August when few are publishing.
3. **Crawl re-evaluation.** A genuine fresh-content event in July prompts crawlers to re-evaluate the pages, which also helps the broader site (including the MLB indexing situation) by signaling an active, maintained site.

---

## Net recommendation

Don't touch anything until the Cup is awarded. Then:
1. Season-complete mode immediately.
2. Lean on the Draft + July 1 free agency for the only summer traffic.
3. Stage the 2026-27 build so it can flip the day the schedule hits the API in July.
4. Ramp to full live mode by training camp.

The payoff is being indexed and ready when demand returns in October, not summer click counts.

---

## Other pages in offseason mode (added 2026-06-15)

The original plan was scoped to team tracker pages. These league-wide pages also needed offseason handling and now have it:

- **Team trackers (`/nhl/{team}`)** — DONE. Season-complete summary (final record, finish, playoff result), past-tense metadata/JSON-LD/sr-only, read-only 5-game sets, no live polling. Detection via `getSeasonState()` from the schedule.
- **Playoff odds (`/nhl-playoff-odds`)** — DONE. Was rendering a "Standings Unavailable" error in the offseason (`standings/now` is empty). Now falls back to final regular-season standings (schedule-derived last regular-season date), shows a champion banner, past-tense title/description/Dataset JSON-LD, and an offseason sr-only table (Playoff result column instead of probability).
- **Playoff bracket (`/playoffs`)** — DONE. Already rendered the completed bracket via the carousel endpoint, but conference routing silently piled every series into the East because standings were empty — fixed with the final-standings fallback. Added a champion crown banner, past-tense metadata with the champion's name, and dynamic season strings.
- **Scores (`/nhl/scores`)** — DONE. Offseason banner ("season complete, the {champion} won the Cup, games return in October") + past-tense title. Past box scores remain evergreen.

### Offseason NHL API realities (important)
- `standings/now` → **empty body** once the season is fully over. Use `standings/{lastRegularSeasonDate}` instead (derive the date from a team's schedule).
- `playoff-bracket/{season}` → **404s** in the offseason. Do NOT rely on it. Use `playoff-series/carousel/{season}` (works) for the bracket + champion.
- `club-schedule-season/{team}/{season}` → reliable all year; the backbone for season-complete detection and final records.
- Shared helpers: `lib/services/nhlOffseason.ts` (`getPlayoffsOutcome`, `getFinalStandings`), `lib/utils/seasonSummary.ts` (`getSeasonState`), `lib/utils/season.ts` (season-string formatting).

## Build checklist (for when we pick this up)

- [x] Add season-state detection (live / complete) driven by the NHL API. (preseason state still TODO for Phase 2)
- [x] Build the season-complete team-page view (final record, finish, playoff result, review).
- [x] Apply season-complete mode to the odds, bracket, and scores pages (see section above).
- [ ] Confirm the NHL API exposes `20262027` schedule; wire team pages to the new season.
- [ ] Build 2026-27 schedule grids + 5-game sets.
- [ ] Add "way-too-early" preseason playoff odds (projection model off prior season + roster changes).
- [ ] Update titles/metadata/JSON-LD years (2025-26 -> 2026-27) across team pages, hubs, odds pages, sitemap, llms.txt.
- [ ] Draft + free agency blog coverage plan.
- [ ] Re-check GSC after the July refresh (indexing + freshness).
