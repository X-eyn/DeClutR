import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { GoogleAuthService } from "@/lib/google-services";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const status = await GoogleAuthService.refreshState(session.user.id);

  return NextResponse.json({
    ...status,
    lastSuccessfulImportAt: status.lastSuccessfulImportAt?.toISOString() ?? null,
  });
}
