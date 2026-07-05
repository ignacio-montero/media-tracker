import type { MediaType, EntryStatus } from "@/generated/prisma/enums";

export const MEDIA_LABELS: Record<MediaType, string> = {
  book: "Book",
  tv: "TV show",
  movie: "Movie",
};

export const MEDIA_ICONS: Record<MediaType, string> = {
  book: "📖",
  tv: "📺",
  movie: "🎬",
};

export const STATUS_LABELS: Record<EntryStatus, string> = {
  want: "Want to consume",
  in_progress: "In progress",
  completed: "Completed",
  dropped: "Dropped",
};

export const STATUS_BADGE: Record<EntryStatus, string> = {
  want: "bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300",
  in_progress: "bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300",
  completed:
    "bg-green-100 text-green-700 dark:bg-green-950/50 dark:text-green-300",
  dropped: "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300",
};

export function stars(rating: number | null): string {
  if (!rating) return "";
  return "★".repeat(rating) + "☆".repeat(5 - rating);
}
