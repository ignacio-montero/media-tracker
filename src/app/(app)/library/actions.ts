"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { entrySchema } from "@/lib/validation";

export type EntryFormState = { error?: string } | undefined;

function parseForm(formData: FormData) {
  const genresRaw = String(formData.get("genres") ?? "");
  const genres = genresRaw
    .split(",")
    .map((g) => g.trim())
    .filter(Boolean);

  const subgenresRaw = String(formData.get("subgenres") ?? "");
  const subgenres = subgenresRaw
    .split(",")
    .map((g) => g.trim())
    .filter(Boolean);

  const ratingRaw = formData.get("rating");
  const yearRaw = formData.get("year");
  const completedAtRaw = formData.get("completedAt");
  const genreCategoryRaw = formData.get("genreCategory");

  return entrySchema.safeParse({
    title: formData.get("title"),
    mediaType: formData.get("mediaType"),
    externalId: formData.get("externalId") ?? "",
    creator: formData.get("creator") ?? "",
    year: yearRaw === null || yearRaw === "" ? undefined : yearRaw,
    genres,
    status: formData.get("status") ?? "want",
    rating: ratingRaw === null || ratingRaw === "" ? undefined : ratingRaw,
    notes: formData.get("notes") ?? "",
    completedAt:
      completedAtRaw === null || completedAtRaw === ""
        ? undefined
        : completedAtRaw,
    authorGender: formData.get("authorGender") ?? "unknown",
    genreCategory:
      genreCategoryRaw === null || genreCategoryRaw === ""
        ? undefined
        : genreCategoryRaw,
    subgenres,
  });
}

/**
 * Resolve the completedAt timestamp to persist.
 * - Not completed → always null.
 * - Completed with an explicit date → that date.
 * - Completed without a date → keep the existing one, or default to now.
 */
function resolveCompletedAt(
  status: string,
  provided: Date | undefined,
  existing: Date | null,
): Date | null {
  if (status !== "completed") return null;
  if (provided) return provided;
  return existing ?? new Date();
}

export async function createEntryAction(
  _prev: EntryFormState,
  formData: FormData,
): Promise<EntryFormState> {
  const user = await requireUser();
  const parsed = parseForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const d = parsed.data;

  await prisma.entry.create({
    data: {
      userId: user.id,
      title: d.title,
      mediaType: d.mediaType,
      externalId: d.externalId || null,
      creator: d.creator || null,
      year: d.year ?? null,
      genres: d.genres,
      status: d.status,
      rating: d.rating ?? null,
      notes: d.notes || null,
      completedAt: resolveCompletedAt(d.status, d.completedAt, null),
      authorGender: d.authorGender,
      genreCategory: d.genreCategory ?? null,
      subgenres: d.subgenres,
      // A user-created row is, by definition, user-confirmed data.
      metadataUnverified: false,
    },
  });

  revalidatePath("/library");
  revalidatePath("/dashboard");
  redirect("/library");
}

export async function updateEntryAction(
  id: string,
  _prev: EntryFormState,
  formData: FormData,
): Promise<EntryFormState> {
  const user = await requireUser();
  const parsed = parseForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const d = parsed.data;

  // Ownership check: only touch rows belonging to this user.
  const existing = await prisma.entry.findFirst({
    where: { id, userId: user.id },
    select: { status: true, completedAt: true },
  });
  if (!existing) return { error: "Entry not found" };

  // Manage completedAt: honor an explicit date, else keep existing / default now,
  // and clear it when the entry is no longer completed.
  const completedAt = resolveCompletedAt(
    d.status,
    d.completedAt,
    existing.completedAt,
  );

  await prisma.entry.update({
    where: { id },
    data: {
      title: d.title,
      mediaType: d.mediaType,
      externalId: d.externalId || null,
      creator: d.creator || null,
      year: d.year ?? null,
      genres: d.genres,
      status: d.status,
      rating: d.rating ?? null,
      notes: d.notes || null,
      completedAt,
      authorGender: d.authorGender,
      genreCategory: d.genreCategory ?? null,
      subgenres: d.subgenres,
      // The user has just reviewed/saved this row — clear the AI-backfill flag.
      metadataUnverified: false,
    },
  });

  revalidatePath("/library");
  revalidatePath("/dashboard");
  redirect("/library");
}

export async function deleteEntryAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  // deleteMany with userId scoping = safe no-op if the row isn't theirs.
  await prisma.entry.deleteMany({ where: { id, userId: user.id } });

  revalidatePath("/library");
  revalidatePath("/dashboard");
}
