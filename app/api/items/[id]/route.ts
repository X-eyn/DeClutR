import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { scheduleDeletedItemGoogleSync, scheduleUpdatedItemGoogleSync } from "@/lib/google-sync";
import type { UpdateItemInput } from "@/types";
import type { Prisma } from "@prisma/client";

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

  const tagRecords = body.tags?.length
    ? await Promise.all(
        body.tags.map((name) =>
          prisma.tag.upsert({ where: { name }, update: {}, create: { name } })
        )
      )
    : undefined;

  const data: Prisma.TemporalItemUpdateInput = {
    ...(body.title ? { title: body.title } : {}),
    ...(body.description !== undefined ? { description: body.description } : {}),
    ...(body.type ? { type: body.type } : {}),
    ...(body.priority ? { priority: body.priority } : {}),
    ...(body.status ? { status: body.status } : {}),
    ...(body.dueDate ? { dueDate: dueDateObj } : {}),
    ...(body.startDate ? { startDate: startDateObj } : {}),
    ...(body.allDay !== undefined ? { allDay: body.allDay } : {}),
    ...(body.reminderMinutes ? { reminderMinutes: body.reminderMinutes } : {}),
    ...(tagRecords ? { tags: { set: tagRecords.map((t) => ({ id: t.id })) } } : {}),
  };

  const updated = await prisma.temporalItem.update({
    where: { id },
    data,
    include: { checklists: true, tags: true },
  });

  if (existing.googleCalendarEventId || existing.googleTaskId) {
    scheduleUpdatedItemGoogleSync({ userId: session.user.id, item: updated });
  }

  return NextResponse.json({ item: updated, syncErrors: [], syncPending: !!(existing.googleCalendarEventId || existing.googleTaskId) });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const existing = await getItem(session.user.id, id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.temporalItem.delete({ where: { id } });

  if (existing.googleCalendarEventId || existing.googleTaskId) {
    scheduleDeletedItemGoogleSync({ userId: session.user.id, item: existing });
  }

  return NextResponse.json({ success: true, syncErrors: [], syncPending: !!(existing.googleCalendarEventId || existing.googleTaskId) });
}
