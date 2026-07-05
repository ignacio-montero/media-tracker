@AGENTS.md

# Media Tracker — project handoff

Personal multi-user app to log books, TV, and movies; see stats/trends; and get
AI "what to try next" suggestions from your own history. Full spec:
[media-tracker-spec.md](media-tracker-spec.md).

## Current phase: local Mac prototype
Runs on the Mac via `npm run dev`. Only Postgres is containerized. Homelab/Docker
deployment is a later, config-only step (no app code changes expected).

## Stack (as actually built — note deviations from spec)
- **Next.js 16** (App Router, TS, Turbopack) — spec said 15; scaffold pulled 16 (fine).
- **Prisma 7** with the new `prisma-client` generator → client generated to
  `src/generated/prisma` (git-ignored). Prisma 7's "client" engine **requires a
  driver adapter**: we use `@prisma/adapter-pg` (see `src/lib/prisma.ts`).
  Datasource URL lives in `prisma.config.ts` (reads `DATABASE_URL`), not the schema.
- **Auth.js v5** (`next-auth@beta`), Credentials provider, **JWT sessions**, bcrypt.
  Config in `src/auth.ts`. Protection is enforced **server-side** via
  `requireUser()` (`src/lib/session.ts`) in the `(app)` layout — no edge middleware
  (bcrypt/Prisma can't run on edge).
- **Tailwind v4**, **Recharts** (charts), **@google/genai** (Gemini), **zod**.

## Run it locally
```bash
docker compose up -d          # start Postgres (container: media-tracker-db, port 5432)
npm run dev                   # Next dev server on http://localhost:3000
npx prisma migrate dev        # apply schema changes
npx prisma studio             # inspect data
```
Node/Docker are installed via Homebrew; Docker runtime is **Colima** (`colima start`
if the daemon isn't up). `docker compose` plugin is symlinked into `~/.docker/cli-plugins`.

## Environment (`.env`, git-ignored; template in `.env.example`)
- `DATABASE_URL` — local Postgres (set).
- `AUTH_SECRET` — generated (set).
- `TMDB_API_KEY` — **empty**, user registering. Blocks movie/TV search-import.
- `GEMINI_API_KEY` — **empty**, user registering. Blocks recommendations.

## App structure
- `src/app/(auth)/` — login + register pages/actions (redirects to /dashboard if signed in).
- `src/app/(app)/` — protected shell (NavBar + `requireUser`): dashboard, library, recommendations.
- `src/lib/` — `prisma.ts`, `session.ts`, `validation.ts` (zod schemas).

## State — MVP feature-complete (prototype)
All spec MVP features are built and pass a clean `npm run build`.
- ✅ Env + Postgres + Prisma schema/migration (`init`).
- ✅ Auth: register/login/logout, per-account. Isolation verified (2nd user can't
  see the 1st's data).
- ✅ Library CRUD + manual entry (status, rating, notes; `completedAt` transitions).
- ✅ Search-import: **Open Library (books) + TMDB (movies/TV) both verified live.**
  Keys are set in `.env`. Degrades gracefully if a key is missing.
- ✅ Dashboard: counts by type/genre, ratings distribution, completions timeline
  (stacked area; **adaptive: monthly ≤2yr span, else yearly**), pace per type,
  avg rating. Recharts.
- ✅ Gemini recommendations: **verified live** (Gemini 2.5 Flash structured JSON →
  cache → display), explicit-regenerate only.
- ✅ **Editable "Date read"** (`completedAt`) on entries — form field + shown in library.
- ✅ **Greatest Books goal** (thegreatestbooks.org top 500): `GreatBook` reference
  table, `/great-books` progress page (count/%, per-100 breakdown, 500-cell rank
  grid, read + next-up lists). Matching is by normalized title (`src/lib/normalize.ts`).
- ✅ **Recs "only from the Greatest Books list"** toggle — constrains Gemini to
  unread list books.

### Real data loaded (replaces the old fake demo)
- **the demo user's ~363 books** (2017–2026) ingested from `reading-list.rtf`. "+" in
  the source = favourite → stored as 5★; others unrated. Account:
  `demo@example.com` / `<redacted-password>` — the main demo account now.
- Old `test@example.com` demo entries were removed (account kept, empty).

### Data files & scripts (in repo root / scripts/)
- `the_greatest_books_of_all_time.csv` — source for the 500 list.
- `reading-list.rtf` — source for the demo user's library.
- `scripts/seed-greatbooks.ts` — seeds `GreatBook` from the CSV.
- `scripts/ingest-books.ts <txt>` — parses the (RTF→txt) list, creates the demo user's
  account, removes test-account demo data. Both run via `npx tsx`.
- Re-ingest: `textutil -convert txt -output /tmp/l.txt reading-list.rtf && npx tsx scripts/ingest-books.ts /tmp/l.txt`.

### Remaining before "done"
- (Later) homelab Docker Compose `app`+`caddy` services; Tailscale.
- Minor: the demo user's 2017 ingested count is 39 vs. the source list's stated 40 —
  one line likely didn't parse a date cleanly. Not investigated.
- Minor: one list-constrained recommendation generation returned instantly with
  no result (looked like a transient/empty Gemini response); a retry succeeded.
  Only seen once — watch for recurrence, add a retry if it does.

### More app structure (added since auth)
- `src/lib/search/` — `openlibrary.ts`, `tmdb.ts`, `types.ts`; `/api/search` route.
- `src/lib/stats.ts` — dashboard aggregates. `src/lib/recommendations.ts` — Gemini
  (+ list-constrained mode). `src/lib/greatbooks.ts` — list-progress computation.
- `src/lib/normalize.ts` — title normalization (MUST match between seed + matching).
- `src/lib/display.ts` — shared labels/icons/badges.
- Charts/UI clients: `DashboardCharts`, `SearchClient`, `EntryForm`, `AuthForm`,
  `GenerateRecsButton`, `NavBar`.
- External image hosts allowlisted in `next.config.ts` (OpenLibrary/TMDB covers).

## Gotchas
- npm 11 gates package install scripts; new deps with postinstall (e.g. Prisma)
  need `npm approve-scripts <pkg>` or they silently don't build.
- **Auth.js credentials sign-in must use `signIn(..., { redirectTo })`**, letting
  signIn own the redirect. The `redirect: false` + manual `redirect()` pattern
  does NOT propagate the session `Set-Cookie`, so login silently fails to persist.
  Re-throw signIn's redirect error; catch only `AuthError` for bad credentials.
- **Recharts areas/bars animate on mount** — a screenshot taken <2s after load
  can look empty even though the DOM has the paths. Wait before capturing.
- **Regenerating the Prisma client requires a dev-server restart** — a running
  `next dev` holds the old client in memory, so a newly-added model reads as
  `undefined` (e.g. `prisma.greatBook` → "Cannot read properties of undefined").
  Restart after `prisma generate` / new migrations.
- Accounts: `demo@example.com` / `<redacted-password>` (main demo, 363 real books),
  `test@example.com` / `<redacted-password>` (now empty) and `second@example.com` /
  `<redacted-password>` (empty, isolation test). Full reset:
  `docker compose down -v && docker compose up -d && npx prisma migrate dev`, then
  `npx tsx scripts/seed-greatbooks.ts` and re-run the the demo user ingest.
