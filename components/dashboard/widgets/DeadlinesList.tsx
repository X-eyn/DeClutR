"use client";

import Link from "next/link";
import { format } from "date-fns";
import { interpretTimeLeft } from "@/lib/time";
import type { TemporalItemWithRelations } from "@/types";

interface DeadlinesListProps {
  items: TemporalItemWithRelations[];
  onEdit?: (item: TemporalItemWithRelations) => void;
}

function typeIcon(type: string) {
  switch (type) {
    case "DEADLINE":
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/>
          <path d="M14 3v6h6"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="13" y2="17"/>
        </svg>
      );
    case "EVENT":
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="17" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/>
          <line x1="8" y1="2" x2="8" y2="6"/><line x1="16" y1="2" x2="16" y2="6"/>
        </svg>
      );
    case "TASK":
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="17" rx="2.5"/>
          <path d="M8 11l3 3 5-6"/>
        </svg>
      );
    default:
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/>
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>
        </svg>
      );
  }
}

function icoStyle(item: TemporalItemWithRelations, urgency: string) {
  if (urgency === "overdue" || urgency === "critical" || item.priority === "HIGH" || item.priority === "CRITICAL") {
    return { background: "var(--red-tint)", color: "var(--red)" };
  }
  if (item.type === "EVENT") return { background: "var(--amber-soft)", color: "var(--amber)" };
  if (item.type === "TASK") return { background: "var(--indigo-soft)", color: "var(--indigo)" };
  return { background: "var(--violet-soft)", color: "var(--violet)" };
}

function badge(urgency: string, priority: string) {
  if (urgency === "overdue") return { text: "Overdue", bg: "#fee2e2", color: "#b91c1c" };
  if (priority === "CRITICAL" || priority === "HIGH") return { text: "High Priority", bg: "#fee2e2", color: "#b91c1c" };
  if (urgency === "critical" || urgency === "high") return { text: "Upcoming", bg: "#fef3c7", color: "#b45309" };
  if (priority === "MEDIUM") return { text: "Medium Priority", bg: "#fef3c7", color: "#b45309" };
  if (priority === "LOW") return { text: "Personal", bg: "#ede9fe", color: "#6d28d9" };
  return { text: "Upcoming", bg: "#fef3c7", color: "#b45309" };
}

function metaText(item: TemporalItemWithRelations, tl: ReturnType<typeof interpretTimeLeft>) {
  const due = new Date(item.dueDate);
  const h = due.getHours(), m = due.getMinutes();
  const isEndOfDay = h === 23 && m >= 58;
  if (tl.urgency === "overdue") return `Overdue · ${format(due, "MMM d")}`;
  if (tl.daysUntil === 0) return `Due today · ${format(due, "h:mm a")}`;
  if (tl.daysUntil === 1) return `Tomorrow, ${format(due, "MMM d")} · ${isEndOfDay ? "11:59 PM" : format(due, "h:mm a")}`;
  if (tl.daysUntil <= 7) return `${tl.daysUntil} days left · ${format(due, "MMM d")}${isEndOfDay ? ", 11:59 PM" : ""}`;
  return format(due, "MMM d, yyyy");
}

export default function DeadlinesList({ items, onEdit }: DeadlinesListProps) {
  const sorted = items
    .filter(i => i.status !== "COMPLETED" && i.status !== "ARCHIVED")
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
    .slice(0, 5);

  return (
    <>
      <style>{`
        .dl-card {
          background: var(--panel); border: 1px solid var(--line);
          border-radius: 18px; padding: 20px 20px 10px;
          box-shadow: var(--shadow-sm);
        }
        .dl-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
        .dl-card-title { font-size: 15px; font-weight: 700; color: var(--ink); }
        .dl-list { display: flex; flex-direction: column; }
        .dl-item {
          display: flex; align-items: center; gap: 13px;
          padding: 12px 4px; border-bottom: 1px solid var(--line-2);
          cursor: pointer; transition: background .12s; border-radius: 6px;
        }
        .dl-item:hover { background: var(--line-2); }
        .dl-item:last-of-type { border-bottom: 0; }
        .dl-ico {
          width: 38px; height: 38px; border-radius: 10px;
          display: grid; place-items: center; flex-shrink: 0;
        }
        .dl-body { flex: 1; min-width: 0; }
        .dl-title { font-weight: 700; font-size: 13.5px; color: var(--ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .dl-meta { font-size: 12px; color: var(--mut); margin-top: 2px; }
        .dl-badge {
          font-size: 11px; font-weight: 700;
          padding: 4px 10px; border-radius: 99px; flex-shrink: 0; white-space: nowrap;
        }
        .dl-empty { text-align: center; padding: 32px 0; color: var(--mut); font-size: 13px; }
        .dl-view-all {
          display: block; text-align: center; color: var(--indigo);
          font-weight: 600; font-size: 13px; padding: 10px 0 2px; cursor: pointer;
          text-decoration: none;
        }
      `}</style>
      <div className="dl-card">
        <div className="dl-head">
          <div className="dl-card-title">Upcoming Deadlines &amp; Events</div>
        </div>
        {sorted.length === 0 ? (
          <div className="dl-empty">Nothing coming up — you&apos;re all clear!</div>
        ) : (
          <div className="dl-list">
            {sorted.map(item => {
              const tl = interpretTimeLeft(new Date(item.dueDate));
              const b = badge(tl.urgency, item.priority);
              const ico = icoStyle(item, tl.urgency);
              return (
                <div key={item.id} className="dl-item" onClick={() => onEdit?.(item)}>
                  <div className="dl-ico" style={ico}>{typeIcon(item.type)}</div>
                  <div className="dl-body">
                    <div className="dl-title">{item.title}</div>
                    <div className="dl-meta">{metaText(item, tl)}</div>
                  </div>
                  <span className="dl-badge" style={{ background: b.bg, color: b.color }}>{b.text}</span>
                </div>
              );
            })}
          </div>
        )}
        <Link className="dl-view-all" href="/dashboard/tasks">View all tasks &amp; events →</Link>
      </div>
    </>
  );
}
