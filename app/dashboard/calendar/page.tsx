"use client";

import { useState, useMemo } from "react";
import {
  startOfMonth, endOfMonth, eachDayOfInterval, getDay,
  format, isSameDay, isToday, addMonths, subMonths, isSameMonth,
  parseISO,
} from "date-fns";
import Modal from "@/components/ui/Modal";
import ItemForm from "@/components/dashboard/ItemForm";
import { useItems } from "@/components/dashboard/ItemsProvider";
import type { TemporalItemWithRelations, CreateItemInput } from "@/types";

const TYPE_COLORS: Record<string, { bg: string; color: string; dot: string }> = {
  DEADLINE: { bg: "var(--red-tint)",    color: "var(--red)",    dot: "#ef4444" },
  EVENT:    { bg: "var(--indigo-soft)", color: "var(--indigo)", dot: "#6366f1" },
  TASK:     { bg: "var(--violet-soft)", color: "var(--violet)", dot: "#8b5cf6" },
  REMINDER: { bg: "var(--amber-soft)",  color: "var(--amber)",  dot: "#f59e0b" },
};

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function CalendarPage() {
  const { items: allItems, loading, createItem, updateItem, deleteItem } = useItems();
  const [month, setMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<TemporalItemWithRelations | null>(null);
  const [preselectedDate, setPreselectedDate] = useState<string | undefined>(undefined);
  const items = useMemo(
    () => allItems.filter(item => item.status !== "ARCHIVED"),
    [allItems]
  );

  const cells = useMemo(() => {
    const start = startOfMonth(month);
    const end = endOfMonth(month);
    const days = eachDayOfInterval({ start, end });
    const firstDow = getDay(start);
    const padBefore = Array.from({ length: firstDow }, () => null as Date | null);
    const all: Array<Date | null> = [...padBefore, ...days];
    while (all.length % 7 !== 0) all.push(null);
    return all;
  }, [month]);

  function itemsForDay(day: Date) {
    return items.filter(
      (item) => item.status !== "ARCHIVED" && isSameDay(parseISO(new Date(item.dueDate).toISOString()), day)
    );
  }

  const selectedDayItems = selectedDay ? itemsForDay(selectedDay) : [];

  async function handleCreate(data: CreateItemInput) {
    const item = await createItem(data);
    if (!item) return;
    setShowForm(false);
    setPreselectedDate(undefined);
  }

  async function handleUpdate(data: CreateItemInput) {
    if (!editItem) return;
    const item = await updateItem(editItem.id, data);
    if (item) setEditItem(null);
  }

  async function handleDelete(id: string) {
    const previousSelectedDay = selectedDay;
    if (selectedDayItems.length <= 1) setSelectedDay(null);
    try {
      await deleteItem(id);
    } catch {
      setSelectedDay(previousSelectedDay);
    }
  }

  function openAddForDay(day: Date) {
    setPreselectedDate(format(day, "yyyy-MM-dd") + "T09:00");
    setShowForm(true);
  }

  return (
    <>
      <style>{`
        .cal-wrap { padding: 22px 24px 40px; min-width: 0; }

        .cal-header {
          display: flex; align-items: center; justify-content: space-between;
          margin-bottom: 24px; gap: 16px;
        }
        .cal-header-left { display: flex; align-items: center; gap: 16px; }
        .cal-title { font-size: 22px; font-weight: 800; letter-spacing: -.02em; color: var(--ink); }
        .cal-month-label { font-size: 18px; font-weight: 700; color: var(--ink-2); }
        .cal-nav { display: flex; gap: 6px; }
        .cal-nav-btn {
          width: 34px; height: 34px; border-radius: 9px;
          background: var(--panel); border: 1.5px solid var(--line);
          display: grid; place-items: center;
          color: var(--mut); cursor: pointer; transition: all .12s;
        }
        .cal-nav-btn:hover { border-color: var(--indigo); color: var(--indigo); }
        .cal-today-btn {
          padding: 7px 14px; border-radius: 9px;
          background: var(--panel); border: 1.5px solid var(--line);
          font-size: 13px; font-weight: 600; color: var(--ink-2);
          cursor: pointer; font-family: inherit; transition: all .12s;
        }
        .cal-today-btn:hover { border-color: var(--indigo); color: var(--indigo); }
        .cal-add-btn {
          display: inline-flex; align-items: center; gap: 7px;
          padding: 9px 18px; background: var(--indigo); border: none;
          border-radius: 10px; font-size: 13.5px; font-weight: 600;
          color: white; cursor: pointer; font-family: inherit;
          transition: background .12s;
        }
        .cal-add-btn:hover { background: var(--indigo-deep); }

        /* Main layout */
        .cal-body {
          display: grid;
          grid-template-columns: 1fr 300px;
          gap: 18px;
          align-items: start;
        }
        .cal-grid-wrap {
          background: var(--panel); border: 1px solid var(--line);
          border-radius: 18px; overflow: hidden;
          box-shadow: var(--shadow-sm);
        }
        .cal-dow-row {
          display: grid; grid-template-columns: repeat(7, 1fr);
          border-bottom: 1px solid var(--line);
          background: var(--bg);
        }
        .cal-dow {
          padding: 10px 0; text-align: center;
          font-size: 11.5px; font-weight: 700;
          color: var(--mut); text-transform: uppercase; letter-spacing: .04em;
        }
        .cal-grid {
          display: grid; grid-template-columns: repeat(7, 1fr);
        }
        .cal-cell {
          min-height: 100px; padding: 8px 6px 6px;
          border-right: 1px solid var(--line);
          border-bottom: 1px solid var(--line);
          cursor: pointer; transition: background .1s;
          position: relative;
        }
        .cal-cell:nth-child(7n) { border-right: none; }
        .cal-cell:hover { background: var(--line-2); }
        .cal-cell.outside { background: #fafbfe; }
        .cal-cell.outside .cal-day-num { color: var(--mut-2); }
        .cal-cell.selected { background: var(--indigo-soft); }
        .cal-cell.today .cal-day-num {
          background: var(--indigo); color: white;
          width: 26px; height: 26px; border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          font-weight: 700;
        }
        .cal-day-num {
          font-size: 13px; font-weight: 600; color: var(--ink);
          margin-bottom: 4px; width: 26px; height: 26px;
          display: flex; align-items: center; justify-content: center;
        }
        .cal-pills { display: flex; flex-direction: column; gap: 2px; }
        .cal-pill {
          font-size: 10.5px; font-weight: 600;
          padding: 1.5px 6px; border-radius: 5px;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
          cursor: pointer;
        }
        .cal-pill-more {
          font-size: 10px; color: var(--mut); font-weight: 500;
          padding: 1px 4px;
        }

        /* Side panel */
        .cal-panel {
          background: var(--panel); border: 1px solid var(--line);
          border-radius: 18px; padding: 20px;
          box-shadow: var(--shadow-sm);
          position: sticky; top: 22px;
        }
        .cal-panel-head {
          display: flex; align-items: center; justify-content: space-between;
          margin-bottom: 16px;
        }
        .cal-panel-title { font-size: 14px; font-weight: 700; color: var(--ink); }
        .cal-panel-date { font-size: 12px; color: var(--mut); }
        .cal-panel-add {
          display: inline-flex; align-items: center; gap: 5px;
          padding: 5px 10px; background: var(--indigo-soft);
          border: 1px solid var(--indigo-soft-2);
          border-radius: 8px; font-size: 12px; font-weight: 600;
          color: var(--indigo); cursor: pointer; font-family: inherit;
          transition: all .12s;
        }
        .cal-panel-add:hover { background: var(--indigo-soft-2); }
        .cal-event-item {
          padding: 10px 12px; border-radius: 12px;
          border: 1px solid var(--line);
          margin-bottom: 8px; position: relative;
        }
        .cal-event-item:last-child { margin-bottom: 0; }
        .cal-event-type {
          font-size: 10px; font-weight: 700;
          text-transform: uppercase; letter-spacing: .05em;
          margin-bottom: 3px;
        }
        .cal-event-title {
          font-size: 13px; font-weight: 600; color: var(--ink);
          margin-bottom: 4px; line-height: 1.3;
        }
        .cal-event-time { font-size: 11.5px; color: var(--mut); }
        .cal-event-actions {
          position: absolute; top: 8px; right: 8px;
          display: flex; gap: 2px; opacity: 0; transition: opacity .12s;
        }
        .cal-event-item:hover .cal-event-actions { opacity: 1; }
        .cal-icon-btn {
          padding: 4px; border-radius: 6px; border: none; background: none;
          cursor: pointer; color: var(--mut); display: grid; place-items: center;
          transition: all .12s;
        }
        .cal-icon-btn:hover { background: var(--line-2); color: var(--ink); }
        .cal-icon-btn.del:hover { background: var(--red-tint); color: var(--red); }
        .cal-empty-panel {
          text-align: center; padding: 32px 0;
          color: var(--mut); font-size: 13px;
        }
        .cal-no-day {
          text-align: center; padding: 32px 0;
          color: var(--mut-2); font-size: 13px;
        }
        .cal-legend {
          display: flex; flex-wrap: wrap; gap: 10px;
          margin-bottom: 18px; align-items: center;
        }
        .cal-legend-item {
          display: flex; align-items: center; gap: 5px;
          font-size: 12px; color: var(--ink-2); font-weight: 500;
        }
        .cal-legend-dot {
          width: 8px; height: 8px; border-radius: 50%;
        }
        .cal-loading {
          display: flex; align-items: center; justify-content: center;
          padding: 80px 0; color: var(--mut); font-size: 14px;
          gap: 10px;
        }
      `}</style>

      <div className="cal-wrap">
        {/* Header */}
        <div className="cal-header">
          <div className="cal-header-left">
            <div className="cal-title">Calendar</div>
            <div className="cal-nav">
              <button
                className="cal-nav-btn"
                onClick={() => setMonth((m) => subMonths(m, 1))}
                title="Previous month"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
              </button>
              <button
                className="cal-nav-btn"
                onClick={() => setMonth((m) => addMonths(m, 1))}
                title="Next month"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
            </div>
            <div className="cal-month-label">{format(month, "MMMM yyyy")}</div>
            <button className="cal-today-btn" onClick={() => setMonth(new Date())}>
              Today
            </button>
          </div>
          <button className="cal-add-btn" onClick={() => { setPreselectedDate(undefined); setShowForm(true); }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Add Event
          </button>
        </div>

        {/* Legend */}
        <div className="cal-legend">
          {Object.entries(TYPE_COLORS).map(([type, { dot }]) => (
            <div key={type} className="cal-legend-item">
              <span className="cal-legend-dot" style={{ background: dot }} />
              {type.charAt(0) + type.slice(1).toLowerCase()}
            </div>
          ))}
        </div>

        {loading ? (
          <div className="cal-loading">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: "spin 1s linear infinite" }}>
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
            </svg>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            Loading calendar…
          </div>
        ) : (
          <div className="cal-body">
            {/* Grid */}
            <div className="cal-grid-wrap">
              <div className="cal-dow-row">
                {DOW.map((d) => (
                  <div key={d} className="cal-dow">{d}</div>
                ))}
              </div>
              <div className="cal-grid">
                {cells.map((day, i) => {
                  if (!day) {
                    return <div key={i} className="cal-cell outside" />;
                  }
                  const dayItems = itemsForDay(day);
                  const outside = !isSameMonth(day, month);
                  const today = isToday(day);
                  const selected = selectedDay ? isSameDay(day, selectedDay) : false;
                  const visibleItems = dayItems.slice(0, 3);
                  const extra = dayItems.length - visibleItems.length;

                  return (
                    <div
                      key={i}
                      className={`cal-cell${outside ? " outside" : ""}${today ? " today" : ""}${selected ? " selected" : ""}`}
                      onClick={() => setSelectedDay((prev) => (prev && isSameDay(prev, day) ? null : day))}
                    >
                      <div className="cal-day-num">{format(day, "d")}</div>
                      <div className="cal-pills">
                        {visibleItems.map((item) => {
                          const tc = TYPE_COLORS[item.type] ?? TYPE_COLORS.EVENT;
                          return (
                            <div
                              key={item.id}
                              className="cal-pill"
                              style={{ background: tc.bg, color: tc.color }}
                              title={item.title}
                            >
                              {item.title}
                            </div>
                          );
                        })}
                        {extra > 0 && (
                          <div className="cal-pill-more">+{extra} more</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Side panel */}
            <div className="cal-panel">
              {selectedDay ? (
                <>
                  <div className="cal-panel-head">
                    <div>
                      <div className="cal-panel-title">{format(selectedDay, "EEEE")}</div>
                      <div className="cal-panel-date">{format(selectedDay, "MMMM d, yyyy")}</div>
                    </div>
                    <button
                      className="cal-panel-add"
                      onClick={() => openAddForDay(selectedDay)}
                    >
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                      </svg>
                      Add
                    </button>
                  </div>
                  {selectedDayItems.length === 0 ? (
                    <div className="cal-empty-panel">
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: "0 auto 10px", display: "block" }}>
                        <rect x="3" y="4" width="18" height="17" rx="2" /><line x1="3" y1="9" x2="21" y2="9" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="16" y1="2" x2="16" y2="6" />
                      </svg>
                      Nothing scheduled
                    </div>
                  ) : (
                    selectedDayItems.map((item) => {
                      const tc = TYPE_COLORS[item.type] ?? TYPE_COLORS.EVENT;
                      return (
                        <div
                          key={item.id}
                          className="cal-event-item"
                          style={{ borderLeftColor: tc.dot, borderLeftWidth: 3 }}
                        >
                          <div className="cal-event-type" style={{ color: tc.color }}>{item.type}</div>
                          <div className="cal-event-title">{item.title}</div>
                          <div className="cal-event-time">
                            {item.allDay
                              ? "All day"
                              : format(new Date(item.dueDate), "h:mm a")}
                          </div>
                          <div className="cal-event-actions">
                            <button
                              className="cal-icon-btn"
                              onClick={() => setEditItem(item)}
                              title="Edit"
                            >
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                              </svg>
                            </button>
                            <button
                              className="cal-icon-btn del"
                              onClick={() => handleDelete(item.id)}
                              title="Delete"
                            >
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </>
              ) : (
                <div className="cal-no-day">
                  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: "0 auto 12px", display: "block" }}>
                    <rect x="3" y="4" width="18" height="17" rx="2" /><line x1="3" y1="9" x2="21" y2="9" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="16" y1="2" x2="16" y2="6" />
                  </svg>
                  Click a day to see its items
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Create modal */}
      <Modal open={showForm} onClose={() => { setShowForm(false); setPreselectedDate(undefined); }} title="Add Event">
        <ItemForm
          onSubmit={handleCreate}
          onCancel={() => { setShowForm(false); setPreselectedDate(undefined); }}
          googleConnected={false}
          initialData={{ type: "EVENT", dueDate: preselectedDate }}
        />
      </Modal>

      {/* Edit modal */}
      <Modal open={!!editItem} onClose={() => setEditItem(null)} title="Edit Item">
        {editItem && (
          <ItemForm
            onSubmit={handleUpdate}
            onCancel={() => setEditItem(null)}
            googleConnected={false}
            initialData={{
              title: editItem.title,
              description: editItem.description ?? undefined,
              type: editItem.type as CreateItemInput["type"],
              priority: editItem.priority as CreateItemInput["priority"],
              dueDate: editItem.dueDate as unknown as string,
              startDate: editItem.startDate as unknown as string | undefined,
              allDay: editItem.allDay,
              reminderMinutes: editItem.reminderMinutes,
              tags: editItem.tags.map((t) => t.name),
            }}
          />
        )}
      </Modal>
    </>
  );
}
