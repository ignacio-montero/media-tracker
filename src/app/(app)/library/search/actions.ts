"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { getTmdbCreator } from "@/lib/search/tmdb";
import { MEDIA_TYPES } from "@/lib/validation";

const addSchema = z.object({
  source: z.enum(["tmdb", "openlibrary"]),
  externalId: z.string().min(1).max(200),
  mediaType: z.enum(MEDIA_TYPES),
  title: z.string().min(1).max(300),
  creator: z.string().max(200).optional(),
  year: z.coerce.number().int().min(0).max(3000).optional(),
  genres: z.array(z.string()).max(30).default([]),
});

export type AddFromSearchState = { error?: string } | undefined;

export async function addFromSearchAction(
  _prev: AddFromSearchState,
  formData: FormData,
): Promise<AddFromSearchState> {
  const user = await requireUser();

  const parsed = addSchema.safeParse({
    source: formData.get("source"),
    externalId: formData.get("externalId"),
    mediaType: formData.get("mediaType"),
    title: formData.get("title"),
    creator: formData.get("creator") || undefined,
    year: formData.get("year") || undefined,
    genres: JSON.parse(String(formData.get("genres") ?? "[]")),
  });
  if (!parsed.success) {
    return { error: "Could not add this item" };
  }
  const d = parsed.data;

  // Avoid duplicates: same external item already in this user's library.
  const dupe = await prisma.entry.findFirst({
    where: { userId: user.id, externalId: d.externalId },
    select: { id: true },
  });
  if (dupe) {
    redirect("/library");
  }

  // Enrich screen titles with a director/creator on add (extra TMDB call).
  let creator = d.creator;
  if (!creator && d.source === "tmdb") {
    try {
      creator = await getTmdbCreator(d.externalId);
    } catch {
      // best-effort; leave creator blank
    }
  }

  await prisma.entry.create({
    data: {
      userId: user.id,
      title: d.title,
      mediaType: d.mediaType,
      externalId: d.externalId,
      creator: creator || null,
      year: d.year ?? null,
      genres: d.genres,
      status: "want",
    },
  });

  revalidatePath("/library");
  revalidatePath("/dashboard");
  redirect("/library");
}
