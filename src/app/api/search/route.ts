import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { searchOpenLibrary } from "@/lib/search/openlibrary";
import { searchTmdb, TmdbNotConfiguredError } from "@/lib/search/tmdb";
import type { SearchResult } from "@/lib/search/types";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") ?? "").trim();
  const type = searchParams.get("type") ?? "all"; // all | book | tv | movie

  if (!q) {
    return NextResponse.json({ results: [], tmdbConfigured: true });
  }

  const wantBooks = type === "all" || type === "book";
  const wantScreen = type === "all" || type === "tv" || type === "movie";

  let tmdbConfigured = true;
  const tasks: Promise<SearchResult[]>[] = [];

  if (wantBooks) {
    tasks.push(searchOpenLibrary(q).catch(() => []));
  }
  if (wantScreen) {
    tasks.push(
      searchTmdb(q).catch((err) => {
        if (err instanceof TmdbNotConfiguredError) tmdbConfigured = false;
        return [];
      }),
    );
  }

  const settled = (await Promise.all(tasks)).flat();

  // If a specific screen type was requested, narrow it down.
  const results =
    type === "tv" || type === "movie"
      ? settled.filter((r) => r.mediaType === type)
      : settled;

  return NextResponse.json({ results, tmdbConfigured });
}
