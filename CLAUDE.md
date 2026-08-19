@AGENTS.md

# Media Tracker — project handoff

Personal multi-user app to log books, TV, and movies; see stats/trends; and get
AI "what to try next" suggestions from your own history.

## Docs map (read in this order when picking up work)
- `docs/NEXT_STEPS.md` — current status, real data loaded, what's next.
- `docs/PRD.md` — requirements, scope, success criteria.
- `docs/ARCHITECTURE.md` — stack (as built), data model, app structure, security.
- `docs/DECISIONS.md` — decision log with rationale.
- `CLAUDE.md` (this file) — how to run it + gotchas.

## Current phase: local Mac prototype — MVP complete & verified
Runs on the Mac via `npm run dev`; only Postgres is containerized. Homelab
Docker deployment is a later, config-only step (no app code changes expected).
All MVP features verified live; `npm run build` is clean.

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
`DATABASE_URL`, `AUTH_SECRET`, `TMDB_API_KEY`, `GEMINI_API_KEY` — all set and
verified working in the local `.env`.

## Data files & scripts
- A ranking CSV (NOT committed — third-party data; see docs/GREAT_BOOKS_DATA.md)
  — source for the Great Books list →
  `npx tsx scripts/seed-greatbooks.ts`.
- A local-only RTF reading list (not in git) — source for the demo user's
  363-book library → `textutil -convert txt -output /tmp/l.txt <source>.rtf &&
  SEED_PASSWORD=… npx tsx scripts/ingest-books.ts /tmp/l.txt`.
- Accounts: `demo@example.com` (main demo, real data), `test@example.com`
  (empty), `second@example.com` (empty, isolation test). Passwords are NOT
  stored in this repo — set `SEED_PASSWORD` in your local `.env`.
- Full DB reset: `docker compose down -v && docker compose up -d &&
  npx prisma migrate dev`, then re-seed + re-ingest as above.

## Gotchas (learned the hard way)
- npm 11 gates package install scripts; new deps with postinstall (e.g. Prisma)
  need `npm approve-scripts <pkg>` or they silently don't build.
- **Auth.js credentials sign-in must use `signIn(..., { redirectTo })`**, letting
  signIn own the redirect. The `redirect: false` + manual `redirect()` pattern
  does NOT propagate the session `Set-Cookie`, so login silently fails to persist.
  Re-throw signIn's redirect error; catch only `AuthError` for bad credentials.
- **Regenerating the Prisma client requires a dev-server restart** — a running
  `next dev` holds the old client in memory, so a newly-added model reads as
  `undefined` (e.g. `prisma.greatBook` → "Cannot read properties of undefined").
  Restart after `prisma generate` / new migrations.
- **Prisma 7 needs a driver adapter** (`@prisma/adapter-pg`, see
  `src/lib/prisma.ts`); datasource URL lives in `prisma.config.ts`, not the schema.
- **Recharts areas/bars animate on mount** — a screenshot taken <2s after load
  can look empty even though the DOM has the paths. Wait before capturing.
- `src/lib/normalize.ts` title normalization MUST stay identical between the
  Greatest Books seed and the matching logic.
