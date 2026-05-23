"use client";

import { useMemo, useState } from "react";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  format,
  getDay,
  isSameDay,
  isToday,
  startOfMonth,
  subMonths,
} from "date-fns";
import { Bell, Calendar, CheckSquare, ChevronLeft, ChevronRight, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { interpretTimeLeft, type UrgencyLevel } from "@/lib/time";
import type { TemporalItemWithRelations } from "@/types";

interface TimelineViewProps {
  initialItems: TemporalItemWithRelations[];
}

type TypeKey = TemporalItemWithRelations["type"];

const TYPE_META: Record<
  TypeKey,
  {
    label: string;
    accent: string;
    bg: string;
    border: string;
    text: string;
    iconBg: string;
    icon: React.ElementType;
  }
> = {
  DEADLINE: {
    label: "Deadline",
    accent: "var(--red)",
    bg: "var(--red-tint)",
    border: "var(--red-soft)",
    text: "#b91c1c",
    iconBg: "#ffe4e6",
    icon: Clock,
  },
  EVENT: {
    label: "Event",
    accent: "var(--indigo)",
    bg: "var(--indigo-soft)",
    border: "var(--indigo-soft-2)",
    text: "var(--indigo)",
    iconBg: "#eef2ff",
    icon: Calendar,
  },
  TASK: {
    label: "Task",
    accent: "var(--violet)",
    bg: "var(--violet-soft)",
    border: "#ddd6fe",
    text: "#6d28d9",
    iconBg: "#f3e8ff",
    icon: CheckSquare,
  },
  REMINDER: {
    label: "Reminder",
    accent: "var(--amber)",
    bg: "var(--amber-soft)",
    border: "#fde68a",
    text: "#b45309",
    iconBg: "#fff7ed",
    icon: Bell,
  },
};

const URGENCY_META: Record<UrgencyLevel, { bg: string; border: string; text: string }> = {
  overdue: { bg: "var(--red-tint)", border: "var(--red-soft)", text: "#b91c1c" },
  critical: { bg: "#fff1e8", border: "#fed7aa", text: "#c2410c" },
  high: { bg: "#fffbeb", border: "#fde68a", text: "#b45309" },
  medium: { bg: "#eff6ff", border: "#bfdbfe", text: "#1d4ed8" },
  low: { bg: "#ecfdf5", border: "#a7f3d0", text: "#047857" },
  future: { bg: "#f8fafc", border: "#e2e8f0", text: "#64748b" },
};

function itemTypeMeta(item: TemporalItemWithRelations) {
  return TYPE_META[item.type] ?? TYPE_META.EVENT;
}

function sortTimelineItems(items: TemporalItemWithRelations[]) {
  return [...items].sort((a, b) => {
    const aCompleted = a.status === "COMPLETED" ? 1 : 0;
    const bCompleted = b.status === "COMPLETED" ? 1 : 0;
    return aCompleted - bCompleted || new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
  });
}

export default function TimelineView({ initialItems }: TimelineViewProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);

  const items = useMemo(
    () => initialItems.filter((item) => item.status !== "ARCHIVED"),
    [initialItems]
  );

  const cells = useMemo(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    const monthDays = eachDayOfInterval({ start, end });
    const leading = (getDay(start) + 6) % 7;
    const padded: Array<Date | null> = [
      ...Array.from({ length: leading }, () => null),
      ...monthDays,
    ];
    while (padded.length % 7 !== 0) padded.push(null);
    return padded;
  }, [currentMonth]);

  const itemsByDay = useMemo(() => {
    const map = new Map<string, TemporalItemWithRelations[]>();
    for (const item of items) {
      const key = format(new Date(item.dueDate), "yyyy-MM-dd");
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(item);
    }
    for (const [key, dayItems] of map.entries()) {
      map.set(key, sortTimelineItems(dayItems));
    }
    return map;
  }, [items]);

  const selectedItems = useMemo(() => {
    if (!selectedDay) return [];
    const key = format(selectedDay, "yyyy-MM-dd");
    return itemsByDay.get(key) ?? [];
  }, [selectedDay, itemsByDay]);

  const upcomingItems = useMemo(() => {
    return sortTimelineItems(
      initialItems
        .filter((item) => item.status !== "COMPLETED" && item.status !== "ARCHIVED")
        .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
        .slice(0, 12)
    );
  }, [initialItems]);

  const activeCount = useMemo(
    () => items.filter((item) => item.status !== "COMPLETED").length,
    [items]
  );

  const completedCount = useMemo(
    () => items.filter((item) => item.status === "COMPLETED").length,
    [items]
  );

  return (
    <>
      <style>{`
        .tlv-shell {
          padding: 24px 24px 40px;
          min-width: 0;
        }
        .tlv-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
          margin-bottom: 18px;
        }
        .tlv-title {
          margin: 0;
          font-size: 22px;
          line-height: 1.1;
          font-weight: 800;
          letter-spacing: -.025em;
          color: var(--ink);
        }
        .tlv-subtitle {
          margin: 8px 0 0;
          font-size: 13px;
          line-height: 1.5;
          color: var(--mut);
          max-width: 620px;
        }
        .tlv-head-stats {
          display: flex;
          flex-wrap: wrap;
          justify-content: flex-end;
          gap: 8px;
          min-width: 0;
        }
        .tlv-stat {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          padding: 9px 12px;
          border-radius: 999px;
          background: var(--panel);
          border: 1px solid var(--line);
          color: var(--ink-2);
          box-shadow: var(--shadow-sm);
          font-size: 12px;
          font-weight: 600;
          white-space: nowrap;
        }
        .tlv-stat-dot {
          width: 8px;
          height: 8px;
          border-radius: 999px;
        }
        .tlv-legend {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin-bottom: 18px;
        }
        .tlv-legend-item {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 8px 12px;
          border-radius: 999px;
          background: var(--panel);
          border: 1px solid var(--line);
          box-shadow: var(--shadow-sm);
          color: var(--ink-2);
          font-size: 12px;
          font-weight: 600;
        }
        .tlv-legend-icon {
          width: 20px;
          height: 20px;
          border-radius: 999px;
          display: grid;
          place-items: center;
          flex-shrink: 0;
        }
        .tlv-body {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 320px;
          gap: 18px;
          align-items: start;
        }
        .tlv-panel {
          background: var(--panel);
          border: 1px solid var(--line);
          border-radius: 24px;
          box-shadow: var(--shadow-sm);
          min-width: 0;
        }
        .tlv-panel-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 18px 20px 14px;
          border-bottom: 1px solid var(--line);
          background:
            radial-gradient(circle at top left, rgba(99, 102, 241, 0.07), transparent 42%),
            linear-gradient(180deg, rgba(248, 250, 255, 0.95), rgba(255, 255, 255, 0.95));
        }
        .tlv-month {
          font-size: 18px;
          font-weight: 750;
          color: var(--ink);
          letter-spacing: -.02em;
        }
        .tlv-month-note {
          margin-top: 5px;
          font-size: 12px;
          color: var(--mut);
        }
        .tlv-nav {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
          justify-content: flex-end;
        }
        .tlv-nav-btn,
        .tlv-today-btn,
        .tlv-clear-btn {
          border: 1px solid var(--line);
          background: var(--panel);
          color: var(--ink-2);
          border-radius: 10px;
          font-family: inherit;
          transition: border-color .12s, color .12s, background .12s, transform .12s;
          cursor: pointer;
        }
        .tlv-nav-btn {
          width: 34px;
          height: 34px;
          display: grid;
          place-items: center;
        }
        .tlv-today-btn,
        .tlv-clear-btn {
          padding: 8px 12px;
          font-size: 12px;
          font-weight: 700;
        }
        .tlv-nav-btn:hover,
        .tlv-today-btn:hover,
        .tlv-clear-btn:hover {
          border-color: var(--indigo);
          color: var(--indigo);
          transform: translateY(-1px);
        }
        .tlv-grid-wrap {
          overflow: hidden;
          border-radius: 0 0 24px 24px;
        }
        .tlv-dow-row {
          display: grid;
          grid-template-columns: repeat(7, minmax(0, 1fr));
          background: linear-gradient(180deg, #fbfbff, #f8f9ff);
          border-bottom: 1px solid var(--line);
        }
        .tlv-dow {
          padding: 11px 0;
          text-align: center;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: .08em;
          text-transform: uppercase;
          color: var(--mut);
        }
        .tlv-grid {
          display: grid;
          grid-template-columns: repeat(7, minmax(0, 1fr));
        }
        .tlv-cell {
          min-height: 124px;
          padding: 10px 8px 8px;
          border-right: 1px solid var(--line);
          border-bottom: 1px solid var(--line);
          background: linear-gradient(180deg, #ffffff, #fcfcff);
          transition: background .12s ease, box-shadow .12s ease;
          cursor: pointer;
        }
        .tlv-cell:nth-child(7n) {
          border-right: none;
        }
        .tlv-cell.blank {
          cursor: default;
          background: linear-gradient(180deg, #fafbff, #f7f8fd);
        }
        .tlv-cell.interactive:hover {
          background: linear-gradient(180deg, #ffffff, #f8faff);
        }
        .tlv-cell.selected {
          background: linear-gradient(180deg, #f8f9ff, #f1f4ff);
          box-shadow: inset 0 0 0 1.5px rgba(99, 102, 241, 0.18);
        }
        .tlv-cell.today {
          background:
            linear-gradient(180deg, rgba(99, 102, 241, 0.04), rgba(99, 102, 241, 0.01)),
            linear-gradient(180deg, #ffffff, #fcfcff);
        }
        .tlv-daytop {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          margin-bottom: 8px;
        }
        .tlv-daynum {
          width: 30px;
          height: 30px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 700;
          color: var(--ink-2);
        }
        .tlv-daynum.today {
          background: var(--indigo);
          color: white;
          box-shadow: 0 10px 22px rgba(99, 102, 241, 0.22);
        }
        .tlv-daycount {
          padding: 2px 7px;
          border-radius: 999px;
          background: #f7f8fc;
          border: 1px solid var(--line);
          color: var(--mut);
          font-size: 10px;
          font-weight: 700;
        }
        .tlv-itemstack {
          display: flex;
          flex-direction: column;
          gap: 5px;
        }
        .tlv-itempill {
          min-width: 0;
          padding: 6px 8px 6px 11px;
          border-radius: 10px;
          border: 1px solid transparent;
          font-size: 11px;
          font-weight: 700;
          line-height: 1.25;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          transition: transform .12s ease, box-shadow .12s ease, opacity .12s ease;
        }
        .tlv-itempill:hover {
          transform: translateY(-1px);
          box-shadow: var(--shadow-sm);
        }
        .tlv-itempill.completed {
          color: var(--mut) !important;
          border-color: var(--line) !important;
          background: #f8fafc !important;
          opacity: .82;
        }
        .tlv-more {
          padding: 4px 8px;
          border-radius: 999px;
          background: #f8fafc;
          border: 1px dashed #d7ddea;
          color: var(--mut);
          font-size: 10px;
          font-weight: 700;
          width: fit-content;
        }
        .tlv-side {
          position: sticky;
          top: 22px;
          overflow: hidden;
        }
        .tlv-side-head {
          padding: 18px 18px 14px;
          border-bottom: 1px solid var(--line);
          background:
            radial-gradient(circle at top right, rgba(99, 102, 241, 0.08), transparent 46%),
            linear-gradient(180deg, #fcfcff, #ffffff);
        }
        .tlv-side-title {
          margin: 0;
          font-size: 15px;
          font-weight: 750;
          color: var(--ink);
          letter-spacing: -.015em;
        }
        .tlv-side-subtitle {
          margin-top: 6px;
          font-size: 12px;
          color: var(--mut);
          line-height: 1.45;
        }
        .tlv-side-actions {
          margin-top: 12px;
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }
        .tlv-list {
          max-height: calc(100vh - 220px);
          overflow-y: auto;
          padding: 14px;
        }
        .tlv-card {
          border: 1px solid var(--line);
          background: linear-gradient(180deg, #ffffff, #fbfcff);
          border-radius: 18px;
          padding: 13px 13px 12px;
          margin-bottom: 10px;
          transition: border-color .12s ease, box-shadow .12s ease, transform .12s ease;
        }
        .tlv-card:last-child {
          margin-bottom: 0;
        }
        .tlv-card.clickable {
          cursor: pointer;
        }
        .tlv-card.clickable:hover {
          border-color: #d8d9e3;
          box-shadow: var(--shadow-md);
          transform: translateY(-1px);
        }
        .tlv-card-top {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          margin-bottom: 9px;
        }
        .tlv-card-icon {
          width: 32px;
          height: 32px;
          display: grid;
          place-items: center;
          border-radius: 12px;
          flex-shrink: 0;
        }
        .tlv-card-body {
          min-width: 0;
          flex: 1;
        }
        .tlv-card-kicker {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 3px 8px;
          border-radius: 999px;
          border: 1px solid transparent;
          font-size: 10px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: .06em;
          margin-bottom: 8px;
        }
        .tlv-card-title {
          font-size: 13.5px;
          line-height: 1.35;
          font-weight: 700;
          color: var(--ink);
          margin: 0;
        }
        .tlv-card-title.completed {
          color: var(--mut);
        }
        .tlv-card-desc {
          margin-top: 8px;
          font-size: 12px;
          color: var(--mut);
          line-height: 1.5;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .tlv-meta {
          display: flex;
          align-items: center;
          gap: 6px;
          flex-wrap: wrap;
        }
        .tlv-badge,
        .tlv-priority,
        .tlv-status {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 4px 8px;
          border-radius: 999px;
          border: 1px solid transparent;
          font-size: 10.5px;
          font-weight: 700;
          line-height: 1;
        }
        .tlv-priority {
          background: #f8fafc;
          border-color: #e2e8f0;
          color: var(--ink-2);
        }
        .tlv-status {
          background: #f1f5f9;
          border-color: #e2e8f0;
          color: #64748b;
        }
        .tlv-time {
          font-size: 11.5px;
          color: var(--mut);
        }
        .tlv-empty {
          padding: 42px 18px;
          text-align: center;
          color: var(--mut);
          font-size: 13px;
          line-height: 1.6;
        }
        @media (max-width: 1400px) {
          .tlv-body {
            grid-template-columns: minmax(0, 1fr) 300px;
          }
          .tlv-cell {
            min-height: 114px;
          }
        }
        @media (max-width: 1220px) {
          .tlv-header,
          .tlv-panel-head {
            flex-direction: column;
            align-items: flex-start;
          }
          .tlv-head-stats,
          .tlv-nav {
            justify-content: flex-start;
          }
          .tlv-body {
            grid-template-columns: 1fr;
          }
          .tlv-side {
            position: static;
          }
          .tlv-list {
            max-height: none;
          }
        }
      `}</style>

      <div className="tlv-shell">
        <div className="tlv-header">
          <div>
            <h1 className="tlv-title">Timeline</h1>
            <p className="tlv-subtitle">
              Cleaner month view for deadlines, events, tasks, and reminders, with active work
              emphasized and completed history pushed into the background.
            </p>
          </div>
          <div className="tlv-head-stats">
            <span className="tlv-stat">
              <span className="tlv-stat-dot" style={{ background: "var(--indigo)" }} />
              {activeCount} active items
            </span>
            <span className="tlv-stat">
              <span className="tlv-stat-dot" style={{ background: "#cbd5e1" }} />
              {completedCount} completed
            </span>
          </div>
        </div>

        <div className="tlv-legend">
          {Object.entries(TYPE_META).map(([type, meta]) => {
            const Icon = meta.icon;
            return (
              <div key={type} className="tlv-legend-item">
                <span className="tlv-legend-icon" style={{ background: meta.iconBg, color: meta.text }}>
                  <Icon className="w-3.5 h-3.5" />
                </span>
                {meta.label}
              </div>
            );
          })}
        </div>

        <div className="tlv-body">
          <section className="tlv-panel">
            <div className="tlv-panel-head">
              <div>
                <div className="tlv-month">{format(currentMonth, "MMMM yyyy")}</div>
                <div className="tlv-month-note">Click a day to focus its schedule and details.</div>
              </div>
              <div className="tlv-nav">
                <button
                  onClick={() => setCurrentMonth((value) => subMonths(value, 1))}
                  className="tlv-nav-btn"
                  title="Previous month"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setCurrentMonth(new Date())}
                  className="tlv-today-btn"
                  title="Jump to current month"
                >
                  Today
                </button>
                <button
                  onClick={() => setCurrentMonth((value) => addMonths(value, 1))}
                  className="tlv-nav-btn"
                  title="Next month"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="tlv-grid-wrap">
              <div className="tlv-dow-row">
                {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
                  <div key={day} className="tlv-dow">{day}</div>
                ))}
              </div>

              <div className="tlv-grid">
                {cells.map((day, index) => {
                  if (!day) {
                    return <div key={`blank-${index}`} className="tlv-cell blank" />;
                  }

                  const key = format(day, "yyyy-MM-dd");
                  const dayItems = itemsByDay.get(key) ?? [];
                  const visibleItems = dayItems.slice(0, 3);
                  const extraItems = dayItems.length - visibleItems.length;
                  const selected = selectedDay ? isSameDay(day, selectedDay) : false;
                  const today = isToday(day);

                  return (
                    <div
                      key={key}
                      onClick={() => setSelectedDay((current) => (current && isSameDay(current, day) ? null : day))}
                      className={cn(
                        "tlv-cell interactive",
                        selected && "selected",
                        today && "today"
                      )}
                    >
                      <div className="tlv-daytop">
                        <span className={cn("tlv-daynum", today && "today")}>{format(day, "d")}</span>
                        {extraItems > 0 && <span className="tlv-daycount">+{extraItems}</span>}
                      </div>

                      <div className="tlv-itemstack">
                        {visibleItems.map((item) => {
                          const meta = itemTypeMeta(item);
                          const completed = item.status === "COMPLETED";
                          return (
                            <div
                              key={item.id}
                              className={cn("tlv-itempill", completed && "completed")}
                              style={{
                                background: meta.bg,
                                borderColor: meta.border,
                                color: meta.text,
                                boxShadow: `inset 3px 0 0 ${meta.accent}`,
                              }}
                              title={item.title}
                            >
                              {item.title}
                            </div>
                          );
                        })}
                        {extraItems > 0 && <div className="tlv-more">{extraItems} more</div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          <aside className="tlv-panel tlv-side">
            <div className="tlv-side-head">
              <h2 className="tlv-side-title">
                {selectedDay ? format(selectedDay, "EEEE, MMMM d") : "Upcoming"}
              </h2>
              <div className="tlv-side-subtitle">
                {selectedDay
                  ? `${selectedItems.length} item${selectedItems.length === 1 ? "" : "s"} scheduled for this day`
                  : `Next ${upcomingItems.length} active item${upcomingItems.length === 1 ? "" : "s"} in view`}
              </div>
              <div className="tlv-side-actions">
                {selectedDay ? (
                  <button className="tlv-clear-btn" onClick={() => setSelectedDay(null)}>
                    Back to upcoming
                  </button>
                ) : (
                  <button className="tlv-clear-btn" onClick={() => setCurrentMonth(new Date())}>
                    Jump to today
                  </button>
                )}
              </div>
            </div>

            <div className="tlv-list">
              {(selectedDay ? selectedItems : upcomingItems).length === 0 ? (
                <div className="tlv-empty">
                  {selectedDay
                    ? "Nothing is scheduled here yet. Pick another day or return to the upcoming list."
                    : "No active items are coming up right now."}
                </div>
              ) : (
                (selectedDay ? selectedItems : upcomingItems).map((item) => {
                  const typeMeta = itemTypeMeta(item);
                  const urgency = interpretTimeLeft(new Date(item.dueDate));
                  const urgencyMeta = URGENCY_META[urgency.urgency];
                  const Icon = typeMeta.icon;
                  const completed = item.status === "COMPLETED";

                  return (
                    <div
                      key={item.id}
                      onClick={selectedDay ? undefined : () => setSelectedDay(new Date(item.dueDate))}
                      className={cn("tlv-card", !selectedDay && "clickable")}
                    >
                      <div className="tlv-card-kicker" style={{ background: typeMeta.bg, borderColor: typeMeta.border, color: typeMeta.text }}>
                        {typeMeta.label}
                      </div>

                      <div className="tlv-card-top">
                        <div className="tlv-card-icon" style={{ background: typeMeta.iconBg, color: typeMeta.text }}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="tlv-card-body">
                          <p className={cn("tlv-card-title", completed && "completed")}>{item.title}</p>
                          {item.description && <div className="tlv-card-desc">{item.description}</div>}
                        </div>
                      </div>

                      <div className="tlv-meta">
                        <span
                          className="tlv-badge"
                          style={{
                            background: urgencyMeta.bg,
                            borderColor: urgencyMeta.border,
                            color: urgencyMeta.text,
                          }}
                        >
                          {urgency.label}
                        </span>
                        <span className="tlv-time">
                          {item.allDay
                            ? format(new Date(item.dueDate), "MMM d")
                            : format(new Date(item.dueDate), "MMM d, h:mm a")}
                        </span>
                        {item.priority && <span className="tlv-priority">{item.priority}</span>}
                        {completed && <span className="tlv-status">Completed</span>}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </aside>
        </div>
      </div>
    </>
  );
}
