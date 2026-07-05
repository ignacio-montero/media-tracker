import { requireUser } from "@/lib/session";
import { SearchClient } from "@/components/SearchClient";

export default async function SearchPage() {
  await requireUser();
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-1 text-2xl font-semibold">Search &amp; add</h1>
      <p className="mb-6 text-sm text-neutral-500">
        Find books via Open Library and movies/TV via TMDB, then add them to your
        library.
      </p>
      <SearchClient />
    </div>
  );
}
