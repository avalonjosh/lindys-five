# Lindy's Five - NHL Playoff Tracker

## Project Overview
NHL playoff odds tracker and scores site. Tracks playoff probability for all 32 NHL teams with 5-game set analysis, live scores, box scores, and standings.

**URL:** https://lindysfive.com

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
- `app/` - Next.js routes (scores, team tracker, blog, admin)
- `app/scores/[gameId]/` - Box score pages
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

### Metadata Pattern
- **Root layout** provides title template: `"%s | Lindy's Five"`
- Each page overrides with specific title and description
- Titles kept to 50-80 characters, descriptions to 150-160 characters

### Page Metadata

| Page | Title | Twitter Card |
|------|-------|-------------|
| Home (`/`) | "NHL Playoff Odds & Standings 2025-26 — Projections for All 32 Teams" | summary_large_image |
| Playoff Odds (`/nhl-playoff-odds`) | "NHL Playoff Odds 2025-26 — Standings, Projections & Playoff Picture" | summary_large_image |
| Scores (`/scores`) | "NHL Scores Today — Live Results, Box Scores & Playoff Impact" | summary |
| Box Score (`/scores/{gameId}`) | "Game {gameId} — Box Score" | summary |
| Team Tracker (`/{team}`) | "{Team} Playoff Odds & Standings 2025-26 — Chances & Projections" | summary_large_image |
| Blog Hub (`/blog`) | "NHL Blog — Sabres Playoff Coverage, Game Recaps & Analysis" | summary |
| Team Blog (`/blog/{team}`) | "{Team} Blog" | summary |
| Blog Post (`/blog/{team}/{slug}`) | Post title from DB | summary_large_image |

### Canonical URLs
Set via `alternates.canonical` on all pages. Pattern: `https://lindysfive.com/{path}`. **Note:** Box score pages (`/scores/{gameId}`) are missing canonical URLs — should be added.

### Structured Data (JSON-LD)
Embedded via `<script type="application/ld+json">` with `dangerouslySetInnerHTML`.

| Page | Schemas |
|------|---------|
| Home | WebSite (publisher: JRR Apps) |
| Playoff Odds | WebPage + BreadcrumbList |
| Scores | BreadcrumbList |
| Box Score | BreadcrumbList |
| Team Tracker | WebPage + FAQPage (3 questions about playoff odds) + BreadcrumbList + SportsTeam |
| Blog Hub | CollectionPage |
| Team Blog | CollectionPage + BreadcrumbList |
| Blog Post | Article (with dates, author, image) + BreadcrumbList |

### FAQPage Schema (Team Tracker Pages)
Each of the 32 team pages generates 3 FAQ questions:
- "Will the {Team} make the playoffs in 2026?"
- "What are the {Team}'s playoff odds?"
- "What are the {Team}'s Stanley Cup odds?"

### Sitemap (`app/sitemap.ts`)
Base URL: `https://lindysfive.com`

| URLs | Change Freq | Priority |
|------|-------------|----------|
| `/` | daily | 1.0 |
| `/nhl-playoff-odds` | daily | 0.95 |
| `/{all 32 teams}` | daily | 0.9 |
| `/blog`, `/blog/sabres`, `/blog/bills` | daily | 0.8 |
| `/scores` | daily | 0.7 |
| `/blog/{team}/{slug}` (dynamic) | weekly | 0.7 |

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
Sitemap: https://lindysfive.com/sitemap.xml
```

### SEO-Specific Patterns
- **ISR revalidation:** `/nhl-playoff-odds` revalidates every 5 min, team blogs every 60s
- **Screen-reader SEO text:** Team tracker pages have `sr-only` div with server-rendered summary for crawlers
- **Blog posts:** Use `metaDescription` field from DB, fallback to `excerpt`
- **OG images:** Team pages use team logo, blog posts use `ogImage` field from DB
- **Admin pages:** `robots: { index: false, follow: false }` — excluded from indexing
- **Image optimization:** `next.config.js` allows remote images from `assets.nhle.com` and `*.public.blob.vercel-storage.com`
