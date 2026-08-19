# Media Tracker — Architecture

_Owned by the Architect persona. How the product is built. Requirements live in
[PRD.md](PRD.md); decision rationale in [DECISIONS.md](DECISIONS.md)._

## Tech stack (as actually built)

| Concern | Choice | Notes |
|---|---|---|
| Framework | **Next.js 16** (App Router, TypeScript, Turbopack) | Spec said 15; scaffold pulled 16 — fine. |
| Database | **PostgreSQL 16** via Docker Compose | Chosen over SQLite for concurrent multi-account writes. |
| ORM | **Prisma 7** (new `prisma-client` generator) | Client generated to `src/generated/prisma` (git-ignored). Prisma 7's "client" engine **requires a driver adapter** — we use `@prisma/adapter-pg` (`src/lib/prisma.ts`). Datasource URL lives in `prisma.config.ts` (reads `DATABASE_URL`), not the schema. |
| Auth | **Auth.js v5** (`next-auth@beta`), Credentials provider, **JWT sessions**, bcrypt | Config in `src/auth.ts`. Enforced **server-side** via `requireUser()` (`src/lib/session.ts`) in the `(app)` layout — no edge middleware (bcrypt/Prisma can't run on edge). |
| Metadata APIs | TMDB (movies/TV), Open Library (books) | Server-side only; keys never reach the client. |
| Recommendations | Google Gemini API (free tier, Gemini 2.5 Flash) via **@google/genai** | Server-side, cached per user, explicit-regenerate only. |
| UI | Tailwind v4, Recharts (charts), zod (validation) | |
| Hosting (later) | Docker Compose on homelab Mini PC; Caddy for HTTPS; Tailscale for remote access | No port-forwarding. |

## Data model

**User** — id, email (unique), password_hash, created_at

**Entry** — id, user_id (FK → User), title, media_type (book | tv | movie),
external_id (nullable, TMDB/OpenLibrary id if matched), creator, year, genres
(string array), status (want | in_progress | completed | dropped), rating (1–5,
nullable), notes (nullable), created_at, updated_at, completed_at (nullable,
set when status → completed; user-editable as "Date read")

**RecommendationCache** — id, user_id (FK → User), generated_at, suggestions
(JSON: array of {title, media_type, reason})

**GreatBook** — reference table for the "Greatest Books of All Time" top-500
list, seeded from `the_greatest_books_of_all_time.csv`. Matching against user
entries is by normalized title (`src/lib/normalize.ts` — normalization MUST
match between seeding and matching).

Relationships: one User has many Entries and (at most, latest) one active
RecommendationCache. Prisma schema maps directly to this; migrations are
checked into the repo.

## v1.1 — Filtering & richer metadata (design)

Implements the PRD's "Filtering & richer stats". Requirements in
[PRD.md](PRD.md); rationale in [DECISIONS.md](DECISIONS.md).

### Schema changes (`Entry`)

New enums:

```prisma
enum AuthorGender { female  male  non_binary  mixed  unknown }
enum GenreCategory { fiction  non_fiction  other }
```

New `Entry` columns:

| Column | Type | Notes |
|---|---|---|
| `authorGender` | `AuthorGender @default(unknown)` | Books-only in the UI; stored on all rows (non-books stay `unknown`). Not nullable — `unknown` *is* the "no value" member, which avoids null-handling in filters/charts. |
| `genreCategory` | `GenreCategory?` | Nullable: null = not yet categorized (movies/TV, or un-backfilled books). |
| `subgenres` | `String[] @default([])` | Controlled vocabulary, validated app-side against `taxonomy.ts` (mirrors the existing `genres[]` pattern). Must belong to the row's `genreCategory`. |
| `metadataUnverified` | `Boolean @default(false)` | Set `true` by the AI backfill; cleared when the user saves the edit form (= confirmation). Powers the "review backfilled data" filter. |

`year` (publication) is **reused as-is** — backfill just populates it. Note it
is overloaded: for books it means publication year, for movies/TV the release
year; the `pubFrom`/`pubTo` filter applies to `year` regardless of media type,
so a publication-year filter also constrains movies/TV by release year. Harmless
in practice (the UI labels it under book context) but a latent conflation.

New indexes (cheap; n is small but keeps filtered reads honest):
`@@index([userId, genreCategory])`, `@@index([userId, authorGender])`,
`@@index([userId, completedAt])`.

### Taxonomy — single source of truth

New module `src/lib/taxonomy.ts` exports the category → subcategory map (the
PRD's confirmed list, incl. the **Other** top-level: Poetry, Drama/Play,
Anthology, Reference). Consumed by **all** of: the add/edit form (dropdowns),
`validation.ts` (zod refinement — a subgenre must be valid for its category),
the backfill script (constrains the model), and the filter parser. Like
`normalize.ts`, this file is a "keep everything in sync from one place" module.

### AI backfill — `scripts/backfill-metadata.ts` (run via `npx tsx`)

- Idempotent, user-scoped (default: the demo account). Targets **books where
  `genreCategory IS NULL`** so re-runs don't clobber confirmed data.
- Batches ~30 books/call to Gemini (`@google/genai`, structured JSON output like
  `recommendations.ts`), passing each entry's `id` + title + author and the full
  taxonomy. Model returns `{ id, publicationYear, authorGender, genreCategory,
  subgenres[] }` per book; app-side we validate every field against the enums +
  taxonomy, drop invalid subgenres, and clamp unknown gender.
- Writes with `metadataUnverified = true`. Small delay between batches for
  free-tier RPM limits. ~363 books ≈ ~12 calls.

### Filtering — query contract

Server components read filters from URL search params (extending today's
`?type=&status=`) and build one Prisma `where`. See [API_SPEC.md](API_SPEC.md)
for the exact param grammar and the shared `EntryFilters` type. Composition
rule: **AND across dimensions, OR within a dimension** (`in` / `hasSome`).
`getDashboardStats(userId, filters)` takes the same `EntryFilters` so every
dashboard stat/chart recomputes over the filtered subset.

### App-structure additions

- Shared **`FilterBar`** component + a `parseEntryFilters(searchParams)` helper,
  used by **both** `/library` and `/dashboard`.
- `stats.ts` gains book breakdowns: gender split, category split, top subgenres,
  publication-decade histogram → new Recharts panels in `DashboardCharts`.
- `EntryForm` gains an author-gender `<select>` and category/subgenre controls
  (subgenre options derive from the selected category via `taxonomy.ts`).

## v1.2 — Inline autocomplete on the add form (design)

Implements the PRD's "Inline autocomplete". A thin typeahead over the existing
`/api/search`; see [API_SPEC.md](API_SPEC.md) for the exact contract.

### Backend

- **`searchOpenLibrary(query, author?)`** — when `author` is passed, add Open
  Library's `author` search field alongside `title`, scoping book suggestions to
  that author.
- **`/api/search` gains two optional modes** (still auth-guarded, results still
  capped at 12/source):
  - `author=` → forwarded to `searchOpenLibrary`; **books only** (TMDB search
    can't filter by director, so it's ignored for screen titles).
  - `creatorFor=<externalId>` → returns `{ creator }` via the existing
    `getTmdbCreator`, for on-select **director enrichment** of a chosen
    movie/TV title (whose search result carries no creator). When present,
    `q`/`type` are ignored.

### Frontend

- **`TitleAutocomplete`** (new `"use client"` component) owns the Title
  `<input name="title">` plus a suggestion dropdown:
  - Debounced (~250 ms), fires at ≥2 chars, queries
    `/api/search?q=&type=&author=` where `type` = the form's current media type
    and `author` = the current Creator value (sent for books only).
  - **Stale-response guard**: `AbortController` + a monotonic request id, so only
    the latest response renders (out-of-order results can't clobber).
  - Keyboard: ↑/↓ move the highlight, Enter selects, Esc closes; click selects;
    blur closes (deferred so a click lands first). ARIA combobox/listbox/option
    with `aria-activedescendant`.
  - Each row shows cover thumb · title · creator · year (cover is **display
    only** — the Entry model stores no image, so nothing to autofill there).
  - Emits `onSelect(result)`; suppresses reopening right after a selection so
    autofill doesn't retrigger a search.
- **`EntryForm` refactor**: lift `title`, `creator`, `year`, `genres`,
  `mediaType`, `externalId` into controlled `useState` (the other fields stay
  uncontrolled). On `onSelect`, set those from the result — genres joined to the
  comma field, `externalId` set — and for a movie/TV pick with no creator, fire
  the `creatorFor` enrichment and fill Creator when it resolves. **Every field
  stays editable.** Editing the Title by hand after a selection clears
  `externalId` (it no longer points at a specific external work). The v1.1
  structured fields (category/subgenre/gender) are untouched by autofill.

## Application structure

Single Next.js app: App Router pages for UI, Route Handlers (`/app/api/*`) for
backend logic. No separate backend service.

- `src/app/(auth)/` — login + register pages/actions (redirects to /dashboard if signed in).
- `src/app/(app)/` — protected shell (NavBar + `requireUser`): dashboard, library,
  recommendations, great-books.
- `src/lib/` — `prisma.ts`, `session.ts`, `validation.ts` (zod schemas),
  `stats.ts` (dashboard aggregates), `recommendations.ts` (Gemini, incl.
  list-constrained mode and retry-once), `greatbooks.ts` (list-progress),
  `normalize.ts`, `display.ts` (shared labels/icons/badges),
  `search/` (`openlibrary.ts`, `tmdb.ts`, `types.ts`; consumed by `/api/search`).
- Client components: `DashboardCharts`, `SearchClient`, `EntryForm`, `AuthForm`,
  `GenerateRecsButton`, `DeleteEntryButton`, `NavBar`.
- External image hosts allowlisted in `next.config.ts` (OpenLibrary/TMDB covers).
- Scripts (run via `npx tsx`): `scripts/seed-greatbooks.ts`,
  `scripts/ingest-books.ts <txt>`.

## Security approach

- All API routes and pages check the session server-side before returning
  user-scoped data; every query is scoped by the authenticated user id.
- Passwords bcrypt-hashed; sessions are JWT cookies via Auth.js.
- TMDB / Open Library / Gemini calls happen server-side only, so API keys never
  reach the client. Gemini calls are triggered by explicit user action only.
- Secrets in `.env` (git-ignored; template in `.env.example`): `DATABASE_URL`,
  `AUTH_SECRET`, `TMDB_API_KEY`, `GEMINI_API_KEY`.

## Deployment phases

- **Prototype (current):** runs locally on the Mac via `npm run dev`; only
  Postgres is containerized (`docker compose up -d`, container
  `media-tracker-db`). Docker runtime is Colima.
- **Homelab (later, config-only):** add `app` (Next.js) and `caddy` services to
  `docker-compose.yml`; Caddy terminates TLS and reverse-proxies to `app`;
  Tailscale for remote access. **No application code changes expected.**
