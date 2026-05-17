import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { updateCalendarEvent, deleteCalendarEvent, updateGoogleTask, deleteGoogleTask } from "@/lib/google";
import type { UpdateItemInput } from "@/types";

async function getItem(userId: string, id: string) {
  return prisma.temporalItem.findFirst({ where: { id, userId }, include: { checklists: true, tags: true } });
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const item = await getItem(session.user.id, id);
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(item);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const existing = await getItem(session.user.id, id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body: UpdateItemInput = await req.json();
  const dueDateObj = body.dueDate ? new Date(body.dueDate) : existing.dueDate;
  const startDateObj = body.startDate ? new Date(body.startDate) : existing.startDate ?? undefined;

  const syncErrors: string[] = [];

  // Sync to Google Calendar if event exists
  if (existing.googleCalendarEventId) {
    try {
      await updateCalendarEvent(session.user.id, existing.googleCalendarEventId, {
        title: body.title ?? existing.title,
        description: body.description ?? existing.description ?? undefined,
        startDate: startDateObj,
        dueDate: dueDateObj,
        allDay: body.allDay ?? existing.allDay,
        reminderMinutes: body.reminderMinutes ?? existing.reminderMinutes,
      });
      await prisma.syncLog.create({
        data: { userId: session.user.id, action: "UPDATE_CALENDAR_EVENT", itemId: id, itemTitle: existing.title, status: "SUCCESS" },
      });
    } catch (e: any) {
      syncErrors.push(`Calendar: ${e.message}`);
      await prisma.syncLog.create({
        data: { userId: session.user.id, action: "UPDATE_CALENDAR_EVENT", itemId: id, itemTitle: existing.title, status: "ERROR", message: e.message },
      });
    }
  }

  // Sync to Google Tasks if task exists
  if (existing.googleTaskId) {
    try {
      await updateGoogleTask(session.user.id, existing.googleTaskId, {
        title: body.title ?? existing.title,
        notes: body.description ?? existing.description ?? undefined,
        dueDate: dueDateObj,
        completed: (body.status ?? existing.status) === "COMPLETED",
      });
      await prisma.syncLog.create({
        data: { userId: session.user.id, action: "UPDATE_GOOGLE_TASK", itemId: id, itemTitle: existing.title, status: "SUCCESS" },
      });
    } catch (e: any) {
      syncErrors.push(`Tasks: ${e.message}`);
    }
  }

  const tagRecords = body.tags?.length
    ? await Promise.all(
        body.tags.map((name) =>
          prisma.tag.upsert({ where: { name }, update: {}, create: { name } })
        )
      )
    : undefined;

  const updated = await prisma.temporalItem.update({
    where: { id },
    data: {
      ...(body.title ? { title: body.title } : {}),
      ...(body.description !== undefined ? { description: body.description } : {}),
      ...(body.type ? { type: body.type as any } : {}),
      ...(body.priority ? { priority: body.priority as any } : {}),
      ...(body.status ? { status: body.status as any } : {}),
      ...(body.dueDate ? { dueDate: dueDateObj } : {}),
      ...(body.startDate ? { startDate: startDateObj } : {}),
      ...(body.allDay !== undefined ? { allDay: body.allDay } : {}),
      ...(body.reminderMinutes ? { reminderMinutes: body.reminderMinutes } : {}),
      ...(tagRecords ? { tags: { set: tagRecords.map((t) => ({ id: t.id })) } } : {}),
      lastSyncedAt: (existing.googleCalendarEventId || existing.googleTaskId) ? new Date() : undefined,
    },
    include: { checklists: true, tags: true },
  });

  return NextResponse.json({ item: updated, syncErrors });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const existing = await getItem(session.user.id, id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const syncErrors: string[] = [];

  if (existing.googleCalendarEventId) {
    try {
      await deleteCalendarEvent(session.user.id, existing.googleCalendarEventId);
      await prisma.syncLog.create({
        data: { userId: session.user.id, action: "DELETE_CALENDAR_EVENT", itemId: id, itemTitle: existing.title, status: "SUCCESS" },
      });
    } catch (e: any) {
      syncErrors.push(`Calendar: ${e.message}`);
    }
  }

  if (existing.googleTaskId) {
    try {
      await deleteGoogleTask(session.user.id, existing.googleTaskId);
    } catch (_e) {}
  }

  await prisma.temporalItem.delete({ where: { id } });

  return NextResponse.json({ success: true, syncErrors });
}
