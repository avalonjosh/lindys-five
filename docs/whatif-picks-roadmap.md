# What-If Picks & Account Roadmap

Status as of 2026-07-20. This is the working plan for the saved-picks / account / profile feature line. Continue from "Remaining roadmap" below.

## Shipped

| Commit | What |
|--------|------|
| a30c2f4 | Saveable What-If picks (NHL): signed-in users save dated pick snapshots per team (one/day, ET date locked server-side), restore latest picks, review history on /account. Keys: `whatif:save:{userId}:{sport}:{teamId}:{season}:{date}`, `whatif:index:{userId}`. Data model already takes `sport: 'mlb' | 'nfl'` for later. Reuses the Perfect Season account realm (`l5_user` cookie). |
| 2b40211 | Profile Phase 1 + favorite team: /account shows member since, masked email, Perfect Season bests with live ranks (`GET /api/account/profile`). Signup asks favorite team (prefill: localStorage `favorite-teams`, then the page's team via AuthModal `defaultFavoriteTeam`), stored as `User.favoriteTeam`, merged into localStorage at explicit auth moments only. Account entry point is in the TeamNav hamburger ("My Account · username" / "Sign In") — NOT a header icon (rejected). |
| a9f3369 | Account-aware newsletter popup: `/api/newsletter/status` resolves the signed-in account's standing; subscribers never see the popup; signed-in non-subscribers get a one-click "Email Me Recaps" (no email field). |
| 46672dc | Post-save email prompt: SavePicksModal success state asks "Want {team} game recaps by email?" (the team just saved, not favoriteTeam). Subscribes via existing endpoint, source `post-save-prompt`. Skips if subscribed / `newsletter-subscribed` flag / within the shared 30-day `newsletter-dismissed-until` cooldown; "No thanks" starts that cooldown; success sets suppression flags. Chosen INSTEAD of pre-checking the signup subscribe box (rejected: CASL/GDPR invalid consent + deliverability; Buffalo audience includes Ontario). |
| e55a5a6, 2ff4ab0 | /account redesign: favorite-team-colored hero (fallback #003087) with monogram avatar + logo watermark; 4 stat tiles (saved picks, exact accuracy, best Perfect Season rank, daily puzzles); color-coded grades + top-3 rank medals; per-team aggregate accuracy in group headers; single-save chart nudge; hero chip links to the favorite team's tracker (pencil icon edits it); "back to Lindy's Five" link removed. |

## Remaining roadmap

2. **Phase 2 — account settings**: change password, change email, newsletter opt-in/out, delete account (must scrub leaderboard entries + picks). Decide layout first: tabs (Overview / My Picks / Settings) vs sections with sub-nav — settings will make the current single page a long scroll.
3. **Phase 3 (optional) — public profiles** at `/u/{username}` for sharing pick history/accuracy; pairs well with season start.
4. **MLB port** of save-picks (MLBTeamTracker has a parallel What-If implementation).
5. **Pick the Bills page** — standalone weekly-picks page, `sport: 'nfl'`, same account/save/accuracy model.
6. **Save nudge**: users should be prompted to save — currently opt-in buttons only; consider a gentle pulse/tooltip after N picks. Decide pushiness with Josh.
7. **Season-start dry run**: verify grading UX against real results when games begin (~Oct 2026); consider testing against a past season earlier.

## Why

The retention loop (re-pick, watch history/accuracy grow) is the point; the profile page is the retention surface.

## Verification still pending (prod)

- Post-save email prompt: never click-tested end to end — save picks on prod, confirm the prompt appears and subscribes.
- /account redesign: check hero + stat tiles on mobile and with no favorite team set.
- Create Josh's real account via a What-If save; confirm Sabres preselects as favorite; check cross-device favorite sync.
- Known gap (accepted for now): signed-OUT /account has no navigation at all.

## Dev notes

- Local dev needs `USER_SESSION_SECRET` in `.env.local` (auth 500s without it; a dev-only value was added 2026-07-20).
- Local dev shares production KV and a live Resend key — test accounts/subscribers land in prod data.
- 2026-27 NHL season is 84 games (CBA change); detection + preseason team pages done, but live ProgressBar/probability/email math is still on 82 (see docs/nhl-offseason-plan.md context).
