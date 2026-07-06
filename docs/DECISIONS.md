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
- **the demo user's ingest: "+" markers become 5★ ratings, everything else unrated** —
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
