import { google } from "googleapis";
import { prisma } from "./prisma";

async function getOAuthClient(userId: string) {
  const account = await prisma.account.findFirst({
    where: { userId, provider: "google" },
  });

  if (!account?.access_token) {
    throw new Error("No Google account linked or missing access token.");
  }

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );

  oauth2Client.setCredentials({
    access_token: account.access_token,
    refresh_token: account.refresh_token ?? undefined,
    expiry_date: account.expires_at ? account.expires_at * 1000 : undefined,
  });

  // Persist refreshed tokens
  oauth2Client.on("tokens", async (tokens) => {
    await prisma.account.update({
      where: { provider_providerAccountId: { provider: "google", providerAccountId: account.providerAccountId } },
      data: {
        access_token: tokens.access_token ?? account.access_token,
        refresh_token: tokens.refresh_token ?? account.refresh_token,
        expires_at: tokens.expiry_date ? Math.floor(tokens.expiry_date / 1000) : account.expires_at,
      },
    });
  });

  return oauth2Client;
}

// ─── Calendar ─────────────────────────────────────────────────────────────

export async function createCalendarEvent(
  userId: string,
  opts: {
    title: string;
    description?: string;
    startDate?: Date;
    dueDate: Date;
    allDay: boolean;
    reminderMinutes: number[];
  }
) {
  const auth = await getOAuthClient(userId);
  const calendar = google.calendar({ version: "v3", auth });

  const start = opts.allDay
    ? { date: opts.startDate ? opts.startDate.toISOString().split("T")[0] : opts.dueDate.toISOString().split("T")[0] }
    : { dateTime: (opts.startDate ?? opts.dueDate).toISOString() };

  const end = opts.allDay
    ? { date: opts.dueDate.toISOString().split("T")[0] }
    : { dateTime: opts.dueDate.toISOString() };

  const reminders = opts.reminderMinutes.length > 0
    ? {
        useDefault: false,
        overrides: opts.reminderMinutes.map((m) => ({ method: "popup" as const, minutes: m })),
      }
    : { useDefault: true };

  const event = await calendar.events.insert({
    calendarId: "primary",
    requestBody: {
      summary: opts.title,
      description: opts.description,
      start,
      end,
      reminders,
    },
  });

  return event.data.id!;
}

export async function updateCalendarEvent(
  userId: string,
  eventId: string,
  opts: {
    title: string;
    description?: string;
    startDate?: Date;
    dueDate: Date;
    allDay: boolean;
    reminderMinutes: number[];
  }
) {
  const auth = await getOAuthClient(userId);
  const calendar = google.calendar({ version: "v3", auth });

  const start = opts.allDay
    ? { date: opts.dueDate.toISOString().split("T")[0] }
    : { dateTime: (opts.startDate ?? opts.dueDate).toISOString() };

  const end = opts.allDay
    ? { date: opts.dueDate.toISOString().split("T")[0] }
    : { dateTime: opts.dueDate.toISOString() };

  const reminders = opts.reminderMinutes.length > 0
    ? {
        useDefault: false,
        overrides: opts.reminderMinutes.map((m) => ({ method: "popup" as const, minutes: m })),
      }
    : { useDefault: true };

  await calendar.events.update({
    calendarId: "primary",
    eventId,
    requestBody: { summary: opts.title, description: opts.description, start, end, reminders },
  });
}

export async function deleteCalendarEvent(userId: string, eventId: string) {
  const auth = await getOAuthClient(userId);
  const calendar = google.calendar({ version: "v3", auth });
  await calendar.events.delete({ calendarId: "primary", eventId });
}

// ─── Tasks ─────────────────────────────────────────────────────────────────

export async function createGoogleTask(
  userId: string,
  opts: { title: string; notes?: string; dueDate: Date }
) {
  const auth = await getOAuthClient(userId);
  const tasks = google.tasks({ version: "v1", auth });

  // Get or create default task list
  const lists = await tasks.tasklists.list({ maxResults: 1 });
  const listId = lists.data.items?.[0]?.id ?? "@default";

  const task = await tasks.tasks.insert({
    tasklist: listId,
    requestBody: {
      title: opts.title,
      notes: opts.notes,
      // Tasks API truncates time; only date matters
      due: opts.dueDate.toISOString(),
    },
  });

  return task.data.id!;
}

export async function updateGoogleTask(
  userId: string,
  taskId: string,
  opts: { title: string; notes?: string; dueDate: Date; completed: boolean }
) {
  const auth = await getOAuthClient(userId);
  const tasks = google.tasks({ version: "v1", auth });

  const lists = await tasks.tasklists.list({ maxResults: 1 });
  const listId = lists.data.items?.[0]?.id ?? "@default";

  await tasks.tasks.update({
    tasklist: listId,
    task: taskId,
    requestBody: {
      id: taskId,
      title: opts.title,
      notes: opts.notes,
      due: opts.dueDate.toISOString(),
      status: opts.completed ? "completed" : "needsAction",
    },
  });
}

export async function deleteGoogleTask(userId: string, taskId: string) {
  const auth = await getOAuthClient(userId);
  const tasks = google.tasks({ version: "v1", auth });

  const lists = await tasks.tasklists.list({ maxResults: 1 });
  const listId = lists.data.items?.[0]?.id ?? "@default";

  await tasks.tasks.delete({ tasklist: listId, task: taskId });
}
