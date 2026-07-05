import "dotenv/config";
import { readFileSync } from "node:fs";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const LAUREN_EMAIL = "demo@example.com";
const LAUREN_PASSWORD = "<redacted-password>";

const MONTHS: Record<string, number> = {
  january: 0,
  february: 1,
  march: 2,
  april: 3,
  may: 4,
  june: 5,
  july: 6,
  august: 7,
  september: 8,
  october: 9,
  november: 10,
  december: 11,
};

type ParsedBook = {
  title: string;
  author: string | null;
  completedAt: Date;
  favourite: boolean;
};

function parseBooks(text: string): ParsedBook[] {
  const books: ParsedBook[] = [];
  let headerYear: number | null = null;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    // Year section header, e.g. "A Year in Books – 2025 (43) 58% women…"
    if (/^a year in books/i.test(line)) {
      const y = line.match(/(\d{4})/);
      if (y) headerYear = parseInt(y[1], 10);
      continue;
    }
    if (/^lauren/i.test(line)) continue; // document title

    const favourite = /\+\s*$/.test(line);

    // The reading period is the last parenthetical group on the line.
    const paren = line.match(/\(([^)]*)\)\s*\+?\s*$/);
    if (!paren) continue; // not a dated book line
    const period = paren[1];
    const beforeParen = line.slice(0, paren.index).trim();

    // Split "Title - Author" on the first hyphen adjacent to whitespace,
    // falling back to the first hyphen. Titles precede authors here.
    let title = beforeParen;
    let author: string | null = null;
    let idx = beforeParen.search(/-\s+/);
    if (idx === -1) idx = beforeParen.search(/\s+-/);
    if (idx === -1) idx = beforeParen.indexOf("-");
    if (idx >= 0) {
      title = beforeParen.slice(0, idx).trim();
      author = beforeParen.slice(idx).replace(/^[\s-]+/, "").trim() || null;
    }
    if (!title) continue;

    // Resolve date from the period. Use the last month named (finished then)
    // and an explicit 4-digit year if present, else the section's year.
    const lower = period.toLowerCase();
    const monthNames = [
      ...lower.matchAll(
        /january|february|march|april|may|june|july|august|september|october|november|december/g,
      ),
    ].map((m) => m[0]);
    const years = [...period.matchAll(/\d{4}/g)].map((m) => parseInt(m[0], 10));

    const year = years.length ? years[years.length - 1] : headerYear;
    if (!year) continue; // can't date it → skip
    const monthIdx = monthNames.length
      ? MONTHS[monthNames[monthNames.length - 1]]
      : 11; // year-only → December

    books.push({
      title,
      author,
      completedAt: new Date(Date.UTC(year, monthIdx, 1, 12)),
      favourite,
    });
  }

  return books;
}

async function main() {
  const path = process.argv[2];
  if (!path) throw new Error("Usage: tsx ingest-books.ts <converted-txt-path>");
  const text = readFileSync(path, "utf8");
  const books = parseBooks(text);

  // Create (or reset) the demo user's account.
  const passwordHash = await bcrypt.hash(LAUREN_PASSWORD, 12);
  const lauren = await prisma.user.upsert({
    where: { email: LAUREN_EMAIL },
    create: { email: LAUREN_EMAIL, passwordHash },
    update: { passwordHash },
  });

  // Idempotent: clear any prior ingest for the demo user.
  await prisma.entry.deleteMany({ where: { userId: lauren.id } });

  await prisma.entry.createMany({
    data: books.map((b) => ({
      userId: lauren.id,
      title: b.title,
      mediaType: "book" as const,
      creator: b.author,
      status: "completed" as const,
      rating: b.favourite ? 5 : null,
      completedAt: b.completedAt,
      genres: [],
    })),
  });

  // "Replace the demo data": remove the seeded fake entries from the test account.
  const test = await prisma.user.findUnique({
    where: { email: "test@example.com" },
  });
  let removedDemo = 0;
  if (test) {
    const res = await prisma.entry.deleteMany({ where: { userId: test.id } });
    removedDemo = res.count;
    await prisma.recommendationCache.deleteMany({ where: { userId: test.id } });
  }

  const favs = books.filter((b) => b.favourite).length;
  const years = new Set(books.map((b) => b.completedAt.getUTCFullYear()));
  console.log(
    `Ingested ${books.length} books for ${LAUREN_EMAIL} (${favs} favourites, ` +
      `${years.size} years). Removed ${removedDemo} demo entries from test account.`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
