import { requireUser } from "@/lib/session";
import { getCachedRecommendations } from "@/lib/recommendations";
import { GenerateRecsButton } from "@/components/GenerateRecsButton";
import { MEDIA_ICONS, MEDIA_LABELS } from "@/lib/display";

export default async function RecommendationsPage() {
  const user = await requireUser();
  const cached = await getCachedRecommendations(user.id);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">For You</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Five picks generated from your own completed &amp; rated history.
          Regenerate only when you want fresh ideas.
        </p>
      </div>

      <div className="flex items-center justify-between gap-4">
        <GenerateRecsButton hasExisting={!!cached} />
        {cached && (
          <span className="text-xs text-neutral-400">
            Updated {cached.generatedAt.toLocaleString()}
          </span>
        )}
      </div>

      {!cached ? (
        <div className="rounded-2xl border border-dashed border-black/15 p-10 text-center text-neutral-500 dark:border-white/15">
          No recommendations yet. Complete and rate a few items, then generate
          your first set.
        </div>
      ) : (
        <ul className="space-y-3">
          {cached.suggestions.map((s, i) => (
            <li
              key={`${s.title}-${i}`}
              className="rounded-xl border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-neutral-900"
            >
              <div className="flex items-center gap-2">
                <span aria-hidden>{MEDIA_ICONS[s.mediaType]}</span>
                <span className="font-medium">{s.title}</span>
                <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
                  {MEDIA_LABELS[s.mediaType]}
                </span>
              </div>
              <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
                {s.reason}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
