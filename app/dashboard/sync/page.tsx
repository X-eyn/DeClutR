import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import SyncLogsView from "@/components/dashboard/SyncLogsView";
import { redirect } from "next/navigation";

export default async function SyncPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;

  const logs = await prisma.syncLog.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const account = await prisma.account.findFirst({
    where: { userId, provider: "google" },
    select: { scope: true, access_token: true },
  });

  return (
    <SyncLogsView
      initialLogs={JSON.parse(JSON.stringify(logs))}
      googleConnected={!!account?.access_token}
      scopes={account?.scope ?? ""}
    />
  );
}
