"use client";

import { useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { CheckCircle, XCircle, RefreshCw, Calendar, CheckSquare, Trash2, Edit2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SyncLogEntry } from "@/types";

interface SyncLogsViewProps {
  initialLogs: SyncLogEntry[];
  googleConnected: boolean;
  scopes: string;
}

const actionIcon: Record<string, React.ElementType> = {
  CREATE_CALENDAR_EVENT: Calendar,
  UPDATE_CALENDAR_EVENT: Edit2,
  DELETE_CALENDAR_EVENT: Trash2,
  CREATE_GOOGLE_TASK: CheckSquare,
  UPDATE_GOOGLE_TASK: Edit2,
  DELETE_GOOGLE_TASK: Trash2,
};

const actionLabel: Record<string, string> = {
  CREATE_CALENDAR_EVENT: "Create Calendar Event",
  UPDATE_CALENDAR_EVENT: "Update Calendar Event",
  DELETE_CALENDAR_EVENT: "Delete Calendar Event",
  CREATE_GOOGLE_TASK: "Create Google Task",
  UPDATE_GOOGLE_TASK: "Update Google Task",
  DELETE_GOOGLE_TASK: "Delete Google Task",
};

export default function SyncLogsView({ initialLogs, googleConnected, scopes }: SyncLogsViewProps) {
  const [logs, setLogs] = useState(initialLogs);
  const [loading, setLoading] = useState(false);

  async function refresh() {
    setLoading(true);
    try {
      const res = await fetch("/api/sync/logs?limit=50");
      const data = await res.json();
      setLogs(data);
    } finally {
      setLoading(false);
    }
  }

  const hasCalendarScope = scopes.includes("calendar.events");
  const hasTasksScope = scopes.includes("tasks");

  return (
    <div className="p-6 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white">Sync & Logs</h1>
          <p className="text-xs text-slate-500 mt-0.5">Google integration status and sync history</p>
        </div>
        <button
          onClick={refresh}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-slate-300 rounded-xl text-sm font-medium hover:bg-slate-700 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
          Refresh
        </button>
      </div>

      {/* Connection status */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 mb-6">
        <h2 className="text-sm font-semibold text-white mb-4">Google Account</h2>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-400">Connected</span>
            <div className="flex items-center gap-2">
              {googleConnected ? (
                <><CheckCircle className="w-4 h-4 text-green-400" /><span className="text-sm text-green-400">Yes</span></>
              ) : (
                <><XCircle className="w-4 h-4 text-red-400" /><span className="text-sm text-red-400">No — sign in with Google</span></>
              )}
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm text-slate-400">Calendar Events scope</span>
              <p className="text-xs text-slate-600">calendar.events — creates events with popup reminders</p>
            </div>
            {hasCalendarScope ? (
              <CheckCircle className="w-4 h-4 text-green-400" />
            ) : (
              <XCircle className="w-4 h-4 text-red-400" />
            )}
          </div>
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm text-slate-400">Tasks scope</span>
              <p className="text-xs text-slate-600">tasks — creates checklist items in Google Tasks</p>
            </div>
            {hasTasksScope ? (
              <CheckCircle className="w-4 h-4 text-green-400" />
            ) : (
              <XCircle className="w-4 h-4 text-red-400" />
            )}
          </div>
        </div>
        {!googleConnected && (
          <Link
            href="/api/auth/signin"
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-white text-slate-900 rounded-xl text-sm font-medium hover:bg-slate-100 transition-colors"
          >
            Connect Google Account
          </Link>
        )}
      </div>

      {/* Sync log */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">Sync History</h2>
          <span className="text-xs text-slate-500">{logs.length} entries</span>
        </div>

        {logs.length === 0 ? (
          <div className="py-12 text-center">
            <RefreshCw className="w-8 h-8 text-slate-700 mx-auto mb-3" />
            <p className="text-sm text-slate-500">No sync events yet</p>
            <p className="text-xs text-slate-600 mt-1">Sync logs appear when items are created or updated with Google sync enabled</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-800">
            {logs.map((log) => {
              const Icon = actionIcon[log.action] ?? RefreshCw;
              return (
                <div key={log.id} className="flex items-center gap-4 px-5 py-3 hover:bg-slate-800/50 transition-colors">
                  <div className={cn("p-1.5 rounded-lg shrink-0", log.status === "SUCCESS" ? "bg-green-400/10" : "bg-red-400/10")}>
                    <Icon className={cn("w-3.5 h-3.5", log.status === "SUCCESS" ? "text-green-400" : "text-red-400")} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-white truncate">{log.itemTitle ?? "Unknown"}</span>
                      <span className="text-xs text-slate-500 shrink-0">{actionLabel[log.action] ?? log.action}</span>
                    </div>
                    {log.message && (
                      <p className="text-xs text-slate-500 truncate mt-0.5">{log.message}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {log.status === "SUCCESS" ? (
                      <CheckCircle className="w-4 h-4 text-green-400" />
                    ) : (
                      <XCircle className="w-4 h-4 text-red-400" />
                    )}
                    <span className="text-xs text-slate-600 tabular-nums">
                      {format(new Date(log.createdAt), "MMM d, h:mm a")}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
