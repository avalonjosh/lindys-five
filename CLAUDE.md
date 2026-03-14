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

**Newsletter:** Subscribers stored in Vercel KV. Email verification with 24h tokens. Emails sent via Resend. Two email types: game-recap and set-recap. Webhook tracking for delivery/open/click/bounce rates. Subscribers can subscribe to specific teams.

**Environment variables needed:** `ADMIN_PASSWORD_HASH`, `ADMIN_SESSION_SECRET`, `RESEND_API_KEY`, `NEXT_PUBLIC_SITE_URL`, `CRON_SECRET`.

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
