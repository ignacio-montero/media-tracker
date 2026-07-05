/**
 * Normalize a book title for fuzzy matching between a user's library entries
 * and the "Greatest Books" reference list. Lowercases, strips diacritics,
 * drops a leading article, removes punctuation, collapses whitespace.
 *
 * Used both when seeding GreatBook.normalizedTitle and when matching entries,
 * so the two MUST stay in sync.
 */
export function normalizeTitle(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "") // strip diacritics
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/^(the|a|an)\s+/, "") // drop leading article
    .replace(/[^a-z0-9]+/g, " ") // punctuation -> space
    .trim()
    .replace(/\s+/g, " ");
}
