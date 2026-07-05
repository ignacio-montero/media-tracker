import { z } from "zod";

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

export const entrySchema = z.object({
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
});

export type EntryInput = z.infer<typeof entrySchema>;
