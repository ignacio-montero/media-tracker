/**
 * v1.1 filter contract (see docs/API_SPEC.md "v1.1 — Filter contract").
 * Shared by /library and /dashboard (both server components) and by
 * getDashboardStats. Frontend imports `EntryFilters`, `parseEntryFilters`.
 */
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import type { MediaType, EntryStatus, AuthorGender, GenreCategory } from "@/generated/prisma/enums";
import { MEDIA_TYPES, ENTRY_STATUSES } from "@/lib/validation";
import {
  isAuthorGender,
  isGenreCategory,
  isValidSubgenre,
  allSubgenres,
} from "@/lib/taxonomy";

export type EntryFilters = {
  type?: MediaType;
  status?: EntryStatus;
  readYear?: number;
  readMonth?: number; // 1–12, only valid alongside readYear
  pubFrom?: number;
  pubTo?: number;
  gender?: AuthorGender[];
  category?: GenreCategory[];
  subgenres?: string[];
  unverified?: boolean;
};

const isMediaType = (v: string): v is MediaType =>
  (MEDIA_TYPES as readonly string[]).includes(v);
const isStatus = (v: string): v is EntryStatus =>
  (ENTRY_STATUSES as readonly string[]).includes(v);

/** Parse a positive integer year (>= 1) from a raw string; undefined if invalid. */
function parseYear(raw: string | undefined | null): number | undefined {
  if (!raw) return undefined;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1) return undefined;
  return n;
}

/** Parse a month 1–12 from a raw string; undefined if invalid. */
function parseMonth(raw: string | undefined | null): number | undefined {
  if (!raw) return undefined;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > 12) return undefined;
  return n;
}

/** Split a comma list, trim, drop empties. */
function csv(raw: string | undefined | null): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** The shape Next.js App Router server components receive for `searchParams`
 * (a repeated `?x=a&x=b` param decodes to a string array). We only ever read
 * the first value for a given key, consistent with the pre-existing
 * type/status filters (which never supported repeated params either). */
export type RawSearchParams = Record<string, string | string[] | undefined>;

/**
 * Normalize the accepted input shapes (URLSearchParams from a page, or a
 * plain record from server-component `searchParams`) into a single getter.
 */
function toGetter(
  searchParams: RawSearchParams | URLSearchParams,
): (key: string) => string | undefined {
  if (searchParams instanceof URLSearchParams) {
    return (key) => searchParams.get(key) ?? undefined;
  }
  return (key) => {
    const v = searchParams[key];
    return Array.isArray(v) ? v[0] : v;
  };
}

/**
 * Parse raw URL search params into EntryFilters. Unknown/invalid values are
 * dropped, never thrown (consistent with the pre-existing type/status
 * filters). `readMonth` is ignored unless `readYear` is also present.
 */
export function parseEntryFilters(
  searchParams: RawSearchParams | URLSearchParams,
): EntryFilters {
  const get = toGetter(searchParams);
  const filters: EntryFilters = {};

  const type = get("type");
  if (type && isMediaType(type)) filters.type = type;

  const status = get("status");
  if (status && isStatus(status)) filters.status = status;

  const readYear = parseYear(get("readYear"));
  if (readYear !== undefined) {
    filters.readYear = readYear;
    const readMonth = parseMonth(get("readMonth"));
    if (readMonth !== undefined) filters.readMonth = readMonth;
  }
  // readMonth without readYear is silently dropped (no `else` branch needed —
  // filters.readMonth is simply never set).

  const pubFrom = parseYear(get("pubFrom"));
  if (pubFrom !== undefined) filters.pubFrom = pubFrom;
  const pubTo = parseYear(get("pubTo"));
  if (pubTo !== undefined) filters.pubTo = pubTo;

  const gender = csv(get("gender")).filter(isAuthorGender);
  if (gender.length > 0) filters.gender = gender;

  const category = csv(get("cat")).filter(isGenreCategory);
  if (category.length > 0) filters.category = category;

  let subgenres = csv(get("sub")).filter((s) => allSubgenres.includes(s));
  // When a category is selected, keep only subgenres that belong to one of the
  // selected categories. Otherwise `?cat=fiction&sub=History` (History is a
  // non_fiction subgenre) would build an impossible query and silently return
  // nothing. The FilterBar only ever offers in-category subgenres, so this
  // guards hand-typed / stale URLs.
  if (category.length > 0) {
    subgenres = subgenres.filter((s) =>
      category.some((c) => isValidSubgenre(c, s)),
    );
  }
  if (subgenres.length > 0) filters.subgenres = subgenres;

  const unverified = get("unverified");
  if (unverified === "1" || unverified === "true") filters.unverified = true;

  return filters;
}

/**
 * Build the Prisma where clause for a user's entries under the given filters.
 * AND across dimensions, OR within a dimension (`in` / `hasSome`). Base scope
 * is always userId — this is the security invariant, never remove it.
 */
export function buildEntryWhere(
  userId: string,
  f: EntryFilters,
): Prisma.EntryWhereInput {
  const where: Prisma.EntryWhereInput = { userId };

  if (f.type) where.mediaType = f.type;
  if (f.status) where.status = f.status;

  if (f.readYear !== undefined) {
    const monthIdx = f.readMonth !== undefined ? f.readMonth - 1 : 0;
    const spanMonths = f.readMonth !== undefined ? 1 : 12;
    const gte = new Date(Date.UTC(f.readYear, monthIdx, 1));
    const lt = new Date(Date.UTC(f.readYear, monthIdx + spanMonths, 1));
    where.completedAt = { gte, lt };
  }

  if (f.pubFrom !== undefined || f.pubTo !== undefined) {
    where.year = {
      ...(f.pubFrom !== undefined ? { gte: f.pubFrom } : {}),
      ...(f.pubTo !== undefined ? { lte: f.pubTo } : {}),
    };
  }

  if (f.gender && f.gender.length > 0) {
    where.authorGender = { in: f.gender };
  }

  if (f.category && f.category.length > 0) {
    where.genreCategory = { in: f.category };
  }

  if (f.subgenres && f.subgenres.length > 0) {
    where.subgenres = { hasSome: f.subgenres };
  }

  if (f.unverified) where.metadataUnverified = true;

  return where;
}

/** Fetch a user's entries under the given filters, newest-updated first. */
export function getLibraryEntries(userId: string, f: EntryFilters) {
  return prisma.entry.findMany({
    where: buildEntryWhere(userId, f),
    orderBy: [{ updatedAt: "desc" }],
  });
}
