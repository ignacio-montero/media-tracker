import { GoogleGenAI, Type } from "@google/genai";
import { prisma } from "@/lib/prisma";
import { normalizeTitle } from "@/lib/normalize";
import type { MediaType } from "@/generated/prisma/enums";

export type Suggestion = {
  title: string;
  mediaType: MediaType;
  reason: string;
};

export class GeminiNotConfiguredError extends Error {
  constructor() {
    super("GEMINI_API_KEY is not set");
    this.name = "GeminiNotConfiguredError";
  }
}

export type CachedRecommendations = {
  suggestions: Suggestion[];
  generatedAt: Date;
} | null;

export async function getCachedRecommendations(
  userId: string,
): Promise<CachedRecommendations> {
  const cache = await prisma.recommendationCache.findUnique({
    where: { userId },
  });
  if (!cache) return null;
  return {
    suggestions: cache.suggestions as unknown as Suggestion[],
    generatedAt: cache.generatedAt,
  };
}

const MEDIA_LABEL: Record<MediaType, string> = {
  book: "book",
  tv: "TV show",
  movie: "movie",
};

/**
 * Build a compact history summary from the user's completed + rated entries.
 * Only completed items are sent (per spec) to keep the prompt focused.
 */
function buildHistorySummary(
  entries: {
    title: string;
    mediaType: MediaType;
    creator: string | null;
    rating: number | null;
    genres: string[];
  }[],
): string {
  return entries
    .map((e) => {
      const rating = e.rating ? `${e.rating}/5` : "unrated";
      const by = e.creator ? ` by ${e.creator}` : "";
      const genres = e.genres.length ? ` [${e.genres.join(", ")}]` : "";
      return `- ${e.title}${by} (${MEDIA_LABEL[e.mediaType]}, ${rating})${genres}`;
    })
    .join("\n");
}

/**
 * Call Gemini once and parse/validate its JSON into suggestions.
 * Returns [] when the model gives back nothing usable so the caller can retry.
 */
async function callGeminiOnce(
  ai: GoogleGenAI,
  prompt: string,
): Promise<Suggestion[]> {
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            mediaType: { type: Type.STRING, enum: ["book", "tv", "movie"] },
            reason: { type: Type.STRING },
          },
          required: ["title", "mediaType", "reason"],
          propertyOrdering: ["title", "mediaType", "reason"],
        },
      },
    },
  });

  const text = response.text;
  if (!text) return [];

  let parsed: Suggestion[];
  try {
    parsed = JSON.parse(text) as Suggestion[];
  } catch {
    return [];
  }

  return parsed
    .filter(
      (s) =>
        s &&
        typeof s.title === "string" &&
        ["book", "tv", "movie"].includes(s.mediaType) &&
        typeof s.reason === "string",
    )
    .slice(0, 5);
}

/**
 * Request suggestions from Gemini, retrying once if the first call comes back
 * empty/unparseable. Gemini occasionally returns an empty response transiently;
 * a single retry turns that user-facing dead-end into a brief extra wait.
 *
 * Note: a persistently empty result now THROWS (surfaced to the user as an
 * error) and is never cached. This differs from the pre-retry behavior, which
 * cached an empty `[]` as a silent success — we'd rather error and let the user
 * retry than persist an empty recommendation set. The retry reuses the same
 * prompt with no backoff, so it only helps transient emptiness, not
 * deterministic failures (over-long prompt, safety filter); those cost a second
 * call and still error.
 */
async function requestSuggestions(
  ai: GoogleGenAI,
  prompt: string,
): Promise<Suggestion[]> {
  const first = await callGeminiOnce(ai, prompt);
  if (first.length > 0) return first;

  const retry = await callGeminiOnce(ai, prompt);
  if (retry.length > 0) return retry;

  throw new Error(
    "The recommendation service returned no suggestions. Please try again.",
  );
}

/**
 * Generate 5 recommendations from the user's own completed history via Gemini,
 * then cache them. Only called on explicit user request. Requires GEMINI_API_KEY.
 */
export type GenerateOptions = { fromGreatBooksList?: boolean };

export async function generateRecommendations(
  userId: string,
  { fromGreatBooksList = false }: GenerateOptions = {},
): Promise<Suggestion[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new GeminiNotConfiguredError();

  const history = await prisma.entry.findMany({
    where: { userId, status: "completed" },
    select: {
      title: true,
      mediaType: true,
      creator: true,
      rating: true,
      genres: true,
    },
    orderBy: { completedAt: "desc" },
    take: 100,
  });

  if (history.length === 0) {
    throw new Error(
      "Complete and rate a few items first — recommendations are based on your history.",
    );
  }

  const summary = buildHistorySummary(history);

  let prompt: string;
  if (fromGreatBooksList) {
    // Candidate pool = highest-ranked "Greatest Books" the user hasn't logged.
    const [greatBooks, ownedBooks] = await Promise.all([
      prisma.greatBook.findMany({ orderBy: { rank: "asc" } }),
      prisma.entry.findMany({
        where: { userId, mediaType: "book" },
        select: { title: true },
      }),
    ]);
    const readSet = new Set(ownedBooks.map((b) => normalizeTitle(b.title)));
    const candidates = greatBooks
      .filter((g) => !readSet.has(g.normalizedTitle))
      .slice(0, 250);

    if (candidates.length === 0) {
      throw new Error(
        "You've logged every book on the Greatest Books list — nothing left to suggest!",
      );
    }

    const candidateList = candidates
      .map((c) => `${c.rank}. ${c.title} — ${c.author}`)
      .join("\n");

    prompt = `You are a book recommendation engine for a personal media tracker.
The user is working through "The Greatest Books of All Time" list and wants their
next reads to come FROM that list. Below is their completed history (their taste)
and a numbered CANDIDATE LIST of great books they have NOT yet read (lower rank
number = more acclaimed).

Choose exactly 5 titles taken ONLY from the candidate list that best match this
user's demonstrated taste. Prefer more acclaimed (lower-ranked) books when taste
fit is similar. Use mediaType "book" for all. Give one concise sentence each on
why it fits THIS user. Do not invent titles outside the candidate list.

User's completed history:
${summary}

Candidate list (rank. Title — Author):
${candidateList}`;
  } else {
    prompt = `You are a recommendation engine for a personal media tracker.
Based ONLY on the user's completed history below (books, TV shows, and movies,
with their 1-5 star ratings), suggest exactly 5 NEW titles they haven't logged
that they're likely to enjoy. Favour what their higher-rated items suggest about
their taste. Mix media types when it fits their habits. For each suggestion give
a single concise sentence explaining why it fits THIS user's taste.

Do not suggest anything already in their history.

User's completed history:
${summary}`;
  }

  const ai = new GoogleGenAI({ apiKey });
  const suggestions = await requestSuggestions(ai, prompt);

  await prisma.recommendationCache.upsert({
    where: { userId },
    create: {
      userId,
      suggestions: suggestions as unknown as object,
      generatedAt: new Date(),
    },
    update: {
      suggestions: suggestions as unknown as object,
      generatedAt: new Date(),
    },
  });

  return suggestions;
}
