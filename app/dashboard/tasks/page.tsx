"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { format, isPast, isToday } from "date-fns";
import Modal from "@/components/ui/Modal";
import ItemForm from "@/components/dashboard/ItemForm";
import type { TemporalItemWithRelations, CreateItemInput } from "@/types";

type FilterTab = "All" | "Active" | "Overdue" | "Completed";

const PRIORITY_STYLE: Record<string, { bg: string; color: string }> = {
  LOW:      { bg: "#f1f5f9", color: "#64748b" },
  MEDIUM:   { bg: "#dbeafe", color: "#1d4ed8" },
  HIGH:     { bg: "#fef3c7", color: "#92400e" },
  CRITICAL: { bg: "#fee2e2", color: "#b91c1c" },
};

function dueDateStyle(item: TemporalItemWithRelations) {
  const d = new Date(item.dueDate);
  if (item.status === "COMPLETED") return { bg: "#f1f5f9", color: "#64748b" };
  if (isPast(d) && !isToday(d)) return { bg: "#fee2e2", color: "#b91c1c" };
  if (isToday(d)) return { bg: "#fef3c7", color: "#92400e" };
  return { bg: "#d1fae5", color: "#065f46" };
}

export default function TasksPage() {
  const [items, setItems] = useState<TemporalItemWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<FilterTab>("All");
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<TemporalItemWithRelations | null>(null);
  const [completing, setCompleting] = useState<Set<string>>(new Set());

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const [tasksRes, deadlinesRes] = await Promise.all([
        fetch("/api/items?type=TASK&limit=300"),
        fetch("/api/items?type=DEADLINE&limit=300"),
      ]);
      const tasks = tasksRes.ok ? await tasksRes.json() : [];
      const deadlines = deadlinesRes.ok ? await deadlinesRes.json() : [];
      const combined: TemporalItemWithRelations[] = [
        ...(Array.isArray(tasks) ? tasks : []),
        ...(Array.isArray(deadlines) ? deadlines : []),
      ];
      setItems(combined);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => void fetchItems());
  }, [fetchItems]);

  const grouped = useMemo(() => {
    const active = items.filter(
      (i) => i.status !== "COMPLETED" && i.status !== "ARCHIVED" && !isPast(new Date(i.dueDate))
    ).sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

    const overdue = items.filter(
      (i) => i.status !== "COMPLETED" && i.status !== "ARCHIVED" && isPast(new Date(i.dueDate)) && !isToday(new Date(i.dueDate))
    ).sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

    const todayItems = items.filter(
      (i) => i.status !== "COMPLETED" && i.status !== "ARCHIVED" && isToday(new Date(i.dueDate))
    ).sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

    const completed = items.filter((i) => i.status === "COMPLETED")
      .sort((a, b) => new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime());

    return { active: [...todayItems, ...active], overdue, completed };
  }, [items]);

  function filteredItems(): { label: string; items: TemporalItemWithRelations[]; accent?: string }[] {
    if (tab === "Active") return [{ label: "Active", items: grouped.active }];
    if (tab === "Overdue") return [{ label: "Overdue", items: grouped.overdue, accent: "var(--red)" }];
    if (tab === "Completed") return [{ label: "Completed", items: grouped.completed }];
    // All
    return [
      { label: "Overdue", items: grouped.overdue, accent: "var(--red)" },
      { label: "Active", items: grouped.active },
      { label: "Completed", items: grouped.completed },
    ];
  }

  async function handleComplete(id: string) {
    setCompleting((prev) => new Set(prev).add(id));
    try {
      const res = await fetch(`/api/items/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "COMPLETED" }),
      });
      const json = await res.json();
      if (json.item) {
        setItems((prev) => prev.map((i) => (i.id === id ? json.item : i)));
      }
    } finally {
      setCompleting((prev) => {
        const s = new Set(prev);
        s.delete(id);
        return s;
      });
    }
  }

  async function handleUnComplete(id: string) {
    const res = await fetch(`/api/items/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "ACTIVE" }),
    });
    const json = await res.json();
    if (json.item) {
      setItems((prev) => prev.map((i) => (i.id === id ? json.item : i)));
    }
  }

  async function handleDelete(id: string) {
    await fetch(`/api/items/${id}`, { method: "DELETE" });
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  async function handleCreate(data: CreateItemInput) {
    const res = await fetch("/api/items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (json.item) {
      setItems((prev) => [json.item, ...prev]);
      setShowForm(false);
    }
  }

  async function handleUpdate(data: CreateItemInput) {
    if (!editItem) return;
    const res = await fetch(`/api/items/${editItem.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (json.item) {
      setItems((prev) => prev.map((i) => (i.id === editItem.id ? json.item : i)));
      setEditItem(null);
    }
  }

  const tabs: FilterTab[] = ["All", "Active", "Overdue", "Completed"];
  const counts: Record<FilterTab, number> = {
    All: items.filter((i) => i.status !== "ARCHIVED").length,
    Active: grouped.active.length,
    Overdue: grouped.overdue.length,
    Completed: grouped.completed.length,
  };

  const sections = filteredItems();

  return (
    <>
      <style>{`
        .tk-wrap { padding: 22px 24px 40px; min-width: 0; }

        .tk-header {
          display: flex; align-items: center; justify-content: space-between;
          margin-bottom: 20px;
        }
        .tk-title { font-size: 22px; font-weight: 800; letter-spacing: -.02em; color: var(--ink); }
        .tk-sub { font-size: 14px; color: var(--mut); margin-top: 4px; }
        .tk-add-btn {
          display: inline-flex; align-items: center; gap: 7px;
          padding: 9px 18px; background: var(--indigo); border: none;
          border-radius: 10px; font-size: 13.5px; font-weight: 600;
          color: white; cursor: pointer; font-family: inherit;
          transition: background .12s;
        }
        .tk-add-btn:hover { background: var(--indigo-deep); }

        .tk-tabs {
          display: flex; gap: 4px; margin-bottom: 20px;
          background: var(--line-2); padding: 4px;
          border-radius: 12px; width: fit-content;
        }
        .tk-tab {
          padding: 7px 16px; border-radius: 9px; border: none;
          font-size: 13px; font-weight: 600; cursor: pointer;
          font-family: inherit; color: var(--mut); background: none;
          transition: all .12s; display: flex; align-items: center; gap: 6px;
        }
        .tk-tab.active { background: var(--panel); color: var(--ink); box-shadow: var(--shadow-sm); }
        .tk-tab-count {
          font-size: 11px; font-weight: 700;
          background: var(--line); color: var(--mut);
          padding: 1px 6px; border-radius: 99px; min-width: 18px; text-align: center;
        }
        .tk-tab.active .tk-tab-count { background: var(--indigo-soft); color: var(--indigo-deep); }

        .tk-section { margin-bottom: 24px; }
        .tk-section-header {
          display: flex; align-items: center; gap: 10px;
          margin-bottom: 10px;
        }
        .tk-section-title { font-size: 13px; font-weight: 700; color: var(--mut); text-transform: uppercase; letter-spacing: .04em; }
        .tk-section-count {
          font-size: 11.5px; font-weight: 700;
          background: var(--line-2); color: var(--mut-2);
          padding: 1px 7px; border-radius: 99px;
        }
        .tk-section-count.red { background: var(--red-tint); color: var(--red); }

        .tk-card {
          background: var(--panel); border: 1px solid var(--line);
          border-radius: 14px; overflow: hidden;
        }
        .tk-row {
          display: flex; align-items: center; gap: 12px;
          padding: 12px 14px;
          border-bottom: 1px solid var(--line);
          transition: background .1s;
        }
        .tk-row:last-child { border-bottom: none; }
        .tk-row:hover { background: var(--bg); }
        .tk-row.completed { opacity: .6; }
        .tk-checkbox {
          width: 18px; height: 18px; border-radius: 5px;
          border: 2px solid var(--line); background: none;
          cursor: pointer; display: grid; place-items: center;
          transition: all .12s; flex-shrink: 0;
        }
        .tk-checkbox.checked { background: var(--green); border-color: var(--green); }
        .tk-checkbox.loading { border-color: var(--indigo); animation: pulse .8s ease-in-out infinite; }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: .4; } }
        .tk-row-body { flex: 1; min-width: 0; }
        .tk-row-title {
          font-size: 13.5px; font-weight: 600; color: var(--ink);
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .tk-row-title.done { text-decoration: line-through; color: var(--mut); }
        .tk-row-meta { display: flex; align-items: center; gap: 6px; margin-top: 3px; flex-wrap: wrap; }
        .tk-badge { font-size: 11px; font-weight: 600; padding: 2px 7px; border-radius: 99px; }
        .tk-type-badge { font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 5px; text-transform: uppercase; letter-spacing: .03em; }
        .tk-row-actions {
          display: flex; align-items: center; gap: 2px;
          opacity: 0; transition: opacity .12s; flex-shrink: 0;
        }
        .tk-row:hover .tk-row-actions { opacity: 1; }
        .tk-icon-btn {
          padding: 5px; border-radius: 7px; border: none; background: none;
          cursor: pointer; color: var(--mut); display: grid; place-items: center;
          transition: all .12s;
        }
        .tk-icon-btn:hover.edit { color: var(--indigo); background: var(--indigo-soft); }
        .tk-icon-btn:hover.del { color: var(--red); background: var(--red-tint); }
        .tk-progress-wrap { margin-top: 5px; }
        .tk-progress-bar { height: 3px; background: var(--line); border-radius: 99px; overflow: hidden; margin-top: 2px; }
        .tk-progress-fill { height: 100%; border-radius: 99px; background: var(--indigo); transition: width .3s; }
        .tk-progress-label { font-size: 10.5px; color: var(--mut); }

        .tk-empty {
          text-align: center; padding: 40px 0; color: var(--mut); font-size: 13.5px;
        }
        .tk-loading {
          display: flex; align-items: center; justify-content: center;
          padding: 80px 0; color: var(--mut); font-size: 14px; gap: 10px;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      <div className="tk-wrap">
        {/* Header */}
        <div className="tk-header">
          <div>
            <div className="tk-title">Tasks</div>
            <div className="tk-sub">Manage your tasks and deadlines</div>
          </div>
          <button className="tk-add-btn" onClick={() => setShowForm(true)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Add Task
          </button>
        </div>

        {/* Tabs */}
        <div className="tk-tabs">
          {tabs.map((t) => (
            <button
              key={t}
              className={`tk-tab${tab === t ? " active" : ""}`}
              onClick={() => setTab(t)}
            >
              {t}
              <span className="tk-tab-count">{counts[t]}</span>
            </button>
          ))}
        </div>

        {loading ? (
          <div className="tk-loading">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: "spin 1s linear infinite" }}>
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
            </svg>
            Loading tasks…
          </div>
        ) : (
          <>
            {sections.map((section) => (
              section.items.length > 0 || tab !== "All" ? (
                <div key={section.label} className="tk-section">
                  <div className="tk-section-header">
                    <div className="tk-section-title">{section.label}</div>
                    <div className={`tk-section-count${section.accent ? " red" : ""}`}>
                      {section.items.length}
                    </div>
                  </div>
                  {section.items.length === 0 ? (
                    <div className="tk-empty">
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: "0 auto 10px", display: "block" }}>
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      No {section.label.toLowerCase()} items
                    </div>
                  ) : (
                    <div className="tk-card">
                      {section.items.map((item) => {
                        const isCompleted = item.status === "COMPLETED";
                        const isLoading = completing.has(item.id);
                        const dueStyle = dueDateStyle(item);
                        const pStyle = PRIORITY_STYLE[item.priority] ?? PRIORITY_STYLE.MEDIUM;
                        const completedChecklist = item.checklists.filter((c) => c.completed).length;
                        const totalChecklist = item.checklists.length;
                        const dueDate = new Date(item.dueDate);

                        return (
                          <div key={item.id} className={`tk-row${isCompleted ? " completed" : ""}`}>
                            {/* Checkbox */}
                            <button
                              className={`tk-checkbox${isCompleted ? " checked" : ""}${isLoading ? " loading" : ""}`}
                              onClick={() => isCompleted ? handleUnComplete(item.id) : handleComplete(item.id)}
                              title={isCompleted ? "Mark as active" : "Mark as complete"}
                            >
                              {isCompleted && (
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="20 6 9 17 4 12" />
                                </svg>
                              )}
                            </button>

                            {/* Body */}
                            <div className="tk-row-body">
                              <div className={`tk-row-title${isCompleted ? " done" : ""}`}>
                                {item.title}
                              </div>
                              <div className="tk-row-meta">
                                <span
                                  className="tk-badge"
                                  style={{ background: dueStyle.bg, color: dueStyle.color }}
                                >
                                  {item.allDay ? format(dueDate, "MMM d") : format(dueDate, "MMM d, h:mm a")}
                                </span>
                                <span
                                  className="tk-badge"
                                  style={{ background: pStyle.bg, color: pStyle.color }}
                                >
                                  {item.priority}
                                </span>
                                <span
                                  className="tk-type-badge"
                                  style={{
                                    background: item.type === "DEADLINE" ? "#fee2e2" : "#ede9fe",
                                    color: item.type === "DEADLINE" ? "#b91c1c" : "#6d28d9",
                                  }}
                                >
                                  {item.type}
                                </span>
                                {item.tags.map((tag) => (
                                  <span
                                    key={tag.id}
                                    style={{
                                      fontSize: "10.5px", padding: "1px 6px",
                                      borderRadius: 6, background: "var(--line-2)",
                                      color: "var(--mut-2)", fontWeight: 500,
                                    }}
                                  >
                                    {tag.name}
                                  </span>
                                ))}
                              </div>
                              {totalChecklist > 0 && (
                                <div className="tk-progress-wrap">
                                  <div className="tk-progress-label">
                                    {completedChecklist}/{totalChecklist} subtasks
                                  </div>
                                  <div className="tk-progress-bar">
                                    <div
                                      className="tk-progress-fill"
                                      style={{ width: `${(completedChecklist / totalChecklist) * 100}%` }}
                                    />
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* Actions */}
                            <div className="tk-row-actions">
                              <button
                                className="tk-icon-btn edit"
                                onClick={() => setEditItem(item)}
                                title="Edit"
                              >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                </svg>
                              </button>
                              <button
                                className="tk-icon-btn del"
                                onClick={() => handleDelete(item.id)}
                                title="Delete"
                              >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                                </svg>
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : null
            ))}

            {items.length === 0 && (
              <div className="tk-empty" style={{ paddingTop: 60 }}>
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: "0 auto 16px", display: "block" }}>
                  <rect x="3" y="3" width="18" height="18" rx="4" /><polyline points="9 11 12 14 22 4" />
                </svg>
                No tasks yet.{" "}
                <button
                  onClick={() => setShowForm(true)}
                  style={{ color: "var(--indigo)", textDecoration: "underline", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: "inherit" }}
                >
                  Add your first task
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Create modal */}
      <Modal open={showForm} onClose={() => setShowForm(false)} title="Add Task">
        <ItemForm
          onSubmit={handleCreate}
          onCancel={() => setShowForm(false)}
          googleConnected={false}
          initialData={{ type: "TASK" }}
        />
      </Modal>

      {/* Edit modal */}
      <Modal open={!!editItem} onClose={() => setEditItem(null)} title="Edit Task">
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
