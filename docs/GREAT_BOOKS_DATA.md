# The "Greatest Books" reference list

The app can seed a reference list of canonical books, which the library then matches
against by normalised title to show how much of the canon you've read.

## The dataset is not in this repository — on purpose

The list this project was developed against was taken from
**[thegreatestbooks.org](https://thegreatestbooks.org/)**, which aggregates published
"best books" lists into a single ranking. That ranking is their work, and their site
grants no licence to redistribute it. Shipping a copy inside a public repository would
be republishing someone else's dataset without permission, so the file is gitignored and
you need to supply your own.

Nothing else in the app depends on it. Skip the seed and everything works; you simply
won't get the "Great Books" comparison view.

## Supplying a list

Point the seeder at any CSV with these columns:

| Column | Required | Notes |
|---|---|---|
| `Position` | yes | Integer rank. Rows without one are skipped. |
| `Title` | yes | Rows with an empty title are skipped. |
| `Authors` | no | Free text, stored as-is. |
| `Published Date` | no | First 1–4 digit run is parsed as the year; negatives allowed for BCE. |
| `Global Score` | no | Integer; used only for ordering ties. |

Any other columns are ignored. Then:

```bash
GREAT_BOOKS_CSV=/path/to/your-list.csv npx tsx scripts/seed-greatbooks.ts
```

It defaults to `the_greatest_books_of_all_time.csv` in the repo root, and fails with a
clear message rather than a stack trace when the file isn't there.

## Building your own

Any ranked list works — a public-domain canon list, a library's recommended reading, or
one you assemble yourself. Matching is by normalised title (`src/lib/normalize.ts`), so
titles just need to be recognisable, not byte-identical to your library entries.
