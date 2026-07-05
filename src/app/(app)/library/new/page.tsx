import Link from "next/link";
import { requireUser } from "@/lib/session";
import { EntryForm } from "@/components/EntryForm";
import { createEntryAction } from "../actions";

export default async function NewEntryPage() {
  await requireUser();
  return (
    <div className="mx-auto max-w-xl">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Add entry</h1>
        <Link
          href="/library/search"
          className="text-sm font-medium underline"
        >
          Search instead →
        </Link>
      </div>
      <EntryForm action={createEntryAction} submitLabel="Add to library" />
    </div>
  );
}
