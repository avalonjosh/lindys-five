# Lindy's Five - NHL Playoff Tracker

## Project Overview
NHL playoff odds tracker and scores site. Tracks playoff probability for all 32 NHL teams with 5-game set analysis, live scores, box scores, and standings.

**URL:** https://www.lindysfive.com (canonical host is `www`; the apex 301-redirects to it)

## Tech Stack
- **Framework:** Next.js (App Router)
- **Styling:** Tailwind CSS (utility classes, no CSS modules)
- **Deployment:** Vercel (push to `main` auto-deploys)
- **Data:** Vercel KV, Vercel Blob
- **APIs:** NHL API (proxied through `/api/nhl-api/*` -> `api-web.nhle.com/v1/*`)
- **Analytics:** Google Analytics (GA4, ID: G-ZQRG7XK9D6)
- **Email:** React Email + Resend
- **Auth:** bcryptjs (password hashing) + jose (JWT tokens)

## Key Directories
- `app/` - Next.js routes, namespaced by sport (`app/nhl/*`, `app/mlb/*`) plus games (`app/82-0`, `app/162-0`), blog, admin
- `app/nhl/scores/[gameId]/`, `app/mlb/scores/[gameId]/` - Box score pages
- `app/admin/` - Admin dashboard (analytics, posts, outreach, newsletter)
- `app/api/cron/` - Automated cron jobs (game recaps, set recaps, news scans)
- `components/scores/boxscore/` - Box score components (GameHeader, ScoringTimeline, PlayoffImpact, etc.)
- `lib/services/` - API fetching (nhlApi.ts, boxscoreApi.ts)
- `lib/utils/` - Utilities (playoffProbability.ts, auth.ts, etc.)
- `lib/teamConfig.ts` - All 32 NHL team configs (colors, abbreviations, etc.)
- `lib/email.ts` - All email templates and sending logic
- `lib/types/` - TypeScript interfaces

## Coding Conventions
- Always use TypeScript
- Use Tailwind utility classes for styling (no inline CSS unless dynamic values)
- Responsive design: mobile-first, use `sm:` breakpoints (e.g., `text-xs sm:text-sm`, `p-3 sm:p-5`)
- All dates/times displayed in Eastern Time, not UTC
- Use `fetchWithRetry` from `lib/services/nhlApi.ts` for NHL API calls
- Team colors come from `lib/teamConfig.ts` via team abbreviation lookup

## Preferences
- Don't add gambling/betting advertising or affiliate links
- Keep UI clean and minimal - avoid over-engineering
- When investigating issues, check if it's mobile AND desktop before assuming one or the other
- Always type-check with `npx tsc --noEmit` before committing
- Commit messages should be concise and descriptive
- Don't create documentation files unless explicitly asked
- Don't add comments, docstrings, or type annotations to code that wasn't changed

## Git Workflow
- Solo project — push directly to `main`, no PRs
- **Always ask before pushing** — never run `git push` without explicit user approval
- Push to `main` triggers Vercel deploy automatically
- Run `npx tsc --noEmit` before pushing to catch type errors

## NHL API Endpoints
All endpoints use base URL `https://api-web.nhle.com/v1` (proxied through `/api/v1/*` -> `/api/nhl-api/*` -> NHL API).

| Endpoint | Purpose |
|----------|---------|
| `/schedule/{date}` | All games for a date (gameWeek array with scores, states) |
| `/club-schedule-season/{teamAbbrev}/{season}` | Team's full season schedule |
| `/club-schedule/{team}/week/{date}` | Team's weekly schedule |
| `/gamecenter/{gameId}/boxscore` | Box score: player stats, team scores, SOG |
| `/gamecenter/{gameId}/landing` | Scoring summary, three stars, penalties, matchup data |
| `/gamecenter/{gameId}/play-by-play` | Play-by-play events (penalties, PP/PK) |
| `/gamecenter/{gameId}/right-rail` | Season series, team stats with league ranks, last 10 record |
| `/standings/{date}` | League-wide standings for a specific date |
| `/roster/{teamAbbrev}/current` | Current team roster |

**Rate limiting:** Max 4 concurrent requests, 100ms min gap (~10 req/s max), exponential backoff on errors.

**Game states:** `FUT` (future), `PRE` (pre-game), `LIVE` (in progress), `CRIT` (critical/late game), `FINAL` (finished), `OFF` (official final).

## Known Gotchas
- `w-0` div trick for border-radius rounding doesn't work — use conditional `rounded-lg` vs `rounded-l-lg` instead
- `overflow-hidden` on parent containers clips child shadows and tooltips — use React portals (`createPortal`) for tooltips that need to escape overflow (see ScoringTimeline.tsx)
- OT goals in filtered arrays need the original `allGoals` index for ID matching, not the filtered array index
- StandingsSnapshot: use conditional rendering (`{expanded && ...}`) not CSS collapse (`max-h-0 opacity-0`) to avoid hidden content causing page overflow

## Common Patterns
- Box score components receive team abbreviations and use `teamConfig.ts` for colors
- Playoff probability uses `computePositionAwareProbability()` from `lib/utils/playoffProbability.ts`
- Live game polling: 15s intervals, stop when game transitions to FINAL
- Portal pattern for tooltips that need to escape `overflow-hidden` containers (see ScoringTimeline.tsx)

## Box Score Page Layout
**Future games (`FUT`/`PRE`):** GameHeader (with ticket CTA) -> PlayoffImpact -> StandingsSnapshot -> SkaterMatchup -> GoalieMatchup -> TeamStatsPreview -> SeasonSeries

**Live/Final games:** GameHeader -> PlayoffImpact -> StandingsSnapshot -> ScoringTimeline -> SeasonSeries -> ThreeStars (final only) -> ScoringPlays -> TeamComparison -> PlayerStatsTable (away) -> PlayerStatsTable (home) -> GoalieStatsTable -> PenaltySummary

## Admin & Newsletter System
**Admin auth:** Password verified against `ADMIN_PASSWORD_HASH` env var via bcrypt. JWT token (24h expiry) stored in HTTP-only secure cookie. Routes protected by `AdminAuthWrapper` component.

**Admin sections:** Analytics, Posts (blog CRUD + cron triggers), Outreach (contacts), Newsletter (subscriber management + email sending).

**Environment variables needed:** `ADMIN_PASSWORD_HASH`, `ADMIN_SESSION_SECRET`, `RESEND_API_KEY`, `NEXT_PUBLIC_SITE_URL`, `CRON_SECRET`.

## Cron Jobs

All crons are configured in `vercel.json` and authorized via `CRON_SECRET` Bearer token. Admin can manually trigger any cron via `POST /api/cron/trigger`.

| Cron | Schedule (UTC) | Purpose |
|------|---------------|---------|
| `game-recap` | `0 4 * * *` (4am daily) | Generate blog post for completed Sabres games (last 48h). Uses Claude to write 400-600 word recap from boxscore/play-by-play data. Auto fact-checks before publishing. |
| `set-recap` | `0 11 * * 0` (11am Sundays) | Generate blog post for completed 5-game sets. 600-900 word analysis. Accepts optional `setNumber` and `force` params. |
| `weekly-roundup` | `0 10 * * 1` (10am Mondays) | Generate 600-900 word weekly recap of Sabres games (Mon-Sun). |
| `news-scan` | `0 10 * * 2,5` (10am Tue/Fri) | Search for Sabres news via Claude web search. Importance >= 7 only. Jaccard similarity (40%) for dedup against recent stories. |
| `bills-game-recap` | `0 5,10 * * 1` (5am+10am Mon) | Bills game recaps from ESPN API data. |
| `bills-weekly-roundup` | `0 10 * * 1` (10am Mondays) | Bills weekly roundup. Detects NFL season vs offseason. |
| `bills-news-scan` | `0 10 * * 2,5` (10am Tue/Fri) | Bills news scan (same pattern as Sabres). |
| `email-game-recap` | `0 12 * * *` (noon daily) | Send game recap emails to verified subscribers for any team with completed games in last 24h. |
| `email-set-recap` | `0 14 * * *` (2pm daily) | Send set recap emails when a 5-game set completes. |
| `analytics-cleanup` | `0 3 * * *` (3am daily) | Delete hourly keys >7 days old, daily keys >90 days old. Trim sorted sets to top 200/100. |

**AI models used:** Claude Sonnet 4 (content generation with prompt caching), Claude Haiku (news importance detection).

**Content pipeline:** Cron generates blog post → auto-publishes if setting enabled → email cron sends newsletter to subscribers.

## Email Trigger Flow

### 1. Verification Email
**Trigger:** User subscribes via signup form → `POST /api/newsletter/subscribe`
**Flow:** Create subscriber (unverified) → generate 24h token → send email with verify link → user clicks → `GET /api/newsletter/verify` → mark verified

### 2. Game Recap Email
**Trigger:** `email-game-recap` cron (noon UTC daily)
**Flow:** Check NHL API for completed games → for each team with games + subscribers → check dupe flag (`email:game-recap-sent:{team}:{date}`, 48h expiry) → fetch boxscore + standings → compute playoff probability delta → render email with score, goal scorers, three stars, next game CTA → batch send (100/batch) via Resend
**Manual:** `POST /api/newsletter/send` with `{ team, type: "game-recap" }`

### 3. Set Recap Email
**Trigger:** `email-set-recap` cron (2pm UTC daily)
**Flow:** Fetch season schedule → compute 5-game sets → find latest completed set → check dupe flag (`email:set-recap-sent:{team}:{setNumber}`, no expiry) → render email with set record, target met/missed, game results, playoff probability → batch send
**Manual:** `POST /api/newsletter/send` with `{ team, type: "set-recap" }`

### 4. Simple Blog Recap (fallback)
**Trigger:** Manual `POST /api/newsletter/send` with `{ slug }` when data-driven email fails
**Flow:** Fetch blog post by slug → convert markdown to email HTML → render simple template with content + buttons

### Webhook Tracking
**Endpoint:** `POST /api/webhook/resend` — receives Resend delivery events
**Events tracked:** `email.delivered`, `email.opened`, `email.clicked`, `email.bounced`, `email.complained`
**Flow:** Resend sends webhook → lookup send record via `email:resend-map:{resendId}` → increment stat counter on `email:send:{sendRecordId}`

## KV Data Model

### Blog
| Key Pattern | Type | Expiry | Purpose |
|-------------|------|--------|---------|
| `blog:post:{postId}` | String (JSON) | None | Full BlogPost object |
| `blog:slug:{slug}` | String | None | Slug → post ID mapping |
| `blog:posts` | Sorted Set | None | All post IDs (score = publishedAt ms) |
| `blog:posts:{team}` | Sorted Set | None | Post IDs by team |
| `blog:posts:type:{type}` | Sorted Set | None | Post IDs by type (game-recap, news-analysis, weekly-roundup, set-recap, custom) |
| `blog:views:{postId}` | Integer | None | View counter |
| `blog:pinned` | String | None | ID of pinned post |
| `blog:settings:auto-publish-{type}` | Boolean | None | Auto-publish toggle per content type |

### Cron Processing
| Key Pattern | Type | Expiry | Purpose |
|-------------|------|--------|---------|
| `blog:gamerecap:processed` | Set | None | Processed Sabres game IDs |
| `blog:bills-gamerecap:processed` | Set | None | Processed Bills game IDs |
| `blog:gamerecap:log:{gameId}` | String (JSON) | None | Processing audit log |
| `blog:setrecap:processed` | Set | None | Processed set numbers |
| `blog:setrecap:log:{setNumber}` | String (JSON) | None | Set recap audit log |
| `blog:news:processed` | Set | None | Processed Sabres news story keys |
| `blog:bills-news:processed` | Set | None | Processed Bills news story keys |
| `blog:news:recent-keywords` | List | None | Last 50 story objects for dedup |
| `blog:bills-news:recent-keywords` | List | None | Last 50 Bills story objects |
| `blog:weekly:last` | String (date) | None | Last Sabres weekly roundup date |
| `blog:bills-weekly:last` | String (date) | None | Last Bills weekly roundup date |

### Newsletter
| Key Pattern | Type | Expiry | Purpose |
|-------------|------|--------|---------|
| `email:subscriber:{id}` | String (JSON) | None | Subscriber record (email, teams, verified, source) |
| `email:subscribers` | Set | None | All subscriber IDs |
| `email:subscribers:team:{team}` | Set | None | Subscriber IDs per team |
| `email:verification:{token}` | String (JSON) | 24h | Verification token → subscriberId + expiresAt |
| `email:send:{id}` | String (JSON) | None | Send record (stats: delivered, opened, clicked, bounced) |
| `email:sends` | Sorted Set | None | Send IDs sorted by timestamp |
| `email:resend-map:{resendId}` | String | 30 days | Resend email ID → send record ID (for webhook tracking) |
| `email:game-recap-sent:{team}:{date}` | Boolean | 48h | Duplicate prevention per team/day |
| `email:set-recap-sent:{team}:{setNumber}` | Boolean | None | Duplicate prevention per set |

### Analytics
> **Architecture note (current):** The admin dashboard reads most metrics (pageviews, visitors, bounce, duration, top pages, referrers, devices, countries, UTM, realtime) from the **GA4 Data API** via `lib/ga4.ts`, gated on `GSC_CLIENT_EMAIL` / `GSC_PRIVATE_KEY` / `GA4_PROPERTY_ID` (a missing/expired key makes every panel return zeros, not an error). Only **team views** (`analytics:top:teams:*`) and **click targets** (`analytics:clicks:*`) are still written to KV, by `app/api/analytics/track/route.ts`. Team views depend on `extractTeamFromPath` matching `/nhl/{team}` and `/mlb/{team}` (and `/blog/{team}`). GA4 is excluded from `/admin` routes via `components/analytics/GoogleAnalytics.tsx`. Most of the KV keys below are legacy/no longer written.

| Key Pattern | Type | Expiry | Purpose |
|-------------|------|--------|---------|
| `analytics:pv:{date}` | Integer | 90 days | Daily pageview count |
| `analytics:uv:{date}` | HyperLogLog | 90 days | Unique visitors (cardinality) |
| `analytics:pv:hourly:{date}:{hour}` | Integer | 7 days | Hourly pageviews |
| `analytics:top:pages:{date}` | Sorted Set | 90 days | Top pages by day |
| `analytics:top:pages:alltime` | Sorted Set | None | Top 200 all-time pages |
| `analytics:top:referrers:{date}` | Sorted Set | 90 days | Referrers by day |
| `analytics:top:referrers:alltime` | Sorted Set | None | Top 100 all-time referrers |
| `analytics:top:devices:{date}` | Sorted Set | 90 days | Device breakdown |
| `analytics:top:browsers:{date}` | Sorted Set | 90 days | Browser breakdown |
| `analytics:top:countries:{date}` | Sorted Set | 90 days | Country breakdown |
| `analytics:top:teams:{date}` | Sorted Set | 90 days | Team page views |
| `analytics:top:utm_source:{date}` | Sorted Set | 90 days | UTM source tracking |
| `analytics:total:pv` | Integer | None | All-time pageview total |
| `analytics:live:{visitorId}` | String | 60s | Currently active visitor's page |
| `analytics:livefeed` | List | None | Last 50 real-time events |
| `analytics:visitors:seen` | Set | None | All-time visitor IDs (new vs returning) |
| `analytics:sessions:{date}` | Integer | 90 days | Session count |
| `analytics:bounces:{date}` | Integer | 90 days | Bounce count |
| `analytics:duration:sum:{date}` | Integer | 90 days | Total session duration (seconds) |
| `analytics:duration:count:{date}` | Integer | 90 days | Session count for avg calculation |
| `analytics:clicks:{date}` | Sorted Set | 90 days | Click targets by day |
| `analytics:clicks:alltime` | Sorted Set | None | Top 100 all-time clicks |

### Outreach
| Key Pattern | Type | Expiry | Purpose |
|-------------|------|--------|---------|
| `outreach:contact:{id}` | String (JSON) | None | Media/influencer contact record |
| `outreach:contacts` | Set | None | All contact IDs |

## SEO Implementation

> Canonical host is `https://www.lindysfive.com` everywhere (root layout `metadataBase`, all canonicals, sitemap, robots, llms.txt). The site is now multi-sport (NHL + MLB) with games. Routes are namespaced by sport: `/nhl/*` and `/mlb/*`. Old flat NHL routes (`/{team}`, `/scores/{gameId}`) 301-redirect to the `/nhl/*` equivalents via `redirects()` in `next.config`.

### Route Map (current)
- **Hubs:** `/nhl`, `/mlb` (sport landing pages with team grids + sr-only crawler text)
- **Odds:** `/nhl-playoff-odds`, `/mlb/playoff-odds`, `/playoffs` (live Stanley Cup bracket)
- **Team trackers:** `/nhl/{team}`, `/mlb/{team}` (+ `/gear`, `/tickets`; NHL also `/history`)
- **Scores:** `/nhl/scores`, `/nhl/scores/{gameId}`, `/mlb/scores`, `/mlb/scores/{gameId}`
- **Games (Perfect Season):** `/82-0` (NHL), `/162-0` (MLB), each with `/leaderboard` and noindexed `/share`
- **Blog:** `/blog`, `/blog/{team}`, `/blog/{team}/{slug}`

### Metadata Pattern
- **Root layout** provides title template `"%s | Lindy's Five"` and `metadataBase`
- Each page overrides with specific title/description; titles ~50-80 chars, descriptions ~150-160
- **OG images:** hub/odds pages use a dynamic generator at `/api/og?type=...`; team pages use team logo; blog posts use `ogImage` from DB
- Perfect Season layouts use `generateMetadata()` so the social unfurl carries the current daily date

### Canonical URLs
Set via `alternates.canonical` on all pages, pattern `https://www.lindysfive.com/{path}`. Team-page canonicals use `team.id`, which equals the route slug (verified). Box score pages (`/nhl|/mlb/scores/{gameId}`) now have canonicals (previously a known gap, resolved).

### Structured Data (JSON-LD)
Embedded via `<script type="application/ld+json">` with `dangerouslySetInnerHTML`.

| Page | Schemas |
|------|---------|
| Home | WebSite (publisher: JRR Apps) |
| NHL/MLB Hub | WebPage + BreadcrumbList + FAQPage |
| Playoff Odds (NHL/MLB) | WebPage (+ `dateModified`) + Dataset (+ `dateModified`, `variableMeasured`) + BreadcrumbList + FAQPage |
| Playoffs bracket | WebPage (+ `dateModified`) + BreadcrumbList + SportsEvent (per active series) |
| Scores hub | BreadcrumbList |
| Box score (NHL/MLB) | BreadcrumbList + SportsEvent (teams, startDate, venue, final score; server-fetched landing/schedule, revalidate 300) |
| Team Tracker (NHL/MLB) | WebPage (+ `dateModified`) + SportsTeam + FAQPage (3 Qs) + BreadcrumbList |
| Team History (NHL) | WebPage + BreadcrumbList + SportsTeam |
| Gear / Tickets | none |
| Perfect Season (`/82-0`, `/162-0`) | none (sr-only H1 + descriptive prose only) |
| Blog Hub | CollectionPage |
| Team Blog | CollectionPage + BreadcrumbList |
| Blog Post | Article (dates, author, image) + BreadcrumbList |

`dateModified: new Date().toISOString()` is emitted at render on the ISR odds/team/playoffs WebPage schemas to signal freshness.

### FAQPage Schema (Team Tracker Pages)
Each team page generates 3 FAQ questions (`/nhl/{team}` and `/mlb/{team}`):
- "Will the {Team} make the playoffs in {year}?"
- "What are the {Team}'s playoff odds?"
- "What are the {Team}'s {Stanley Cup | World Series} odds?"

### Sitemap (`app/sitemap.ts`)
Base URL: `https://www.lindysfive.com`. Generates ~200 URLs:

| URLs | Change Freq | Priority |
|------|-------------|----------|
| `/` | daily | 1.0 |
| `/nhl-playoff-odds`, `/playoffs`, `/nhl` | daily/hourly | 0.95 |
| `/mlb/playoff-odds`, `/mlb` | daily | 0.9-0.95 |
| `/nhl/{32 teams}` | daily | 0.9 |
| `/mlb/{30 teams}` | daily | 0.85 |
| `/nhl|/mlb/{team}/gear`, `/tickets` | weekly | 0.5 |
| `/nhl/scores`, `/mlb/scores` | daily | 0.7 |
| `/82-0`, `/162-0` (+ leaderboards) | daily | 0.6-0.7 |
| `/blog`, `/blog/sabres`, `/blog/bills` | daily | 0.8 |
| `/blog/{team}/{slug}` (dynamic from KV) | weekly | 0.7 |

Box score and `/share` pages are intentionally excluded.

### RSS Feed (`/feed.xml`)
- Cached 1 hour (`max-age=3600`)
- Includes published blog posts with title, link, description, pubDate
- GUID is full URL with `isPermaLink="true"`

### Robots.txt (`/public/robots.txt`)
```
User-agent: *
Allow: /
Disallow: /admin
Disallow: /admin/*
Disallow: /api/

Sitemap: https://www.lindysfive.com/sitemap.xml
```

### llms.txt (`/public/llms.txt`)
Curated AI-crawler index: site summary, methodology, data sources, and deep links to every NHL/MLB team tracker, the odds/bracket pages, the Perfect Season games, and the blog/RSS. Keep in sync when routes change.

### SEO-Specific Patterns
- **ISR revalidation:** odds + team pages every 5 min, `/playoffs` every 60s, gear/tickets every 24h, blog 60s (`force-dynamic` on individual posts)
- **Screen-reader SEO text:** NHL and MLB team pages (and the hub pages, and the Perfect Season pages) have an `sr-only` block with a server-rendered, answer-shaped summary of live stats for crawlers/AI engines
- **Single H1:** one canonical H1 per page; hub pages keep the visible H1 and use `<p>` for the sr-only keyword line
- **Blog posts:** use `metaDescription` from DB, fallback to `excerpt`
- **Admin pages:** `robots: { index: false, follow: false }`; Perfect Season `/share` pages `robots: { index: false, follow: true }` (UGC)
- **Image optimization:** `next.config.js` allows remote images from `assets.nhle.com`, `*.public.blob.vercel-storage.com`, and `www.mlbstatic.com` / `img.mlbstatic.com`

### GEO: server-rendered standings mirror
The interactive odds tables (`PlayoffOddsClient`, `MLBPlayoffOddsClient`) are client-rendered, so the full table is not in the initial HTML. Both odds pages (`/nhl-playoff-odds`, `/mlb/playoff-odds`) therefore also render an `sr-only` `<table>` mirror server-side, listing every team ranked by points/wins with record, projected points/wins, and playoff probability. This is the faithful crawler/AI-readable copy of the visible table; keep it in sync if the row data shape changes.

### Breadcrumbs
- `components/seo/BreadcrumbNav.tsx` is the reusable visible trail (`<nav aria-label="Breadcrumb">`); pages that use it already emit a matching BreadcrumbList JSON-LD, so it is the visual counterpart only.
- Visible trails exist on: NHL/MLB odds, playoffs, gear, tickets, blog, and the NHL/MLB box scores (the box score's final crumb is the live matchup, e.g. "Pirates at Braves").
- Team pages (dark team-colored hero) and scores hubs (colored hero) intentionally keep JSON-LD breadcrumbs only; a gray server-rendered trail would clash with those client-owned hero headers.
- Gear/tickets BreadcrumbList JSON-LD and visible trail both live inside the hub components (`TeamGearHub`/`TeamTicketsHub`), not the page files.

### Known opportunities (from SEO/GEO audit, not yet done)
- `/playoffs` has footer cross-links but no top Home > Playoffs trail; could add one if desired.
