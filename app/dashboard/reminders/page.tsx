"use client";

import { useState, useMemo } from "react";
import { format, isToday, isPast, isThisWeek } from "date-fns";
import Modal from "@/components/ui/Modal";
import ItemForm from "@/components/dashboard/ItemForm";
import { useItems } from "@/components/dashboard/ItemsProvider";
import type { TemporalItemWithRelations, CreateItemInput } from "@/types";

interface ReminderGroup {
  label: string;
  items: TemporalItemWithRelations[];
  isOverdue?: boolean;
}

function groupReminders(items: TemporalItemWithRelations[]): ReminderGroup[] {
  const active = items.filter(
    (i) => i.status !== "ARCHIVED" && i.status !== "COMPLETED"
  );

  const overdue = active
    .filter((i) => isPast(new Date(i.dueDate)) && !isToday(new Date(i.dueDate)))
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

  const todayItems = active
    .filter((i) => isToday(new Date(i.dueDate)))
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

  const thisWeek = active
    .filter(
      (i) =>
        isThisWeek(new Date(i.dueDate), { weekStartsOn: 1 }) &&
        !isToday(new Date(i.dueDate)) &&
        !isPast(new Date(i.dueDate))
    )
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

  const later = active
    .filter(
      (i) =>
        !isThisWeek(new Date(i.dueDate), { weekStartsOn: 1 }) &&
        !isToday(new Date(i.dueDate)) &&
        !isPast(new Date(i.dueDate))
    )
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

  return [
    { label: "Overdue", items: overdue, isOverdue: true },
    { label: "Today", items: todayItems },
    { label: "This Week", items: thisWeek },
    { label: "Later", items: later },
  ];
}

export default function RemindersPage() {
  const { items: allItems, loading, createItem, updateItem, dismissItem } = useItems();
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<TemporalItemWithRelations | null>(null);
  const [dismissing, setDismissing] = useState<Set<string>>(new Set());
  const items = useMemo(
    () => allItems.filter((item) => item.type === "REMINDER"),
    [allItems]
  );

  const groups = useMemo(() => groupReminders(items), [items]);
  const totalActive = groups.reduce((sum, g) => sum + g.items.length, 0);

  async function handleDismiss(id: string) {
    setDismissing((prev) => new Set(prev).add(id));
    try {
      await dismissItem(id);
    } catch {
      // Provider rolls back the optimistic dismissal.
    } finally {
      setDismissing((prev) => {
        const s = new Set(prev);
        s.delete(id);
        return s;
      });
    }
  }

  async function handleCreate(data: CreateItemInput) {
    const item = await createItem(data);
    if (item) setShowForm(false);
  }

  async function handleUpdate(data: CreateItemInput) {
    if (!editItem) return;
    const item = await updateItem(editItem.id, data);
    if (item) setEditItem(null);
  }

  function formatReminderTime(item: TemporalItemWithRelations): string {
    const d = new Date(item.dueDate);
    if (item.allDay) return format(d, "EEEE, MMMM d");
    if (isToday(d)) return `Today at ${format(d, "h:mm a")}`;
    return format(d, "EEE, MMM d 'at' h:mm a");
  }

  return (
    <>
      <style>{`
        .rm-wrap { padding: 22px 24px 40px; min-width: 0; }

        .rm-header {
          display: flex; align-items: center; justify-content: space-between;
          margin-bottom: 24px;
        }
        .rm-title { font-size: 22px; font-weight: 800; letter-spacing: -.02em; color: var(--ink); }
        .rm-sub { font-size: 14px; color: var(--mut); margin-top: 4px; }
        .rm-add-btn {
          display: inline-flex; align-items: center; gap: 7px;
          padding: 9px 18px; background: var(--indigo); border: none;
          border-radius: 10px; font-size: 13.5px; font-weight: 600;
          color: white; cursor: pointer; font-family: inherit;
          transition: background .12s;
        }
        .rm-add-btn:hover { background: var(--indigo-deep); }

        .rm-summary {
          display: flex; gap: 12px; margin-bottom: 24px; flex-wrap: wrap;
        }
        .rm-stat-card {
          background: var(--panel); border: 1px solid var(--line);
          border-radius: 12px; padding: 14px 18px;
          flex: 1; min-width: 120px;
          box-shadow: var(--shadow-sm);
        }
        .rm-stat-num { font-size: 24px; font-weight: 800; color: var(--ink); letter-spacing: -.02em; }
        .rm-stat-num.red { color: var(--red); }
        .rm-stat-label { font-size: 12px; color: var(--mut); margin-top: 2px; font-weight: 500; }

        .rm-section { margin-bottom: 28px; }
        .rm-section-head {
          display: flex; align-items: center; gap: 10px;
          margin-bottom: 12px;
        }
        .rm-section-title {
          font-size: 12.5px; font-weight: 700; text-transform: uppercase;
          letter-spacing: .05em; color: var(--mut);
        }
        .rm-section-count {
          font-size: 11px; font-weight: 700;
          padding: 1px 7px; border-radius: 99px;
          background: var(--line-2); color: var(--mut-2);
        }
        .rm-section-count.red { background: var(--red-tint); color: var(--red); }

        .rm-empty-group {
          background: var(--panel); border: 1px solid var(--line);
          border-radius: 12px; padding: 20px;
          text-align: center; color: var(--mut-2); font-size: 13px;
        }

        .rm-card-grid { display: flex; flex-direction: column; gap: 8px; }

        .rm-card {
          background: var(--panel); border: 1.5px solid var(--line);
          border-radius: 14px; padding: 14px 16px;
          display: flex; align-items: flex-start; gap: 12px;
          transition: box-shadow .15s, border-color .15s;
          position: relative;
        }
        .rm-card:hover { box-shadow: var(--shadow-md); border-color: #d8d9e3; }
        .rm-card.overdue {
          border-color: #fecaca; background: #fff8f8;
        }
        .rm-card.overdue .rm-card-time { color: var(--red); }

        .rm-bell {
          width: 36px; height: 36px; border-radius: 10px;
          display: grid; place-items: center; flex-shrink: 0;
          background: var(--amber-soft); color: var(--amber);
        }
        .rm-bell.overdue { background: var(--red-tint); color: var(--red); }

        .rm-card-body { flex: 1; min-width: 0; }
        .rm-card-title {
          font-size: 14px; font-weight: 600; color: var(--ink);
          line-height: 1.3; margin-bottom: 4px;
        }
        .rm-card-meta { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
        .rm-card-time { font-size: 12px; color: var(--mut); font-weight: 500; }
        .rm-card-priority {
          font-size: 11px; font-weight: 600;
          padding: 2px 7px; border-radius: 99px;
        }
        .rm-card-desc {
          font-size: 12px; color: var(--mut); margin-top: 4px;
          display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
        }
        .rm-card-tags { display: flex; gap: 4px; flex-wrap: wrap; margin-top: 5px; }
        .rm-tag {
          font-size: 10.5px; padding: 1px 6px;
          border-radius: 6px; background: var(--line-2); color: var(--mut-2);
          font-weight: 500;
        }

        .rm-card-actions {
          display: flex; flex-direction: column; gap: 4px;
          align-items: flex-end; flex-shrink: 0;
        }
        .rm-dismiss-btn {
          display: inline-flex; align-items: center; gap: 5px;
          padding: 5px 10px; border-radius: 8px;
          border: 1.5px solid var(--line); background: none;
          font-size: 12px; font-weight: 600; color: var(--mut);
          cursor: pointer; font-family: inherit; transition: all .12s;
          white-space: nowrap;
        }
        .rm-dismiss-btn:hover { border-color: #d8d9e3; background: var(--line-2); color: var(--ink); }
        .rm-dismiss-btn:disabled { opacity: .5; cursor: not-allowed; }
        .rm-edit-btn {
          padding: 5px 8px; border-radius: 8px;
          border: 1.5px solid var(--line); background: none;
          font-size: 12px; font-weight: 600; color: var(--mut);
          cursor: pointer; font-family: inherit; transition: all .12s;
          display: flex; align-items: center; gap: 4px;
        }
        .rm-edit-btn:hover { border-color: var(--indigo); color: var(--indigo); background: var(--indigo-soft); }

        .rm-empty-state {
          text-align: center; padding: 72px 0;
          color: var(--mut); font-size: 14px;
        }
        .rm-loading {
          display: flex; align-items: center; justify-content: center;
          padding: 80px 0; color: var(--mut); font-size: 14px; gap: 10px;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      <div className="rm-wrap">
        {/* Header */}
        <div className="rm-header">
          <div>
            <div className="rm-title">Reminders</div>
            <div className="rm-sub">Stay on top of your upcoming reminders</div>
          </div>
          <button className="rm-add-btn" onClick={() => setShowForm(true)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Add Reminder
          </button>
        </div>

        {loading ? (
          <div className="rm-loading">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: "spin 1s linear infinite" }}>
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
            </svg>
            Loading reminders…
          </div>
        ) : items.length === 0 ? (
          <div className="rm-empty-state">
            <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: "0 auto 16px", display: "block" }}>
              <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
              <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
            </svg>
            No reminders yet.{" "}
            <button
              onClick={() => setShowForm(true)}
              style={{ color: "var(--indigo)", textDecoration: "underline", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: "inherit" }}
            >
              Create your first reminder
            </button>
          </div>
        ) : (
          <>
            {/* Summary stats */}
            <div className="rm-summary">
              <div className="rm-stat-card">
                <div className="rm-stat-num">{totalActive}</div>
                <div className="rm-stat-label">Active reminders</div>
              </div>
              {groups[0].items.length > 0 && (
                <div className="rm-stat-card">
                  <div className="rm-stat-num red">{groups[0].items.length}</div>
                  <div className="rm-stat-label">Overdue</div>
                </div>
              )}
              <div className="rm-stat-card">
                <div className="rm-stat-num">{groups[1].items.length}</div>
                <div className="rm-stat-label">Due today</div>
              </div>
              <div className="rm-stat-card">
                <div className="rm-stat-num">{groups[2].items.length}</div>
                <div className="rm-stat-label">This week</div>
              </div>
            </div>

            {/* Groups */}
            {groups.map((group) => (
              <div key={group.label} className="rm-section">
                <div className="rm-section-head">
                  <div className="rm-section-title">{group.label}</div>
                  <div className={`rm-section-count${group.isOverdue ? " red" : ""}`}>
                    {group.items.length}
                  </div>
                </div>

                {group.items.length === 0 ? (
                  <div className="rm-empty-group">
                    {group.isOverdue
                      ? "No overdue reminders"
                      : `No reminders for ${group.label.toLowerCase()}`}
                  </div>
                ) : (
                  <div className="rm-card-grid">
                    {group.items.map((item) => {
                      const overdue = group.isOverdue || false;
                      const isDismissing = dismissing.has(item.id);
                      const pStyle =
                        item.priority === "CRITICAL"
                          ? { bg: "#fee2e2", color: "#b91c1c" }
                          : item.priority === "HIGH"
                          ? { bg: "#fef3c7", color: "#92400e" }
                          : item.priority === "MEDIUM"
                          ? { bg: "#dbeafe", color: "#1d4ed8" }
                          : { bg: "#f1f5f9", color: "#64748b" };

                      return (
                        <div key={item.id} className={`rm-card${overdue ? " overdue" : ""}`}>
                          {/* Bell icon */}
                          <div className={`rm-bell${overdue ? " overdue" : ""}`}>
                            {overdue ? (
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
                                <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
                                <line x1="12" y1="2" x2="12" y2="4" />
                              </svg>
                            ) : (
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
                                <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
                              </svg>
                            )}
                          </div>

                          {/* Body */}
                          <div className="rm-card-body">
                            <div className="rm-card-title">{item.title}</div>
                            <div className="rm-card-meta">
                              <span className="rm-card-time">{formatReminderTime(item)}</span>
                              <span
                                className="rm-card-priority"
                                style={{ background: pStyle.bg, color: pStyle.color }}
                              >
                                {item.priority}
                              </span>
                            </div>
                            {item.description && (
                              <div className="rm-card-desc">{item.description}</div>
                            )}
                            {item.tags.length > 0 && (
                              <div className="rm-card-tags">
                                {item.tags.map((tag) => (
                                  <span key={tag.id} className="rm-tag">{tag.name}</span>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Actions */}
                          <div className="rm-card-actions">
                            <button
                              className="rm-dismiss-btn"
                              onClick={() => handleDismiss(item.id)}
                              disabled={isDismissing}
                              title="Dismiss reminder"
                            >
                              {isDismissing ? (
                                "Dismissing…"
                              ) : (
                                <>
                                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                                  </svg>
                                  Dismiss
                                </>
                              )}
                            </button>
                            <button
                              className="rm-edit-btn"
                              onClick={() => setEditItem(item)}
                              title="Edit reminder"
                            >
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                              </svg>
                              Edit
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </>
        )}
      </div>

      {/* Create modal */}
      <Modal open={showForm} onClose={() => setShowForm(false)} title="Add Reminder">
        <ItemForm
          onSubmit={handleCreate}
          onCancel={() => setShowForm(false)}
          googleConnected={false}
          initialData={{ type: "REMINDER" }}
        />
      </Modal>

      {/* Edit modal */}
      <Modal open={!!editItem} onClose={() => setEditItem(null)} title="Edit Reminder">
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
