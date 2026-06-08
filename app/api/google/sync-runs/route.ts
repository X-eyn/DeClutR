import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { GoogleImportService, GoogleReconnectRequiredError } from "@/lib/google-services";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { mode?: string };
  if (body.mode !== "import") {
    return NextResponse.json({ error: "Unsupported sync mode." }, { status: 400 });
  }

  try {
    const run = await GoogleImportService.runManualImport(session.user.id);
    return NextResponse.json(run);
  } catch (error) {
    const reconnectRequired = error instanceof GoogleReconnectRequiredError;
    return NextResponse.json(
      {
        error: reconnectRequired
          ? "Reconnect Google and run import again."
          : error instanceof Error
            ? error.message
            : "Google import failed.",
        reconnectRequired,
      },
      { status: reconnectRequired ? 409 : 500 }
    );
  }
}
