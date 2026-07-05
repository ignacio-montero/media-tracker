import type { MediaType } from "@/generated/prisma/enums";

export type SearchResult = {
  source: "tmdb" | "openlibrary";
  externalId: string;
  mediaType: MediaType;
  title: string;
  creator?: string;
  year?: number;
  genres: string[];
  imageUrl?: string;
  overview?: string;
};
