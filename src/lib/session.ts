import { redirect } from "next/navigation";
import { auth } from "@/auth";

/**
 * Returns the authenticated user's id + email, or redirects to /login.
 * Use at the top of every protected page / server action that touches
 * user-scoped data.
 */
export async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  return { id: session.user.id, email: session.user.email ?? "" };
}
