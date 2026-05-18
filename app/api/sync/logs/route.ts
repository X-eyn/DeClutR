import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

const SYNC_LOG_STATUSES = ["PENDING", "SUCCESS", "ERROR"] as const;

function isSyncLogStatus(value: string | null): value is (typeof SYNC_LOG_STATUSES)[number] {
  return SYNC_LOG_STATUSES.includes(value as (typeof SYNC_LOG_STATUSES)[number]);
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const limit = parseInt(searchParams.get("limit") ?? "50");
  const status = searchParams.get("status");
  const where: Prisma.SyncLogWhereInput = { userId: session.user.id };
  if (isSyncLogStatus(status)) where.status = status;

  const logs = await prisma.syncLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return NextResponse.json(logs);
}
