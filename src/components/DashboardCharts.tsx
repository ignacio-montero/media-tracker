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
} from "recharts";
import type { DashboardStats } from "@/lib/stats";

const TYPE_COLORS = {
  book: "#6366f1",
  tv: "#10b981",
  movie: "#f59e0b",
} as const;

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
                <XAxis dataKey="month" fontSize={11} tickMargin={8} />
                <YAxis allowDecimals={false} fontSize={11} width={28} />
                <Tooltip
                  contentStyle={{
                    borderRadius: 8,
                    border: "1px solid #8888",
                    fontSize: 12,
                  }}
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
              />
              <Tooltip
                cursor={{ fill: "#8888881a" }}
                contentStyle={{
                  borderRadius: 8,
                  border: "1px solid #8888",
                  fontSize: 12,
                }}
              />
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
              <Tooltip
                cursor={{ fill: "#8888881a" }}
                contentStyle={{
                  borderRadius: 8,
                  border: "1px solid #8888",
                  fontSize: 12,
                }}
              />
              <Bar dataKey="count" fill="#f59e0b" radius={[4, 4, 0, 0]} />
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
