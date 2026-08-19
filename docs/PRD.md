# Media Tracker — PRD

_Owned by the PM persona. What we're building and why. For how it's built see
[ARCHITECTURE.md](ARCHITECTURE.md); for current status see
[NEXT_STEPS.md](NEXT_STEPS.md)._

## Problem & goal

People (the user, plus friends/family who each get their own account) want a
single place to log books, TV shows, and movies they've consumed, see
stats/trends about their own habits over time, and get a small number of
AI-generated "what to try next" suggestions based on their own logged history.
Today this is scattered across Goodreads/Letterboxd/memory, with no cross-media
view and no personalized recs tied to one's actual combined history.

Success looks like: each user privately logs their media in one place, sees
meaningful trends, and gets useful recommendations grounded in what they've
actually read/watched.

## Target users

- The owner and a small circle of friends/family, each
  with their own private account. No public users, no scale requirements beyond
  a handful of concurrent people.

## MVP scope

All MVP items below are **built and verified live** (see NEXT_STEPS.md).

- [x] User can create an account with email + password; passwords are bcrypt-hashed
- [x] User can log in / log out; sessions persist via secure cookie
- [x] Each user's library (entries, ratings, stats) is private to that account by default
- [x] User can search TMDB for a movie or TV show by title and add a result to their library
- [x] User can search Open Library for a book by title and add a result to their library
- [x] User can manually add an entry if search doesn't find the item, with fields:
      title, type (book/show/movie), creator (author/director), year, genre(s)
- [x] User can mark an entry's status: Want to consume / In progress / Completed / Dropped
- [x] User can rate a completed entry 1–5 stars
- [x] User can add a free-text note to any entry
- [x] User can edit or delete any entry in their own library
- [x] User can view a dashboard with: total counts by type, counts by genre, ratings
      distribution, and a timeline chart of completions over time
- [x] User can view a "pace" stat: average items completed per month, per media type
- [x] User can request recommendations; system sends the user's completed items + ratings
      to the Gemini API and returns 5 suggested titles with a one-line reason each
- [x] Recommendations are cached and only regenerated on explicit user request (not
      auto-refreshed), to control API cost
- [x] All data and views are scoped per-account — no user can see another user's library

Added post-spec (also done):
- [x] Editable "Date read" (`completedAt`) on entries
- [x] Greatest Books goal — 500-book reference list + `/great-books` progress page
- [x] Recommendations optionally constrained to unread Greatest Books

## v1.1 — Filtering & richer stats (planned)

**Goal.** Let a user slice their logged library along the dimensions they
actually think in — *when* they read something, *when* it was written, the
*author's gender*, and a real *fiction / non-fiction genre* structure — both in
the library list and in the dashboard visualizations. Motivated directly by a
real user signal: the demo user's source reading list already tracks "% women per
year" by hand; the app should make that (and more) first-class.

**The core challenge is data, not UI.** Three of the four filter dimensions
have no data today: `year` (publication) and `genres` are empty for all 363
imported books, and author gender has no field at all. So this feature is as
much a data-population effort as a UI one. (Decided: AI-assisted backfill —
see Decisions log.)

### New/enriched fields (requirements; schema owned by Architect)

- **Read date** — already captured (`completedAt`). No new data; new filters
  only.
- **Publication year** — reuse existing `year`. Backfill for existing books.
- **Author gender** *(books only)* — new field. Values: **Female, Male,
  Non-binary, Mixed** (multi-author / collective), **Unknown** (default /
  un-backfilled / ambiguous). Not applied to movies/TV in this version.
- **Genre — controlled 2-level taxonomy** *(books)*. Each book gets one
  **top-level category** (Fiction / Non-fiction / Other) and zero-or-more
  **subcategories** drawn from a fixed list under that category. Movies/TV keep
  their existing freeform genre tags from TMDB for now.

  **Taxonomy (confirmed):**
  - **Fiction:** Literary, Classic, Science fiction, Fantasy,
    Mystery/Crime/Thriller, Historical fiction, Horror, Romance, Short stories,
    Graphic novel.
  - **Non-fiction:** History, Biography/Memoir, Politics/Current affairs,
    Science, Philosophy, Economics, Social science, Essays, Art/Culture,
    Religion, Travel, True crime, Practical/Self-help.
  - **Other:** Poetry, Drama/Play, Anthology, Reference — forms that don't sit
    cleanly on the fiction/non-fiction line.

- **Metadata provenance** — backfilled values are marked *AI-suggested,
  unverified* until the user confirms/edits, so inferred author gender in
  particular is never presented as ground truth.

### Filtering (library)

- [ ] Extend the existing library filter bar with: **read year** (and month
      within a year), **publication year** (range / decade), **author gender**
      (multi-select), and **genre** (top-level + subcategory multi-select).
- [ ] Multiple values *within* a dimension are OR'd; *different* dimensions are
      AND'd (e.g. "Non-fiction ∧ History ∧ Female ∧ read in 2023").
- [ ] Filters are shareable/bookmarkable via URL query params (consistent with
      today's `?type=&status=`).

### Visualization (dashboard) — "both filters + new charts"

- [ ] New breakdown charts for books: **author-gender split**, **fiction vs
      non-fiction**, **top subgenres**, and **books by publication decade**.
- [ ] The same filter set applies to the **whole dashboard**, recomputing every
      stat/chart for the filtered subset (not just the new charts).

### Data population

- [ ] One-time **AI backfill script** (reuses the wired-up Gemini client):
      infer publication year, author gender, and category + subcategories for
      each existing book from title + author, writing values as *unverified*.
- [ ] **New adds** get the same fields on the add/edit form, pre-filled with
      AI/search suggestions where possible, always user-editable.
- [ ] A lightweight **review affordance** so the user can sweep and confirm/fix
      unverified values (gender especially).

### Scope boundaries for v1.1

- Author gender and structured genre are **books-only**; movies/TV are
  unchanged (they keep freeform TMDB genres and have no gender field).
- Backfill accuracy is best-effort; the review step, not the model, is the
  source of truth.

### Success criteria

- A user can filter their completed books to e.g. "Non-fiction · History · Female
  authors · read in 2023" and get the correct set.
- The dashboard, with that filter applied, recomputes all stats and shows a
  gender split and fiction/non-fiction split consistent with the filtered set.
- After backfill + a review pass, the large majority of the 363 books have
  publication year, category, and gender populated.

## v1.2 — Inline autocomplete on the add form (planned)

**Goal.** When adding an entry manually, typing a title surfaces live
autocomplete suggestions; picking one autofills the metadata fields (still
editable). Removes the "type it all by hand" friction and reduces typos/dupes,
without forcing users through the separate search page.

**Reuses existing infra.** `/api/search` already returns the needed shape
(title, creator, year, genres, cover, externalId) for books (Open Library) and
movies/TV (TMDB). This feature surfaces those as a typeahead on the add form.

### Behavior

- [ ] As the user types the **Title** (debounced, ~2+ chars), a dropdown shows
      matching suggestions for the currently-selected **Type** (book → Open
      Library, movie/TV → TMDB).
- [ ] **Author scoping (books):** if the **Creator** field is already filled,
      book suggestions are limited to that author. (Screen titles can't be
      scoped by director — TMDB search has no such filter — so the author
      constraint applies to books only.)
- [ ] Selecting a suggestion **autofills** title, creator, year, genres, cover
      reference, and the external id. **Every field stays editable** — the user
      can override any autofilled value before saving.
- [ ] Keyboard-navigable (↑/↓/Enter/Esc), click to select, dismiss on blur.
- [ ] Graceful states: no matches, TMDB-not-configured (books still work),
      request errors, and stale-response guarding (out-of-order results).

### Scope boundaries for v1.2

- Autocomplete covers **all three types**; the **author-filter is books-only**
  (API constraint above).
- Autofill covers metadata fields only. The v1.1 **structured book fields**
  (category, subgenre, author gender) aren't in the metadata APIs, so they stay
  user-set (or a later inference step) — selecting a suggestion doesn't touch
  them.
- The dedicated **`/library/search` page stays** (browse-with-covers); inline
  typeahead is additive, for fast known-item entry.

### Success criteria

- Typing "war and pea" with author "Tolstoy" already filled suggests War and
  Peace by Tolstoy; selecting it fills creator/year/genres, and the user can
  still change the year before saving.
- Typing a movie title with Type=Movie suggests TMDB matches and autofills on
  select; no author-filter is applied to screen titles.
- With no TMDB key, book autocomplete still works and screen autocomplete
  degrades to a clear "not configured" state rather than erroring.

## Explicitly out of scope (v1)

- Shared/group lists or any cross-user visibility
- Rules-based or collaborative-filtering recommendation engines
- Social features (following, sharing, comments)
- Mobile app / native clients — web only, responsive layout is enough
- Import from Goodreads/Letterboxd/etc. (one-off scripted ingests like the demo
  book list are scripts, not a product feature)
- Google/social sign-in — email/password only for v1
- Notifications/reminders
- Offline support / PWA installability

## Success criteria

- A user can register, log in, search and add at least one book, one movie, and
  one TV show, mark one as completed with a rating, and see it reflected
  correctly in the dashboard stats. ✅ verified
- A second user account cannot see the first user's entries under any view.
  ✅ verified
- Requesting a recommendation returns 5 suggestions tied to the requesting
  user's own logged history within a few seconds (bounded by Gemini API
  latency). ✅ verified
- (Deferred with deployment) The app runs via `docker compose up` on the Mini PC
  and is reachable over Tailscale from another device.

## Open questions

- ~~TMDB API key~~ — resolved: registered, working.
- ~~Gemini API key~~ — resolved: registered, working; free-tier privacy
  trade-off accepted for personal library data.
- Domain name for Caddy's HTTPS cert, or is Tailscale-only access (no public
  domain) acceptable for v1? Not blocking until the homelab deployment step.
