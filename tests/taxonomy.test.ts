import { test } from "node:test";
import assert from "node:assert/strict";
import {
  GENRE_CATEGORIES,
  GENDER_VALUES,
  subgenresFor,
  isValidSubgenre,
  isGenreCategory,
  isAuthorGender,
  allSubgenres,
} from "../src/lib/taxonomy";

test("subgenresFor returns the fiction list including canonical entries", () => {
  const subs = subgenresFor("fiction");
  assert.ok(subs.includes("Science fiction"));
  assert.ok(subs.includes("Graphic novel"));
  assert.ok(!subs.includes("History")); // non_fiction-only
});

test("subgenresFor returns the non_fiction list", () => {
  const subs = subgenresFor("non_fiction");
  assert.ok(subs.includes("History"));
  assert.ok(subs.includes("Practical/Self-help"));
});

test("subgenresFor returns the other list", () => {
  const subs = subgenresFor("other");
  assert.deepEqual([...subs], ["Poetry", "Drama/Play", "Anthology", "Reference"]);
});

test("isValidSubgenre accepts a subgenre belonging to its category", () => {
  assert.equal(isValidSubgenre("fiction", "Fantasy"), true);
  assert.equal(isValidSubgenre("non_fiction", "Philosophy"), true);
  assert.equal(isValidSubgenre("other", "Reference"), true);
});

test("isValidSubgenre rejects a subgenre from a different category", () => {
  assert.equal(isValidSubgenre("fiction", "History"), false);
  assert.equal(isValidSubgenre("non_fiction", "Fantasy"), false);
  assert.equal(isValidSubgenre("other", "Fantasy"), false);
});

test("isValidSubgenre rejects unknown strings entirely", () => {
  assert.equal(isValidSubgenre("fiction", "Not a real genre"), false);
});

test("isGenreCategory / isAuthorGender validate enum membership", () => {
  for (const c of GENRE_CATEGORIES) assert.equal(isGenreCategory(c), true);
  assert.equal(isGenreCategory("bogus"), false);

  for (const g of GENDER_VALUES) assert.equal(isAuthorGender(g), true);
  assert.equal(isAuthorGender("bogus"), false);
});

test("allSubgenres is the flattened union of every category's list", () => {
  const expectedLength = GENRE_CATEGORIES.reduce(
    (n, c) => n + subgenresFor(c).length,
    0,
  );
  assert.equal(allSubgenres.length, expectedLength);
  assert.ok(allSubgenres.includes("Science fiction"));
  assert.ok(allSubgenres.includes("History"));
  assert.ok(allSubgenres.includes("Reference"));
});
