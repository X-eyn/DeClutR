import type { TemporalItem, ChecklistItem, Tag, SyncLog } from "@prisma/client";

export type TemporalItemWithRelations = TemporalItem & {
  checklists: ChecklistItem[];
  tags: Tag[];
};

export type SyncLogEntry = SyncLog;

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
