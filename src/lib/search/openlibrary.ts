import type { SearchResult } from "./types";

type OpenLibraryDoc = {
  key: string;
  title: string;
  author_name?: string[];
  first_publish_year?: number;
  subject?: string[];
  cover_i?: number;
};

type OpenLibraryResponse = {
  docs: OpenLibraryDoc[];
};

/**
 * Build the Open Library search URL. Pure/exported for testability.
 * When `author` is a non-empty (trimmed) string, scopes results to that
 * author alongside the title search.
 */
export function buildOpenLibrarySearchUrl(query: string, author?: string): URL {
  const url = new URL("https://openlibrary.org/search.json");
  url.searchParams.set("title", query);
  const trimmedAuthor = author?.trim();
  if (trimmedAuthor) {
    url.searchParams.set("author", trimmedAuthor);
  }
  url.searchParams.set("limit", "12");
  url.searchParams.set(
    "fields",
    "key,title,author_name,first_publish_year,subject,cover_i",
  );
  return url;
}

/**
 * Search Open Library by title, optionally scoped to an author. No API key
 * required.
 * Docs: https://openlibrary.org/dev/docs/api/search
 */
export async function searchOpenLibrary(
  query: string,
  author?: string,
): Promise<SearchResult[]> {
  const url = buildOpenLibrarySearchUrl(query, author);

  const res = await fetch(url, {
    headers: { "User-Agent": "MediaTracker/0.1 (personal project)" },
    // metadata is fairly stable; cache briefly to be a good API citizen
    next: { revalidate: 3600 },
  });
  if (!res.ok) {
    throw new Error(`Open Library search failed (${res.status})`);
  }

  const data = (await res.json()) as OpenLibraryResponse;

  return (data.docs ?? []).slice(0, 12).map((doc) => ({
    source: "openlibrary" as const,
    externalId: doc.key, // e.g. "/works/OL45804W"
    mediaType: "book" as const,
    title: doc.title,
    creator: doc.author_name?.[0],
    year: doc.first_publish_year,
    // subjects are numerous and noisy; keep a few as genre-ish tags
    genres: (doc.subject ?? []).slice(0, 3),
    imageUrl: doc.cover_i
      ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg`
      : undefined,
  }));
}
