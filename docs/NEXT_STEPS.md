# Media Tracker — Status & next steps

_Last updated: 2026-07-06. Read this first when picking the project back up.
For dev details and gotchas see [../CLAUDE.md](../CLAUDE.md); for requirements
see [PRD.md](PRD.md); for design see [ARCHITECTURE.md](ARCHITECTURE.md)._

## Current state: MVP feature-complete and verified live

Every MVP feature from the PRD is built, and every feature has been
click-tested in a real browser against a real database — not just compiled.
A v1 polish pass (2026-07-06) closed the known loose ends: Gemini
empty-response retry, delete confirmation, mobile nav wrapping, and the
"2017 count gap" resolved as a source miscount (see
[DECISIONS.md](DECISIONS.md)).

**Production build is clean:** `npm run build` passes TypeScript and compiles
all 13 routes with no errors.

| Feature | Status |
|---|---|
| Register / login / logout (Auth.js, bcrypt, JWT sessions) | ✅ Verified; per-account isolation confirmed with a second account. |
| Library CRUD (add/edit/delete, status, rating, notes, date read) | ✅ Verified, incl. status→completed date transitions. |
| Search-import: Open Library (books) + TMDB (movies/TV) | ✅ Verified live with real keys. |
| Dashboard (counts, genres, ratings, adaptive timeline, pace) | ✅ Verified. |
| Gemini recommendations (5 picks, cached, explicit-regenerate) | ✅ Verified live. |
| Greatest Books goal (500-list progress page + on-list recs toggle) | ✅ Verified live. |

## Real data loaded

- **Demo account** (`demo@example.com`) — main demo account, **363 real books**
  (2017–2026) ingested from a local RTF reading list (not in git). "+" in the
  source = favourite → 5★; rest unrated.
- `test@example.com` — kept, empty.
- `second@example.com` — kept empty; used to verify isolation.
- Passwords for all three come from `SEED_PASSWORD` in your local `.env`.
- The 500-book Greatest Books reference list is seeded from
  `the_greatest_books_of_all_time.csv`.

## How to pick this back up

```bash
cd "Media Tracker"
colima start                  # if the Docker daemon isn't already running
docker compose up -d          # start Postgres (container: media-tracker-db)
npm run dev                   # http://localhost:3000
```

Your `.env` (git-ignored) already has working `DATABASE_URL`, `AUTH_SECRET`,
`TMDB_API_KEY`, and `GEMINI_API_KEY`. On a fresh clone, copy `.env.example`
and fill those in (see CLAUDE.md's Environment section).

## What's next

1. **v1.1 — Filtering & richer stats — BUILT & verified live (2026-07-06).**
   Filtering by read year/month, publication-year range, author gender, and the
   controlled Fiction/Non-fiction/Other taxonomy — in the library **and** the
   dashboard (4 new book breakdown charts + dashboard-wide filter). Built by
   backend + frontend agents in parallel; integrated clean (`npm run build` +
   34 unit tests pass). Verified in-browser: compound AND filters narrow
   correctly (e.g. non-fiction ∧ History ∧ female = 35) and the dashboard
   recomputes under a filter. See [PRD.md](PRD.md) → "v1.1",
   [ARCHITECTURE.md](ARCHITECTURE.md), [API_SPEC.md](API_SPEC.md).

   **Backfill complete: 363/363** books categorized (fiction 129 / non-fiction
   219 / other 15), all marked `metadataUnverified=true` pending review. The
   backfill script now retries on transient Gemini 503/429 with backoff and
   drops ambiguous duplicate ids (critic fixes W3/W4). It stays idempotent
   (`genreCategory IS NULL`), so it's safe to re-run for any future books.

   Critic review (PR #2) findings all addressed — subgenre filtering is now
   category-scoped, backfill defaults unclassifiable rows to "other", +5 tests
   (39/39 pass). See [DECISIONS.md](DECISIONS.md).

   The "lightweight review affordance" (PRD) is satisfied by the **"Unverified
   only" filter + badges + edit-to-confirm** flow; a dedicated bulk-review
   screen was not built (nice-to-have, not required).

2. **v1.2 — Inline autocomplete on the add form — BUILT & verified (2026-07-06).**
   Typeahead on the manual add form (books/movies/TV) with book suggestions
   scoped to the Creator when set; selecting autofills title/creator/year/
   genres/externalId (all editable) and enriches TMDB director on select. Built
   by backend + frontend agents in parallel → tester → critic. Critic fixes
   applied: enrichment-race guard, `creatorFor` numeric-id validation (blocks a
   TMDB path-traversal), Enter picks the first suggestion instead of submitting,
   and Creator-change re-scopes book results. 66/66 tests, lint/build clean.
   See [PRD.md](PRD.md) / [ARCHITECTURE.md](ARCHITECTURE.md) / [API_SPEC.md](API_SPEC.md) → "v1.2".

   **Follow-ups (non-blocking):**
   - No component-level tests for `TitleAutocomplete`/`EntryForm` async paths
     (debounce, stale-guard, keyboard nav) — the repo has no jsdom/RTL harness;
     verified live instead. Worth adding a testing-library setup if this area
     grows.
   - Open Library `title=` matches whole words, so partial fragments ("war and
     pea") return nothing until the word completes. Switching book search to
     OL's general `q=` would improve partial matching at some relevance cost.
   - Autofilled genres from a *book* result aren't saved (books use the v1.1
     category/subgenre fields, not the freeform genres input) — harmless, noted.

3. **Homelab deployment (deferred by design).** Docker Compose currently only
   runs Postgres; the app runs via `npm run dev`. Moving to the Mini PC means
   adding `app` + `caddy` services to `docker-compose.yml` and setting up
   Tailscale — scoped from the start as a config-only step with **no app code
   changes expected**. Open question: public domain for Caddy's cert vs.
   Tailscale-only access (see PRD).

## Quick orientation for a fresh session

1. Read this file, then [../CLAUDE.md](../CLAUDE.md) for stack details and gotchas.
2. `git log --oneline` to see what's actually landed vs. this snapshot.
3. Top two gotchas: Auth.js sign-in must use `redirectTo` (not manual
   `redirect()`), and the Prisma client needs a dev-server restart after schema
   changes. Both documented in CLAUDE.md's Gotchas section.
