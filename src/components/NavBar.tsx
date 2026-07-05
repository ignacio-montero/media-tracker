import Link from "next/link";
import { signOutAction } from "@/app/(app)/actions";

const links = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/library", label: "Library" },
  { href: "/great-books", label: "Great Books" },
  { href: "/recommendations", label: "For You" },
];

export function NavBar({ email }: { email: string }) {
  return (
    <header className="border-b border-black/10 bg-white/80 backdrop-blur dark:border-white/10 dark:bg-neutral-900/80">
      <nav className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-6">
          <Link href="/dashboard" className="font-semibold">
            📚 Media Tracker
          </Link>
          <div className="flex items-center gap-4 text-sm">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="text-neutral-600 transition hover:text-black dark:text-neutral-400 dark:hover:text-white"
              >
                {l.label}
              </Link>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="hidden text-neutral-500 sm:inline">{email}</span>
          <form action={signOutAction}>
            <button
              type="submit"
              className="rounded-lg border border-black/15 px-3 py-1.5 transition hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/10"
            >
              Sign out
            </button>
          </form>
        </div>
      </nav>
    </header>
  );
}
