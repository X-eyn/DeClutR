"use client";

import { useMemo, useState } from "react";
import {
  startOfMonth, endOfMonth, eachDayOfInterval, getDay,
  format, isSameDay, isToday, addMonths, subMonths, isSameMonth,
} from "date-fns";
import { interpretTimeLeft } from "@/lib/time";
import type { TemporalItemWithRelations } from "@/types";

interface MiniCalendarProps {
  items: TemporalItemWithRelations[];
}

const DOW = ["S", "M", "T", "W", "T", "F", "S"];

const DOT_COLORS: Record<string, string> = {
  overdue:  "#ef4444",
  critical: "#ef4444",
  high:     "#f59e0b",
  medium:   "#3b82f6",
  low:      "#10b981",
  future:   "#8b5cf6",
};

export default function MiniCalendar({ items }: MiniCalendarProps) {
  const [month, setMonth] = useState(new Date());

  const cells = useMemo(() => {
    const start = startOfMonth(month);
    const end   = endOfMonth(month);
    const days  = eachDayOfInterval({ start, end });
    const firstDow = getDay(start);
    const padBefore = Array.from({ length: firstDow }, () => null as Date | null);
    const all: Array<Date | null> = [...padBefore, ...days];
    while (all.length % 7 !== 0) all.push(null);
    return all;
  }, [month]);

  function dotForDay(date: Date) {
    const dayItems = items.filter(
      i => isSameDay(new Date(i.dueDate), date) && i.status !== "COMPLETED" && i.status !== "ARCHIVED"
    );
    if (dayItems.length === 0) return null;
    const tl = interpretTimeLeft(new Date(dayItems[0].dueDate));
    return DOT_COLORS[tl.urgency] ?? "#94a3b8";
  }

  return (
    <>
      <style>{`
        .mc-card {
          background: var(--panel); border: 1px solid var(--line);
          border-radius: 18px; padding: 20px 16px;
          box-shadow: var(--shadow-sm);
        }
        .mc-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
        .mc-month { font-size: 15px; font-weight: 700; color: var(--ink); }
        .mc-nav { display: flex; gap: 6px; }
        .mc-nav button {
          width: 26px; height: 26px; border-radius: 7px;
          background: white; border: 1px solid var(--line);
          color: var(--mut); cursor: pointer;
          display: grid; place-items: center;
        }
        .mc-nav button:hover { border-color: var(--indigo); color: var(--indigo); }
        .mc-grid {
          display: grid; grid-template-columns: repeat(7, 1fr);
          gap: 2px; text-align: center; font-size: 12px;
        }
        .mc-dow { color: var(--mut); font-weight: 600; padding: 8px 0 4px; font-size: 12px; }
        .mc-day {
          aspect-ratio: 1; display: grid; place-items: center;
          color: var(--ink); font-weight: 500; cursor: pointer;
          border-radius: 999px; position: relative; font-size: 13px;
        }
        .mc-day.dim { color: var(--mut-2); font-weight: 400; }
        .mc-day.today { background: var(--indigo); color: white; font-weight: 700; }
        .mc-day:not(.today):hover { background: var(--line-2); }
        .mc-dot {
          position: absolute; bottom: 4px; left: 50%; transform: translateX(-50%);
          width: 4px; height: 4px; border-radius: 50%;
        }
        .mc-day.today .mc-dot { display: none; }
      `}</style>
      <div className="mc-card">
        <div className="mc-head">
          <div className="mc-month">{format(month, "MMMM yyyy")}</div>
          <div className="mc-nav">
            <button onClick={() => setMonth(m => subMonths(m, 1))}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6"/>
              </svg>
            </button>
            <button onClick={() => setMonth(m => addMonths(m, 1))}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            </button>
          </div>
        </div>

        <div className="mc-grid">
          {DOW.map((d, i) => <div key={i} className="mc-dow">{d}</div>)}
          {cells.map((day, i) => {
            if (!day) return <div key={i} />;
            const dot = dotForDay(day);
            const today = isToday(day);
            const dim = !isSameMonth(day, month);
            return (
              <div key={i} className={`mc-day${today ? " today" : ""}${dim ? " dim" : ""}`}>
                {format(day, "d")}
                {dot && !today && (
                  <span className="mc-dot" style={{ background: dot }} />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
