"use client";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  AreaChart,
  Area,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import type { DashboardStats } from "@/lib/stats";
import { GENDER_LABELS } from "@/lib/taxonomy";

const TYPE_COLORS = {
  book: "#6366f1",
  tv: "#10b981",
  movie: "#f59e0b",
} as const;

const GENDER_COLORS: Record<string, string> = {
  female: "#ec4899",
  male: "#3b82f6",
  non_binary: "#a855f7",
  mixed: "#f59e0b",
  unknown: "#a3a3a3",
};

const CATEGORY_COLORS: Record<string, string> = {
  fiction: "#6366f1",
  non_fiction: "#10b981",
  other: "#a3a3a3",
};

const MONTH_ABBR = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** Format a timeline tick: "2021-03" -> "Mar '21"; a plain year is left as-is. */
function fmtTimelineTick(v: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(v);
  if (!m) return v;
  return `${MONTH_ABBR[parseInt(m[2], 10) - 1]} '${m[1].slice(2)}`;
}

// Shared tooltip styling. Explicit white background + dark text so labels stay
// readable in dark mode (Recharts' default inherits the page's light text,
// which was washing out on the tooltip's white card).
const TOOLTIP_STYLE = {
  contentStyle: {
    borderRadius: 8,
    border: "1px solid #8888",
    fontSize: 12,
    backgroundColor: "#ffffff",
    color: "#111111",
  },
  labelStyle: { color: "#111111", fontWeight: 500 },
  itemStyle: { color: "#111111" },
} as const;

const BAR_CURSOR = { fill: "#8888881a" };

// Only draw an on-slice label for slices big enough to not collide with their
// neighbours; small slices (e.g. Mixed / Non-binary / Unknown) get their value
// from the legend instead of overlapping leader lines.
type PieLabelArg = { percent?: number; value?: number };
function pieValueLabel(p: PieLabelArg): string {
  return p.percent !== undefined && p.percent >= 0.08 && p.value !== undefined
    ? String(p.value)
    : "";
}

// Legend entry -> "Name (count)" so every category's value is visible even when
// its slice is too small to label.
type LegendEntry = { value?: string; payload?: { count?: number } };
function pieLegendFormatter(value: string, entry: LegendEntry): string {
  const count = entry?.payload?.count;
  return count !== undefined ? `${value} (${count})` : value;
}

function ChartCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-neutral-900">
      <h2 className="mb-4 text-sm font-medium text-neutral-500">{title}</h2>
      {children}
    </div>
  );
}

export function DashboardCharts({ stats }: { stats: DashboardStats }) {
  const hasCompletions = stats.timeline.some(
    (m) => m.book + m.tv + m.movie > 0,
  );
  const hasGenres = stats.genreCounts.length > 0;
  const hasRatings = stats.ratingDistribution.some((r) => r.count > 0);

  // v1.1 book breakdowns — books-only, so these can legitimately be empty
  // even when other stats have data (e.g. a movie-only filtered view).
  const hasGenderSplit = stats.genderSplit.some((g) => g.count > 0);
  const hasCategorySplit = stats.categorySplit.some((c) => c.count > 0);
  const hasTopSubgenres = stats.topSubgenres.length > 0;
  const hasPubDecade = stats.byPublicationDecade.some((d) => d.count > 0);

  // Pre-map to {name, count, color} so Recharts' Pie can use its standard
  // `name`/`value` keys with well-typed label/tooltip/legend renderers,
  // instead of fighting PieLabelRenderProps' generic shape.
  const genderPieData = stats.genderSplit.map((g) => ({
    name: GENDER_LABELS[g.gender],
    count: g.count,
    color: GENDER_COLORS[g.gender] ?? "#a3a3a3",
  }));
  const categoryPieData = stats.categorySplit.map((c) => ({
    name: c.label,
    count: c.count,
    color: CATEGORY_COLORS[c.category] ?? "#a3a3a3",
  }));

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="lg:col-span-2">
        <ChartCard
          title={`Completions over time (${stats.timelineGranularity === "year" ? "yearly" : "monthly"})`}
        >
          {hasCompletions ? (
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={stats.timeline}>
                <CartesianGrid strokeDasharray="3 3" stroke="#88888822" />
                <XAxis
                  dataKey="month"
                  fontSize={11}
                  tickMargin={8}
                  tickFormatter={fmtTimelineTick}
                />
                <YAxis allowDecimals={false} fontSize={11} width={28} />
                <Tooltip
                  {...TOOLTIP_STYLE}
                  labelFormatter={(v) => fmtTimelineTick(String(v))}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Area
                  type="monotone"
                  dataKey="book"
                  stackId="1"
                  stroke={TYPE_COLORS.book}
                  fill={TYPE_COLORS.book}
                  name="Books"
                />
                <Area
                  type="monotone"
                  dataKey="tv"
                  stackId="1"
                  stroke={TYPE_COLORS.tv}
                  fill={TYPE_COLORS.tv}
                  name="TV"
                />
                <Area
                  type="monotone"
                  dataKey="movie"
                  stackId="1"
                  stroke={TYPE_COLORS.movie}
                  fill={TYPE_COLORS.movie}
                  name="Movies"
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <Empty />
          )}
        </ChartCard>
      </div>

      <ChartCard title="Top genres">
        {hasGenres ? (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={stats.genreCounts} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#88888822" />
              <XAxis type="number" allowDecimals={false} fontSize={11} />
              <YAxis
                type="category"
                dataKey="genre"
                width={120}
                fontSize={11}
                interval={0}
              />
              <Tooltip {...TOOLTIP_STYLE} cursor={BAR_CURSOR} />
              <Bar dataKey="count" fill="#6366f1" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <Empty />
        )}
      </ChartCard>

      <ChartCard title="Ratings distribution">
        {hasRatings ? (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={stats.ratingDistribution}>
              <CartesianGrid strokeDasharray="3 3" stroke="#88888822" />
              <XAxis
                dataKey="rating"
                fontSize={11}
                tickFormatter={(v) => "★".repeat(v)}
              />
              <YAxis allowDecimals={false} fontSize={11} width={28} />
              <Tooltip {...TOOLTIP_STYLE} cursor={BAR_CURSOR} />
              <Bar dataKey="count" fill="#f59e0b" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <Empty />
        )}
      </ChartCard>

      {/* --- v1.1 book breakdowns --- */}

      <ChartCard title="Author gender split (books)">
        {hasGenderSplit ? (
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie
                data={genderPieData}
                dataKey="count"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={80}
                label={pieValueLabel}
                labelLine={false}
                isAnimationActive={false}
              >
                {genderPieData.map((g) => (
                  <Cell key={g.name} fill={g.color} />
                ))}
              </Pie>
              <Tooltip {...TOOLTIP_STYLE} />
              <Legend wrapperStyle={{ fontSize: 12 }} formatter={pieLegendFormatter} />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <Empty />
        )}
      </ChartCard>

      <ChartCard title="Fiction vs non-fiction (books)">
        {hasCategorySplit ? (
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie
                data={categoryPieData}
                dataKey="count"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={80}
                label={pieValueLabel}
                labelLine={false}
                isAnimationActive={false}
              >
                {categoryPieData.map((c) => (
                  <Cell key={c.name} fill={c.color} />
                ))}
              </Pie>
              <Tooltip {...TOOLTIP_STYLE} />
              <Legend wrapperStyle={{ fontSize: 12 }} formatter={pieLegendFormatter} />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <Empty />
        )}
      </ChartCard>

      <ChartCard title="Top subgenres (books)">
        {hasTopSubgenres ? (
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={stats.topSubgenres} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#88888822" />
              <XAxis type="number" allowDecimals={false} fontSize={11} />
              <YAxis
                type="category"
                dataKey="subgenre"
                width={150}
                fontSize={11}
                interval={0}
              />
              <Tooltip {...TOOLTIP_STYLE} cursor={BAR_CURSOR} />
              <Bar dataKey="count" fill="#10b981" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <Empty />
        )}
      </ChartCard>

      <ChartCard title="Books by publication decade">
        {hasPubDecade ? (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={stats.byPublicationDecade}>
              <CartesianGrid strokeDasharray="3 3" stroke="#88888822" />
              <XAxis dataKey="decade" fontSize={11} tickMargin={8} />
              <YAxis allowDecimals={false} fontSize={11} width={28} />
              <Tooltip {...TOOLTIP_STYLE} cursor={BAR_CURSOR} />
              <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <Empty />
        )}
      </ChartCard>
    </div>
  );
}

function Empty() {
  return (
    <div className="flex h-[240px] items-center justify-center text-sm text-neutral-400">
      No data yet — complete and rate some entries.
    </div>
  );
}
