/**
 * One-time AI-assisted metadata backfill for v1.1 filtering (see
 * docs/API_SPEC.md "Backfill script interface", docs/ARCHITECTURE.md
 * "AI backfill").
 *
 * Fills `year` (publication), `authorGender`, `genreCategory`, `subgenres`
 * for a user's books where `genreCategory IS NULL`, marking each row
 * `metadataUnverified = true`. Idempotent: re-running only touches
 * still-uncategorized rows, so confirmed/edited rows are never clobbered.
 *
 * Usage: npx tsx scripts/backfill-metadata.ts [email]   (default: demo@example.com)
 * Requires GEMINI_API_KEY. Does NOT run automatically — invoke explicitly.
 */
import "dotenv/config";
import { GoogleGenAI, Type } from "@google/genai";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import {
  GENRE_CATEGORIES,
  GENDER_VALUES,
  SUBGENRES_BY_CATEGORY,
  isGenreCategory,
  isAuthorGender,
  isValidSubgenre,
} from "../src/lib/taxonomy";
import type { AuthorGender, GenreCategory } from "../src/generated/prisma/enums";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const DEFAULT_EMAIL = "demo@example.com";
const BATCH_SIZE = 30;
const DELAY_MS = 4000; // free-tier RPM headroom between batches

type BookRow = { id: string; title: string; creator: string | null };

type ModelResult = {
  id: string;
  publicationYear: number | null;
  authorGender: string;
  genreCategory: string;
  subgenres: string[];
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** Build the taxonomy description embedded in the prompt so the model only
 * emits values we can validate against. */
function taxonomyPromptBlock(): string {
  const lines = GENRE_CATEGORIES.map(
    (cat) => `- ${cat}: ${SUBGENRES_BY_CATEGORY[cat].join(", ")}`,
  );
  return lines.join("\n");
}

async function callGemini(
  ai: GoogleGenAI,
  books: BookRow[],
): Promise<ModelResult[]> {
  const bookList = books
    .map((b) => `${b.id} | ${b.title}${b.creator ? ` | ${b.creator}` : ""}`)
    .join("\n");

  const prompt = `You are a metadata inference assistant for a personal book-tracking app.
For each book below (format: id | title | author), infer:
- publicationYear: the year it was FIRST published, as an integer. Use null if unknown.
- authorGender: one of [${GENDER_VALUES.join(", ")}]. Use "mixed" for multi-author/collective
  works with mixed genders, "unknown" if you cannot determine it confidently.
- genreCategory: exactly one of [${GENRE_CATEGORIES.join(", ")}].
- subgenres: zero or more values, but ONLY from the list for the chosen genreCategory below.
  Do not invent new subgenre strings; use these exact strings.

Category -> allowed subgenres:
${taxonomyPromptBlock()}

Return one object per book, in the same order, each including the original "id" unchanged.

Books:
${bookList}`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING },
            publicationYear: { type: Type.INTEGER, nullable: true },
            authorGender: { type: Type.STRING, enum: [...GENDER_VALUES] },
            genreCategory: { type: Type.STRING, enum: [...GENRE_CATEGORIES] },
            subgenres: { type: Type.ARRAY, items: { type: Type.STRING } },
          },
          required: ["id", "publicationYear", "authorGender", "genreCategory", "subgenres"],
          propertyOrdering: [
            "id",
            "publicationYear",
            "authorGender",
            "genreCategory",
            "subgenres",
          ],
        },
      },
    },
  });

  const text = response.text;
  if (!text) return [];

  try {
    return JSON.parse(text) as ModelResult[];
  } catch {
    return [];
  }
}

/**
 * Call Gemini for a batch, retrying on transient failures (503 "high demand",
 * 429 rate-limit, network blips) with exponential backoff. Returns [] only
 * after exhausting attempts — the caller then leaves that batch's books
 * uncategorized, and the script's idempotency means a later re-run picks them
 * up.
 */
async function callGeminiWithRetry(
  ai: GoogleGenAI,
  books: BookRow[],
  attempts = 3,
): Promise<ModelResult[]> {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await callGemini(ai, books);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (attempt === attempts) {
        console.error(`  Gemini call failed (attempt ${attempt}/${attempts}):`, msg);
        return [];
      }
      const backoff = 2000 * 2 ** (attempt - 1); // 2s, 4s
      console.error(
        `  Gemini call failed (attempt ${attempt}/${attempts}), retrying in ${backoff}ms:`,
        msg,
      );
      await sleep(backoff);
    }
  }
  return [];
}

const CURRENT_YEAR = new Date().getFullYear();

/** Validate + coerce one model result against the DB row it targets. Returns
 * null if the result doesn't correspond to a book we asked about. */
function sanitize(
  result: ModelResult,
  knownIds: Set<string>,
): {
  id: string;
  year: number | null;
  authorGender: AuthorGender;
  genreCategory: GenreCategory;
  subgenres: string[];
} | null {
  if (!result || typeof result.id !== "string" || !knownIds.has(result.id)) {
    return null;
  }

  const year =
    typeof result.publicationYear === "number" &&
    Number.isInteger(result.publicationYear) &&
    result.publicationYear >= 0 &&
    result.publicationYear <= CURRENT_YEAR
      ? result.publicationYear
      : null;

  const authorGender: AuthorGender =
    typeof result.authorGender === "string" && isAuthorGender(result.authorGender)
      ? result.authorGender
      : "unknown";

  const genreCategory: GenreCategory =
    typeof result.genreCategory === "string" && isGenreCategory(result.genreCategory)
      ? result.genreCategory
      : "other"; // "couldn't classify" bucket; still flagged unverified for review

  const subgenres = Array.isArray(result.subgenres)
    ? result.subgenres.filter(
        (s): s is string => typeof s === "string" && isValidSubgenre(genreCategory, s),
      )
    : [];

  return { id: result.id, year, authorGender, genreCategory, subgenres };
}

async function main() {
  const email = process.argv[2] || DEFAULT_EMAIL;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set");

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new Error(`No user found with email ${email}`);

  const books = await prisma.entry.findMany({
    where: { userId: user.id, mediaType: "book", genreCategory: null },
    select: { id: true, title: true, creator: true },
  });

  if (books.length === 0) {
    console.log(`No uncategorized books found for ${email}. Nothing to do.`);
    return;
  }

  console.log(`Backfilling ${books.length} books for ${email} in batches of ${BATCH_SIZE}...`);

  const ai = new GoogleGenAI({ apiKey });
  const batches = chunk(books, BATCH_SIZE);
  const knownIds = new Set(books.map((b) => b.id));

  let updated = 0;
  let skipped = 0;

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    console.log(`Batch ${i + 1}/${batches.length} (${batch.length} books)...`);

    const results = await callGeminiWithRetry(ai, batch);

    // Map results by id, but drop any id the model echoed more than once: a
    // duplicate id is ambiguous (we can't tell which book's metadata it is), so
    // it's safer to skip than risk writing one book's data onto another.
    const idCounts = new Map<string, number>();
    for (const r of results) {
      if (r?.id) idCounts.set(r.id, (idCounts.get(r.id) ?? 0) + 1);
    }
    const resultById = new Map<string, ModelResult>();
    for (const r of results) {
      if (r?.id && idCounts.get(r.id) === 1) resultById.set(r.id, r);
    }

    for (const book of batch) {
      const raw = resultById.get(book.id);
      if (!raw) {
        skipped++;
        continue;
      }
      const clean = sanitize(raw, knownIds);
      if (!clean) {
        skipped++;
        continue;
      }

      await prisma.entry.update({
        where: { id: clean.id },
        data: {
          year: clean.year,
          authorGender: clean.authorGender,
          genreCategory: clean.genreCategory,
          subgenres: clean.subgenres,
          metadataUnverified: true,
        },
      });
      updated++;
    }

    if (i < batches.length - 1) await sleep(DELAY_MS);
  }

  console.log(
    `Done. Updated ${updated}/${books.length} books (${skipped} skipped/unparseable). ` +
      `All updated rows are marked metadataUnverified=true — review in the app.`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
