import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import TimelineView from "@/components/timeline/TimelineView";
import { redirect } from "next/navigation";

export default async function TimelinePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;

  const items = await prisma.temporalItem.findMany({
    where: { userId },
    include: { checklists: true, tags: true },
    orderBy: { dueDate: "asc" },
    take: 200,
  });

  return <TimelineView initialItems={JSON.parse(JSON.stringify(items))} />;
}
