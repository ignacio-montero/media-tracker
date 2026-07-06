import { test } from "node:test";
import assert from "node:assert/strict";
import { rankNextUp, type LibraryBook } from "../src/lib/greatbooks";

const gb = (rank: number, author: string, year: number | null, title = `T${rank}`) => ({
  rank,
  title,
  author,
  year,
  read: false as const,
});
const lib = (creator: string | null, rating: number | null, year: number | null): LibraryBook => ({
  creator,
  rating,
  year,
});

test("rankNextUp: cold start (no library) falls back to acclaim/rank order", () => {
  const out = rankNextUp([gb(5, "A A", 1900), gb(1, "B B", 1900), gb(3, "C C", 1900)], [], 500);
  assert.deepEqual(
    out.map((r) => r.rank),
    [1, 3, 5],
  );
  assert.match(out[0].reason, /Acclaimed — #1/);
});

test("rankNextUp: author affinity outranks a more-acclaimed book by an unread author", () => {
  const library = [lib("James Baldwin", 5, 1960), lib("James Baldwin", 4, 1963)];
  const out = rankNextUp(
    [gb(2, "Leo Tolstoy", 1869), gb(200, "James Baldwin", 1953)],
    library,
    500,
  );
  assert.equal(out[0].author, "James Baldwin");
  assert.match(out[0].reason, /You've read 2 by James Baldwin and rated highly/);
});

test("rankNextUp: single-author match phrases the reason as 'Another by'", () => {
  const out = rankNextUp([gb(300, "Albert Camus", 1947)], [lib("Albert Camus", null, 1942)], 500);
  assert.match(out[0].reason, /Another by Albert Camus, whom you've read/);
});

test("rankNextUp: era affinity beats acclaim when there's no author match", () => {
  const library = [lib("Unmatched Personone", null, 1925), lib("Other Someonetwo", null, 1927)];
  const out = rankNextUp(
    [gb(10, "Aaaaa Bbbbb", 1926), gb(5, "Ccccc Ddddd", 1850)],
    library,
    500,
  );
  assert.equal(out[0].rank, 10); // 1920s book, matching the reader's era
  assert.match(out[0].reason, /Fits your 1920s reading/);
});

test("rankNextUp: respects the limit", () => {
  const unread = Array.from({ length: 15 }, (_, i) => gb(i + 1, `Auth${i}`, 1900));
  assert.equal(rankNextUp(unread, [], 500, 10).length, 10);
  assert.equal(rankNextUp(unread, [], 500, 5).length, 5);
});

test("rankNextUp: empty unread returns empty (list fully read)", () => {
  assert.deepEqual(rankNextUp([], [lib("X Y", 5, 2000)], 500), []);
});

test("rankNextUp: initial+surname collision does NOT assert a false count", () => {
  // Anne Rice, Anne Rice, Antony Rice all key to "a rice"; an unread "Anita
  // Rice" must not claim "You've read 3 by Anita Rice".
  const library = [lib("Anne Rice", 5, 1976), lib("Anne Rice", 4, 1985), lib("Antony Rice", null, 1990)];
  const out = rankNextUp([gb(50, "Anita Rice", 2005)], library, 500);
  assert.doesNotMatch(out[0].reason, /read \d+ by Anita Rice/);
  assert.doesNotMatch(out[0].reason, /Another by Anita Rice/);
});

test("rankNextUp: exact name still counts even amid a same-key collision", () => {
  // Same "a rice" key, but the unread book IS Anne Rice — the exact match wins.
  const library = [lib("Anne Rice", 5, 1976), lib("Anne Rice", 5, 1985), lib("Antony Rice", null, 1990)];
  const out = rankNextUp([gb(50, "Anne Rice", 2003)], library, 500);
  assert.match(out[0].reason, /You've read 2 by Anne Rice and rated highly/);
});

test("rankNextUp: short surnames (Kobo Abe) match — no length cutoff regression", () => {
  const out = rankNextUp([gb(120, "Kobo Abe", 1962)], [lib("Kobo Abe", null, 1964), lib("Kobo Abe", null, 1959)], 500);
  assert.match(out[0].reason, /You've read 2 by Kobo Abe/);
});

test("rankNextUp: multi-author creator keys on the first author, not the translator", () => {
  // "Leo Tolstoy, Louise Maude" (translator) must credit Tolstoy.
  const out = rankNextUp([gb(15, "Leo Tolstoy", 1877)], [lib("Leo Tolstoy, Louise Maude", 5, 1869)], 500);
  assert.match(out[0].reason, /Another by Leo Tolstoy/);
});

test("rankNextUp: punctuation/format variant of one author still attributed", () => {
  // "J. K. Rowling" (library) vs "J.K. Rowling" (list) — single name under the
  // key, so it's a trustworthy variant, not a collision.
  const out = rankNextUp([gb(236, "J.K. Rowling", 1997)], [lib("J. K. Rowling", 5, 1997)], 500);
  assert.match(out[0].reason, /by J\.K\. Rowling/);
});
