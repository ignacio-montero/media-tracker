import { test } from "node:test";
import assert from "node:assert/strict";
import { computeTimeline } from "../src/lib/stats";

type MediaType = "book" | "tv" | "movie";
const c = (type: MediaType, iso: string) => ({ type, date: new Date(iso) });

test("computeTimeline: empty completions -> empty timeline, month granularity", () => {
  const r = computeTimeline([]);
  assert.deepEqual(r.timeline, []);
  assert.equal(r.timelineGranularity, "month");
});

test("computeTimeline: readYear -> exactly 12 monthly buckets for that year", () => {
  const r = computeTimeline(
    [
      c("book", "2021-01-15T12:00:00Z"),
      c("book", "2021-01-20T12:00:00Z"),
      c("movie", "2021-06-10T12:00:00Z"),
    ],
    2021,
  );
  assert.equal(r.timelineGranularity, "month");
  assert.equal(r.timeline.length, 12);
  assert.equal(r.timeline[0].month, "2021-01");
  assert.equal(r.timeline[11].month, "2021-12");
  assert.equal(r.timeline[0].book, 2); // both January books
  assert.equal(r.timeline[5].movie, 1); // June movie
  const total = r.timeline.reduce((s, m) => s + m.book + m.tv + m.movie, 0);
  assert.equal(total, 3);
});

test("computeTimeline: readYear buckets only that year; out-of-year dates don't land", () => {
  const r = computeTimeline(
    [c("book", "2021-03-01T12:00:00Z"), c("book", "2022-03-01T12:00:00Z")],
    2021,
  );
  const total = r.timeline.reduce((s, m) => s + m.book, 0);
  assert.equal(total, 1); // only the 2021 completion buckets into the 12 months
});

test("computeTimeline: recent completions (<=24 months) stay monthly", () => {
  // Relative to "now" so the test isn't tied to a wall-clock date.
  const now = new Date();
  const recent = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 15, 12),
  );
  const r = computeTimeline([c("book", recent.toISOString())]);
  assert.equal(r.timelineGranularity, "month");
  assert.match(r.timeline[0].month, /^\d{4}-\d{2}$/);
});

test("computeTimeline: long span (>24 months) collapses to yearly buckets", () => {
  const r = computeTimeline([
    c("book", "2017-05-01T12:00:00Z"),
    c("book", "2020-05-01T12:00:00Z"),
  ]);
  assert.equal(r.timelineGranularity, "year");
  assert.ok(r.timeline.every((t) => /^\d{4}$/.test(t.month)));
  assert.equal(r.timeline.find((t) => t.month === "2017")?.book, 1);
  assert.equal(r.timeline.find((t) => t.month === "2020")?.book, 1);
});
