/**
 * Single source of truth for the v1.1 book genre taxonomy (category ->
 * subgenre list) and the author-gender enum's display labels. Consumed by:
 * validation.ts (zod refinement), filters.ts (parsing/validating `sub`),
 * the backfill script (constrains the model's output), and the frontend's
 * add/edit form + filter bar (dropdown options).
 *
 * Like normalize.ts, this file's exported strings MUST stay in sync with
 * every consumer — there is no independent enum in the DB for subgenres,
 * they're a validated String[] column.
 */
import type { GenreCategory, AuthorGender } from "@/generated/prisma/enums";

export type { GenreCategory, AuthorGender };

export const GENRE_CATEGORIES = [
  "fiction",
  "non_fiction",
  "other",
] as const satisfies readonly GenreCategory[];

export const CATEGORY_LABELS: Record<GenreCategory, string> = {
  fiction: "Fiction",
  non_fiction: "Non-fiction",
  other: "Other",
};

/** Category -> ordered subgenre list (PRD's confirmed taxonomy, verbatim strings). */
export const SUBGENRES_BY_CATEGORY: Record<GenreCategory, readonly string[]> = {
  fiction: [
    "Literary",
    "Classic",
    "Science fiction",
    "Fantasy",
    "Mystery/Crime/Thriller",
    "Historical fiction",
    "Horror",
    "Romance",
    "Short stories",
    "Graphic novel",
  ],
  non_fiction: [
    "History",
    "Biography/Memoir",
    "Politics/Current affairs",
    "Science",
    "Philosophy",
    "Economics",
    "Social science",
    "Essays",
    "Art/Culture",
    "Religion",
    "Travel",
    "True crime",
    "Practical/Self-help",
  ],
  other: ["Poetry", "Drama/Play", "Anthology", "Reference"],
};

/** Flattened list of every valid subgenre string, across all categories. */
export const allSubgenres: readonly string[] = GENRE_CATEGORIES.flatMap(
  (c) => SUBGENRES_BY_CATEGORY[c],
);

export const GENDER_VALUES = [
  "female",
  "male",
  "non_binary",
  "mixed",
  "unknown",
] as const satisfies readonly AuthorGender[];

export const GENDER_LABELS: Record<AuthorGender, string> = {
  female: "Female",
  male: "Male",
  non_binary: "Non-binary",
  mixed: "Mixed",
  unknown: "Unknown",
};

/** Ordered subgenre options for a given top-level category. */
export function subgenresFor(category: GenreCategory): readonly string[] {
  return SUBGENRES_BY_CATEGORY[category];
}

/** True iff `s` is a valid subgenre string for `category`. */
export function isValidSubgenre(category: GenreCategory, s: string): boolean {
  return (SUBGENRES_BY_CATEGORY[category] as readonly string[]).includes(s);
}

export function isGenreCategory(v: string): v is GenreCategory {
  return (GENRE_CATEGORIES as readonly string[]).includes(v);
}

export function isAuthorGender(v: string): v is AuthorGender {
  return (GENDER_VALUES as readonly string[]).includes(v);
}
