"use client";

import Link from "next/link";
import { format, isToday } from "date-fns";
import type { TemporalItemWithRelations } from "@/types";

interface AgendaCardProps {
  items: TemporalItemWithRelations[];
  onEdit?: (item: TemporalItemWithRelations) => void;
}

// Cycle through border colors for variety
const BORDER_COLORS = ["#6366f1", "#10b981", "#8b5cf6", "#f59e0b", "#3b82f6"];

export default function AgendaCard({ items, onEdit }: AgendaCardProps) {
  const todayItems = items
    .filter(i => isToday(new Date(i.dueDate)) && i.status !== "COMPLETED" && i.status !== "ARCHIVED")
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
    .slice(0, 5);

  return (
    <>
      <style>{`
        .ag-card {
          background: var(--panel); border: 1px solid var(--line);
          border-radius: 18px; padding: 20px 20px 10px;
          box-shadow: var(--shadow-sm);
        }
        .ag-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
        .ag-card-title { font-size: 15px; font-weight: 700; color: var(--ink); }
        .ag-chip {
          font-size: 11.5px; font-weight: 600;
          background: var(--indigo-soft); color: var(--indigo-deep);
          padding: 4px 10px; border-radius: 99px;
        }
        .ag-list { display: flex; flex-direction: column; }
        .ag-item {
          display: grid; grid-template-columns: 58px 1fr;
          gap: 14px; padding: 12px 0;
          border-bottom: 1px solid var(--line-2); position: relative;
          cursor: pointer; border-radius: 6px; transition: background .12s;
        }
        .ag-item:hover { background: var(--line-2); }
        .ag-item:last-of-type { border-bottom: 0; }
        .ag-time { font-size: 12.5px; font-weight: 700; color: var(--mut); padding-top: 2px; }
        .ag-body { padding-left: 14px; }
        .ag-name { font-weight: 700; font-size: 13.5px; color: var(--ink); }
        .ag-when { font-size: 12px; color: var(--mut); margin-top: 2px; }
        .ag-empty { text-align: center; padding: 32px 0; color: var(--mut); font-size: 13px; }
        .ag-view-all {
          display: block; text-align: center; color: var(--indigo);
          font-weight: 600; font-size: 13px; padding: 10px 0 2px; cursor: pointer;
          text-decoration: none;
        }
      `}</style>
      <div className="ag-card">
        <div className="ag-head">
          <div className="ag-card-title">Today&apos;s Agenda</div>
          <span className="ag-chip">{format(new Date(), "EEEE, MMM d")}</span>
        </div>

        {todayItems.length === 0 ? (
          <div className="ag-empty">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: "0 auto 10px", display: "block" }}>
              <rect x="3" y="4" width="18" height="17" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/>
              <line x1="8" y1="2" x2="8" y2="6"/><line x1="16" y1="2" x2="16" y2="6"/>
            </svg>
            Free day ahead!
          </div>
        ) : (
          <div className="ag-list">
            {todayItems.map((item, i) => {
              const dt = new Date(item.dueDate);
              const timeLabel = item.allDay ? "All day" : format(dt, "h:mm a");
              const borderColor = BORDER_COLORS[i % BORDER_COLORS.length];
              const endLabel = item.startDate
                ? `${format(new Date(item.startDate), "h:mm a")} – ${format(dt, "h:mm a")}`
                : timeLabel;

              return (
                <div key={item.id} className="ag-item" onClick={() => onEdit?.(item)}>
                  <div className="ag-time">{timeLabel}</div>
                  <div className="ag-body" style={{ borderLeft: `3px solid ${borderColor}` }}>
                    <div className="ag-name">{item.title}</div>
                    <div className="ag-when">{endLabel}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <Link className="ag-view-all" href="/dashboard/calendar">View full calendar →</Link>
      </div>
    </>
  );
}
