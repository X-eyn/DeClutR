import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Sidebar from "@/components/dashboard/Sidebar";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const reminderCount = await prisma.temporalItem.count({
    where: {
      userId: session.user.id!,
      type: "REMINDER",
      status: { in: ["ACTIVE", "OVERDUE"] },
    },
  });

  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "248px minmax(0, 1fr)",
      minHeight: "100vh",
      background: "var(--bg)",
    }}>
      <Sidebar user={session.user} reminderCount={reminderCount} />
      <main style={{ minWidth: 0, overflowY: "auto", overflowX: "hidden" }}>
        {children}
      </main>
    </div>
  );
}
