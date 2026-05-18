import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import CommandCenter from "@/components/dashboard/CommandCenter";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;

  const account = await prisma.account.findFirst({
    where: { userId, provider: "google" },
    select: { access_token: true, scope: true },
  });

  const googleConnected = !!account?.access_token;

  return (
    <CommandCenter
      googleConnected={googleConnected}
      user={{
        name: session.user.name ?? null,
        image: session.user.image ?? null,
        email: session.user.email ?? null,
      }}
    />
  );
}
