# Media Tracker — Contract spec

_Owned by the Architect persona. The contract between UI and server logic. This
app has almost no REST surface (server components + server actions do the work),
so "the contract" is mostly: URL param grammar, shared types, and the backfill
script interface. For the data model see [ARCHITECTURE.md](ARCHITECTURE.md)._

## v1.1 — Filter contract

### `EntryFilters` (shared type, `src/lib/filters.ts`)

```ts
type EntryFilters = {
  type?: MediaType;              // existing
  status?: EntryStatus;          // existing
  readYear?: number;             // completedAt year
  readMonth?: number;            // 1–12, only valid alongside readYear
  pubFrom?: number;              // publication year >=
  pubTo?: number;                // publication year <=
  gender?: AuthorGender[];       // OR within
  category?: GenreCategory[];    // OR within
  subgenres?: string[];          // OR within (hasSome); validated vs taxonomy
  unverified?: boolean;          // true = only AI-backfilled, unconfirmed rows
};
```

### URL param grammar (extends today's `?type=&status=`)

| Param | Example | Meaning |
|---|---|---|
| `readYear` | `readYear=2023` | `completedAt` in that calendar year |
| `readMonth` | `readMonth=6` | narrows to June of `readYear` (ignored without `readYear`) |
| `pubFrom` / `pubTo` | `pubFrom=1900&pubTo=1999` | publication `year` range (either side optional) |
| `gender` | `gender=female,mixed` | comma list; each must be an `AuthorGender` |
| `cat` | `cat=non_fiction` | comma list; each a `GenreCategory` |
| `sub` | `sub=History,Science` | comma list; **case-sensitive**, must match taxonomy strings exactly. When `cat` is set, subgenres not valid for a selected category are dropped. |
| `unverified` | `unverified=1` | review mode: only `metadataUnverified` rows |

Parsing (`parseEntryFilters(searchParams)`): unknown/invalid values are
**dropped, not errored** (consistent with the current library filters). Invalid
subgenres are filtered against the taxonomy. `readMonth` without `readYear` is
ignored.

### Prisma `where` composition

- **AND across dimensions**, **OR within** (`in` for scalars/enums, `hasSome`
  for `subgenres`).
- `readYear`(+`readMonth`) → `completedAt: { gte, lt }`.
- `pubFrom`/`pubTo` → `year: { gte?, lte? }`.
- Base scope is always `userId` (unchanged security invariant).

### Dashboard

`getDashboardStats(userId, filters: EntryFilters)` recomputes all existing
aggregates over the filtered set and adds book breakdowns:
`genderSplit`, `categorySplit`, `topSubgenres`, `byPublicationDecade`.
`/library` and `/dashboard` share `FilterBar` + `parseEntryFilters`.

## Backfill script interface

```
npx tsx scripts/backfill-metadata.ts [email]   # default: demo@example.com
```

Fills `year`, `authorGender`, `genreCategory`, `subgenres` for that user's books
where `genreCategory IS NULL`, marking each `metadataUnverified = true`.
Idempotent; safe to re-run. Requires `GEMINI_API_KEY`.
