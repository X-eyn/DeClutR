"use client";

import { useMemo } from "react";
import { addDays, format, differenceInDays, startOfDay } from "date-fns";
import type { TemporalItemWithRelations } from "@/types";

interface TimelineGanttProps {
  items: TemporalItemWithRelations[];
  onEdit?: (item: TemporalItemWithRelations) => void;
}

// Map priority/type to pill color class
function pillClass(item: TemporalItemWithRelations): string {
  if (item.priority === "CRITICAL" || item.priority === "HIGH") return "p-red";
  if (item.type === "TASK") return "p-violet";
  if (item.type === "EVENT") return "p-blue";
  return "p-green";
}

export default function TimelineGantt({ items, onEdit }: TimelineGanttProps) {
  const { rows, axisLabels, itemMap } = useMemo(() => {
    const today = startOfDay(new Date());
    // 10-day window: today to today+10
    const spanDays = 10;
    const end = addDays(today, spanDays);

    const upcoming = items
      .filter(i =>
        i.status !== "COMPLETED" &&
        i.status !== "ARCHIVED" &&
        differenceInDays(new Date(i.dueDate), today) >= 0 &&
        differenceInDays(new Date(i.dueDate), today) <= spanDays + 2
      )
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
      .slice(0, 6);

    const itemMap = new Map(upcoming.map(i => [i.id, i]));
    const rows = upcoming.map(item => {
      const due = startOfDay(new Date(item.dueDate));
      const itemStart = item.startDate ? startOfDay(new Date(item.startDate)) : today;
      const startOff = Math.max(0, differenceInDays(itemStart, today));
      const endOff   = Math.min(spanDays, differenceInDays(due, today));
      const left  = (startOff / spanDays) * 100;
      const width = Math.max(2, ((endOff - startOff + 1) / spanDays) * 100);
      return {
        id: item.id,
        title: item.title,
        endLabel: format(due, "MMM d"),
        left: Math.min(left, 95),
        width: Math.min(width, 100 - Math.min(left, 95)),
        cls: pillClass(item),
      };
    });

    // 6 axis labels evenly distributed
    const axisLabels = Array.from({ length: 6 }, (_, i) =>
      format(addDays(today, Math.round((i / 5) * spanDays)), "MMM d")
    );

    return { rows, axisLabels, itemMap };
  }, [items]);

  const legendItems = [
    { color: "#ef4444", label: "High Priority" },
    { color: "#f59e0b", label: "Medium Priority" },
    { color: "#3b82f6", label: "Low Priority" },
    { color: "#8b5cf6", label: "Personal" },
  ];

  return (
    <>
      <style>{`
        .tl-card {
          background: var(--panel); border: 1px solid var(--line);
          border-radius: 18px; padding: 20px 20px 16px;
          box-shadow: var(--shadow-sm);
        }
        .tl-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; }
        .tl-title { font-size: 15px; font-weight: 700; color: var(--ink); }
        .tl-wrap { position: relative; padding-top: 6px; }
        .tl-axis {
          display: grid; grid-template-columns: repeat(6, 1fr);
          font-size: 11.5px; color: var(--mut);
          border-bottom: 1px dashed var(--line);
          padding-bottom: 8px; margin-bottom: 12px; position: relative;
        }
        .tl-axis span { text-align: left; padding-left: 4px; }
        .tl-row { position: relative; height: 30px; margin-bottom: 8px; }
        .tl-grid {
          position: absolute; inset: 0;
          display: grid; grid-template-columns: repeat(6, 1fr);
          pointer-events: none;
        }
        .tl-grid i { border-left: 1px dashed #eef0f5; }
        .tl-grid i:first-child { border-left: 0; }
        .tl-pill {
          position: absolute; height: 28px;
          border-radius: 8px;
          display: flex; align-items: center; justify-content: space-between;
          padding: 0 12px; font-size: 12.5px; font-weight: 600;
          gap: 12px; top: 1px; overflow: hidden;
          min-width: 60px; cursor: pointer;
          transition: filter .15s ease;
        }
        .tl-pill:hover { filter: brightness(0.92); }
        .tl-pill .end { font-size: 11.5px; opacity: .9; font-weight: 600; white-space: nowrap; }
        .tl-pill .name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .p-red    { background: #fee2e2; color: #b91c1c; }
        .p-violet { background: #ede9fe; color: #6d28d9; }
        .p-blue   { background: #dbeafe; color: #1d4ed8; }
        .p-green  { background: #d1fae5; color: #047857; }
        .today-line {
          position: absolute; top: -6px; bottom: 38px; width: 2px;
          background: var(--red); border-radius: 2px;
        }
        .today-tag {
          position: absolute; background: var(--red); color: white;
          font-size: 10.5px; font-weight: 700;
          padding: 2px 8px; border-radius: 6px;
          transform: translateX(-50%);
        }
        .tl-legend { display: flex; gap: 22px; align-items: center; margin-top: 14px; font-size: 12px; color: var(--mut); flex-wrap: wrap; }
        .tl-ld { display: flex; align-items: center; gap: 7px; }
        .tl-ld .sw { width: 9px; height: 9px; border-radius: 50%; }
        .tl-empty { text-align: center; padding: 36px 0; color: var(--mut); font-size: 13px; }
      `}</style>
      <div className="tl-card">
        <div className="tl-head">
          <div className="tl-title">Upcoming Deadlines Timeline</div>
        </div>

        {rows.length === 0 ? (
          <div className="tl-empty">No upcoming deadlines to display</div>
        ) : (
          <div className="tl-wrap">
            {/* Axis */}
            <div className="tl-axis">
              {axisLabels.map((l, i) => <span key={i}>{l}</span>)}
            </div>

            {/* Today tag + line */}
            <div style={{ position: "relative" }}>
              <div className="today-tag" style={{ left: "0%" }}>Today</div>
              <div className="today-line" style={{ left: "-1px", top: "-22px", height: `${rows.length * 38 + 22}px` }} />

              {rows.map((row, i) => (
                <div key={row.id} className="tl-row">
                  <div className="tl-grid">
                    <i/><i/><i/><i/><i/><i/>
                  </div>
                  <div
                    className={`tl-pill ${row.cls}`}
                    style={{ left: `${row.left}%`, width: `${row.width}%` }}
                    onClick={() => { const item = itemMap.get(row.id); if (item) onEdit?.(item); }}
                  >
                    <span className="name">{row.title}</span>
                    <span className="end">{row.endLabel}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="tl-legend">
          {legendItems.map(li => (
            <div key={li.label} className="tl-ld">
              <span className="sw" style={{ background: li.color }} />
              {li.label}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
