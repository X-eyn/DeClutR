"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import {
  AlertCircle,
  Calendar,
  CheckCircle,
  CheckSquare,
  Clock3,
  Edit2,
  RefreshCw,
  ShieldCheck,
  Trash2,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { SyncLogEntry } from "@/types";

interface SyncLogsViewProps {
  initialLogs: SyncLogEntry[];
  googleConnected: boolean;
  scopes: string;
}

type SyncStatusFilter = "ALL" | "PENDING" | "SUCCESS" | "ERROR";

const ACTION_META: Record<
  string,
  {
    label: string;
    family: "Calendar" | "Tasks";
    icon: React.ElementType;
    bg: string;
    border: string;
    text: string;
    iconBg: string;
  }
> = {
  CREATE_CALENDAR_EVENT: {
    label: "Create calendar event",
    family: "Calendar",
    icon: Calendar,
    bg: "#eef2ff",
    border: "#dbe3ff",
    text: "#4338ca",
    iconBg: "#e0e7ff",
  },
  UPDATE_CALENDAR_EVENT: {
    label: "Update calendar event",
    family: "Calendar",
    icon: Edit2,
    bg: "#eef2ff",
    border: "#dbe3ff",
    text: "#4338ca",
    iconBg: "#e0e7ff",
  },
  DELETE_CALENDAR_EVENT: {
    label: "Delete calendar event",
    family: "Calendar",
    icon: Trash2,
    bg: "#fff1f2",
    border: "#fecdd3",
    text: "#be123c",
    iconBg: "#ffe4e6",
  },
  CREATE_GOOGLE_TASK: {
    label: "Create Google Task",
    family: "Tasks",
    icon: CheckSquare,
    bg: "#f3e8ff",
    border: "#e9d5ff",
    text: "#7c3aed",
    iconBg: "#ede9fe",
  },
  UPDATE_GOOGLE_TASK: {
    label: "Update Google Task",
    family: "Tasks",
    icon: Edit2,
    bg: "#f3e8ff",
    border: "#e9d5ff",
    text: "#7c3aed",
    iconBg: "#ede9fe",
  },
  DELETE_GOOGLE_TASK: {
    label: "Delete Google Task",
    family: "Tasks",
    icon: Trash2,
    bg: "#fff1f2",
    border: "#fecdd3",
    text: "#be123c",
    iconBg: "#ffe4e6",
  },
};

const STATUS_META: Record<
  Exclude<SyncStatusFilter, "ALL">,
  {
    label: string;
    icon: React.ElementType;
    bg: string;
    border: string;
    text: string;
    dot: string;
  }
> = {
  PENDING: {
    label: "Queued",
    icon: Clock3,
    bg: "#fff7ed",
    border: "#fed7aa",
    text: "#c2410c",
    dot: "#f97316",
  },
  SUCCESS: {
    label: "Synced",
    icon: CheckCircle,
    bg: "#ecfdf5",
    border: "#a7f3d0",
    text: "#047857",
    dot: "#10b981",
  },
  ERROR: {
    label: "Failed",
    icon: AlertCircle,
    bg: "#fff1f2",
    border: "#fecdd3",
    text: "#be123c",
    dot: "#ef4444",
  },
};

function actionMeta(action: string) {
  return (
    ACTION_META[action] ?? {
      label: action.replaceAll("_", " ").toLowerCase(),
      family: "Calendar" as const,
      icon: RefreshCw,
      bg: "#f8fafc",
      border: "#e2e8f0",
      text: "#475569",
      iconBg: "#f1f5f9",
    }
  );
}

function statusMeta(status: string) {
  return STATUS_META[status as keyof typeof STATUS_META] ?? STATUS_META.PENDING;
}

export default function SyncLogsView({ initialLogs, googleConnected, scopes }: SyncLogsViewProps) {
  const [logs, setLogs] = useState(initialLogs);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<SyncStatusFilter>("ALL");
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/sync/logs?limit=50", { cache: "no-store" });
      if (!res.ok) throw new Error("Unable to refresh sync history right now.");
      const data = await res.json();
      setLogs(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to refresh sync history right now.");
    } finally {
      setLoading(false);
    }
  }

  const hasCalendarScope = scopes.includes("calendar.events");
  const hasTasksScope = scopes.includes("tasks");

  const filteredLogs = useMemo(() => {
    return statusFilter === "ALL" ? logs : logs.filter((log) => log.status === statusFilter);
  }, [logs, statusFilter]);

  const summary = useMemo(() => {
    return {
      total: logs.length,
      queued: logs.filter((log) => log.status === "PENDING").length,
      success: logs.filter((log) => log.status === "SUCCESS").length,
      error: logs.filter((log) => log.status === "ERROR").length,
      calendar: logs.filter((log) => log.action.includes("CALENDAR")).length,
      tasks: logs.filter((log) => log.action.includes("TASK")).length,
    };
  }, [logs]);

  const lastActivity = logs[0]?.createdAt
    ? format(new Date(logs[0].createdAt), "MMM d, h:mm a")
    : "No activity yet";

  const statusFilters: Array<{ value: SyncStatusFilter; label: string; count: number }> = [
    { value: "ALL", label: "All events", count: summary.total },
    { value: "PENDING", label: "Queued", count: summary.queued },
    { value: "SUCCESS", label: "Synced", count: summary.success },
    { value: "ERROR", label: "Failed", count: summary.error },
  ];

  return (
    <>
      <style>{`
        .sync-shell {
          padding: 24px 24px 40px;
          min-width: 0;
        }
        .sync-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
          margin-bottom: 18px;
        }
        .sync-title {
          margin: 0;
          font-size: 22px;
          line-height: 1.1;
          font-weight: 800;
          letter-spacing: -.025em;
          color: var(--ink);
        }
        .sync-subtitle {
          margin: 8px 0 0;
          font-size: 13px;
          line-height: 1.55;
          color: var(--mut);
          max-width: 680px;
        }
        .sync-refresh {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 10px 14px;
          border-radius: 12px;
          border: 1px solid var(--line);
          background: var(--panel);
          color: var(--ink-2);
          font-size: 13px;
          font-weight: 700;
          font-family: inherit;
          cursor: pointer;
          box-shadow: var(--shadow-sm);
          transition: border-color .12s, color .12s, transform .12s;
        }
        .sync-refresh:hover:not(:disabled) {
          border-color: var(--indigo);
          color: var(--indigo);
          transform: translateY(-1px);
        }
        .sync-refresh:disabled {
          opacity: .62;
          cursor: default;
        }
        .sync-stats {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 12px;
          margin-bottom: 18px;
        }
        .sync-stat {
          background: var(--panel);
          border: 1px solid var(--line);
          border-radius: 18px;
          padding: 15px 16px;
          box-shadow: var(--shadow-sm);
        }
        .sync-stat-label {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 10px;
          font-size: 12px;
          font-weight: 700;
          color: var(--mut);
        }
        .sync-stat-dot {
          width: 8px;
          height: 8px;
          border-radius: 999px;
        }
        .sync-stat-value {
          font-size: 24px;
          line-height: 1;
          font-weight: 800;
          color: var(--ink);
          letter-spacing: -.03em;
        }
        .sync-stat-note {
          margin-top: 6px;
          font-size: 11.5px;
          color: var(--mut);
        }
        .sync-grid {
          display: grid;
          grid-template-columns: 340px minmax(0, 1fr);
          gap: 18px;
          align-items: start;
        }
        .sync-panel {
          background: var(--panel);
          border: 1px solid var(--line);
          border-radius: 24px;
          box-shadow: var(--shadow-sm);
          min-width: 0;
        }
        .sync-panel-head {
          padding: 18px 20px 16px;
          border-bottom: 1px solid var(--line);
          background:
            radial-gradient(circle at top right, rgba(99, 102, 241, 0.08), transparent 48%),
            linear-gradient(180deg, #fcfcff, #ffffff);
        }
        .sync-panel-title {
          margin: 0;
          font-size: 15px;
          font-weight: 750;
          color: var(--ink);
          letter-spacing: -.015em;
        }
        .sync-panel-copy {
          margin-top: 6px;
          font-size: 12px;
          color: var(--mut);
          line-height: 1.5;
        }
        .sync-panel-body {
          padding: 18px;
        }
        .sync-health {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .sync-health-row {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 14px;
          padding: 14px;
          border-radius: 16px;
          border: 1px solid var(--line);
          background: linear-gradient(180deg, #ffffff, #fbfcff);
        }
        .sync-health-main {
          min-width: 0;
        }
        .sync-health-label {
          font-size: 13px;
          font-weight: 700;
          color: var(--ink);
        }
        .sync-health-note {
          margin-top: 5px;
          font-size: 11.5px;
          line-height: 1.5;
          color: var(--mut);
        }
        .sync-chip {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 10px;
          border-radius: 999px;
          border: 1px solid transparent;
          font-size: 11px;
          font-weight: 800;
          line-height: 1;
          white-space: nowrap;
        }
        .sync-alert {
          margin-top: 14px;
          padding: 14px;
          border-radius: 16px;
          border: 1px solid #dbe3ff;
          background: linear-gradient(180deg, #f8faff, #f1f5ff);
        }
        .sync-alert-title {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 12px;
          font-weight: 800;
          color: var(--indigo);
        }
        .sync-alert-copy {
          margin-top: 6px;
          font-size: 12px;
          line-height: 1.55;
          color: var(--ink-2);
        }
        .sync-connect {
          margin-top: 12px;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 10px 14px;
          border-radius: 12px;
          background: var(--indigo);
          color: white;
          font-size: 13px;
          font-weight: 700;
          text-decoration: none;
          box-shadow: 0 10px 24px rgba(99, 102, 241, 0.18);
        }
        .sync-meta-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 14px;
          flex-wrap: wrap;
        }
        .sync-last-activity {
          font-size: 12px;
          color: var(--mut);
        }
        .sync-filters {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }
        .sync-filter {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          padding: 8px 11px;
          border-radius: 999px;
          border: 1px solid var(--line);
          background: var(--panel);
          color: var(--ink-2);
          font-size: 12px;
          font-weight: 700;
          font-family: inherit;
          cursor: pointer;
          transition: border-color .12s, background .12s, color .12s;
        }
        .sync-filter.active {
          border-color: #c7d2fe;
          background: #eef2ff;
          color: var(--indigo);
        }
        .sync-filter-count {
          padding: 2px 6px;
          border-radius: 999px;
          background: #f8fafc;
          color: var(--mut);
          font-size: 10px;
          font-weight: 800;
        }
        .sync-filter.active .sync-filter-count {
          background: rgba(255, 255, 255, 0.8);
          color: var(--indigo);
        }
        .sync-error {
          margin-bottom: 12px;
          padding: 12px 14px;
          border-radius: 14px;
          border: 1px solid #fecdd3;
          background: #fff1f2;
          color: #be123c;
          font-size: 12px;
          font-weight: 600;
        }
        .sync-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .sync-log {
          border: 1px solid var(--line);
          background: linear-gradient(180deg, #ffffff, #fbfcff);
          border-radius: 18px;
          padding: 14px;
          transition: border-color .12s ease, box-shadow .12s ease, transform .12s ease;
        }
        .sync-log:hover {
          border-color: #d8d9e3;
          box-shadow: var(--shadow-md);
          transform: translateY(-1px);
        }
        .sync-log-top {
          display: flex;
          align-items: flex-start;
          gap: 12px;
        }
        .sync-log-icon {
          width: 36px;
          height: 36px;
          display: grid;
          place-items: center;
          border-radius: 14px;
          flex-shrink: 0;
        }
        .sync-log-main {
          min-width: 0;
          flex: 1;
        }
        .sync-log-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          flex-wrap: wrap;
        }
        .sync-log-title {
          margin: 0;
          font-size: 13.5px;
          line-height: 1.35;
          font-weight: 700;
          color: var(--ink);
        }
        .sync-log-time {
          font-size: 11.5px;
          color: var(--mut);
          white-space: nowrap;
        }
        .sync-log-tags {
          display: flex;
          flex-wrap: wrap;
          gap: 7px;
          margin-top: 8px;
        }
        .sync-log-message {
          margin-top: 9px;
          font-size: 12px;
          line-height: 1.55;
          color: var(--mut);
          word-break: break-word;
        }
        .sync-empty {
          padding: 40px 18px;
          text-align: center;
          color: var(--mut);
          font-size: 13px;
          line-height: 1.6;
        }
        @media (max-width: 1400px) {
          .sync-stats {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }
        @media (max-width: 1220px) {
          .sync-header {
            flex-direction: column;
            align-items: flex-start;
          }
          .sync-grid {
            grid-template-columns: 1fr;
          }
        }
        @media (max-width: 720px) {
          .sync-stats {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      <div className="sync-shell">
        <div className="sync-header">
          <div>
            <h1 className="sync-title">Sync & Logs</h1>
            <p className="sync-subtitle">
              Google connection health, scope coverage, and recent sync activity. Saves happen
              immediately in the app, and Google updates continue in the background.
            </p>
          </div>
          <button onClick={refresh} disabled={loading} className="sync-refresh">
            <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
            {loading ? "Refreshing..." : "Refresh history"}
          </button>
        </div>

        <div className="sync-stats">
          <div className="sync-stat">
            <div className="sync-stat-label">
              <span className="sync-stat-dot" style={{ background: googleConnected ? "#10b981" : "#ef4444" }} />
              Google account
            </div>
            <div className="sync-stat-value">{googleConnected ? "Connected" : "Offline"}</div>
            <div className="sync-stat-note">{googleConnected ? "Ready to sync with Google services" : "Reconnect Google to resume sync"}</div>
          </div>

          <div className="sync-stat">
            <div className="sync-stat-label">
              <span className="sync-stat-dot" style={{ background: STATUS_META.PENDING.dot }} />
              Queued work
            </div>
            <div className="sync-stat-value">{summary.queued}</div>
            <div className="sync-stat-note">Waiting for the background sync worker to finish</div>
          </div>

          <div className="sync-stat">
            <div className="sync-stat-label">
              <span className="sync-stat-dot" style={{ background: STATUS_META.SUCCESS.dot }} />
              Successful syncs
            </div>
            <div className="sync-stat-value">{summary.success}</div>
            <div className="sync-stat-note">{summary.calendar} calendar and {summary.tasks} task operations logged</div>
          </div>

          <div className="sync-stat">
            <div className="sync-stat-label">
              <span className="sync-stat-dot" style={{ background: STATUS_META.ERROR.dot }} />
              Needs attention
            </div>
            <div className="sync-stat-value">{summary.error}</div>
            <div className="sync-stat-note">{summary.error === 0 ? "No failed syncs in the recent history" : "Review failed entries and reconnect if needed"}</div>
          </div>
        </div>

        <div className="sync-grid">
          <section className="sync-panel">
            <div className="sync-panel-head">
              <h2 className="sync-panel-title">Google account health</h2>
              <div className="sync-panel-copy">
                Confirm the account is connected and that the right scopes are available before
                chasing individual sync failures.
              </div>
            </div>
            <div className="sync-panel-body">
              <div className="sync-health">
                <div className="sync-health-row">
                  <div className="sync-health-main">
                    <div className="sync-health-label">Connection</div>
                    <div className="sync-health-note">
                      {googleConnected
                        ? "Your Google account is authorized and ready for calendar or task sync."
                        : "No active Google token is available for this account right now."}
                    </div>
                  </div>
                  <span
                    className="sync-chip"
                    style={
                      googleConnected
                        ? { background: "#ecfdf5", borderColor: "#a7f3d0", color: "#047857" }
                        : { background: "#fff1f2", borderColor: "#fecdd3", color: "#be123c" }
                    }
                  >
                    {googleConnected ? <CheckCircle className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                    {googleConnected ? "Connected" : "Disconnected"}
                  </span>
                </div>

                <div className="sync-health-row">
                  <div className="sync-health-main">
                    <div className="sync-health-label">Calendar scope</div>
                    <div className="sync-health-note">
                      Grants event creation and reminder sync through the Google Calendar API.
                    </div>
                  </div>
                  <span
                    className="sync-chip"
                    style={
                      hasCalendarScope
                        ? { background: "#eef2ff", borderColor: "#dbe3ff", color: "#4338ca" }
                        : { background: "#f8fafc", borderColor: "#e2e8f0", color: "#64748b" }
                    }
                  >
                    {hasCalendarScope ? <ShieldCheck className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                    {hasCalendarScope ? "Granted" : "Missing"}
                  </span>
                </div>

                <div className="sync-health-row">
                  <div className="sync-health-main">
                    <div className="sync-health-label">Tasks scope</div>
                    <div className="sync-health-note">
                      Enables checklist and due-date sync to Google Tasks.
                    </div>
                  </div>
                  <span
                    className="sync-chip"
                    style={
                      hasTasksScope
                        ? { background: "#f3e8ff", borderColor: "#e9d5ff", color: "#7c3aed" }
                        : { background: "#f8fafc", borderColor: "#e2e8f0", color: "#64748b" }
                    }
                  >
                    {hasTasksScope ? <ShieldCheck className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                    {hasTasksScope ? "Granted" : "Missing"}
                  </span>
                </div>
              </div>

              <div className="sync-alert">
                <div className="sync-alert-title">
                  <Clock3 className="w-4 h-4" />
                  Background sync model
                </div>
                <div className="sync-alert-copy">
                  Item saves return immediately. Google calendar and task updates are queued, then
                  logged here as they succeed or fail.
                </div>
                {!googleConnected && (
                  <Link href="/api/auth/signin" className="sync-connect">
                    Connect Google account
                  </Link>
                )}
              </div>
            </div>
          </section>

          <section className="sync-panel">
            <div className="sync-panel-head">
              <h2 className="sync-panel-title">Recent sync activity</h2>
              <div className="sync-panel-copy">
                Review the latest queued, successful, and failed Google operations across calendar
                and task sync.
              </div>
            </div>
            <div className="sync-panel-body">
              <div className="sync-meta-row">
                <div className="sync-last-activity">Last activity: {lastActivity}</div>
                <div className="sync-filters">
                  {statusFilters.map((filter) => (
                    <button
                      key={filter.value}
                      onClick={() => setStatusFilter(filter.value)}
                      className={cn("sync-filter", statusFilter === filter.value && "active")}
                      aria-pressed={statusFilter === filter.value}
                    >
                      {filter.label}
                      <span className="sync-filter-count">{filter.count}</span>
                    </button>
                  ))}
                </div>
              </div>

              {error && <div className="sync-error">{error}</div>}

              {filteredLogs.length === 0 ? (
                <div className="sync-empty">
                  {logs.length === 0
                    ? "No sync activity has been logged yet. Once Google-linked items are created or updated, entries will appear here."
                    : "No entries match the current filter."}
                </div>
              ) : (
                <div className="sync-list">
                  {filteredLogs.map((log) => {
                    const meta = actionMeta(log.action);
                    const status = statusMeta(log.status);
                    const ActionIcon = meta.icon;
                    const StatusIcon = status.icon;

                    return (
                      <article key={log.id} className="sync-log">
                        <div className="sync-log-top">
                          <div className="sync-log-icon" style={{ background: meta.iconBg, color: meta.text }}>
                            <ActionIcon className="w-4 h-4" />
                          </div>

                          <div className="sync-log-main">
                            <div className="sync-log-row">
                              <p className="sync-log-title">{log.itemTitle ?? "Unknown item"}</p>
                              <span className="sync-log-time">
                                {format(new Date(log.createdAt), "MMM d, h:mm a")}
                              </span>
                            </div>

                            <div className="sync-log-tags">
                              <span className="sync-chip" style={{ background: meta.bg, borderColor: meta.border, color: meta.text }}>
                                {meta.label}
                              </span>
                              <span className="sync-chip" style={{ background: "#f8fafc", borderColor: "#e2e8f0", color: "#64748b" }}>
                                {meta.family}
                              </span>
                              <span className="sync-chip" style={{ background: status.bg, borderColor: status.border, color: status.text }}>
                                <StatusIcon className="w-3.5 h-3.5" />
                                {status.label}
                              </span>
                            </div>

                            {log.message && <div className="sync-log-message">{log.message}</div>}
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
