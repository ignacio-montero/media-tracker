# Media Tracker — Decisions log

Notable decisions and their rationale, most recent last.

## Scoping / architecture (pre-build)

- **Multi-user with separate accounts and private libraries** — the whole point
  is that friends/family each track their own media.
- **Email/password auth only** — no social login in v1; smallest auth surface
  that meets the need.
- **Search-and-import from TMDB/Open Library as the primary add flow**, manual
  entry as fallback — metadata quality without manual typing.
- **Recommendations via direct LLM prompting (Google Gemini API, free tier)**
  with the user's own rated history — not a rules-based or collaborative-
  filtering engine (overkill for n≈3 users), not a local model (Ollama) or paid
  API. Cached per user, regenerated only on explicit request, to control cost.
- **Postgres over SQLite** — specifically because of concurrent multi-account
  writes.
- **Self-hosted on the homelab Mini PC via Docker, remote access via
  Tailscale** — no public hosting cost, no port-forwarding.
- **Stats include trends over time** (pace, ratings over time), not just static
  counts.
- **No deadline** — build for correctness/quality over speed.

## During build

- **No edge middleware for auth** — bcrypt/Prisma can't run on the edge
  runtime, so protection is enforced server-side via `requireUser()` in the
  `(app)` layout instead.
- **Adaptive dashboard timeline** — completions chart buckets monthly for a
  span ≤2 years, yearly beyond that, so long histories (the demo user's 2017–2026)
  stay readable.
- **Greatest Books matching by normalized title** (`src/lib/normalize.ts`), not
  external ids — the CSV list has no ids; normalization must stay identical
  between seeding and matching.
- **Book-list ingest: "+" markers become 5★ ratings, everything else unrated** —
  faithful to how the source list encodes favourites without inventing ratings.

## v1 polish pass (2026-07-06)

- **Gemini empty-response retry-once** (`src/lib/recommendations.ts`):
  `requestSuggestions` calls `callGeminiOnce` up to 2×, retrying once on an
  empty/unparseable response. **Semantic change:** a *persistently* empty
  result now throws and is **not** cached — the old code cached an empty `[]`
  as a silent success. The retry reuses the same prompt with no backoff, so it
  only rescues transient emptiness, not deterministic failures.
- **"2017 (40)" count gap is a source miscount, not a bug** — the RTF lists 39
  books under that header; the ingest captured all 39. No code change. (The RTF
  isn't in version control, so this is only re-verifiable from the local copy.)
- **Delete confirmation is a client-side `confirm()` guard**
  (`DeleteEntryButton`, `"use client"`) — JS-dependent by accepted trade-off,
  since the app already assumes JS. Added because deletion is irreversible.
- **Mobile nav wraps** instead of overflowing on ~375px screens.

## v1.1 filtering & richer stats (2026-07-06, planning)

- **AI-assisted backfill over manual or external-API population** — the killer
  constraint is that pub year, genre, and author gender are empty/absent for all
  363 existing books. Manual entry across 363 books is unrealistic; external
  APIs (Open Library) give pub year + messy subjects but *no* reliable gender.
  Gemini is already wired up, so a one-time inference script covers all three
  fields at once. Values land as **AI-suggested/unverified** so nothing inferred
  (gender especially) is treated as ground truth without a user review pass.
- **Controlled 2-level genre taxonomy over freeform tags** — the user asked
  specifically for Fiction / Non-fiction with subcategories. A fixed vocabulary
  (top-level + curated subcategory list) keeps filters and charts consistent;
  freeform tags would make subgenre aggregation noisy. Proposed list lives in
  the PRD, open to revision.
- **Author gender is books-only, values {Female, Male, Non-binary, Mixed,
  Unknown}** — matches how the user tracks it; "Mixed" handles multi-author
  works, "Unknown" is the honest default for un-backfilled/ambiguous cases.
  Directors/creators for movies/TV are excluded this round to bound scope and
  avoid noisier inference.
- **Dashboard gets both new charts and a dashboard-wide filter** — the new
  dimensions drive four book breakdowns (gender, fiction/non-fiction,
  subgenres, publication decade) and also filter every existing stat, so the
  whole dashboard reflects the filtered subset.
- **Structured genre + gender are additive to the schema; movies/TV keep
  freeform TMDB genres** — avoids reworking the search-import path and keeps the
  change focused on the book-heavy library.

## Great Books "Next up" personalization (2026-07-06)

- **"Next up" is a deterministic taste-match, not an LLM call** — it ranks
  unread list books by author affinity (books read by the same author, boosted
  by ratings) + publication-era match, with list rank as a small tiebreaker.
  Chosen over reusing the Gemini list-recommendation because "Next up" renders
  on every page load, and calling Gemini there would break the standing
  explicit-trigger/cached cost-control rule. Free, instant, explainable, and
  cold-start-safe (no history → collapses to acclaim/rank order, the old
  behavior). Logic is the pure, unit-tested `rankNextUp` in `src/lib/greatbooks.ts`.
- **Author matching keys on first-initial + surname** (e.g. "z smith") for
  grouping, but the "you've read N by X" reason is only asserted when that key
  resolves to a single distinct name (exact match, or one format/spelling
  variant) — a genuine collision (Anne vs Antony vs Anita Rice) grants no author
  credit and falls back to an era/acclaim reason, so the panel never misstates
  what you've read. Library `creator` strings are reduced to their **first
  author** before keying (drops co-authors/translators like
  "Tolstoy, Louise Maude"). The Gemini list-recommendation ("For You") remains
  the higher-quality, on-demand option.

## v1.2 inline autocomplete (2026-07-06, planning)

- **Reuse `/api/search`, don't build a new suggestion source** — it already
  returns the exact shape (title, creator, year, genres, cover, externalId) for
  books (Open Library) and movies/TV (TMDB). The add-form typeahead is a thin
  client over it; extend the endpoint with an optional `author` param that maps
  to Open Library's `author` search field.
- **Author-filter is books-only** — TMDB's search endpoint can't scope by
  director (director is only recoverable via a separate lookup after selection),
  so the "limit suggestions to this author" behavior applies to book search
  only. Movies/TV still get title autocomplete, just unscoped.
- **Keep the dedicated `/library/search` page** — inline typeahead is additive
  (fast known-item entry); the search page keeps the cover-browse experience.
  Not retiring it avoids a larger change for a feature meant to reduce friction.
- **Autofill is metadata-only** — selecting a suggestion fills title/creator/
  year/genres/cover/externalId (all overridable), but not the v1.1 structured
  book fields (category/subgenre/gender), which the metadata APIs don't carry.
