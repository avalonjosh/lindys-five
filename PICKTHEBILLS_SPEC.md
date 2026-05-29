# Pick the Bills — Build Spec

A weekly Bills prediction game living inside Lindy's Five at the route `/pickthebills`.

This document is the product spec. It captures what to build and why. It does **not** assume anything about the Lindy's Five stack. A short list of repo-specific questions to answer against the actual code is at the bottom.

---

## 1. The concept

Inspired by a local sports radio segment where a host predicts whether the Bills win each remaining game on the schedule, then re-predicts at meaningful checkpoints (after the draft, after free agency, after each game). The interesting part is watching how a single person's confidence in the season shifts over time.

This turns that into a social, competitive game. Any fan does the same thing for themselves, and a leaderboard ranks fans by how accurate their predictions are.

The core unit is **not** a one-time bracket. It is a living prediction that the user revises over the course of the season. The product's personality is the timeline of how someone's picks change.

---

## 2. The window + pick model (the heart of it)

Everything rests on one idea: **a pick is a row that ties a user to a game AND to the moment (window) the pick was made.** That single shape gives carry-forward, history, and honest scoring almost for free.

### Pick windows

A "window" is a checkpoint where users can submit or revise their predictions for all games that have not yet kicked off.

There is only **one kind of window object.** All of these are the same row, differing only by label and timestamps:

- Season baseline (preseason, pick all 17 games)
- Scheduled offseason checkpoints (post-draft, free agency opening, etc.)
- After each regular season game
- Breaking-news windows the admin opens manually (e.g. "Traded for X")

Windows are **admin/system created only.** Users do not create their own windows. This is mandatory for a fair leaderboard: everyone must be scored against the same set of checkpoints. (A user-facing "propose an event" feature is explicitly deferred to v2.)

Every window has a hard rule: **`locks_at` must be at or before the next kickoff.** Nobody may pick a game they have already watched begin. Admin windows opened mid-week inherit the same "closes at next kickoff" lock.

### Picks and carry-forward

A pick row is only written when a user **actively submits** one. Picks are never auto-copied between windows.

The pick that "counts" for any game is computed, not stored:

> The effective pick for a (user, game) pair is the most recent `PICKS` row for that user and game where `created_at` is before that game's `kickoff_at`.

Consequences of this rule (all desirable):

- A user who picks at the baseline and never returns keeps that prediction live forever. Missing a window costs nothing.
- A user who reacts to a trade writes a new row with a later timestamp, and it automatically supersedes the old one.
- An admin window is an **opportunity**, not an obligation. The fans who react to news get to capitalize on it; the fans who do not keep their old pick and live with the result. This mirrors the radio segment and is the source of the competitive fun.

---

## 3. Data model

Four tables. Three of the four (everything except picks/windows logic) are conceptually similar to schedule/results data Lindy's Five already handles for NHL and MLB, just for the NFL.

### USERS
- `id` (uuid, PK)
- `username` (string)
- `email` (string)
- `created_at` (timestamp)

### GAMES
- `id` (uuid, PK)
- `season` (int)
- `week_label` (string — e.g. "Week 1", "Wild Card". Use a label rather than a plain int so playoff/bye handling is flexible.)
- `opponent` (string)
- `home` (bool)
- `kickoff_at` (timestamp)
- `status` (string — scheduled / final)
- `result` (string — W / L / T, from the Bills' perspective, null until final)

### WINDOWS
- `id` (uuid, PK)
- `season` (int)
- `label` (string — e.g. "Season Baseline", "After Week 3", "Trade: Acquired X")
- `type` (string — baseline / scheduled / event. Drives UI badging only; logic is identical across types.)
- `opens_at` (timestamp)
- `locks_at` (timestamp — must be <= next kickoff)
- `status` (string — open / locked)

### PICKS
- `id` (uuid, PK)
- `user_id` (uuid, FK -> USERS)
- `game_id` (uuid, FK -> GAMES)
- `window_id` (uuid, FK -> WINDOWS)
- `predicted` (string — W / L)
- `confidence` (int, nullable) — **include this column from day one even though MVP will not surface it.** It is impossible to backfill and cheap to add now. It enables conviction-weighted scoring and the "confidence drift over time" chart later.
- `created_at` (timestamp)

Relationships: USERS, GAMES, and WINDOWS each have a one-to-many relationship to PICKS.

---

## 4. Auth approach: gated-write with a soft wall

Lindy's Five has no accounts today, and **most of the site must stay account-free.** Public stats, odds, and the team tracker keep working with zero login. Auth is a gate placed only in front of writing a pick, not a wall around the site.

Build **one site-wide account system,** not a "Pick the Bills account." Pick the Bills just happens to be the first feature that requires login. This keeps the door open to using accounts elsewhere later (e.g. saving favorite teams in the tracker).

### Read is public, write requires an account

- Anyone (logged in or not) can browse the leaderboard, standings, and how picks are trending. The leaderboard is the marketing: an anonymous fan sees others ranked by accuracy and wants to beat them.
- Login is only required to **submit** a pick.

### The soft wall + claim-on-signup (this is v1, not v2)

The flow:

1. An anonymous user clicks through the entire pick screen and chooses W/L for all games. These selections live **client-side only** (UI state, nothing written to the database, since there is no `user_id` yet).
2. At submit, the pending pick set is stashed somewhere that survives an OAuth redirect (browser session storage is the simplest home). The prompt is framed as "Create a free account to save your picks."
3. The user is bounced to the OAuth provider and returns authenticated. The pending picks are still in the browser.
4. On account creation, read the stashed picks, write them to `PICKS` against the new `user_id` and the currently-open window, then clear the stash. The picks are now permanent and show as saved.

**Why claim-on-signup is mandatory, not optional:** the entire value of the soft wall is that the picks survive the signup. If the user has to re-enter everything after creating an account, the soft wall is worse than a hard gate, because it frustrates them at the exact conversion moment.

**Edge case to handle:** a user fills out anonymous picks but logs into an existing account instead of signing up, and that account already has picks in the open window. Default behavior: the freshly-made anonymous picks overwrite the older ones (they represent the user's current intent), but show a confirmation prompt rather than silently overwriting.

### Provider

Since this is greenfield auth, use OAuth (Google sign-in, and consider X given the Buffalo sports audience) rather than rolling a custom email/password system. Lower friction, and no owning password resets or security headaches.

---

## 5. Scoring and leaderboard rules

- When a game's `status` becomes final, for each user grab their effective pick (the lookup from section 2), compare `predicted` to `result`. That game is now **graded** for that user.
- **Primary leaderboard sort: accuracy percent** (correct / graded). This is fairer to fans who join mid-season than raw win count.
- **Tiebreaker: raw correct count.** If still tied, users share the rank.
- **Qualification threshold (recommended, adjustable):** pure accuracy percent has a small-sample problem in the other direction. A fan who joins late, picks 2 games, and gets both right would show 100% and top everyone. Solve it the way a batting title does: a user must have a minimum number of graded games to appear on the ranked leaderboard. Everyone below the threshold is shown in an "not yet qualified" state with their stats visible but unranked. Suggested threshold: graded on at least half the games played so far in the season. **Josh to confirm the exact threshold.**
- **Playoffs (default: count them):** playoff games are just more games and windows, same engine, and Bills fans will want them in. They are fair because every user faces the same conditional schedule. **Flag for Josh:** if you want to ship before the playoffs to validate the regular-season loop first, playoffs can be scoped out of v1 cleanly and added later with zero schema change.
- **Bye week:** no game, no pick, no grading. The `week_label` field handles this naturally.

---

## 6. MVP scope

### In v1
- Regular season Bills pick'em
- The full window engine (baseline, scheduled, after-each-game, and admin breaking-news windows are all the same object, so building offseason and breaking-news support costs almost nothing once windows exist)
- Carry-forward effective-pick logic
- Accuracy-based leaderboard with qualification threshold
- Gated-write auth with soft wall and claim-on-signup
- Public read-only leaderboard and standings

### Deferred to v2
- User-facing "propose an event" (let fans flag breaking news for the admin to approve into a real window)
- Multi-team / "Pick the NFL" generalization (the schema is already general enough to support this; it is a scope decision, not an architecture one)
- Surfacing the `confidence` field and conviction-weighted scoring
- Confidence-drift-over-time charts per user

---

## 7. Questions for Claude Code to answer against the repo

These genuinely require the actual codebase and should be resolved there, not guessed here:

1. **What is the stack?** (Next.js, plain React, something else.) This determines the obvious auth library choice.
2. **How does Lindy's Five currently ingest schedule and results data for NHL/MLB?** Can the same pattern feed the NFL `GAMES` table, or does NFL data need a new source?
3. **How is routing set up,** and what is the cleanest way to add `/pickthebills` as a new section?
4. **Where should the OAuth + session layer live** so it is site-wide infrastructure rather than bolted onto one feature?
5. **What is available for the pending-picks stash** that survives an OAuth redirect in this stack (session storage vs a short-lived server-side session)?

---

*Formatting note for the assistant working in the repo: do not use em dashes in any writing for Josh. Use commas, periods, parentheses, or rewrite the sentence.*
