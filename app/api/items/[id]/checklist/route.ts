import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const item = await prisma.temporalItem.findFirst({ where: { id, userId: session.user.id } });
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { title, sortOrder } = await req.json();
  const checklist = await prisma.checklistItem.create({
    data: { temporalItemId: id, title, sortOrder: sortOrder ?? 0 },
  });

  return NextResponse.json(checklist, { status: 201 });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const { checklistId, completed, title } = await req.json();

  const checklistItem = await prisma.checklistItem.findFirst({
    where: { id: checklistId, temporalItem: { userId: session.user.id, id } },
  });
  if (!checklistItem) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const updated = await prisma.checklistItem.update({
    where: { id: checklistId },
    data: {
      ...(title !== undefined ? { title } : {}),
      ...(completed !== undefined ? { completed, completedAt: completed ? new Date() : null } : {}),
    },
  });

  return NextResponse.json(updated);
}
