# Lindy's Five: Expansion Strategy & Roadmap

## Context

The NHL regular season ends soon, followed by playoffs through mid-June. After that, there's a ~3 month dead zone before the next NHL season. The site currently generates almost no revenue ($6 total from one StubHub conversion). The probability model uses a logistic S-curve — decent but less credible than Monte Carlo sites like MoneyPuck. The codebase is tightly coupled to NHL/Sabres, but the Bills pattern (separate crons, ESPN API) proves multi-sport is feasible. The Upstash KV free tier (500K daily commands) is already maxed out — any expansion will make this worse.

---

## Key Recommendations

### 1. Probability: Source from APIs, don't build Monte Carlo

**Do:** Fetch pre-computed probabilities from MoneyPuck (NHL) and FanGraphs (MLB) via daily cron jobs. Display them with attribution ("Powered by MoneyPuck"). Keep the existing logistic model for the interactive "what-if" breakdown tables — label those as "Lindy's Five projections."

**Don't:** Build a Monte Carlo simulation. The accuracy gap between the current logistic model and Monte Carlo is 5-15% for bubble teams. Closing that gap requires modeling strength-of-schedule, goal differential distributions, injury effects, and inter-team dependencies. MoneyPuck has a team of data scientists calibrating their model — we'd build an inferior version and spend weeks doing it.

**Why this works:** The 5-game chunk concept is the brand differentiator, not the probability model. Users come for the tracker visualization, not to compare probability formulas. Sourcing credible probabilities legitimizes the site immediately at near-zero development cost.

**Implementation:** One new cron job per sport, one new KV key pattern (`probability:{sport}:{team}:{date}`), one new API route to serve cached data. ~1-2 days of work.

### 2. MLB Expansion: Launch by August 2026

**MVP scope:**
- 30 MLB team configs (colors, logos, slugs, StubHub IDs)
- MLB Stats API integration (`statsapi.mlb.com/api/v1/` — free, no auth)
- 5-game chunk calculator adapted for 162 games (32 chunks per team)
- Standings + FanGraphs-sourced probabilities
- Game recaps via Claude (same pattern as NHL crons)
- Team tracker pages at `/mlb/[team]`
- Scores page at `/mlb/scores`

**Key differences from NHL:**
- 162 games (vs 82) — more chunks, more content, more API calls
- Win/loss only (no OT loss point) — simpler standings math
- Different playoff format: 12 teams, Wild Card best-of-3, DS best-of-5, LCS/WS best-of-7
- Different stats: ERA, OPS, batting avg vs goals, saves, PP%
- Games nearly every day — higher content volume

**What's reusable:** ChunkCard.tsx (with adjusted thresholds), ProgressBar.tsx, newsletter system, email templates, admin dashboard, blog system, affiliate link infrastructure.

**Target threshold for "playoff pace":** ~90 wins (historically, 88-92 wins is the wild card bubble). This replaces the 96-point target from NHL.

### 3. Routing: Restructure to `/nhl/[team]` and `/mlb/[team]`

**Current:** `/[team]` catches all 32 NHL slugs at root level.

**Problem:** Slug collisions. NHL has `rangers` (New York Rangers). MLB has Texas Rangers. Can't share a namespace.

**Plan:**
- `/nhl/[team]` — all 32 NHL team pages
- `/mlb/[team]` — all 30 MLB team pages
- `/[team]` — keep as redirect middleware: lookup slug in NHL first, then MLB, then 404. Preserves SEO for existing NHL URLs via 301 redirects.
- `/` — multi-sport hub showing whichever sport is in-season (or both)
- `/nhl/scores`, `/mlb/scores` — sport-specific scores pages
- `/blog/nhl`, `/blog/mlb` — sport-filtered blog views

**Team config restructure:**
```
lib/nhl/teamConfig.ts  — 32 NHL teams (move existing)
lib/mlb/teamConfig.ts  — 30 MLB teams (new)
lib/teamConfig.ts      — re-export both + unified lookup helpers
```

Add `sport: 'nhl' | 'mlb'` field to `TeamConfig` interface.

### 4. KV Usage: Move analytics off Upstash before expanding

**The math:** Currently ~11 KV commands per pageview at 500K limit. Adding 30 MLB teams with higher game frequency will easily 3x the load. Must fix before MLB launch.

**Options (pick one):**
- **Plausible Analytics** ($9/mo) — privacy-friendly, hosted, zero KV commands
- **Vercel Web Analytics** — free tier, built into Vercel, zero KV commands
- **Vercel Postgres** — move analytics writes to SQL (better for aggregation anyway)

**Recommendation:** Switch to Vercel Web Analytics for pageview/visitor tracking (free, built-in). Keep KV only for: blog posts, newsletter subscribers, probability cache, cron dedup flags. This eliminates ~70% of KV commands.

### 5. Monetization: Three things to add now

**a) Fanatics Affiliate (merch)**
- Fanatics is the official NHL + MLB licensed merch partner
- Affiliate program via CJ Affiliate or Impact pays 5-10% commission
- Add "Shop Gear" links on team pages, in blog post footers, in newsletter emails
- Higher conversion potential than tickets (lower price point, impulse buys)

**b) Amazon Associates (merch fallback)**
- 3-4% commission on team jerseys, hats, memorabilia
- Easier approval than Fanatics, broader inventory
- Good fallback if Fanatics application takes time

**c) Newsletter growth → sponsorships**
- At 1,000+ subscribers: approach sports newsletter sponsors via Swapstack/Paved
- Sports newsletter CPM: $25-50 (revenue per 1,000 subscribers per send)
- At 2,000 subscribers sending 2x/week: $200-400/month potential
- Focus on subscriber growth now, monetize later

**Realistic near-term revenue:** $100-300/month from affiliates + ads. Enough to cover Upstash Pro ($10), Plausible ($9), domain, and justify continued development.

### 6. Brand: Keep "Lindy's Five"

The name works. Most users associate "Five" with the 5-game chunk concept, not Lindy Ruff. The 5-game set works for any sport. Don't rebrand — it costs SEO equity and confuses users. Evolve the tagline from "NHL Playoff Odds" to something like "Track every season, five games at a time."

---

## Phased Timeline

### Phase 0: Playoffs (Now → mid-June 2026)
- **Do nothing disruptive.** Let playoff crons run, enjoy traffic.
- Research MLB API in parallel (draft team configs, test endpoints)
- Apply for Fanatics + Amazon Associates affiliate programs
- Start growing newsletter subscriber count

### Phase 1: Off-Season Infrastructure (Mid-June → July 2026)
- Move analytics off KV (Vercel Web Analytics or Plausible)
- Restructure routing: `/nhl/[team]`, `/mlb/[team]` with redirects
- Restructure team config: separate NHL/MLB files, add `sport` field
- Generalize types: rename `sabresScore` → `teamScore`, namespace KV keys
- Add MoneyPuck probability sourcing cron for NHL
- Integrate Fanatics/Amazon merch affiliate links on team pages + emails

### Phase 2: MLB Launch (August 2026)
- MLB API integration (`lib/services/mlbApi.ts`)
- 30 MLB team configs
- MLB chunk calculator (162-game season, adjusted thresholds)
- FanGraphs probability sourcing
- MLB cron jobs (game recaps, set recaps, weekly roundups)
- MLB scores + team pages
- Target: Live before September pennant races

### Phase 3: Grow & Monetize (September 2026+)
- Two sports live simultaneously (MLB September + NHL preseason October)
- Cross-promote: NHL subscribers see MLB content and vice versa
- Newsletter sponsorship outreach at 1K+ subscribers
- Evaluate display ads if traffic supports minimums
- Off-season content: draft coverage, free agency trackers

### Future (2027+)
- NBA expansion (82-game season, same chunk model)
- NFL expansion (generalize Bills pattern to all 32 teams)
- Premium newsletter tier
- Mobile app (if traffic justifies)

---

## Files That Will Need Changes

| File | Change | Phase |
|------|--------|-------|
| `lib/teamConfig.ts` | Split into `lib/nhl/teamConfig.ts` + `lib/mlb/teamConfig.ts` | 1 |
| `app/[team]/page.tsx` | Redirect layer → `/nhl/[team]` | 1 |
| `lib/types.ts` | Rename `sabresScore`, add `sport` field to `BlogPost` | 1 |
| `components/analytics/PageTracker.tsx` | Remove (replaced by Vercel Analytics) | 1 |
| `app/api/analytics/track/route.ts` | Remove (replaced by Vercel Analytics) | 1 |
| `lib/utils/playoffProbability.ts` | Keep as-is; add adapter for sourced probabilities | 1 |
| `lib/services/mlbApi.ts` | New — MLB Stats API client | 2 |
| `lib/utils/chunkCalculator.ts` | Generalize for variable season length | 2 |
| `app/mlb/[team]/page.tsx` | New — MLB team tracker pages | 2 |
| `app/api/cron/mlb-game-recap/route.ts` | New — MLB content pipeline | 2 |
