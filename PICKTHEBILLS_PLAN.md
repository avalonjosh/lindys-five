# Pick the Bills - Implementation Plan

This is the plan authored in plan mode at the start of the build. It is the
canonical record of decisions and the phased sequence. All 8 phases are now
built; see `PICKTHEBILLS_UI_NOTES.md` for current state and the remaining
UI/verification work.

## Context

Pick the Bills is a new weekly Bills prediction game for Lindy's Five at `/pickthebills`, specced in `PICKTHEBILLS_SPEC.md`. Unlike one-and-done pick'em, the core unit is a living prediction a fan revises across the season, and the product's personality is how someone's confidence drifts over time. It also introduces the site's first end-user accounts, which become reusable site-wide infrastructure later (favorites, cross-device modal suppression, etc.).

The feature is additive and isolated. It does not touch existing KV data (blog, newsletter, analytics) or any current page. It is built on a feature branch, not main, because it ships security-sensitive auth and should not auto-deploy half-built to production.

### Locked decisions (confirmed with Josh)
- **Persistence:** Vercel Postgres (Neon) for this feature only. Rest of site stays on Vercel KV + Blob, untouched. No paid upgrade required (Neon free tier easily fits the data footprint; already on Vercel Pro for the commercial site + crons).
- **Auth:** Auth.js (NextAuth v5), Google provider only for v1. X deferred (X API can incur cost).
- **v1 timeline scope:** leaderboard + picks + a lightweight per-game "your pick over time" history view. Full drift charts and confidence-weighting deferred to v2. The `confidence` column ships now, unused.

### Recommended defaults for open scoring questions (confirm before grading)
- **Ties (NFL games can tie):** a `T` result is excluded from grading entirely (not counted in graded or correct). Ties are rare and a user cannot express T with a W/L pick.
- **Qualification threshold:** season-wide constant. `threshold = ceil(total Bills games final so far / 2)`. Applied in app code so it stays adjustable.
- **No pick = not graded:** a user with no pick before kickoff simply has a smaller denominator (consistent with "missing a window costs nothing"); the threshold protects fairness.
- **Single open window invariant:** at most one window `open` at a time, enforced at the admin layer. The claim flow needs exactly one target.
- **Username:** store Google `name` as `display_name`, not guaranteed unique; disambiguate on the leaderboard if needed.

## Tech choices
- DB client: **`drizzle-orm` + `@neondatabase/serverless` + `drizzle-kit`** (dev dep). Clean slate (no existing DB tooling), HTTP driver suits serverless, drizzle-kit gives the missing migration story, raw `sql` escape hatch for the effective-pick query. Avoid the superseded `@vercel/postgres`.
- Auth session strategy: **JWT** (stateless, no DB round-trip per request, no adapter needed). Upsert the user into our `users` table in the NextAuth callback and stash internal `users.id` in the token. Use a fresh `AUTH_SECRET`, separate from `ADMIN_SESSION_SECRET`.
- **No `middleware.ts`** (the project has none). Gate writes at the route-handler level with `await auth()`. This sidesteps the NextAuth v5 Edge-runtime-DB pitfall.
- Leaderboard: **precomputed and cached in KV** (`pickthebills:leaderboard:{season}`), recomputed in the grade cron when a game flips final. Public GET is a single KV read. Per-user picks/history read live from Postgres.

## Data model

New files: `lib/db/schema.ts` (drizzle tables), `lib/db/index.ts` (singleton `db` from `drizzle(neon(process.env.POSTGRES_URL))`, mirroring how `lib/kv.ts` centralizes KV), `drizzle.config.ts` (root), migrations in `lib/db/migrations/`.

Tables: `users(id uuid pk, email unique, display_name, image, created_at)`, `games(id uuid pk, espn_id text unique, season, week_label, opponent, home bool, kickoff_at timestamptz, status, result)`, `windows(id uuid pk, season, label, type, opens_at, locks_at, status)`, `picks(id uuid pk, user_id fk, game_id fk, window_id fk, predicted, confidence int null, created_at)`. All timestamps `timestamptz`.

`espn_id` is added beyond the spec: it makes the schedule ingest idempotent (`ON CONFLICT (espn_id)`) and maps ESPN results back to a games row during grading.

Indexes (load-bearing): `picks(user_id, game_id, created_at DESC)`, `picks(game_id, created_at DESC)`, `games(status)`, `games(season, kickoff_at)`.

Migrations run manually against a Neon dev branch first, then prod (no CI gate; fine for solo). Add `db:generate` / `db:migrate` / `db:push` npm scripts.

## Key query logic (`lib/db/` query helpers)
- **Effective pick** (latest pre-kickoff row per game): `SELECT DISTINCT ON (p.game_id) ... FROM picks p JOIN games g ON g.id=p.game_id WHERE p.user_id=$1 AND p.created_at < g.kickoff_at ORDER BY p.game_id, p.created_at DESC`. Drop the DISTINCT ON for the full history view, joined to `windows.label`.
- **Grading / leaderboard:** CTE over effective picks for `status='final'` games, `graded_count` filtered to `result IN ('W','L')` (ties excluded), `correct_count` where `result = predicted`, accuracy = correct/graded. Order by accuracy desc, correct desc. Ranks + qualification threshold applied in JS (shared ranks on exact ties).

## Auth (`lib/auth.ts` + `app/api/auth/[...nextauth]/route.ts`)
- `NextAuth({ providers: [Google], session: { strategy: 'jwt' }, callbacks })`. Callback upserts user by email (`INSERT ... ON CONFLICT (email) DO UPDATE RETURNING id`), sets `token.userId`; session callback copies to `session.user.id`.
- Server routes read `const session = await auth()` then `session?.user?.id`; null -> 401. Public reads skip `auth()`.
- Coexists with admin auth: admin keeps `admin_token` + `verifyAdmin()` untouched. New pickthebills admin routes reuse `verifyAdmin` (extract to `lib/utils/adminAuth.ts`), not NextAuth. Two independent systems, two cookies, two secrets.

## Soft-wall claim-on-signup flow
- Anonymous picks live in React state. On "Save," stash to `sessionStorage` key `pickthebills:pendingPicks` (`{season, picks:[{gameId,predicted,confidence}], stashedAt}`), then `signIn('google', { callbackUrl: '/pickthebills?claim=1' })`.
- On authenticated return, client reads stash, POSTs to `/api/pickthebills/picks`, clears stash on success.
- **Open window resolved server-side at write time** (not the stale client value). Reject any game with `kickoff_at <= now()` (enforces the no-pick-after-kickoff rule), partial-accept the rest, report rejects.
- **Existing-account overwrite edge case:** submit accepts optional `confirmOverwrite`. If user already has picks in the open window for submitted games, return `409 {requiresConfirmation, conflictingGames}` and write nothing; client shows a confirm modal; re-POST with `confirmOverwrite:true`. Implement "overwrite" as **appending a newer row** (never delete) so append-only holds and the effective-pick query supersedes naturally.
- Known v1 limitation: sessionStorage is per-tab; in-app browsers that open OAuth in a new tab lose the stash (user re-picks). KV-nonce-via-OAuth-`state` is the v2 fix.

## Routes and pages

Pages under `app/pickthebills/` (mirror `app/nhl/` / `app/blog/` server+client split):
- `page.tsx` - public hub: leaderboard (server, reads cached KV) + entry to pick screen.
- pick screen (client component) - all not-yet-kicked-off games in the open window with W/L toggles, prefilled with the user's current effective picks; smart default of Bills-win to flip (reduces the 17-pick friction).
- leaderboard view (ranked + unranked-but-visible sections).
- per-game pick-history view (v1 lightweight: table of pick rows with window label + timestamp, effective pick highlighted; no charts).

API under `app/api/pickthebills/`:
- `POST /picks` (auth-gated) - submit/claim, window resolution, kickoff guard, confirmOverwrite protocol.
- `GET /picks` (auth-gated) - current user's effective picks (prefill).
- `GET /leaderboard` (public) - reads cached KV.
- `GET /history?userId=` (public) - full pick history joined to window labels.
- `GET /games` (public) - games + windows state.

Admin (reuse `verifyAdmin`, listed in `app/admin/page.tsx`, wrapped by `AdminAuthWrapper`):
- `app/admin/pickthebills/page.tsx`.
- `POST /api/admin/pickthebills/windows` - create window (`locks_at` auto = next kickoff, validated `<=` next kickoff; enforce single-open invariant).
- `POST /api/admin/pickthebills/windows/:id/lock` - manual lock.
- `POST /api/admin/pickthebills/schedule/refresh` - on-demand ingest (same logic as cron).

## Crons (vercel.json + CRON_SECRET, mirror `app/api/cron/bills-game-recap/route.ts`)

Consolidate into **one** `app/api/cron/pickthebills/route.ts` to conserve cron quota (project already has ~13 crons; check plan limit). One pass does:
1. **Schedule ingest** - fetch `teams/buf/schedule`, upsert each event into `games` by `espn_id` (idempotent).
2. **Finals + grade + leaderboard** - find ESPN `status.type.completed` games not yet `final` in DB, derive `result` (W/L/T from competitor parsing reused from `bills-game-recap`), update games, recompute leaderboard, write to KV.
3. **Auto-open next window** - on a game going final, lock the expired open window and open a new `scheduled` window `After <week_label>` with `locks_at = MIN(kickoff_at)` of remaining scheduled games. Guard: no trailing window after the season's last game.

Also register the handler in `app/api/cron/trigger/route.ts` for manual admin triggering. The per-game kickoff guard in the submit route makes cron timing forgiving (need not be second-accurate).

## Phased build sequence (de-risk first)
1. **Data foundation** - add deps, provision Neon via Vercel, schema + config + connection, migrate to Neon dev branch, build schedule ingest, populate `games`. (Proves the new infra before feature code.)
2. **Core query logic** - effective-pick + grading/leaderboard queries against seeded data; validate tie + threshold rules. (Correctness heart, in isolation.)
3. **Auth** - NextAuth v5 config + route + user-upsert callback; verify login/logout, `auth()` returns internal `users.id`, zero admin interference.
4. **Authenticated write path** - `POST /picks` with window resolution, kickoff guard, confirmOverwrite. Test via curl before UI.
5. **Admin surface** - window create/lock + schedule refresh. Create the baseline window.
6. **Public read UI** - pick screen (with prefill), leaderboard, per-game history.
7. **Soft-wall claim flow** - stash + signIn redirect + claim-on-return + overwrite modal. Last, depends on all layers.
8. **Grade cron + KV cache + auto-window** - wire consolidated cron, register in vercel.json + trigger.

## Verification (local)
- **Effective pick:** seed a user with multiple picks across windows for one game at different `created_at`, some after kickoff; assert only the latest pre-kickoff row returns. Test no-pick (not graded) and stale-after-kickoff (ignored).
- **Claim flow:** `next dev`, anonymous picks, real Google test login, confirm rows land in the open window and stash clears; repeat logged into same account to hit the 409 confirm path; observe new-tab-loses-stash mode.
- **Scoring end to end:** seed a final game with known result, run grade handler via admin trigger, verify leaderboard query + KV output. Force a `T` to verify tie rule. Add a sub-threshold user, confirm unranked-but-visible.
- **Locks/timing:** set a `kickoff_at` in the past, confirm submit rejects that game while accepting still-open ones.
- Run `npx tsc --noEmit` before any commit (project convention).

## Branch
Create `feature/pickthebills` off `main`. Vercel gives preview deploys per branch, so the WIP is testable without touching production lindysfive.com. Merge to main only when v1 is ready and verified. Provision a separate Neon dev branch for the preview environment so test data never hits prod.

## New dependencies / env vars
- Deps: `next-auth@beta` (v5), `drizzle-orm`, `@neondatabase/serverless`; dev: `drizzle-kit`.
- Env: `POSTGRES_URL` + `DATABASE_URL` (Neon, same value), `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`. Existing `CRON_SECRET`, admin vars, KV/Blob vars unchanged.

## Open items to confirm before grading
Tie rule, qualification threshold value, history-view privacy (public vs own-only). Defaults above are recommended; none block earlier phases.

---

## Build status (post-implementation)

- Phases 1-8: all committed to `feature/pickthebills` and pushed. `tsc` clean.
- Deviation from plan: there is only ONE Neon DB (`neon-teal-lighthouse`), not a
  separate dev branch. Local and (future) prod share it. Treat writes as
  semi-permanent.
- Season Baseline window already created in the DB.
- Remaining: interactive verification (Google-login pick/claim flow, 409 modal,
  grading dry-run with revert, past-kickoff lock guard) and the UI/layout work in
  `PICKTHEBILLS_UI_NOTES.md`. Then merge to `main` to go live.
