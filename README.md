# Media Tracker

Personal, multi-user web app to log books, TV shows, and movies; see
stats/trends about your own habits; and get AI-generated "what to try next"
suggestions from your own logged history. Includes a "Greatest Books of All
Time" reading-goal tracker against the top-500 list.

**Stack:** Next.js 16 (App Router, TypeScript) · PostgreSQL 16 (Docker) ·
Prisma 7 · Auth.js v5 · Tailwind v4 · Recharts · Google Gemini (recommendations)
· TMDB + Open Library (metadata).

## Run it locally

```bash
docker compose up -d          # Postgres (container: media-tracker-db)
npm run dev                   # http://localhost:3000
npx prisma migrate dev        # apply schema changes
npx prisma studio             # inspect data
```

Copy `.env.example` to `.env` and set `DATABASE_URL`, `AUTH_SECRET`,
`TMDB_API_KEY`, and `GEMINI_API_KEY`.

## Documentation

- [docs/PRD.md](docs/PRD.md) — what this is and why; scope and success criteria
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — stack, data model, security, deployment plan
- [docs/DECISIONS.md](docs/DECISIONS.md) — decision log with rationale
- [docs/NEXT_STEPS.md](docs/NEXT_STEPS.md) — current status and what's next
- [CLAUDE.md](CLAUDE.md) — dev handoff: run instructions, environment, gotchas

## Status

MVP feature-complete and verified live as a local prototype; homelab Docker
deployment is a deferred, config-only step. See
[docs/NEXT_STEPS.md](docs/NEXT_STEPS.md).

## Data & license

Application code is released under the [MIT License](LICENSE).

The optional "Great Books" reference list is **not** included in this repository. The
list this project was built against came from [thegreatestbooks.org](https://thegreatestbooks.org/),
whose ranking is their own work and not ours to redistribute — so the seeder reads a CSV
you supply. See [docs/GREAT_BOOKS_DATA.md](docs/GREAT_BOOKS_DATA.md) for the expected
columns. Everything else in the app works without it.
