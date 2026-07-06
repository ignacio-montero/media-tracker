import Link from "next/link";
import { requireUser } from "@/lib/session";
import { getGreatBooksProgress } from "@/lib/greatbooks";

export default async function GreatBooksPage() {
  const user = await requireUser();
  const p = await getGreatBooksProgress(user.id);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Greatest Books goal</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Your progress through{" "}
          <a
            href="https://thegreatestbooks.org/"
            target="_blank"
            rel="noreferrer"
            className="underline"
          >
            The Greatest Books of All Time
          </a>{" "}
          (top {p.total}).
        </p>
      </div>

      {/* Headline progress */}
      <div className="rounded-2xl border border-black/10 bg-white p-6 dark:border-white/10 dark:bg-neutral-900">
        <div className="flex items-end justify-between">
          <div>
            <div className="text-4xl font-semibold">
              {p.readCount}
              <span className="text-xl text-neutral-400"> / {p.total}</span>
            </div>
            <div className="mt-1 text-sm text-neutral-500">
              {p.percent}% of the list read
            </div>
          </div>
        </div>
        <div className="mt-4 h-3 w-full overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800">
          <div
            className="h-full rounded-full bg-emerald-500 transition-all"
            style={{ width: `${Math.max(p.percent, 1)}%` }}
          />
        </div>

        {/* Per-100 breakdown */}
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
          {p.buckets.map((b) => (
            <div key={b.label} className="text-center">
              <div className="text-sm font-medium">
                {b.read}
                <span className="text-neutral-400">/{b.total}</span>
              </div>
              <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800">
                <div
                  className="h-full bg-emerald-500"
                  style={{ width: `${(b.read / b.total) * 100}%` }}
                />
              </div>
              <div className="mt-1 text-xs text-neutral-400">#{b.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* 500-cell rank grid */}
      <div className="rounded-2xl border border-black/10 bg-white p-6 dark:border-white/10 dark:bg-neutral-900">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-medium text-neutral-500">
            Every book by rank (hover for title)
          </h2>
          <div className="flex items-center gap-4 text-xs text-neutral-400">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 rounded-sm bg-emerald-500" />
              Read
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 rounded-sm bg-neutral-200 dark:bg-neutral-700" />
              Not yet
            </span>
          </div>
        </div>
        <div className="grid grid-cols-[repeat(25,minmax(0,1fr))] gap-1">
          {p.books.map((b) => (
            <div
              key={b.rank}
              title={`#${b.rank} · ${b.title} — ${b.author}`}
              className={`aspect-square rounded-sm ${
                b.read
                  ? "bg-emerald-500"
                  : "bg-neutral-200 dark:bg-neutral-700"
              }`}
            />
          ))}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Read from the list */}
        <div className="rounded-2xl border border-black/10 bg-white p-6 dark:border-white/10 dark:bg-neutral-900">
          <h2 className="mb-4 text-sm font-medium text-neutral-500">
            Read from the list ({p.readList.length})
          </h2>
          {p.readList.length === 0 ? (
            <p className="text-sm text-neutral-400">
              None matched yet. Add books to your{" "}
              <Link href="/library" className="underline">
                library
              </Link>{" "}
              and they’ll light up here.
            </p>
          ) : (
            <ul className="space-y-2 text-sm">
              {p.readList.map((b) => (
                <li key={b.rank} className="flex gap-3">
                  <span className="w-10 shrink-0 tabular-nums text-neutral-400">
                    #{b.rank}
                  </span>
                  <span>
                    <span className="font-medium">{b.title}</span>{" "}
                    <span className="text-neutral-500">— {b.author}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Next up — personalized picks from the list */}
        <div className="rounded-2xl border border-black/10 bg-white p-6 dark:border-white/10 dark:bg-neutral-900">
          <h2 className="mb-1 text-sm font-medium text-neutral-500">
            Next up — picked for your taste
          </h2>
          <p className="mb-4 text-xs text-neutral-400">
            Unread list books matched to the authors and eras you read most.
          </p>
          {p.nextUp.length === 0 ? (
            <p className="text-sm text-neutral-400">
              You’ve read every book on the list — nothing left to suggest!
            </p>
          ) : (
            <ul className="space-y-3 text-sm">
              {p.nextUp.map((b) => (
                <li key={b.rank} className="flex gap-3">
                  <span className="w-10 shrink-0 tabular-nums text-neutral-400">
                    #{b.rank}
                  </span>
                  <span className="min-w-0">
                    <span className="font-medium">{b.title}</span>{" "}
                    <span className="text-neutral-500">— {b.author}</span>
                    <span className="mt-0.5 block text-xs text-neutral-400">
                      {b.reason}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-4 text-xs text-neutral-400">
            Want AI-generated picks with fuller reasoning? Try{" "}
            <Link href="/recommendations" className="underline">
              For You
            </Link>{" "}
            with “only from the Greatest Books list.”
          </p>
        </div>
      </div>
    </div>
  );
}
