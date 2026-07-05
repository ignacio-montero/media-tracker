# Media Tracker — Build Spec (v1)

## 1. Problem & Users
People (the user, plus friends/family who each get their own account) want a single
place to log books, TV shows, and movies they've consumed, see stats/trends about their
own habits over time, and get a small number of AI-generated "what to try next"
suggestions based on their own logged history. Today this is scattered across
Goodreads/Letterboxd/memory, with no cross-media view and no personalized recs tied to
one's actual combined history.

## 2. Recommended Tech Stack
- **Framework:** Next.js 15 (App Router, TypeScript)
- **Database:** PostgreSQL 16, run via Docker Compose
- **ORM:** Prisma
- **Auth:** Auth.js (NextAuth) v5, Credentials provider, bcrypt password hashing
- **External metadata APIs:** TMDB (movies/TV), Open Library API (books)
- **Recommendations:** Google Gemini API (free tier, Gemini 2.5 Flash), server-side call,
  results cached per user
- **Charts:** Recharts
- **Hosting:** Docker Compose on user's homelab Mini PC; Caddy reverse proxy for HTTPS;
  Tailscale for remote access (no port-forwarding)

## 3. Core Scope (MVP)
- [ ] User can create an account with email + password; passwords are bcrypt-hashed
- [ ] User can log in / log out; sessions persist via secure cookie
- [ ] Each user's library (entries, ratings, stats) is private to that account by default
- [ ] User can search TMDB for a movie or TV show by title and add a result to their
      library
- [ ] User can search Open Library for a book by title and add a result to their library
- [ ] User can manually add an entry if search doesn't find the item, with fields:
      title, type (book/show/movie), creator (author/director), year, genre(s)
- [ ] User can mark an entry's status: Want to consume / In progress / Completed /
      Dropped
- [ ] User can rate a completed entry 1–5 stars
- [ ] User can add a free-text note to any entry
- [ ] User can edit or delete any entry in their own library
- [ ] User can view a dashboard with: total counts by type, counts by genre, ratings
      distribution, and a timeline chart of completions over time (monthly buckets)
- [ ] User can view a "pace" stat: average items completed per month, per media type
- [ ] User can request recommendations; system sends the user's completed items + ratings
      to the Gemini API and returns 5 suggested titles with a one-line reason each
- [ ] Recommendations are cached and only regenerated on explicit user request (not
      auto-refreshed), to control API cost
- [ ] All data and views are scoped per-account — no user can see another user's library

## 4. Data Model (conceptual)

**User**
- id, email (unique), password_hash, created_at

**Entry**
- id, user_id (FK → User), title, media_type (book | tv | movie), external_id (nullable,
  TMDB/OpenLibrary id if matched), creator, year, genres (string array), status
  (want | in_progress | completed | dropped), rating (1–5, nullable), notes (text,
  nullable), created_at, updated_at, completed_at (nullable, set when status → completed)

**RecommendationCache**
- id, user_id (FK → User), generated_at, suggestions (JSON: array of {title, media_type,
  reason})

Relationships: one User has many Entries and (at most, latest) one active
RecommendationCache.

## 5. Explicitly Out of Scope (v1)
- Shared/group lists or any cross-user visibility
- Rules-based or collaborative-filtering recommendation engines
- Social features (following, sharing, comments)
- Mobile app / native clients — web only, responsive layout is enough
- Import from Goodreads/Letterboxd/etc.
- Google/social sign-in — email/password only for v1
- Notifications/reminders
- Offline support / PWA installability

## 6. Architecture Notes
- Single Next.js app: App Router pages for UI, Route Handlers (`/app/api/*`) for backend
  logic. No separate backend service.
- Prisma schema maps directly to the data model above; migrations checked into repo.
- Auth.js handles session cookies; all API routes and pages check session server-side
  before returning user-scoped data.
- TMDB and Open Library calls happen server-side (Route Handlers) so API keys never
  reach the client.
- Gemini API calls happen server-side only, triggered by an explicit user action (button
  click → API route → Gemini API → store in RecommendationCache → return to client).
- **Prototype phase (current):** runs locally on a Mac via `npm run dev`, no Docker for
  the app itself. Postgres runs as a single local Docker container (`docker run
  postgres` or a one-service Compose file) — no `app` or `caddy` containers needed yet.
- **Later deployment phase (Mini PC/homelab):** Docker Compose file defines two services,
  `app` (Next.js) and `db` (Postgres); Caddy runs as a third service or on the host,
  terminating TLS and reverse-proxying to `app`. This is a deployment-config change only
  — no application code changes required to move from prototype to homelab.
- Environment variables (`.env`, not committed): `DATABASE_URL`, `NEXTAUTH_SECRET`,
  `TMDB_API_KEY`, `GEMINI_API_KEY`.

## 7. Key Decisions Already Made
- Multi-user with separate accounts and private libraries — decided.
- Email/password auth — decided, no social login in v1.
- Search-and-import from TMDB/Open Library as the primary add flow, manual entry as
  fallback — decided.
- Recommendations use direct LLM prompting via the Google Gemini API (free tier) with
  the user's own rated history, not a rules-based or ML collaborative-filtering engine,
  and not a local model (Ollama) or paid API (Anthropic) — decided.
- Stats include trends over time (pace, ratings over time), not just static counts —
  decided.
- Self-hosted on the user's homelab Mini PC via Docker, remote access via Tailscale —
  decided.
- Postgres over SQLite, specifically because of concurrent multi-account writes —
  decided.
- No real deadline — build for correctness/quality over speed.

## 8. Remaining Open Questions
- TMDB requires a free API key/account signup — confirm the user will register for one
  before build starts (blocking for the search-import feature).
- Gemini API requires a free Google AI Studio API key — confirm the user will register
  for one before build starts (blocking for the recommendations feature). No credit card
  required for the free tier at time of writing.
- Free-tier Gemini usage may have prompts reviewed/used to improve Google's products;
  confirm this is acceptable for personal library data before build starts. If not,
  fall back to a local model (Ollama) — no code-path change needed beyond swapping the
  API call target.
- Domain name for Caddy's HTTPS cert (or is Tailscale-only access, with no public
  domain, acceptable for v1)? Not blocking for the current Mac-local prototype phase.

## 9. Success Criteria
- A user can register, log in, search and add at least one book, one movie, and one TV
  show, mark one as completed with a rating, and see it reflected correctly in the
  dashboard stats.
- A second user account cannot see the first user's entries under any view.
- Requesting a recommendation returns 5 suggestions tied to the requesting user's own
  logged history within a reasonable time (a few seconds, bounded by Claude API latency).
- The app runs via `docker compose up` on the Mini PC and is reachable over Tailscale
  from another device.
