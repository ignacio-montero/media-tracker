import { test } from "node:test";
import assert from "node:assert/strict";
import { parseEntryFilters, buildEntryWhere } from "../src/lib/filters";

test("parseEntryFilters: empty input yields empty filters", () => {
  assert.deepEqual(parseEntryFilters({}), {});
  assert.deepEqual(parseEntryFilters(new URLSearchParams()), {});
});

test("parseEntryFilters: valid type/status pass through (existing behavior)", () => {
  const f = parseEntryFilters({ type: "book", status: "completed" });
  assert.equal(f.type, "book");
  assert.equal(f.status, "completed");
});

test("parseEntryFilters: invalid type/status are dropped, not thrown", () => {
  const f = parseEntryFilters({ type: "podcast", status: "reading" });
  assert.equal(f.type, undefined);
  assert.equal(f.status, undefined);
});

test("parseEntryFilters: readYear + readMonth parse together", () => {
  const f = parseEntryFilters({ readYear: "2023", readMonth: "6" });
  assert.equal(f.readYear, 2023);
  assert.equal(f.readMonth, 6);
});

test("parseEntryFilters: readMonth without readYear is ignored", () => {
  const f = parseEntryFilters({ readMonth: "6" });
  assert.equal(f.readYear, undefined);
  assert.equal(f.readMonth, undefined);
});

test("parseEntryFilters: out-of-range readMonth is dropped even with readYear present", () => {
  const f = parseEntryFilters({ readYear: "2023", readMonth: "13" });
  assert.equal(f.readYear, 2023);
  assert.equal(f.readMonth, undefined);
});

test("parseEntryFilters: non-numeric readYear is dropped", () => {
  const f = parseEntryFilters({ readYear: "abc", readMonth: "6" });
  assert.equal(f.readYear, undefined);
  assert.equal(f.readMonth, undefined); // dependent on readYear, also dropped
});

test("parseEntryFilters: pubFrom/pubTo parse as numbers", () => {
  const f = parseEntryFilters({ pubFrom: "1900", pubTo: "1999" });
  assert.equal(f.pubFrom, 1900);
  assert.equal(f.pubTo, 1999);
});

test("parseEntryFilters: invalid pub range values are dropped independently", () => {
  const f = parseEntryFilters({ pubFrom: "not-a-year", pubTo: "1999" });
  assert.equal(f.pubFrom, undefined);
  assert.equal(f.pubTo, 1999);
});

test("parseEntryFilters: gender csv keeps only valid enum members", () => {
  const f = parseEntryFilters({ gender: "female,mixed,alien" });
  assert.deepEqual(f.gender, ["female", "mixed"]);
});

test("parseEntryFilters: gender entirely invalid yields undefined (not empty array)", () => {
  const f = parseEntryFilters({ gender: "alien,martian" });
  assert.equal(f.gender, undefined);
});

test("parseEntryFilters: cat csv keeps only valid GenreCategory members", () => {
  const f = parseEntryFilters({ cat: "fiction,non_fiction,sci-fi" });
  assert.deepEqual(f.category, ["fiction", "non_fiction"]);
});

test("parseEntryFilters: sub csv validated against the taxonomy (unknown subgenre dropped)", () => {
  const f = parseEntryFilters({ sub: "History,Not a real genre,Fantasy" });
  assert.deepEqual(f.subgenres, ["History", "Fantasy"]);
});

test("parseEntryFilters: sub csv is order-preserving and dedupe is not required", () => {
  const f = parseEntryFilters({ sub: "Fantasy,Fantasy" });
  assert.deepEqual(f.subgenres, ["Fantasy", "Fantasy"]);
});

test("parseEntryFilters: with no category, a valid subgenre from any category is kept", () => {
  const f = parseEntryFilters({ sub: "History" });
  assert.deepEqual(f.subgenres, ["History"]);
});

test("parseEntryFilters: subgenre not valid for the selected category is dropped", () => {
  // History is a non_fiction subgenre; with cat=fiction it must be dropped so
  // the query isn't an impossible fiction∧History that silently returns nothing.
  const f = parseEntryFilters({ cat: "fiction", sub: "History" });
  assert.equal(f.subgenres, undefined);
});

test("parseEntryFilters: category scoping keeps in-category subgenres, drops others", () => {
  const f = parseEntryFilters({ cat: "non_fiction", sub: "History,Literary" });
  assert.deepEqual(f.subgenres, ["History"]); // Literary (fiction) dropped
});

test("parseEntryFilters: subgenre valid for any of several selected categories is kept", () => {
  const f = parseEntryFilters({ cat: "fiction,non_fiction", sub: "Literary,History" });
  assert.deepEqual(f.subgenres, ["Literary", "History"]);
});

test("buildEntryWhere: pubFrom > pubTo yields an (empty) inverted range, not a crash", () => {
  // Documents current behavior: an impossible range builds gte>lte, which
  // Postgres evaluates to zero rows rather than erroring.
  const where = buildEntryWhere("user-1", { pubFrom: 2000, pubTo: 1900 });
  assert.deepEqual(where.year, { gte: 2000, lte: 1900 });
});

test("parseEntryFilters: unverified=1 and unverified=true both set true", () => {
  assert.equal(parseEntryFilters({ unverified: "1" }).unverified, true);
  assert.equal(parseEntryFilters({ unverified: "true" }).unverified, true);
});

test("parseEntryFilters: unverified with any other value is dropped", () => {
  assert.equal(parseEntryFilters({ unverified: "0" }).unverified, undefined);
  assert.equal(parseEntryFilters({ unverified: "no" }).unverified, undefined);
});

test("parseEntryFilters: accepts URLSearchParams input directly", () => {
  const usp = new URLSearchParams("type=book&readYear=2022&gender=female");
  const f = parseEntryFilters(usp);
  assert.equal(f.type, "book");
  assert.equal(f.readYear, 2022);
  assert.deepEqual(f.gender, ["female"]);
});

test("parseEntryFilters: repeated query params (string[] from Next searchParams) use the first value", () => {
  const f = parseEntryFilters({ type: ["book", "movie"] });
  assert.equal(f.type, "book");
});

// --- buildEntryWhere: Prisma where-clause composition ---

test("buildEntryWhere: always scopes by userId even with no filters", () => {
  const where = buildEntryWhere("user-1", {});
  assert.equal(where.userId, "user-1");
});

test("buildEntryWhere: readYear alone spans the full calendar year", () => {
  const where = buildEntryWhere("user-1", { readYear: 2023 });
  const completedAt = where.completedAt as { gte: Date; lt: Date };
  assert.equal(completedAt.gte.toISOString(), "2023-01-01T00:00:00.000Z");
  assert.equal(completedAt.lt.toISOString(), "2024-01-01T00:00:00.000Z");
});

test("buildEntryWhere: readYear + readMonth narrows to that single month", () => {
  const where = buildEntryWhere("user-1", { readYear: 2023, readMonth: 6 });
  const completedAt = where.completedAt as { gte: Date; lt: Date };
  assert.equal(completedAt.gte.toISOString(), "2023-06-01T00:00:00.000Z");
  assert.equal(completedAt.lt.toISOString(), "2023-07-01T00:00:00.000Z");
});

test("buildEntryWhere: December readMonth rolls over into next year correctly", () => {
  const where = buildEntryWhere("user-1", { readYear: 2023, readMonth: 12 });
  const completedAt = where.completedAt as { gte: Date; lt: Date };
  assert.equal(completedAt.gte.toISOString(), "2023-12-01T00:00:00.000Z");
  assert.equal(completedAt.lt.toISOString(), "2024-01-01T00:00:00.000Z");
});

test("buildEntryWhere: pubFrom/pubTo become a year range, either side optional", () => {
  const both = buildEntryWhere("user-1", { pubFrom: 1900, pubTo: 1999 });
  assert.deepEqual(both.year, { gte: 1900, lte: 1999 });

  const fromOnly = buildEntryWhere("user-1", { pubFrom: 1900 });
  assert.deepEqual(fromOnly.year, { gte: 1900 });

  const toOnly = buildEntryWhere("user-1", { pubTo: 1999 });
  assert.deepEqual(toOnly.year, { lte: 1999 });
});

test("buildEntryWhere: gender/category use `in`, subgenres use `hasSome` (OR within dimension)", () => {
  const where = buildEntryWhere("user-1", {
    gender: ["female", "mixed"],
    category: ["non_fiction"],
    subgenres: ["History", "Science"],
  });
  assert.deepEqual(where.authorGender, { in: ["female", "mixed"] });
  assert.deepEqual(where.genreCategory, { in: ["non_fiction"] });
  assert.deepEqual(where.subgenres, { hasSome: ["History", "Science"] });
});

test("buildEntryWhere: unverified flag maps to metadataUnverified: true", () => {
  const where = buildEntryWhere("user-1", { unverified: true });
  assert.equal(where.metadataUnverified, true);
});

test("buildEntryWhere: dimensions compose with AND (all present simultaneously)", () => {
  const where = buildEntryWhere("user-1", {
    type: "book",
    status: "completed",
    readYear: 2023,
    gender: ["female"],
    category: ["non_fiction"],
    subgenres: ["History"],
  });
  assert.equal(where.userId, "user-1");
  assert.equal(where.mediaType, "book");
  assert.equal(where.status, "completed");
  assert.ok(where.completedAt);
  assert.deepEqual(where.authorGender, { in: ["female"] });
  assert.deepEqual(where.genreCategory, { in: ["non_fiction"] });
  assert.deepEqual(where.subgenres, { hasSome: ["History"] });
});
