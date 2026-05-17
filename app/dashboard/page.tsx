import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import CommandCenter from "@/components/dashboard/CommandCenter";
import { isToday, isThisWeek, isThisMonth, isPast } from "date-fns";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;

  const allItems = await prisma.temporalItem.findMany({
    where: { userId },
    include: { checklists: true, tags: true },
    orderBy: { dueDate: "asc" },
    take: 200,
  });

  const now = new Date();
  const stats = {
    total: allItems.filter(i => i.status !== "COMPLETED" && i.status !== "ARCHIVED").length,
    overdue: allItems.filter(i => isPast(i.dueDate) && i.status !== "COMPLETED" && i.status !== "ARCHIVED").length,
    dueToday: allItems.filter(i => isToday(i.dueDate) && i.status !== "COMPLETED").length,
    dueThisWeek: allItems.filter(i => isThisWeek(i.dueDate, { weekStartsOn: 1 }) && i.status !== "COMPLETED").length,
    dueThisMonth: allItems.filter(i => isThisMonth(i.dueDate) && i.status !== "COMPLETED").length,
    completed: allItems.filter(i => i.status === "COMPLETED").length,
  };

  const account = await prisma.account.findFirst({
    where: { userId, provider: "google" },
    select: { access_token: true, scope: true },
  });

  const googleConnected = !!account?.access_token;

  return (
    <CommandCenter
      initialItems={JSON.parse(JSON.stringify(allItems))}
      stats={stats}
      googleConnected={googleConnected}
      user={{
        name: session.user.name ?? null,
        image: session.user.image ?? null,
        email: session.user.email ?? null,
      }}
    />
  );
}
