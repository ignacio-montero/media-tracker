import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildOpenLibrarySearchUrl,
  searchOpenLibrary,
} from "../src/lib/search/openlibrary";

test("buildOpenLibrarySearchUrl: sets title only when no author given", () => {
  const url = buildOpenLibrarySearchUrl("war and peace");
  assert.equal(url.searchParams.get("title"), "war and peace");
  assert.equal(url.searchParams.get("author"), null);
});

test("buildOpenLibrarySearchUrl: adds trimmed author param alongside title", () => {
  const url = buildOpenLibrarySearchUrl("war and peace", "  Tolstoy  ");
  assert.equal(url.searchParams.get("title"), "war and peace");
  assert.equal(url.searchParams.get("author"), "Tolstoy");
});

test("buildOpenLibrarySearchUrl: whitespace-only author is treated as absent", () => {
  const url = buildOpenLibrarySearchUrl("dune", "   ");
  assert.equal(url.searchParams.get("author"), null);
});

test("buildOpenLibrarySearchUrl: always sets limit and fields", () => {
  const url = buildOpenLibrarySearchUrl("dune");
  assert.equal(url.searchParams.get("limit"), "12");
  assert.ok(url.searchParams.get("fields")?.includes("first_publish_year"));
});

test("buildOpenLibrarySearchUrl: empty-string author is treated as absent", () => {
  const url = buildOpenLibrarySearchUrl("dune", "");
  assert.equal(url.searchParams.get("author"), null);
});

test("buildOpenLibrarySearchUrl: title is always set even for an empty query", () => {
  const url = buildOpenLibrarySearchUrl("");
  assert.equal(url.searchParams.get("title"), "");
});

test("buildOpenLibrarySearchUrl: special characters in title/author are preserved (URL-encodes, doesn't mangle)", () => {
  const url = buildOpenLibrarySearchUrl("war & peace?", "Tolstoy & co.");
  assert.equal(url.searchParams.get("title"), "war & peace?");
  assert.equal(url.searchParams.get("author"), "Tolstoy & co.");
  // Sanity: the raw URL string actually encodes the special chars.
  assert.ok(url.toString().includes("war+%26+peace%3F"));
});

// --- searchOpenLibrary: response-mapping logic (mocked fetch, no network) ---

test("searchOpenLibrary: maps docs to SearchResult shape, truncates genres to 3, picks first author", async (t) => {
  const originalFetch = global.fetch;
  t.after(() => {
    global.fetch = originalFetch;
  });

  global.fetch = (async () =>
    new Response(
      JSON.stringify({
        docs: [
          {
            key: "/works/OL45804W",
            title: "War and Peace",
            author_name: ["Leo Tolstoy", "Constance Garnett"],
            first_publish_year: 1869,
            subject: ["Russia", "War", "Napoleonic Wars", "Fiction", "Aristocracy"],
            cover_i: 12345,
          },
        ],
      }),
      { status: 200 },
    )) as typeof fetch;

  const results = await searchOpenLibrary("war and peace", "Tolstoy");

  assert.equal(results.length, 1);
  const r = results[0];
  assert.equal(r.source, "openlibrary");
  assert.equal(r.externalId, "/works/OL45804W");
  assert.equal(r.mediaType, "book");
  assert.equal(r.title, "War and Peace");
  assert.equal(r.creator, "Leo Tolstoy"); // first author only
  assert.equal(r.year, 1869);
  assert.deepEqual(r.genres, ["Russia", "War", "Napoleonic Wars"]); // truncated to 3
  assert.equal(r.imageUrl, "https://covers.openlibrary.org/b/id/12345-M.jpg");
});

test("searchOpenLibrary: docs missing optional fields (no author/year/subject/cover) map to undefined, not throw", async (t) => {
  const originalFetch = global.fetch;
  t.after(() => {
    global.fetch = originalFetch;
  });

  global.fetch = (async () =>
    new Response(
      JSON.stringify({
        docs: [{ key: "/works/OL1W", title: "Untitled Work" }],
      }),
      { status: 200 },
    )) as typeof fetch;

  const results = await searchOpenLibrary("untitled");
  assert.equal(results.length, 1);
  const r = results[0];
  assert.equal(r.creator, undefined);
  assert.equal(r.year, undefined);
  assert.deepEqual(r.genres, []);
  assert.equal(r.imageUrl, undefined);
});

test("searchOpenLibrary: empty docs array returns an empty result list", async (t) => {
  const originalFetch = global.fetch;
  t.after(() => {
    global.fetch = originalFetch;
  });

  global.fetch = (async () =>
    new Response(JSON.stringify({ docs: [] }), { status: 200 })) as typeof fetch;

  const results = await searchOpenLibrary("zzzznonexistent");
  assert.deepEqual(results, []);
});

test("searchOpenLibrary: non-OK response throws (caller in route.ts catches and degrades to [])", async (t) => {
  const originalFetch = global.fetch;
  t.after(() => {
    global.fetch = originalFetch;
  });

  global.fetch = (async () =>
    new Response("Internal Server Error", { status: 500 })) as typeof fetch;

  await assert.rejects(() => searchOpenLibrary("dune"));
});
