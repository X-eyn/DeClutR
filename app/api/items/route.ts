import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { scheduleCreatedItemGoogleSync } from "@/lib/google-sync";
import type { CreateItemInput } from "@/types";
import type { Prisma } from "@prisma/client";

const ITEM_TYPES = ["DEADLINE", "EVENT", "REMINDER", "TASK"] as const;
const ITEM_STATUSES = ["ACTIVE", "COMPLETED", "ARCHIVED", "OVERDUE"] as const;

function isItemType(value: string | null): value is CreateItemInput["type"] {
  return ITEM_TYPES.includes(value as CreateItemInput["type"]);
}

function isItemStatus(value: string | null): value is (typeof ITEM_STATUSES)[number] {
  return ITEM_STATUSES.includes(value as (typeof ITEM_STATUSES)[number]);
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const type = searchParams.get("type");
  const limit = parseInt(searchParams.get("limit") ?? "100");
  const where: Prisma.TemporalItemWhereInput = { userId: session.user.id };
  if (isItemStatus(status)) where.status = status;
  if (isItemType(type)) where.type = type;

  const items = await prisma.temporalItem.findMany({
    where,
    include: { checklists: { orderBy: { sortOrder: "asc" } }, tags: true },
    orderBy: { dueDate: "asc" },
    take: limit,
  });

  return NextResponse.json(items);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body: CreateItemInput = await req.json();

  const { title, description, type, priority, dueDate, startDate, allDay, reminderMinutes, tags, syncToCalendar, syncToTasks } = body;

  if (!title || !type || !dueDate) {
    return NextResponse.json({ error: "title, type, and dueDate are required" }, { status: 400 });
  }

  const dueDateObj = new Date(dueDate);
  const startDateObj = startDate ? new Date(startDate) : undefined;

  // Upsert tags
  const tagRecords = tags?.length
    ? await Promise.all(
        tags.map((name) =>
          prisma.tag.upsert({
            where: { name },
            update: {},
            create: { name },
          })
        )
      )
    : [];

  const item = await prisma.temporalItem.create({
    data: {
      userId: session.user.id,
      title,
      description,
      type,
      priority: priority ?? "MEDIUM",
      dueDate: dueDateObj,
      startDate: startDateObj,
      allDay: allDay ?? false,
      reminderMinutes: reminderMinutes ?? [],
      tags: tagRecords.length ? { connect: tagRecords.map((t) => ({ id: t.id })) } : undefined,
    },
    include: { checklists: true, tags: true },
  });

  if (syncToCalendar || syncToTasks) {
    scheduleCreatedItemGoogleSync({
      userId: session.user.id,
      item,
      syncToCalendar,
      syncToTasks,
      calendarReminderMinutes: reminderMinutes ?? [15, 60],
    });
  }

  return NextResponse.json({ item, syncErrors: [], syncPending: !!(syncToCalendar || syncToTasks) }, { status: 201 });
}
