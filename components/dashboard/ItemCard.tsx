"use client";

import { useState } from "react";
import { format } from "date-fns";
import { interpretTimeLeft, urgencyColor, urgencyBadgeColor } from "@/lib/time";
import type { TemporalItemWithRelations } from "@/types";

interface ItemCardProps {
  item: TemporalItemWithRelations;
  onComplete: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit: (item: TemporalItemWithRelations) => void;
}

const TYPE_LABEL: Record<string, string> = {
  DEADLINE: "Deadline", EVENT: "Event", TASK: "Task", REMINDER: "Reminder",
};

const PRIORITY_STYLE: Record<string, { background: string; color: string }> = {
  LOW:      { background: "#f1f5f9", color: "#64748b" },
  MEDIUM:   { background: "#dbeafe", color: "#1d4ed8" },
  HIGH:     { background: "#fef3c7", color: "#92400e" },
  CRITICAL: { background: "#fee2e2", color: "#b91c1c" },
};

export default function ItemCard({ item, onComplete, onDelete, onEdit }: ItemCardProps) {
  const dueDate = new Date(item.dueDate);
  const startDate = item.startDate ? new Date(item.startDate) : undefined;
  const timeLeft = interpretTimeLeft(dueDate, startDate);
  const isCompleted = item.status === "COMPLETED";
  const completedChecklist = item.checklists.filter(c => c.completed).length;
  const totalChecklist = item.checklists.length;

  return (
    <>
      <style>{`
        .ic-card {
          background: var(--panel); border: 1px solid var(--line);
          border-radius: 14px; padding: 14px;
          transition: box-shadow .15s, border-color .15s;
          position: relative;
        }
        .ic-card:hover { box-shadow: var(--shadow-md); border-color: #d8d9e3; }
        .ic-card.completed { opacity: .6; }
        .ic-top { display: flex; align-items: flex-start; gap: 10px; }
        .ic-type-pill {
          font-size: 10px; font-weight: 700; letter-spacing: .03em;
          padding: 2px 7px; border-radius: 99px; flex-shrink: 0;
          text-transform: uppercase;
        }
        .ic-body { flex: 1; min-width: 0; }
        .ic-title {
          font-size: 13.5px; font-weight: 600; color: var(--ink);
          line-height: 1.3; margin-bottom: 3px;
        }
        .ic-title.done { text-decoration: line-through; color: var(--mut); }
        .ic-desc { font-size: 11.5px; color: var(--mut); margin-bottom: 8px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
        .ic-meta { display: flex; align-items: center; flex-wrap: wrap; gap: 5px; }
        .ic-badge { font-size: 11px; font-weight: 600; padding: 2px 7px; border-radius: 99px; }
        .ic-date { font-size: 11px; color: var(--mut); }
        .ic-tag {
          font-size: 10.5px; padding: 1px 6px; border-radius: 6px;
          background: var(--line-2); color: var(--mut-2); font-weight: 500;
        }
        .ic-sync { font-size: 10.5px; color: var(--blue); display: flex; align-items: center; gap: 3px; }
        .ic-sync.tasks { color: var(--green); }
        .ic-actions {
          display: flex; align-items: center; gap: 2px;
          opacity: 0; transition: opacity .15s;
        }
        .ic-card:hover .ic-actions { opacity: 1; }
        .ic-btn {
          padding: 5px; border-radius: 7px; border: none; background: none;
          cursor: pointer; color: var(--mut); display: grid; place-items: center;
          transition: all .12s; font-family: inherit;
        }
        .ic-btn:hover.edit { color: var(--indigo); background: var(--indigo-soft); }
        .ic-btn:hover.done-btn { color: var(--green); background: var(--green-soft); }
        .ic-btn:hover.del { color: var(--red); background: var(--red-soft); }
        .ic-progress-wrap { margin-top: 8px; }
        .ic-progress-label { display: flex; justify-content: space-between; font-size: 10.5px; color: var(--mut); margin-bottom: 3px; }
        .ic-progress-bar { height: 4px; background: var(--line); border-radius: 99px; overflow: hidden; }
        .ic-progress-fill { height: 100%; border-radius: 99px; transition: width .3s ease; }
      `}</style>
      <div className={`ic-card${isCompleted ? " completed" : ""}`}>
        <div className="ic-top">
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
              <div className={`ic-title${isCompleted ? " done" : ""}`}>{item.title}</div>
              <div className="ic-actions">
                <button className="ic-btn edit" onClick={() => onEdit(item)}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                </button>
                {!isCompleted && (
                  <button className="ic-btn done-btn" onClick={() => onComplete(item.id)}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  </button>
                )}
                <button className="ic-btn del" onClick={() => onDelete(item.id)}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                  </svg>
                </button>
              </div>
            </div>
            {item.description && <div className="ic-desc">{item.description}</div>}
            <div className="ic-meta">
              <span
                className="ic-badge"
                style={{
                  background: timeLeft.urgency === "overdue" ? "#fee2e2" : timeLeft.urgency === "critical" ? "#ffedd5" : timeLeft.urgency === "high" ? "#fef3c7" : timeLeft.urgency === "medium" ? "#dbeafe" : "#d1fae5",
                  color: timeLeft.urgency === "overdue" ? "#b91c1c" : timeLeft.urgency === "critical" ? "#c2410c" : timeLeft.urgency === "high" ? "#92400e" : timeLeft.urgency === "medium" ? "#1d4ed8" : "#065f46",
                }}
              >
                {timeLeft.label}
              </span>
              <span className="ic-date">
                {item.allDay ? format(dueDate, "MMM d") : format(dueDate, "MMM d, h:mm a")}
              </span>
              <span
                className="ic-tag"
                style={PRIORITY_STYLE[item.priority]}
              >
                {item.priority}
              </span>
              {item.tags.map(tag => (
                <span key={tag.id} className="ic-tag">{tag.name}</span>
              ))}
              {item.googleCalendarEventId && (
                <span className="ic-sync">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="17" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/></svg>
                  Cal
                </span>
              )}
              {item.googleTaskId && (
                <span className="ic-sync tasks">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
                  Tasks
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Checklist progress */}
        {totalChecklist > 0 && (
          <div className="ic-progress-wrap">
            <div className="ic-progress-label">
              <span>{completedChecklist}/{totalChecklist} done</span>
              <span>{Math.round((completedChecklist / totalChecklist) * 100)}%</span>
            </div>
            <div className="ic-progress-bar">
              <div className="ic-progress-fill" style={{ width: `${(completedChecklist / totalChecklist) * 100}%`, background: "var(--indigo)" }} />
            </div>
          </div>
        )}

        {/* Time progress bar */}
        {timeLeft.percentComplete !== undefined && !isCompleted && (
          <div className="ic-progress-wrap">
            <div className="ic-progress-bar">
              <div className="ic-progress-fill" style={{ width: `${timeLeft.percentComplete}%`, background: timeLeft.urgency === "overdue" ? "var(--red)" : "var(--indigo)" }} />
            </div>
          </div>
        )}
      </div>
    </>
  );
}
