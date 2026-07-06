import { z } from "zod";
import { GENDER_VALUES, GENRE_CATEGORIES, isValidSubgenre } from "@/lib/taxonomy";

export const registerSchema = z
  .object({
    email: z.string().email("Enter a valid email address"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const MEDIA_TYPES = ["book", "tv", "movie"] as const;
export const ENTRY_STATUSES = [
  "want",
  "in_progress",
  "completed",
  "dropped",
] as const;

export const entrySchema = z
  .object({
    title: z.string().trim().min(1, "Title is required").max(300),
    mediaType: z.enum(MEDIA_TYPES),
    externalId: z.string().trim().max(100).optional().or(z.literal("")),
    creator: z.string().trim().max(200).optional().or(z.literal("")),
    year: z.coerce
      .number()
      .int()
      .min(0)
      .max(3000)
      .optional()
      .or(z.nan().transform(() => undefined)),
    genres: z.array(z.string().trim().min(1)).max(30).default([]),
    status: z.enum(ENTRY_STATUSES).default("want"),
    rating: z.coerce.number().int().min(1).max(5).optional(),
    notes: z.string().trim().max(5000).optional().or(z.literal("")),
    // Date the item was read/finished. Only meaningful for completed items.
    completedAt: z.coerce.date().optional(),
    // v1.1: books-only structured metadata (see docs/ARCHITECTURE.md).
    authorGender: z.enum(GENDER_VALUES).default("unknown"),
    genreCategory: z.enum(GENRE_CATEGORIES).optional(),
    subgenres: z.array(z.string().trim().min(1)).max(20).default([]),
  })
  .superRefine((data, ctx) => {
    // A subgenre must belong to the row's selected category (taxonomy.ts is
    // the source of truth). No category selected -> no subgenres allowed.
    if (data.subgenres.length === 0) return;
    if (!data.genreCategory) {
      ctx.addIssue({
        code: "custom",
        message: "Select a genre category before choosing subgenres",
        path: ["subgenres"],
      });
      return;
    }
    for (const s of data.subgenres) {
      if (!isValidSubgenre(data.genreCategory, s)) {
        ctx.addIssue({
          code: "custom",
          message: `"${s}" is not a valid subgenre for ${data.genreCategory}`,
          path: ["subgenres"],
        });
      }
    }
  });

export type EntryInput = z.infer<typeof entrySchema>;
