import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { GoogleImportService, GoogleReconnectRequiredError } from "@/lib/google-services";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const run = await GoogleImportService.runManualImport(session.user.id);
    return NextResponse.json(run);
  } catch (error) {
    const reconnectRequired = error instanceof GoogleReconnectRequiredError;
    if (reconnectRequired) {
      return NextResponse.json(
        {
          error: "Reconnect Google and run import again.",
          reconnectRequired: true,
        },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Google import failed." },
      { status: 500 }
    );
  }
}
