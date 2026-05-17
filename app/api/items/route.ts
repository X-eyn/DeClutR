import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createCalendarEvent, createGoogleTask } from "@/lib/google";
import type { CreateItemInput } from "@/types";
import { isToday, isThisWeek, isPast } from "date-fns";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const type = searchParams.get("type");
  const limit = parseInt(searchParams.get("limit") ?? "100");

  const items = await prisma.temporalItem.findMany({
    where: {
      userId: session.user.id,
      ...(status ? { status: status as any } : {}),
      ...(type ? { type: type as any } : {}),
    },
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

  let googleCalendarEventId: string | undefined;
  let googleTaskId: string | undefined;
  const syncErrors: string[] = [];

  if (syncToCalendar) {
    try {
      googleCalendarEventId = await createCalendarEvent(session.user.id, {
        title,
        description,
        startDate: startDateObj,
        dueDate: dueDateObj,
        allDay: allDay ?? false,
        reminderMinutes: reminderMinutes ?? [15, 60],
      });
      await prisma.syncLog.create({
        data: {
          userId: session.user.id,
          action: "CREATE_CALENDAR_EVENT",
          itemTitle: title,
          status: "SUCCESS",
          message: `Created calendar event ${googleCalendarEventId}`,
        },
      });
    } catch (e: any) {
      syncErrors.push(`Calendar: ${e.message}`);
      await prisma.syncLog.create({
        data: {
          userId: session.user.id,
          action: "CREATE_CALENDAR_EVENT",
          itemTitle: title,
          status: "ERROR",
          message: e.message,
        },
      });
    }
  }

  if (syncToTasks) {
    try {
      googleTaskId = await createGoogleTask(session.user.id, {
        title,
        notes: description,
        dueDate: dueDateObj,
      });
      await prisma.syncLog.create({
        data: {
          userId: session.user.id,
          action: "CREATE_GOOGLE_TASK",
          itemTitle: title,
          status: "SUCCESS",
          message: `Created task ${googleTaskId}`,
        },
      });
    } catch (e: any) {
      syncErrors.push(`Tasks: ${e.message}`);
      await prisma.syncLog.create({
        data: {
          userId: session.user.id,
          action: "CREATE_GOOGLE_TASK",
          itemTitle: title,
          status: "ERROR",
          message: e.message,
        },
      });
    }
  }

  const item = await prisma.temporalItem.create({
    data: {
      userId: session.user.id,
      title,
      description,
      type: type as any,
      priority: (priority as any) ?? "MEDIUM",
      dueDate: dueDateObj,
      startDate: startDateObj,
      allDay: allDay ?? false,
      reminderMinutes: reminderMinutes ?? [],
      googleCalendarEventId,
      googleTaskId,
      lastSyncedAt: (googleCalendarEventId || googleTaskId) ? new Date() : undefined,
      tags: tagRecords.length ? { connect: tagRecords.map((t) => ({ id: t.id })) } : undefined,
    },
    include: { checklists: true, tags: true },
  });

  return NextResponse.json({ item, syncErrors }, { status: 201 });
}
