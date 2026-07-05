"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/session";
import {
  generateRecommendations,
  GeminiNotConfiguredError,
} from "@/lib/recommendations";

export type RecsState = { error?: string } | undefined;

export async function generateRecommendationsAction(
  _prev: RecsState,
  formData: FormData,
): Promise<RecsState> {
  const user = await requireUser();
  const fromGreatBooksList = formData.get("fromList") === "on";

  try {
    await generateRecommendations(user.id, { fromGreatBooksList });
  } catch (error) {
    if (error instanceof GeminiNotConfiguredError) {
      return {
        error:
          "Recommendations aren’t configured yet — a GEMINI_API_KEY needs to be set.",
      };
    }
    return {
      error:
        error instanceof Error
          ? error.message
          : "Something went wrong generating recommendations.",
    };
  }

  revalidatePath("/recommendations");
  return undefined;
}
