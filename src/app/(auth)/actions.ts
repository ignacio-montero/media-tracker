"use server";

import bcrypt from "bcryptjs";
import { AuthError } from "next-auth";
import { prisma } from "@/lib/prisma";
import { signIn } from "@/auth";
import { registerSchema } from "@/lib/validation";

export type AuthFormState = { error?: string } | undefined;

export async function registerAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = registerSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const email = parsed.data.email.toLowerCase();

  // ACCEPTED RISK — user enumeration. Returning a distinct "already exists"
  // message lets an attacker probe which emails hold accounts. The privacy-
  // preserving alternative is a generic success response plus an email
  // confirmation flow; that needs a mail provider, which this single-user app
  // deliberately does not have. Revisit if registration is ever opened up.
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { error: "An account with that email already exists" };
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  await prisma.user.create({ data: { email, passwordHash } });

  // signIn owns the redirect so its Set-Cookie is carried on the response.
  // It throws NEXT_REDIRECT on success (re-thrown) or AuthError on failure.
  try {
    await signIn("credentials", {
      email,
      password: parsed.data.password,
      redirectTo: "/dashboard",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return {
        error: "Account created, but automatic sign-in failed. Please log in.",
      };
    }
    throw error;
  }

  return undefined;
}

// ACCEPTED RISK — no login rate limiting. There is no throttle on failed
// attempts, so credential brute-forcing is bounded only by bcrypt's cost factor
// of 12 (~250ms/attempt), which is a real but partial brake. A production
// deployment should add per-IP and per-account attempt limits.
export async function loginAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "").toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Email and password are required" };
  }

  try {
    await signIn("credentials", { email, password, redirectTo: "/dashboard" });
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "Invalid email or password" };
    }
    throw error;
  }

  return undefined;
}
