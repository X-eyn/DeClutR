"use client";

import { useMemo, useState, useEffect } from "react";
import { startOfWeek, addDays, differenceInMinutes, isSameDay, isToday } from "date-fns";
import type { TemporalItemWithRelations } from "@/types";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const FALLBACK_HOURS: Record<string, number> = { TASK: 2, EVENT: 1.5, DEADLINE: 1, REMINDER: 0.25 };

function shouldUseTimedRange(item: TemporalItemWithRelations, start: Date, due: Date) {
  return item.type === "EVENT" || isSameDay(start, due);
}

function itemHours(item: TemporalItemWithRelations): number {
  if (item.allDay) return 8;

  if (item.startDate) {
    const start = new Date(item.startDate);
    const due = new Date(item.dueDate);
    if (
      !Number.isNaN(start.getTime()) &&
      !Number.isNaN(due.getTime()) &&
      start < due &&
      shouldUseTimedRange(item, start, due)
    ) {
      const hours = differenceInMinutes(due, start) / 60;
      return Math.min(Math.max(hours, 0.25), 8);
    }
  }

  return FALLBACK_HOURS[item.type] ?? 1;
}

export default function WorkloadChart({ items }: { items: TemporalItemWithRelations[] }) {
  const [hovered, setHovered] = useState<number | null>(null);
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setEntered(true)));
    return () => cancelAnimationFrame(id);
  }, []);

  const bars = useMemo(() => {
    const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
    return DAYS.map((label, i) => {
      const date = addDays(weekStart, i);
      const dayItems = items.filter(
        it => it.status !== "COMPLETED" && it.status !== "ARCHIVED" && isSameDay(new Date(it.dueDate), date)
      );
      const hours = dayItems.reduce((sum, item) => sum + itemHours(item), 0);
      return { label, count: dayItems.length, hours: Math.round(hours * 10) / 10, today: isToday(date) };
    });
  }, [items]);

  const toHours = (hours: number) => hours.toFixed(1);

  const hBar = hovered !== null ? bars[hovered] : null;

  return (
    <>
      <style>{`
        .wl-card {
          background: var(--panel);
          border: 1px solid var(--line);
          border-radius: 18px;
          padding: 18px 18px 16px;
          box-shadow: var(--shadow-sm);
          transition: box-shadow 0.35s ease;
        }
        .wl-card:hover { box-shadow: 0 6px 28px rgba(0,0,0,0.08); }

        .wl-head {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
        }
        .wl-title { font-size: 15px; font-weight: 700; color: var(--ink); }
        .wl-hover-info {
          font-size: 12px;
          color: var(--indigo);
          font-weight: 600;
          transition: opacity 0.2s ease;
        }

        .wl-chart {
          display: grid;
          grid-template-columns: 22px 1fr;
          gap: 8px;
          height: 150px;
          margin-top: 4px;
        }
        .wl-y {
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          font-size: 10.5px;
          color: var(--mut-2);
          text-align: right;
          padding-bottom: 20px;
          user-select: none;
        }

        /* The plot area is the only positioned ancestor — overflow hidden keeps bars inside */
        .wl-plot {
          position: relative;
          overflow: hidden;
        }

        .wl-gridlines {
          position: absolute;
          inset: 0 0 20px 0;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          pointer-events: none;
          z-index: 0;
        }
        .wl-gridlines i { height: 1px; background: #f1f2f7; display: block; }

        .wl-bars-row {
          position: absolute;
          inset: 0 0 20px 0;
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          align-items: end;
          gap: 5px;
          padding: 0 3px;
          z-index: 1;
        }

        /* Each column is the full height of the bar area */
        .wl-bar-col {
          height: 100%;
          position: relative;
          cursor: pointer;
          display: flex;
          align-items: flex-end;
          justify-content: center;
        }

        /* Value label sits at a fixed top inside the column, never pushes bar down */
        .wl-bar-val {
          position: absolute;
          top: 2px;
          left: 0; right: 0;
          text-align: center;
          font-size: 11px;
          font-weight: 700;
          color: var(--indigo);
          pointer-events: none;
          transition: opacity 0.18s ease, transform 0.22s cubic-bezier(0.34,1.56,0.64,1);
        }

        .wl-bar {
          width: 68%;
          border-radius: 6px 6px 3px 3px;
          transition:
            height 0.65s cubic-bezier(0.34,1.56,0.64,1),
            opacity 0.22s ease,
            background 0.2s ease,
            transform 0.22s cubic-bezier(0.34,1.56,0.64,1);
          transform-origin: bottom center;
        }

        .wl-x-axis {
          position: absolute;
          bottom: 0; left: 0; right: 0;
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          gap: 5px;
          font-size: 11px;
          color: var(--mut);
          text-align: center;
          padding: 0 3px;
          z-index: 1;
        }
        .wl-x-axis span { transition: color 0.2s ease; }
        .wl-x-axis span.today { color: var(--indigo-deep); font-weight: 700; }
        .wl-x-axis span.lit   { color: var(--indigo); font-weight: 700; }
      `}</style>

      <div className="wl-card">
        <div className="wl-head">
          <div className="wl-title">Weekly Workload</div>
          <div className="wl-hover-info" style={{ opacity: hBar ? 1 : 0 }}>
            {hBar ? `${hBar.count} item${hBar.count !== 1 ? "s" : ""} | ${toHours(hBar.hours)}h` : "-"}
          </div>
        </div>

        <div className="wl-chart">
          <div className="wl-y">
            {["8h","6h","4h","2h","0h"].map(l => <span key={l}>{l}</span>)}
          </div>

          <div className="wl-plot" onMouseLeave={() => setHovered(null)}>
            <div className="wl-gridlines"><i/><i/><i/><i/><i/></div>

            <div className="wl-bars-row">
              {bars.map((b, i) => {
                const heightPct = Math.min((b.hours / 8) * 100, 100);
                const isLit    = b.today || hovered === i;
                const isDimmed = hovered !== null && hovered !== i;

                return (
                  <div
                    key={i}
                    className="wl-bar-col"
                    onMouseEnter={() => setHovered(i)}
                  >
                    {/* Label fixed at top of column, never in flow with bar */}
                    <div
                      className="wl-bar-val"
                      style={{
                        opacity: hovered === i && b.count > 0 ? 1 : 0,
                        transform: hovered === i ? "translateY(0)" : "translateY(5px)",
                      }}
                    >
                      {toHours(b.hours)}h
                    </div>

                    <div
                      className="wl-bar"
                      style={{
                        height: entered ? `${Math.max(b.count > 0 ? 8 : 2, heightPct)}%` : "0%",
                        background: isLit ? "var(--indigo)" : "var(--indigo-soft)",
                        opacity: isDimmed ? 0.28 : 1,
                        transform: hovered === i ? "scaleX(1.08)" : "scaleX(1)",
                        transition: [
                          `height 0.65s cubic-bezier(0.34,1.56,0.64,1) ${entered ? "0s" : `${i * 0.07}s`}`,
                          "opacity 0.22s ease",
                          "background 0.2s ease",
                          "transform 0.22s cubic-bezier(0.34,1.56,0.64,1)",
                        ].join(", "),
                      }}
                    />
                  </div>
                );
              })}
            </div>

            <div className="wl-x-axis">
              {bars.map((b, i) => (
                <span key={i} className={b.today ? "today" : hovered === i ? "lit" : ""}>
                  {b.label}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
