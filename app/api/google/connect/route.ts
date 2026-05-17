import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const account = await prisma.account.findFirst({
    where: { userId: session.user.id, provider: "google" },
    select: { access_token: true, refresh_token: true, scope: true },
  });

  const connected = !!account?.access_token;
  const hasCalendarScope = account?.scope?.includes("calendar.events") ?? false;
  const hasTasksScope = account?.scope?.includes("tasks") ?? false;

  return NextResponse.json({ connected, hasCalendarScope, hasTasksScope });
}
