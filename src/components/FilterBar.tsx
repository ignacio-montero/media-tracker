"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useState } from "react";
import { MEDIA_TYPES, ENTRY_STATUSES } from "@/lib/validation";
import { MEDIA_LABELS, STATUS_LABELS } from "@/lib/display";
import {
  CATEGORY_LABELS,
  GENDER_VALUES,
  GENDER_LABELS,
  subgenresFor,
  type GenreCategory,
} from "@/lib/taxonomy";

const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/**
 * Shape this component expects for "current" filter values — parsed upstream
 * (in the page) via `parseEntryFilters(searchParams)` and passed down as
 * props so chips render active on load without a client fetch.
 */
export type FilterBarValue = {
  type?: string;
  status?: string;
  readYear?: number;
  readMonth?: number;
  pubFrom?: number;
  pubTo?: number;
  gender?: string[];
  category?: string[];
  subgenres?: string[];
  unverified?: boolean;
};

const chip = (active: boolean) =>
  `rounded-full px-3 py-1 transition ${
    active
      ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
      : "border border-black/15 hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/10"
  }`;

const inputClass =
  "rounded-lg border border-black/15 bg-transparent px-2 py-1 text-sm outline-none focus:border-black/40 dark:border-white/15 dark:focus:border-white/40";

/**
 * Shared filter bar used by both /library and /dashboard. Navigates purely
 * via URL query params (no client-side fetch) so filters stay shareable and
 * bookmarkable, and so server components can read them directly.
 */
export function FilterBar({
  value,
  availableYears,
}: {
  value: FilterBarValue;
  /** Known read-years for the year <select>, e.g. from entry completedAt
   * range. Optional — if omitted, falls back to a free-typed number input. */
  availableYears?: number[];
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Local (uncommitted) state for the free-text pub-year range inputs, so we
  // don't push a URL on every keystroke.
  const [pubFrom, setPubFrom] = useState(value.pubFrom?.toString() ?? "");
  const [pubTo, setPubTo] = useState(value.pubTo?.toString() ?? "");

  const buildHref = (patch: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, val] of Object.entries(patch)) {
      if (val === null || val === "") {
        params.delete(key);
      } else {
        params.set(key, val);
      }
    }
    const qs = params.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  };

  const toggleInList = (
    key: "gender" | "cat" | "sub",
    current: string[] | undefined,
    val: string,
  ) => {
    const list = current ?? [];
    const next = list.includes(val)
      ? list.filter((v) => v !== val)
      : [...list, val];
    return buildHref({ [key]: next.length ? next.join(",") : null });
  };

  const pushPubRange = (from: string, to: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (from) params.set("pubFrom", from);
    else params.delete("pubFrom");
    if (to) params.set("pubTo", to);
    else params.delete("pubTo");
    const qs = params.toString();
    window.location.href = qs ? `${pathname}?${qs}` : pathname;
  };

  const selectedCategories = (value.category ?? []) as GenreCategory[];
  const subgenreOptions =
    selectedCategories.length > 0
      ? [...new Set(selectedCategories.flatMap((c) => subgenresFor(c)))]
      : [
          ...new Set(
            (Object.keys(CATEGORY_LABELS) as GenreCategory[]).flatMap((c) =>
              subgenresFor(c),
            ),
          ),
        ];

  const hasAnyFilter =
    value.type ||
    value.status ||
    value.readYear ||
    value.pubFrom ||
    value.pubTo ||
    (value.gender && value.gender.length > 0) ||
    (value.category && value.category.length > 0) ||
    (value.subgenres && value.subgenres.length > 0) ||
    value.unverified;

  return (
    <div className="mb-6 space-y-4 rounded-2xl border border-black/10 bg-white p-4 text-sm dark:border-white/10 dark:bg-neutral-900">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xs font-medium tracking-wide text-neutral-500 uppercase">
          Filters
        </h2>
        {hasAnyFilter && (
          <Link
            href={pathname}
            className="rounded-full border border-black/15 px-3 py-1 text-xs transition hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/10"
          >
            Clear all
          </Link>
        )}
      </div>

      <div className="flex flex-wrap gap-4">
        <FilterRow
          label="Type"
          allHref={buildHref({ type: null })}
          allActive={!value.type}
          options={MEDIA_TYPES.map((t) => ({
            label: MEDIA_LABELS[t],
            href: buildHref({ type: value.type === t ? null : t }),
            active: value.type === t,
          }))}
        />
        <FilterRow
          label="Status"
          allHref={buildHref({ status: null })}
          allActive={!value.status}
          options={ENTRY_STATUSES.map((s) => ({
            label: STATUS_LABELS[s],
            href: buildHref({ status: value.status === s ? null : s }),
            active: value.status === s,
          }))}
        />
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <div>
          <label htmlFor="filter-read-year" className="mb-1 block text-xs text-neutral-400">
            Read year
          </label>
          <div className="flex gap-2">
            {availableYears && availableYears.length > 0 ? (
              <select
                id="filter-read-year"
                className={inputClass}
                value={value.readYear ?? ""}
                onChange={(e) => {
                  window.location.href = buildHref({
                    readYear: e.target.value || null,
                    readMonth: e.target.value ? value.readMonth?.toString() ?? null : null,
                  });
                }}
              >
                <option value="">Any year</option>
                {availableYears.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            ) : (
              <input
                id="filter-read-year"
                type="number"
                placeholder="Any year"
                className={`${inputClass} w-24`}
                defaultValue={value.readYear ?? ""}
                onBlur={(e) =>
                  (window.location.href = buildHref({
                    readYear: e.target.value || null,
                  }))
                }
              />
            )}
            {value.readYear && (
              <select
                aria-label="Read month"
                className={inputClass}
                value={value.readMonth ?? ""}
                onChange={(e) =>
                  (window.location.href = buildHref({
                    readMonth: e.target.value || null,
                  }))
                }
              >
                <option value="">Any month</option>
                {MONTH_LABELS.map((m, i) => (
                  <option key={m} value={i + 1}>
                    {m}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        <div>
          <span className="mb-1 block text-xs text-neutral-400">
            Publication year
          </span>
          <div className="flex items-center gap-2">
            <input
              type="number"
              placeholder="From"
              className={`${inputClass} w-20`}
              value={pubFrom}
              onChange={(e) => setPubFrom(e.target.value)}
              onBlur={() => pushPubRange(pubFrom, pubTo)}
              onKeyDown={(e) => {
                if (e.key === "Enter") pushPubRange(pubFrom, pubTo);
              }}
            />
            <span className="text-neutral-400">–</span>
            <input
              type="number"
              placeholder="To"
              className={`${inputClass} w-20`}
              value={pubTo}
              onChange={(e) => setPubTo(e.target.value)}
              onBlur={() => pushPubRange(pubFrom, pubTo)}
              onKeyDown={(e) => {
                if (e.key === "Enter") pushPubRange(pubFrom, pubTo);
              }}
            />
          </div>
        </div>

        <label className="flex items-center gap-2 pb-1.5">
          <input
            type="checkbox"
            checked={!!value.unverified}
            onChange={() =>
              (window.location.href = buildHref({
                unverified: value.unverified ? null : "1",
              }))
            }
            className="h-4 w-4 rounded border-black/15 dark:border-white/15"
          />
          <span>Unverified only</span>
        </label>
      </div>

      <div className="flex flex-wrap gap-2">
        <span className="pt-1 text-neutral-400">Author gender:</span>
        {GENDER_VALUES.map((g) => (
          <Link
            key={g}
            href={toggleInList("gender", value.gender, g)}
            className={chip(!!value.gender?.includes(g))}
          >
            {GENDER_LABELS[g]}
          </Link>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <span className="pt-1 text-neutral-400">Category:</span>
        {(Object.keys(CATEGORY_LABELS) as GenreCategory[]).map((c) => (
          <Link
            key={c}
            href={toggleInList("cat", value.category, c)}
            className={chip(!!value.category?.includes(c))}
          >
            {CATEGORY_LABELS[c]}
          </Link>
        ))}
      </div>

      {subgenreOptions.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <span className="pt-1 text-neutral-400">Subgenre:</span>
          {subgenreOptions.map((s) => (
            <Link
              key={s}
              href={toggleInList("sub", value.subgenres, s)}
              className={chip(!!value.subgenres?.includes(s))}
            >
              {s}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function FilterRow({
  label,
  allHref,
  allActive,
  options,
}: {
  label: string;
  allHref: string;
  allActive: boolean;
  options: { label: string; href: string; active: boolean }[];
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-neutral-400">{label}:</span>
      <Link href={allHref} className={chip(allActive)}>
        All
      </Link>
      {options.map((o) => (
        <Link key={o.href} href={o.href} className={chip(o.active)}>
          {o.label}
        </Link>
      ))}
    </div>
  );
}
