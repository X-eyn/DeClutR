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
          background: var(--panel);
          border: 1px solid var(--line);
          border-radius: 18px;
          padding: 18px 16px 14px;
          box-shadow: var(--shadow-sm);
        }

        .mc-head {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 14px;
        }
        .mc-month {
          font-size: 15px;
          font-weight: 700;
          color: var(--ink);
          letter-spacing: -0.01em;
        }
        .mc-nav { display: flex; gap: 5px; }
        .mc-nav button {
          width: 28px; height: 28px; border-radius: 8px;
          background: white; border: 1px solid var(--line);
          color: var(--mut); cursor: pointer;
          display: grid; place-items: center;
          transition: border-color 0.14s, color 0.14s, background 0.14s;
        }
        .mc-nav button:hover {
          border-color: var(--indigo); color: var(--indigo);
          background: var(--indigo-soft);
        }

        /* 7 equal columns, no gap — spacing comes from the cells themselves */
        .mc-grid {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
        }

        /* DOW header cells */
        .mc-dow {
          display: flex; align-items: center; justify-content: center;
          padding: 0 0 8px;
          font-size: 10px; font-weight: 600;
          letter-spacing: 0.06em; text-transform: uppercase;
          color: var(--mut);
        }

        /*
          Every cell — real day or padding — has the same structure:
            • a fluid circle  (scales with column width, max 32px)
            • a fixed 6px dot strip below it
          No fixed pixel widths. No absolute positioning.
        */
        .mc-cell {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 2px 0;
          row-gap: 3px;
        }

        /* Circle: fills the column, capped at 32px */
        .mc-bubble {
          width: min(100%, 32px);
          aspect-ratio: 1 / 1;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          font-size: 12.5px;
          font-weight: 500;
          color: var(--ink);
          cursor: pointer;
          transition: background 0.12s ease;
          flex-shrink: 0;
        }
        .mc-cell.dim  .mc-bubble { color: var(--mut-2); font-weight: 400; }
        .mc-cell.today .mc-bubble {
          background: var(--indigo);
          color: white; font-weight: 700;
          box-shadow: 0 2px 8px rgba(99,102,241,0.30);
        }
        .mc-cell:not(.today):not(.empty) .mc-bubble:hover { background: var(--line-2); }
        .mc-cell.empty .mc-bubble { cursor: default; }

        /* Dot strip — always 6px tall, dot centered inside */
        .mc-strip {
          height: 6px;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
        }
        .mc-dot {
          width: 4px; height: 4px;
          border-radius: 50%;
          flex-shrink: 0;
        }
      `}</style>

      <div className="mc-card">
        <div className="mc-head">
          <div className="mc-month">{format(month, "MMMM yyyy")}</div>
          <div className="mc-nav">
            <button onClick={() => setMonth(m => subMonths(m, 1))} aria-label="Previous month">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6"/>
              </svg>
            </button>
            <button onClick={() => setMonth(m => addMonths(m, 1))} aria-label="Next month">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            </button>
          </div>
        </div>

        <div className="mc-grid">
          {/* DOW header */}
          {DOW.map((d, i) => (
            <div key={`dow-${i}`} className="mc-dow">{d}</div>
          ))}

          {/* Day cells — padding and real days share identical DOM structure */}
          {cells.map((day, i) => {
            if (!day) {
              return (
                <div key={`pad-${i}`} className="mc-cell empty">
                  <div className="mc-bubble" />
                  <div className="mc-strip" />
                </div>
              );
            }
            const dot   = dotForDay(day);
            const today = isToday(day);
            const dim   = !isSameMonth(day, month);
            return (
              <div
                key={format(day, "yyyy-MM-dd")}
                className={`mc-cell${today ? " today" : ""}${dim ? " dim" : ""}`}
              >
                <div className="mc-bubble">{format(day, "d")}</div>
                <div className="mc-strip">
                  {dot && !today && <span className="mc-dot" style={{ background: dot }} />}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
