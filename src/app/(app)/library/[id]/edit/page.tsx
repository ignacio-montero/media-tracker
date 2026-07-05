import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { EntryForm } from "@/components/EntryForm";
import { updateEntryAction } from "../../actions";

export default async function EditEntryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;

  const entry = await prisma.entry.findFirst({
    where: { id, userId: user.id },
  });
  if (!entry) notFound();

  const action = updateEntryAction.bind(null, entry.id);

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="mb-6 text-2xl font-semibold">Edit entry</h1>
      <EntryForm
        action={action}
        submitLabel="Save changes"
        initial={{
          title: entry.title,
          mediaType: entry.mediaType,
          externalId: entry.externalId ?? "",
          creator: entry.creator ?? "",
          year: entry.year,
          genres: entry.genres,
          status: entry.status,
          rating: entry.rating,
          notes: entry.notes,
          completedAt: entry.completedAt
            ? entry.completedAt.toISOString().slice(0, 10)
            : null,
        }}
      />
    </div>
  );
}
