import type { TemporalItem, ChecklistItem, Tag, SyncLog, SyncRun, GoogleSyncState } from "@prisma/client";

export type TemporalItemWithRelations = TemporalItem & {
  checklists: ChecklistItem[];
  tags: Tag[];
};

export type SyncLogEntry = SyncLog;
export type SyncRunEntry = SyncRun;
export type GoogleSyncStateEntry = GoogleSyncState;

export type GoogleConnectionStatus = {
  connected: boolean;
  tokenHealthy: boolean;
  reconnectRequired: boolean;
  hasCalendarScope: boolean;
  hasTasksScope: boolean;
  scopes: string[];
  lastSuccessfulImportAt: string | null;
  message: string;
};

export type CreateItemInput = {
  title: string;
  description?: string;
  type: "DEADLINE" | "EVENT" | "REMINDER" | "TASK";
  priority?: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  dueDate: string; // ISO
  startDate?: string; // ISO
  allDay?: boolean;
  reminderMinutes?: number[];
  tags?: string[];
  syncToCalendar?: boolean;
  syncToTasks?: boolean;
};

export type UpdateItemInput = Partial<CreateItemInput> & { status?: "ACTIVE" | "COMPLETED" | "ARCHIVED" | "OVERDUE" };

export interface DashboardStats {
  total: number;
  overdue: number;
  dueToday: number;
  dueThisWeek: number;
  dueThisMonth: number;
  completed: number;
}
