# Media Tracker — Project Status

_Last updated: 2026-07-05. Read this first when picking the project back up —
it's the "where did I leave off" doc. For day-to-day dev details (stack
choices, gotchas, file structure) see [CLAUDE.md](CLAUDE.md). For the original
requirements see [media-tracker-spec.md](media-tracker-spec.md)._

## What this is

A personal, multi-user app to log books, TV shows, and movies; see stats/trends
about your own habits; and get AI-generated "what to try next" suggestions from
your own logged history. Currently a **local-only prototype** — runs on a Mac
via `npm run dev`, with Postgres in a Docker container. Homelab deployment is
a later, config-only step.

## Current state: MVP feature-complete and verified live

Every MVP feature from the spec is built, and every feature has been
click-tested in a real browser against a real database — not just compiled.

| Feature | Status |
|---|---|
| Register / login / logout (Auth.js, bcrypt, JWT sessions) | ✅ Verified. Per-account data isolation confirmed with a second test account. |
| Library CRUD (manual add/edit/delete, status, rating, notes) | ✅ Verified, including status→completed date transitions. |
| Editable **"Date read"** on entries | ✅ Verified — field in the add/edit form, shown in the library list. |
| Search-import: Open Library (books) | ✅ Verified live, no key needed. |
| Search-import: TMDB (movies/TV) | ✅ Verified live with your key. |
| Dashboard (counts, genres, ratings, timeline, pace) | ✅ Verified. Timeline auto-switches monthly ↔ yearly depending on history span. |
| Gemini recommendations (5 picks, cached, explicit-regenerate) | ✅ Verified live with your key — real suggestions tied to real reading history. |
| **Greatest Books goal** — 500-book reference list + progress page | ✅ Verified — progress bar, per-100 breakdown, 500-cell rank grid. |
| Recommendations constrained to the Greatest Books list | ✅ Verified live — suggestions confirmed to be on-list and unread. |

**Production build is clean:** `npm run build` passes TypeScript and compiles
all 13 routes with no errors.

## Real data loaded

- **the demo user's account** (`demo@example.com` / `<redacted-password>`) — the main demo
  account, with **363 real books** (2017–2026) ingested from
  `reading-list.rtf`. Favourited books (marked "+" in the source) are stored
  as 5★; the rest are unrated. This replaced the old placeholder demo data.
- `test@example.com` / `<redacted-password>` — kept, now empty.
- `second@example.com` / `<redacted-password>` — kept empty, used to verify account
  isolation.
- The 500-book "Greatest Books of All Time" reference list is seeded from
  `the_greatest_books_of_all_time.csv`.

## How to pick this back up

```bash
cd "Media Tracker"
colima start                  # if the Docker daemon isn't already running
docker compose up -d          # start Postgres (container: media-tracker-db)
npm run dev                   # http://localhost:3000
```

Your `.env` (git-ignored, not in this repo) already has working `DATABASE_URL`,
`AUTH_SECRET`, `TMDB_API_KEY`, and `GEMINI_API_KEY` — nothing to reconfigure.
If you're on a fresh clone/machine, copy `.env.example` to `.env` and fill in
those four values (see CLAUDE.md's "Environment" section for what each one
does and where to get the API keys).

## What's left

Nothing blocking — the app is usable end-to-end today. Two small loose ends
and one deliberate deferral:

1. **Minor data-quality gap:** the demo user's ingested 2017 count is 39 vs. the
   source list's own stated 40 — one line likely didn't parse cleanly. Not
   investigated; low priority since it's a single book in one year.
2. **Minor flakiness:** one list-constrained recommendation generation
   returned instantly with no result (looked like an empty/transient Gemini
   response). A retry succeeded immediately. Only seen once — if it recurs,
   the fix is a simple retry-once in `src/lib/recommendations.ts`.
3. **Deliberately deferred: homelab deployment.** Docker Compose currently
   only runs Postgres; the Next.js app itself runs directly via `npm run dev`.
   Moving to the Mini PC homelab means adding `app` and `caddy` services to
   `docker-compose.yml` and setting up Tailscale for remote access — this was
   scoped from the start as a later, config-only step with **no application
   code changes expected**.

## Quick orientation for a fresh session

If you (or an assistant) are starting a new session on this project:
1. Read this file, then [CLAUDE.md](CLAUDE.md) for stack details and gotchas.
2. `git log --oneline` to see what's actually landed vs. this snapshot.
3. The two "gotchas" most likely to trip up a fresh session: Auth.js sign-in
   must use `redirectTo` (not manual `redirect()`), and the Prisma client
   needs a dev-server restart after schema changes. Both are documented in
   CLAUDE.md's Gotchas section.
