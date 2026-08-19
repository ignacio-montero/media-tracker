import "dotenv/config";
import { readFileSync } from "node:fs";
import { parse } from "csv-parse/sync";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { normalizeTitle } from "../src/lib/normalize";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

type Row = Record<string, string>;

async function main() {
  // The ranking dataset is NOT committed — it is third-party content scraped
  // from thegreatestbooks.org and not ours to redistribute. See
  // docs/GREAT_BOOKS_DATA.md for the expected columns and how to supply one.
  const csvPath =
    process.env.GREAT_BOOKS_CSV ?? "the_greatest_books_of_all_time.csv";
  let csv: string;
  try {
    csv = readFileSync(csvPath, "utf8");
  } catch {
    throw new Error(
      `Ranking dataset not found at "${csvPath}".\n` +
        "This file is deliberately not committed — see docs/GREAT_BOOKS_DATA.md " +
        "for the required columns. Set GREAT_BOOKS_CSV to point at your own copy.",
    );
  }
  const rows = parse(csv, {
    columns: true,
    skip_empty_lines: true,
    bom: true,
  }) as Row[];

  const data = rows
    .map((r) => {
      const rank = parseInt(r["Position"], 10);
      const title = (r["Title"] ?? "").trim();
      const author = (r["Authors"] ?? "").trim();
      const yearMatch = String(r["Published Date"] ?? "").match(/-?\d{1,4}/);
      const year = yearMatch ? parseInt(yearMatch[0], 10) : null;
      const scoreRaw = r["Global Score"];
      const score = scoreRaw ? parseInt(scoreRaw, 10) : null;
      return {
        rank,
        title,
        author,
        normalizedTitle: normalizeTitle(title),
        year: Number.isFinite(year!) ? year : null,
        score: Number.isFinite(score!) ? score : null,
      };
    })
    .filter((d) => Number.isFinite(d.rank) && d.title.length > 0);

  await prisma.greatBook.deleteMany();
  await prisma.greatBook.createMany({ data });

  const count = await prisma.greatBook.count();
  console.log(`Seeded ${count} great books (top rank: ${data[0]?.title}).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
