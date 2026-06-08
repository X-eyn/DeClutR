import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import SyncLogsView from "@/components/dashboard/SyncLogsView";
import { redirect } from "next/navigation";
import { GoogleAuthService } from "@/lib/google-services";

export default async function SyncPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;

  const logs = await prisma.syncLog.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const [connectionStatus, latestSyncRun] = await Promise.all([
    GoogleAuthService.refreshState(userId),
    prisma.syncRun.findFirst({
      where: { userId },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return (
    <SyncLogsView
      initialLogs={JSON.parse(JSON.stringify(logs))}
      initialConnectionStatus={{
        ...connectionStatus,
        lastSuccessfulImportAt: connectionStatus.lastSuccessfulImportAt?.toISOString() ?? null,
      }}
      initialSyncRun={JSON.parse(JSON.stringify(latestSyncRun))}
    />
  );
}
