# Lindy's Five - Development Notes

## Project Overview

Buffalo sports tracker with AI-generated blog content for Sabres and Bills. Built with Vite + React 19 + React Router 7, deployed on Vercel with serverless functions.

**Live URL**: lindysfive.com
**Branch**: `feature/blog-system`

---

## Current State (January 27, 2026)

### Completed Features

#### Core Tracker
- Sabres season tracker with live standings, schedule, playoff projections
- Team page with game results, stats cards
- Classic/dark mode toggle

#### Blog System
- Public blog at `/blog`, `/blog/sabres`, `/blog/bills`
- Admin dashboard at `/admin` with password auth
- Post editor with markdown preview
- AI article generation (Claude Sonnet)

#### AI Content Generation
- **Game Recaps**: Select game from dropdown → AI writes narrative from NHL API box score data (no hallucinations)
- **Custom Articles**: AI writes with web search + injected NHL standings/roster data
- Research toggle with configurable trusted domains

#### Image Upload
- Drag-drop or file picker in post editor
- Stored in Vercel Blob
- Auto-inserts markdown into content
- Gallery of uploaded images for re-use

#### Post Management
- Custom publish dates (backdate game recaps to actual game date)
- Posts sort by `publishedAt` (newest first)
- Draft/published status
- Meta description for SEO

#### Cross-Promotion
- "Track the Sabres Season" CTA card on game recap posts
- Links to `/sabres` tracker

---

## Key Files

### API Endpoints (`/api/`)
| File | Purpose |
|------|---------|
| `blog/posts.js` | GET list, POST create |
| `blog/posts/[slug].js` | GET/PUT/DELETE single post |
| `blog/generate.js` | AI content generation |
| `blog/upload.js` | Image upload to Vercel Blob |
| `admin/login.js` | Password auth |
| `admin/logout.js` | Clear session |
| `admin/verify.js` | Check session |

### Frontend Components (`/src/components/`)
| File | Purpose |
|------|---------|
| `blog/Blog.tsx` | Blog landing page |
| `blog/BlogList.tsx` | Team-filtered post list |
| `blog/BlogPost.tsx` | Single post view + tracker CTA |
| `blog/PostContent.tsx` | Markdown renderer |
| `admin/PostEditor.tsx` | Create/edit posts with AI |
| `admin/AdminDashboard.tsx` | Post management |

### Services (`/src/services/`)
| File | Purpose |
|------|---------|
| `blogApi.ts` | Blog API client |
| `nhlApi.ts` | NHL API client |

---

## Environment Variables

Required in `.env.local` and Vercel dashboard:

```env
# Vercel KV (auto-set when you create KV store)
KV_REST_API_URL=
KV_REST_API_TOKEN=
KV_REST_API_READ_ONLY_TOKEN=
KV_URL=
REDIS_URL=

# Admin Auth
ADMIN_PASSWORD_HASH=    # bcrypt hash of admin password
ADMIN_SESSION_SECRET=   # random 32-char string for JWT signing

# AI Generation
ANTHROPIC_API_KEY=sk-ant-...

# Image Upload
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_...
```

---

## Recent Changes (Today's Session)

### 1. Custom Publish Date
- Added `publishedAt` field to posts
- datetime-local input in post editor
- Can backdate posts to actual event dates

### 2. Fixed Post Sorting
- Posts now sort by `publishedAt` instead of `createdAt`
- Editing publish date updates post position
- **Files**: `api/blog/posts.js`, `api/blog/posts/[slug].js`

### 3. Fixed Datetime Input Bugs
- Added timezone-aware conversion helpers
- `isoToDatetimeLocal()` - for display
- `datetimeLocalToIso()` - for saving
- **File**: `src/components/admin/PostEditor.tsx`

### 4. Tracker CTA on Game Recaps
- Blue gradient card with "Track the Sabres Season"
- Only shows on Sabres game recap posts
- Links to `/sabres`
- **File**: `src/components/blog/BlogPost.tsx`

---

## How Game Recaps Work

1. Admin selects "Game Recap" type in editor
2. Dropdown shows last 10 completed Sabres games
3. Select a game → opponent/date auto-populate
4. Click "Generate Recap"
5. Backend fetches box score from NHL API:
   - Final score, period breakdown
   - All goals with times, scorers, assists
   - Goalie stats, power play, penalties
6. Claude writes narrative using ONLY this data
7. No web search = no hallucinations
8. Review, edit, set publish date, publish

---

## Pending/Future Work

### From Original Plan
- [ ] Set recaps (analyze 5-game sets)
- [ ] Bills content (NFL API integration)
- [ ] SEO Phase 2-3 (sitemap, performance)
- [ ] Vike/SSG migration (better SEO)

### Ideas
- [ ] Auto-publish game recaps via cron (needs Vercel Pro)
- [ ] Bills tracker page
- [ ] Player stats cards
- [ ] Historical game data

---

## Commands

```bash
# Development
npm run dev

# Build
npm run build

# Type check
npx tsc --noEmit
```

---

## Continuing on Another Computer

1. Push current changes:
   ```bash
   git push origin feature/blog-system
   ```

2. On new computer:
   ```bash
   git clone <repo>
   git checkout feature/blog-system
   npm install
   ```

3. Copy `.env.local` (not in git) or export from Vercel:
   ```bash
   vercel env pull .env.local
   ```

4. Run dev server:
   ```bash
   npm run dev
   ```

---

## Architecture Notes

### Data Storage
- **Vercel KV (Redis)**: Posts stored as JSON, sorted sets for ordering
- **Vercel Blob**: Image storage with CDN

### Post Sorting
- Redis sorted sets with `publishedAt` timestamp as score
- `zrange(..., { rev: true })` = newest first
- Score updated when `publishedAt` changes

### AI Generation Flow
```
PostEditor → blogApi.generateArticle() → /api/blog/generate.js
                                              ↓
                                         fetchGameBoxScore() (for game recaps)
                                              ↓
                                         formatBoxScore() → inject into prompt
                                              ↓
                                         Claude API (Sonnet)
                                              ↓
                                         Parse response → return content
```

### Auth Flow
- Login: bcrypt verify → JWT cookie (`admin_token`)
- Protected routes: `verifyAdmin()` checks JWT
- Logout: Clear cookie

---

## Commits Today

1. `b6124d3` - Fix post sorting by publishedAt and datetime input bugs
2. (pending) - Add tracker CTA to game recap posts
