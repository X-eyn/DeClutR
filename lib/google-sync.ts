import { after } from "next/server";
import type { Prisma, TemporalItem } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  createCalendarEvent,
  createGoogleTask,
  deleteCalendarEvent,
  deleteGoogleTask,
  updateCalendarEvent,
  updateGoogleTask,
} from "@/lib/google";

type SyncStatus = "PENDING" | "SUCCESS" | "ERROR";
type SyncLogData = Omit<Prisma.SyncLogUncheckedCreateInput, "status"> & {
  status: SyncStatus;
};

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
>;

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

async function createSyncLog(data: SyncLogData) {
  try {
    const log = await prisma.syncLog.create({ data });
    return log.id;
  } catch (error) {
    console.error("Failed to create sync log", error);
    return undefined;
  }
}

async function finishSyncLog(logId: string | undefined, data: SyncLogData) {
  try {
    if (logId) {
      await prisma.syncLog.update({
        where: { id: logId },
        data: {
          status: data.status,
          message: data.message,
          metadata: data.metadata,
        },
      });
      return;
    }

    await prisma.syncLog.create({ data });
  } catch (error) {
    console.error("Failed to finish sync log", error);
  }
}

function scheduleGoogleSync(work: () => Promise<void>) {
  after(async () => {
    try {
      await work();
    } catch (error) {
      console.error("Google sync job failed", error);
    }
  });
}

export function scheduleCreatedItemGoogleSync(args: {
  userId: string;
  item: SyncableItem;
  syncToCalendar?: boolean;
  syncToTasks?: boolean;
  calendarReminderMinutes: number[];
}) {
  const { userId, item, syncToCalendar, syncToTasks, calendarReminderMinutes } = args;
  scheduleGoogleSync(async () => {
    const [calendarLogId, taskLogId] = await Promise.all([
      syncToCalendar
        ? createSyncLog({
            userId,
            action: "CREATE_CALENDAR_EVENT",
            itemId: item.id,
            itemTitle: item.title,
            status: "PENDING",
            message: "Calendar event sync queued",
          })
        : Promise.resolve(undefined),
      syncToTasks
        ? createSyncLog({
            userId,
            action: "CREATE_GOOGLE_TASK",
            itemId: item.id,
            itemTitle: item.title,
            status: "PENDING",
            message: "Google Task sync queued",
          })
        : Promise.resolve(undefined),
    ]);
    const syncData: Prisma.TemporalItemUpdateInput = {};

    if (syncToCalendar) {
      try {
        const googleCalendarEventId = await createCalendarEvent(userId, {
          title: item.title,
          description: item.description ?? undefined,
          startDate: item.startDate ?? undefined,
          dueDate: item.dueDate,
          allDay: item.allDay,
          reminderMinutes: calendarReminderMinutes,
        });
        syncData.googleCalendarEventId = googleCalendarEventId;
        await finishSyncLog(calendarLogId, {
          userId,
          action: "CREATE_CALENDAR_EVENT",
          itemId: item.id,
          itemTitle: item.title,
          status: "SUCCESS",
          message: `Created calendar event ${googleCalendarEventId}`,
        });
      } catch (error) {
        await finishSyncLog(calendarLogId, {
          userId,
          action: "CREATE_CALENDAR_EVENT",
          itemId: item.id,
          itemTitle: item.title,
          status: "ERROR",
          message: errorMessage(error),
        });
      }
    }

    if (syncToTasks) {
      try {
        const googleTaskId = await createGoogleTask(userId, {
          title: item.title,
          notes: item.description ?? undefined,
          dueDate: item.dueDate,
        });
        syncData.googleTaskId = googleTaskId;
        await finishSyncLog(taskLogId, {
          userId,
          action: "CREATE_GOOGLE_TASK",
          itemId: item.id,
          itemTitle: item.title,
          status: "SUCCESS",
          message: `Created task ${googleTaskId}`,
        });
      } catch (error) {
        await finishSyncLog(taskLogId, {
          userId,
          action: "CREATE_GOOGLE_TASK",
          itemId: item.id,
          itemTitle: item.title,
          status: "ERROR",
          message: errorMessage(error),
        });
      }
    }

    if (Object.keys(syncData).length > 0) {
      await prisma.temporalItem.update({
        where: { id: item.id },
        data: { ...syncData, lastSyncedAt: new Date() },
      });
    }
  });
}

export function scheduleUpdatedItemGoogleSync(args: {
  userId: string;
  item: SyncableItem;
}) {
  const { userId, item } = args;
  scheduleGoogleSync(async () => {
    const [calendarLogId, taskLogId] = await Promise.all([
      item.googleCalendarEventId
        ? createSyncLog({
            userId,
            action: "UPDATE_CALENDAR_EVENT",
            itemId: item.id,
            itemTitle: item.title,
            status: "PENDING",
            message: "Calendar event update queued",
          })
        : Promise.resolve(undefined),
      item.googleTaskId
        ? createSyncLog({
            userId,
            action: "UPDATE_GOOGLE_TASK",
            itemId: item.id,
            itemTitle: item.title,
            status: "PENDING",
            message: "Google Task update queued",
          })
        : Promise.resolve(undefined),
    ]);
    let synced = false;

    if (item.googleCalendarEventId) {
      try {
        await updateCalendarEvent(userId, item.googleCalendarEventId, {
          title: item.title,
          description: item.description ?? undefined,
          startDate: item.startDate ?? undefined,
          dueDate: item.dueDate,
          allDay: item.allDay,
          reminderMinutes: item.reminderMinutes,
        });
        synced = true;
        await finishSyncLog(calendarLogId, {
          userId,
          action: "UPDATE_CALENDAR_EVENT",
          itemId: item.id,
          itemTitle: item.title,
          status: "SUCCESS",
        });
      } catch (error) {
        await finishSyncLog(calendarLogId, {
          userId,
          action: "UPDATE_CALENDAR_EVENT",
          itemId: item.id,
          itemTitle: item.title,
          status: "ERROR",
          message: errorMessage(error),
        });
      }
    }

    if (item.googleTaskId) {
      try {
        await updateGoogleTask(userId, item.googleTaskId, {
          title: item.title,
          notes: item.description ?? undefined,
          dueDate: item.dueDate,
          completed: item.status === "COMPLETED",
        });
        synced = true;
        await finishSyncLog(taskLogId, {
          userId,
          action: "UPDATE_GOOGLE_TASK",
          itemId: item.id,
          itemTitle: item.title,
          status: "SUCCESS",
        });
      } catch (error) {
        await finishSyncLog(taskLogId, {
          userId,
          action: "UPDATE_GOOGLE_TASK",
          itemId: item.id,
          itemTitle: item.title,
          status: "ERROR",
          message: errorMessage(error),
        });
      }
    }

    if (synced) {
      await prisma.temporalItem.update({
        where: { id: item.id },
        data: { lastSyncedAt: new Date() },
      });
    }
  });
}

export function scheduleDeletedItemGoogleSync(args: {
  userId: string;
  item: SyncableItem;
}) {
  const { userId, item } = args;
  scheduleGoogleSync(async () => {
    const [calendarLogId, taskLogId] = await Promise.all([
      item.googleCalendarEventId
        ? createSyncLog({
            userId,
            action: "DELETE_CALENDAR_EVENT",
            itemId: item.id,
            itemTitle: item.title,
            status: "PENDING",
            message: "Calendar event deletion queued",
          })
        : Promise.resolve(undefined),
      item.googleTaskId
        ? createSyncLog({
            userId,
            action: "DELETE_GOOGLE_TASK",
            itemId: item.id,
            itemTitle: item.title,
            status: "PENDING",
            message: "Google Task deletion queued",
          })
        : Promise.resolve(undefined),
    ]);
    if (item.googleCalendarEventId) {
      try {
        await deleteCalendarEvent(userId, item.googleCalendarEventId);
        await finishSyncLog(calendarLogId, {
          userId,
          action: "DELETE_CALENDAR_EVENT",
          itemId: item.id,
          itemTitle: item.title,
          status: "SUCCESS",
        });
      } catch (error) {
        await finishSyncLog(calendarLogId, {
          userId,
          action: "DELETE_CALENDAR_EVENT",
          itemId: item.id,
          itemTitle: item.title,
          status: "ERROR",
          message: errorMessage(error),
        });
      }
    }

    if (item.googleTaskId) {
      try {
        await deleteGoogleTask(userId, item.googleTaskId);
        await finishSyncLog(taskLogId, {
          userId,
          action: "DELETE_GOOGLE_TASK",
          itemId: item.id,
          itemTitle: item.title,
          status: "SUCCESS",
        });
      } catch (error) {
        await finishSyncLog(taskLogId, {
          userId,
          action: "DELETE_GOOGLE_TASK",
          itemId: item.id,
          itemTitle: item.title,
          status: "ERROR",
          message: errorMessage(error),
        });
      }
    }
  });
}
