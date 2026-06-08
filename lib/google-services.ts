import { calendar_v3, google, tasks_v1 } from "googleapis";
import type { OAuth2Client } from "google-auth-library";
import type { Prisma, TemporalItem } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type ImportBucket = {
  created: number;
  updated: number;
  skipped: number;
  archived: number;
  errors: number;
};

export type SyncRunCounts = {
  calendar: ImportBucket;
  tasks: ImportBucket;
};

type GoogleTaskRef = {
  taskListId: string;
  taskId: string;
};

const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.events";
const TASKS_SCOPE = "https://www.googleapis.com/auth/tasks";
const IMPORT_PAGE_LIMIT = 20;
const DEFAULT_COUNTS: SyncRunCounts = {
  calendar: { created: 0, updated: 0, skipped: 0, archived: 0, errors: 0 },
  tasks: { created: 0, updated: 0, skipped: 0, archived: 0, errors: 0 },
};

export class GoogleReconnectRequiredError extends Error {
  constructor(message = "Google authorization expired or was revoked. Reconnect Google and try again.") {
    super(message);
    this.name = "GoogleReconnectRequiredError";
  }
}

function cloneCounts(): SyncRunCounts {
  return JSON.parse(JSON.stringify(DEFAULT_COUNTS)) as SyncRunCounts;
}

function isInvalidGrant(error: unknown) {
  return error instanceof Error && error.message.includes("invalid_grant");
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function parseScopes(scope: string | null | undefined) {
  return scope?.split(/\s+/).filter(Boolean) ?? [];
}

function hasRequiredScopes(scopes: string[]) {
  return {
    hasCalendarScope: scopes.includes(CALENDAR_SCOPE) || scopes.some((scope) => scope.includes("calendar.events")),
    hasTasksScope: scopes.includes(TASKS_SCOPE) || scopes.some((scope) => scope.endsWith("/tasks")),
  };
}

function dateOnlyToUtcDate(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function previousUtcDate(value: string) {
  return new Date(dateOnlyToUtcDate(value).getTime() - 24 * 60 * 60 * 1000);
}

function calendarEventDates(event: {
  start?: { date?: string | null; dateTime?: string | null } | null;
  end?: { date?: string | null; dateTime?: string | null } | null;
}) {
  const allDay = !!event.start?.date;
  const startValue = event.start?.dateTime ?? event.start?.date;
  const endValue = event.end?.dateTime ?? event.end?.date ?? startValue;
  if (!startValue) return null;

  const startDate = allDay ? dateOnlyToUtcDate(startValue) : new Date(startValue);
  let dueDate = startDate;
  if (endValue) {
    dueDate = allDay && event.end?.date ? previousUtcDate(endValue) : new Date(endValue);
  }

  if (Number.isNaN(startDate.getTime())) return null;
  if (Number.isNaN(dueDate.getTime()) || dueDate < startDate) dueDate = startDate;
  return { allDay, startDate, dueDate };
}

function calendarReminderMinutes(event: {
  reminders?: { overrides?: Array<{ method?: string | null; minutes?: number | null }> | null } | null;
}) {
  return (
    event.reminders?.overrides
      ?.filter((reminder) => reminder.method === "popup" && typeof reminder.minutes === "number")
      .map((reminder) => reminder.minutes as number) ?? []
  );
}

function splitLegacyTaskRef(taskId: string, taskListId?: string | null): GoogleTaskRef {
  const separator = taskId.indexOf(":");
  if (separator > 0) {
    return {
      taskListId: taskId.slice(0, separator),
      taskId: taskId.slice(separator + 1),
    };
  }
  return { taskListId: taskListId ?? "@default", taskId };
}

export class GoogleAuthService {
  static async saveFreshTokensFromSignIn(userId: string | undefined, account: {
    provider?: string;
    providerAccountId?: string;
    access_token?: string;
    refresh_token?: string;
    expires_at?: number;
    token_type?: string;
    scope?: string;
    id_token?: string;
  } | null | undefined) {
    if (!userId || account?.provider !== "google" || !account.providerAccountId) return;

    await prisma.account.updateMany({
      where: { provider: "google", providerAccountId: account.providerAccountId },
      data: {
        ...(account.access_token ? { access_token: account.access_token } : {}),
        ...(account.refresh_token ? { refresh_token: account.refresh_token } : {}),
        ...(typeof account.expires_at === "number" ? { expires_at: account.expires_at } : {}),
        ...(account.token_type ? { token_type: account.token_type } : {}),
        ...(account.scope ? { scope: account.scope } : {}),
        ...(account.id_token ? { id_token: account.id_token } : {}),
      },
    });

    await this.refreshState(userId);
  }

  static async refreshState(userId: string) {
    const account = await prisma.account.findFirst({
      where: { userId, provider: "google" },
      select: { access_token: true, refresh_token: true, scope: true },
    });

    const scopes = parseScopes(account?.scope);
    const connected = !!(account?.access_token || account?.refresh_token);
    const tokenHealthy = connected;
    const reconnectRequired = !tokenHealthy;
    const rawScopeStatus = hasRequiredScopes(scopes);
    const scopeStatus = {
      hasCalendarScope: tokenHealthy && rawScopeStatus.hasCalendarScope,
      hasTasksScope: tokenHealthy && rawScopeStatus.hasTasksScope,
    };
    const message = tokenHealthy
      ? "Google is connected and ready to sync."
      : "Reconnect Google to give the app a fresh Calendar and Tasks token.";

    const state = await prisma.googleSyncState.upsert({
      where: { userId },
      create: {
        userId,
        connected,
        tokenHealthy,
        reconnectRequired,
        scopes,
        reconnectReason: reconnectRequired ? message : null,
      },
      update: {
        connected,
        tokenHealthy,
        reconnectRequired,
        scopes,
        reconnectReason: reconnectRequired ? message : null,
      },
    });

    return {
      connected,
      tokenHealthy,
      reconnectRequired,
      scopes,
      ...scopeStatus,
      lastSuccessfulImportAt: state.lastSuccessfulImportAt,
      message,
    };
  }

  static async markDisconnected(userId: string, reason: string) {
    await prisma.account.updateMany({
      where: { userId, provider: "google" },
      data: { access_token: null, refresh_token: null, expires_at: null },
    });

    await prisma.googleSyncState.upsert({
      where: { userId },
      create: {
        userId,
        connected: false,
        tokenHealthy: false,
        reconnectRequired: true,
        scopes: [],
        reconnectReason: reason,
      },
      update: {
        connected: false,
        tokenHealthy: false,
        reconnectRequired: true,
        reconnectReason: reason,
      },
    });
  }

  static async getOAuthClient(userId: string) {
    const account = await prisma.account.findFirst({ where: { userId, provider: "google" } });
    if (!account?.access_token && !account?.refresh_token) {
      await this.markDisconnected(userId, "No active Google token is available.");
      throw new GoogleReconnectRequiredError();
    }

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );

    oauth2Client.setCredentials({
      access_token: account.access_token ?? undefined,
      refresh_token: account.refresh_token ?? undefined,
      expiry_date: account.expires_at ? account.expires_at * 1000 : undefined,
    });

    oauth2Client.on("tokens", async (tokens) => {
      await prisma.account.update({
        where: {
          provider_providerAccountId: {
            provider: "google",
            providerAccountId: account.providerAccountId,
          },
        },
        data: {
          access_token: tokens.access_token ?? account.access_token,
          refresh_token: tokens.refresh_token ?? account.refresh_token,
          expires_at: tokens.expiry_date ? Math.floor(tokens.expiry_date / 1000) : account.expires_at,
        },
      });
      await GoogleAuthService.refreshState(userId);
    });

    if (account.refresh_token && (!account.expires_at || account.expires_at * 1000 < Date.now() + 60_000)) {
      try {
        await oauth2Client.getAccessToken();
      } catch (error) {
        if (isInvalidGrant(error)) {
          await this.markDisconnected(userId, "Google authorization expired or was revoked.");
          throw new GoogleReconnectRequiredError();
        }
        throw error;
      }
    }

    await this.refreshState(userId);
    return oauth2Client;
  }
}

export class GoogleCalendarService {
  constructor(private auth: OAuth2Client) {}

  async listImportEvents() {
    const calendar = google.calendar({ version: "v3", auth: this.auth });
    const timeMin = new Date();
    timeMin.setFullYear(timeMin.getFullYear() - 1);
    const timeMax = new Date();
    timeMax.setFullYear(timeMax.getFullYear() + 2);

    const items: calendar_v3.Schema$Event[] = [];
    let pageToken: string | undefined;

    for (let page = 0; page < IMPORT_PAGE_LIMIT; page += 1) {
      const response = await calendar.events.list({
        calendarId: "primary",
        maxResults: 2500,
        pageToken,
        showDeleted: true,
        singleEvents: true,
        orderBy: "startTime",
        timeMin: timeMin.toISOString(),
        timeMax: timeMax.toISOString(),
      });

      items.push(...(response.data.items ?? []));
      pageToken = response.data.nextPageToken ?? undefined;
      if (!pageToken) break;
    }

    return items;
  }

  async createEvent(opts: {
    title: string;
    description?: string;
    startDate?: Date;
    dueDate: Date;
    allDay: boolean;
    reminderMinutes: number[];
  }) {
    const calendar = google.calendar({ version: "v3", auth: this.auth });
    const start = opts.allDay
      ? { date: (opts.startDate ?? opts.dueDate).toISOString().split("T")[0] }
      : { dateTime: (opts.startDate ?? opts.dueDate).toISOString() };
    const end = opts.allDay
      ? { date: opts.dueDate.toISOString().split("T")[0] }
      : { dateTime: opts.dueDate.toISOString() };
    const reminders = opts.reminderMinutes.length
      ? {
          useDefault: false,
          overrides: opts.reminderMinutes.map((minutes) => ({ method: "popup" as const, minutes })),
        }
      : { useDefault: true };

    const event = await calendar.events.insert({
      calendarId: "primary",
      requestBody: { summary: opts.title, description: opts.description, start, end, reminders },
    });

    return { id: event.data.id!, updated: event.data.updated ? new Date(event.data.updated) : new Date() };
  }

  async updateEvent(eventId: string, opts: Parameters<GoogleCalendarService["createEvent"]>[0]) {
    const calendar = google.calendar({ version: "v3", auth: this.auth });
    const start = opts.allDay
      ? { date: (opts.startDate ?? opts.dueDate).toISOString().split("T")[0] }
      : { dateTime: (opts.startDate ?? opts.dueDate).toISOString() };
    const end = opts.allDay
      ? { date: opts.dueDate.toISOString().split("T")[0] }
      : { dateTime: opts.dueDate.toISOString() };
    const reminders = opts.reminderMinutes.length
      ? {
          useDefault: false,
          overrides: opts.reminderMinutes.map((minutes) => ({ method: "popup" as const, minutes })),
        }
      : { useDefault: true };

    const event = await calendar.events.update({
      calendarId: "primary",
      eventId,
      requestBody: { summary: opts.title, description: opts.description, start, end, reminders },
    });

    return { updated: event.data.updated ? new Date(event.data.updated) : new Date() };
  }

  async deleteEvent(eventId: string) {
    const calendar = google.calendar({ version: "v3", auth: this.auth });
    await calendar.events.delete({ calendarId: "primary", eventId });
  }
}

export class GoogleTasksService {
  constructor(private auth: OAuth2Client) {}

  async listImportTasks() {
    const tasks = google.tasks({ version: "v1", auth: this.auth });
    const result: Array<{
      taskListId: string;
      task: tasks_v1.Schema$Task;
    }> = [];
    let listPageToken: string | undefined;

    for (let page = 0; page < IMPORT_PAGE_LIMIT; page += 1) {
      const taskLists = await tasks.tasklists.list({ maxResults: 100, pageToken: listPageToken });

      for (const taskList of taskLists.data.items ?? []) {
        if (!taskList.id) continue;
        let taskPageToken: string | undefined;
        for (let taskPage = 0; taskPage < IMPORT_PAGE_LIMIT; taskPage += 1) {
          const taskItems = await tasks.tasks.list({
            tasklist: taskList.id,
            maxResults: 100,
            pageToken: taskPageToken,
            showCompleted: true,
            showDeleted: true,
            showHidden: true,
          });

          for (const task of taskItems.data.items ?? []) {
            result.push({ taskListId: taskList.id, task });
          }

          taskPageToken = taskItems.data.nextPageToken ?? undefined;
          if (!taskPageToken) break;
        }
      }

      listPageToken = taskLists.data.nextPageToken ?? undefined;
      if (!listPageToken) break;
    }

    return result;
  }

  async defaultTaskListId() {
    const tasks = google.tasks({ version: "v1", auth: this.auth });
    const lists = await tasks.tasklists.list({ maxResults: 1 });
    return lists.data.items?.[0]?.id ?? "@default";
  }

  async createTask(opts: { title: string; notes?: string; dueDate: Date }) {
    const tasks = google.tasks({ version: "v1", auth: this.auth });
    const taskListId = await this.defaultTaskListId();
    const task = await tasks.tasks.insert({
      tasklist: taskListId,
      requestBody: { title: opts.title, notes: opts.notes, due: opts.dueDate.toISOString() },
    });
    return {
      taskListId,
      taskId: task.data.id!,
      updated: task.data.updated ? new Date(task.data.updated) : new Date(),
    };
  }

  async updateTask(ref: GoogleTaskRef, opts: { title: string; notes?: string; dueDate: Date; completed: boolean }) {
    const tasks = google.tasks({ version: "v1", auth: this.auth });
    const task = await tasks.tasks.update({
      tasklist: ref.taskListId,
      task: ref.taskId,
      requestBody: {
        id: ref.taskId,
        title: opts.title,
        notes: opts.notes,
        due: opts.dueDate.toISOString(),
        status: opts.completed ? "completed" : "needsAction",
      },
    });
    return { updated: task.data.updated ? new Date(task.data.updated) : new Date() };
  }

  async deleteTask(ref: GoogleTaskRef) {
    const tasks = google.tasks({ version: "v1", auth: this.auth });
    await tasks.tasks.delete({ tasklist: ref.taskListId, task: ref.taskId });
  }
}

export class GoogleImportService {
  static async runManualImport(userId: string) {
    const counts = cloneCounts();
    const run = await prisma.syncRun.create({
      data: { userId, mode: "import", source: "manual", status: "RUNNING", phase: "AUTH_CHECK", counts },
    });

    try {
      const auth = await GoogleAuthService.getOAuthClient(userId);
      const calendar = new GoogleCalendarService(auth);
      const tasks = new GoogleTasksService(auth);

      await this.updateRun(run.id, "CALENDAR_IMPORT", counts);
      await this.importCalendar(userId, run.id, calendar, counts);

      await this.updateRun(run.id, "TASKS_IMPORT", counts);
      await this.importTasks(userId, run.id, tasks, counts);

      await prisma.googleSyncState.update({
        where: { userId },
        data: {
          connected: true,
          tokenHealthy: true,
          reconnectRequired: false,
          reconnectReason: null,
          lastSuccessfulImportAt: new Date(),
        },
      });

      const finished = await prisma.syncRun.update({
        where: { id: run.id },
        data: { status: "SUCCESS", phase: "FINISHED", counts, finishedAt: new Date() },
      });

      return finished;
    } catch (error) {
      const reconnect = error instanceof GoogleReconnectRequiredError || isInvalidGrant(error);
      if (reconnect) {
        await GoogleAuthService.markDisconnected(userId, "Google authorization expired or was revoked.");
      }

      const failed = await prisma.syncRun.update({
        where: { id: run.id },
        data: {
          status: reconnect ? "NEEDS_RECONNECT" : "ERROR",
          phase: "FAILED",
          counts,
          errorSummary: reconnect ? "Reconnect Google and run import again." : errorMessage(error),
          finishedAt: new Date(),
        },
      });

      await prisma.syncLog.create({
        data: {
          userId,
          syncRunId: run.id,
          action: "IMPORT_GOOGLE_SOURCES",
          status: "ERROR",
          message: failed.errorSummary,
        },
      });

      throw error;
    }
  }

  private static async updateRun(runId: string, phase: string, counts: SyncRunCounts) {
    await prisma.syncRun.update({ where: { id: runId }, data: { phase, counts } });
  }

  private static async importCalendar(
    userId: string,
    syncRunId: string,
    calendar: GoogleCalendarService,
    counts: SyncRunCounts
  ) {
    for (const event of await calendar.listImportEvents()) {
      try {
        const result = await this.upsertCalendarEvent(userId, syncRunId, event);
        counts.calendar[result] += 1;
      } catch (error) {
        counts.calendar.errors += 1;
        await prisma.syncLog.create({
          data: {
            userId,
            syncRunId,
            action: "IMPORT_CALENDAR_EVENT",
            status: "ERROR",
            itemTitle: event.summary ?? "Unknown Google event",
            message: errorMessage(error),
            metadata: { googleCalendarEventId: event.id ?? null },
          },
        });
      }
    }
  }

  private static async importTasks(userId: string, syncRunId: string, tasks: GoogleTasksService, counts: SyncRunCounts) {
    for (const { taskListId, task } of await tasks.listImportTasks()) {
      try {
        const result = await this.upsertTask(userId, syncRunId, taskListId, task);
        counts.tasks[result] += 1;
      } catch (error) {
        counts.tasks.errors += 1;
        await prisma.syncLog.create({
          data: {
            userId,
            syncRunId,
            action: "IMPORT_GOOGLE_TASK",
            status: "ERROR",
            itemTitle: task.title ?? "Unknown Google task",
            message: errorMessage(error),
            metadata: { googleTaskId: task.id ?? null, googleTaskListId: taskListId },
          },
        });
      }
    }
  }

  private static async upsertCalendarEvent(
    userId: string,
    syncRunId: string,
    event: Awaited<ReturnType<GoogleCalendarService["listImportEvents"]>>[number]
  ) {
    if (!event.id) return "skipped" as const;

    const existing = await prisma.temporalItem.findFirst({
      where: { userId, googleCalendarEventId: event.id },
      select: { id: true, title: true },
    });

    if (event.status === "cancelled") {
      if (!existing) return "skipped" as const;
      const archived = await prisma.temporalItem.update({
        where: { id: existing.id },
        data: { status: "ARCHIVED", googleDeletedAt: new Date(), lastSyncedAt: new Date() },
      });
      await this.log(userId, syncRunId, "IMPORT_CALENDAR_EVENT", archived.id, archived.title, "SUCCESS", "Archived local item because Google event was deleted.", { googleCalendarEventId: event.id });
      return "archived" as const;
    }

    const dates = calendarEventDates(event);
    if (!dates) return "skipped" as const;

    const data = {
      title: event.summary?.trim() || "Untitled Google event",
      description: event.description ?? event.location ?? null,
      type: "EVENT" as const,
      priority: "MEDIUM" as const,
      status: "ACTIVE" as const,
      startDate: dates.startDate,
      dueDate: dates.dueDate,
      allDay: dates.allDay,
      rrule: event.recurrence?.join("\n") ?? null,
      googleCalendarEventId: event.id,
      googleUpdatedAt: event.updated ? new Date(event.updated) : null,
      googleDeletedAt: null,
      syncOrigin: "GOOGLE",
      reminderMinutes: calendarReminderMinutes(event),
      lastSyncedAt: new Date(),
    };

    if (existing) {
      const updated = await prisma.temporalItem.update({ where: { id: existing.id }, data });
      await this.log(userId, syncRunId, "IMPORT_CALENDAR_EVENT", updated.id, updated.title, "SUCCESS", "Updated from Google Calendar.", { googleCalendarEventId: event.id });
      return "updated" as const;
    }

    const created = await prisma.temporalItem.create({ data: { userId, ...data } });
    await this.log(userId, syncRunId, "IMPORT_CALENDAR_EVENT", created.id, created.title, "SUCCESS", "Created from Google Calendar.", { googleCalendarEventId: event.id });
    return "created" as const;
  }

  private static async upsertTask(
    userId: string,
    syncRunId: string,
    taskListId: string,
    task: Awaited<ReturnType<GoogleTasksService["listImportTasks"]>>[number]["task"]
  ) {
    if (!task.id) return "skipped" as const;
    const existing = await prisma.temporalItem.findFirst({
      where: {
        userId,
        OR: [
          { googleTaskId: task.id, googleTaskListId: taskListId },
          { googleTaskId: `${taskListId}:${task.id}` },
        ],
      },
      select: { id: true, title: true },
    });

    if (task.deleted || task.hidden) {
      if (!existing) return "skipped" as const;
      const archived = await prisma.temporalItem.update({
        where: { id: existing.id },
        data: { status: "ARCHIVED", googleDeletedAt: new Date(), lastSyncedAt: new Date() },
      });
      await this.log(userId, syncRunId, "IMPORT_GOOGLE_TASK", archived.id, archived.title, "SUCCESS", "Archived local item because Google task was deleted or hidden.", { googleTaskId: task.id, googleTaskListId: taskListId });
      return "archived" as const;
    }

    const dueDate = new Date(task.due ?? task.completed ?? task.updated ?? Date.now());
    if (Number.isNaN(dueDate.getTime())) return "skipped" as const;

    const data = {
      title: task.title?.trim() || "Untitled Google task",
      description: task.notes ?? null,
      type: "TASK" as const,
      priority: "MEDIUM" as const,
      status: task.status === "completed" ? "COMPLETED" as const : "ACTIVE" as const,
      dueDate,
      allDay: true,
      googleTaskId: task.id,
      googleTaskListId: taskListId,
      googleUpdatedAt: task.updated ? new Date(task.updated) : null,
      googleDeletedAt: null,
      syncOrigin: "GOOGLE",
      lastSyncedAt: new Date(),
    };

    if (existing) {
      const updated = await prisma.temporalItem.update({ where: { id: existing.id }, data });
      await this.log(userId, syncRunId, "IMPORT_GOOGLE_TASK", updated.id, updated.title, "SUCCESS", "Updated from Google Tasks.", { googleTaskId: task.id, googleTaskListId: taskListId });
      return "updated" as const;
    }

    const created = await prisma.temporalItem.create({ data: { userId, ...data } });
    await this.log(userId, syncRunId, "IMPORT_GOOGLE_TASK", created.id, created.title, "SUCCESS", "Created from Google Tasks.", { googleTaskId: task.id, googleTaskListId: taskListId });
    return "created" as const;
  }

  private static async log(
    userId: string,
    syncRunId: string,
    action: string,
    itemId: string | null,
    itemTitle: string | null,
    status: string,
    message: string,
    metadata?: Prisma.InputJsonValue
  ) {
    await prisma.syncLog.create({ data: { userId, syncRunId, action, itemId, itemTitle, status, message, metadata } });
  }
}

type SyncableItem = Pick<
  TemporalItem,
  | "id"
  | "title"
  | "description"
  | "dueDate"
  | "startDate"
  | "allDay"
  | "reminderMinutes"
  | "status"
  | "googleCalendarEventId"
  | "googleTaskId"
  | "googleTaskListId"
>;

export class GoogleOutboundSyncService {
  static async createForItem(args: {
    userId: string;
    item: SyncableItem;
    syncToCalendar?: boolean;
    syncToTasks?: boolean;
    calendarReminderMinutes: number[];
  }) {
    const auth = await GoogleAuthService.getOAuthClient(args.userId);
    const calendar = new GoogleCalendarService(auth);
    const tasks = new GoogleTasksService(auth);
    const syncData: Prisma.TemporalItemUpdateInput = {};

    if (args.syncToCalendar) {
      const created = await calendar.createEvent({
        title: args.item.title,
        description: args.item.description ?? undefined,
        startDate: args.item.startDate ?? undefined,
        dueDate: args.item.dueDate,
        allDay: args.item.allDay,
        reminderMinutes: args.calendarReminderMinutes,
      });
      syncData.googleCalendarEventId = created.id;
      syncData.googleUpdatedAt = created.updated;
      await this.log(args.userId, "CREATE_CALENDAR_EVENT", args.item, "SUCCESS", `Created calendar event ${created.id}`);
    }

    if (args.syncToTasks) {
      const created = await tasks.createTask({
        title: args.item.title,
        notes: args.item.description ?? undefined,
        dueDate: args.item.dueDate,
      });
      syncData.googleTaskId = created.taskId;
      syncData.googleTaskListId = created.taskListId;
      syncData.googleUpdatedAt = created.updated;
      await this.log(args.userId, "CREATE_GOOGLE_TASK", args.item, "SUCCESS", `Created task ${created.taskId}`);
    }

    if (Object.keys(syncData).length > 0) {
      await prisma.temporalItem.update({
        where: { id: args.item.id },
        data: { ...syncData, syncOrigin: "LOCAL", lastSyncedAt: new Date() },
      });
    }
  }

  static async updateForItem(userId: string, item: SyncableItem) {
    const auth = await GoogleAuthService.getOAuthClient(userId);
    const calendar = new GoogleCalendarService(auth);
    const tasks = new GoogleTasksService(auth);
    let synced = false;

    if (item.googleCalendarEventId) {
      const updated = await calendar.updateEvent(item.googleCalendarEventId, {
        title: item.title,
        description: item.description ?? undefined,
        startDate: item.startDate ?? undefined,
        dueDate: item.dueDate,
        allDay: item.allDay,
        reminderMinutes: item.reminderMinutes,
      });
      synced = true;
      await prisma.temporalItem.update({ where: { id: item.id }, data: { googleUpdatedAt: updated.updated } });
      await this.log(userId, "UPDATE_CALENDAR_EVENT", item, "SUCCESS", "Updated Google Calendar event.");
    }

    if (item.googleTaskId) {
      const ref = splitLegacyTaskRef(item.googleTaskId, item.googleTaskListId);
      const updated = await tasks.updateTask(ref, {
        title: item.title,
        notes: item.description ?? undefined,
        dueDate: item.dueDate,
        completed: item.status === "COMPLETED",
      });
      synced = true;
      await prisma.temporalItem.update({
        where: { id: item.id },
        data: { googleUpdatedAt: updated.updated, googleTaskId: ref.taskId, googleTaskListId: ref.taskListId },
      });
      await this.log(userId, "UPDATE_GOOGLE_TASK", item, "SUCCESS", "Updated Google Task.");
    }

    if (synced) {
      await prisma.temporalItem.update({ where: { id: item.id }, data: { lastSyncedAt: new Date() } });
    }
  }

  static async deleteForItem(userId: string, item: SyncableItem) {
    const auth = await GoogleAuthService.getOAuthClient(userId);
    const calendar = new GoogleCalendarService(auth);
    const tasks = new GoogleTasksService(auth);

    if (item.googleCalendarEventId) {
      await calendar.deleteEvent(item.googleCalendarEventId);
      await this.log(userId, "DELETE_CALENDAR_EVENT", item, "SUCCESS", "Deleted Google Calendar event.");
    }

    if (item.googleTaskId) {
      await tasks.deleteTask(splitLegacyTaskRef(item.googleTaskId, item.googleTaskListId));
      await this.log(userId, "DELETE_GOOGLE_TASK", item, "SUCCESS", "Deleted Google Task.");
    }
  }

  private static async log(userId: string, action: string, item: SyncableItem, status: string, message: string) {
    await prisma.syncLog.create({
      data: { userId, action, itemId: item.id, itemTitle: item.title, status, message },
    });
  }
}
