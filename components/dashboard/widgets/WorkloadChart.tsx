"use client";

import { useMemo } from "react";
import { startOfWeek, addDays, isSameDay, isToday, format } from "date-fns";
import type { TemporalItemWithRelations } from "@/types";

interface WorkloadChartProps {
  items: TemporalItemWithRelations[];
}

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function WorkloadChart({ items }: WorkloadChartProps) {
  const { bars } = useMemo(() => {
    const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
    const bars = DAYS.map((label, i) => {
      const date = addDays(weekStart, i);
      const count = items.filter(
        it => it.status !== "COMPLETED" && it.status !== "ARCHIVED" && isSameDay(new Date(it.dueDate), date)
      ).length;
      return { label, date, count, isToday: isToday(date) };
    });
    return { bars };
  }, [items]);

  const maxCount = Math.max(...bars.map(b => b.count), 1);
  // Scale to hours: map maxCount → 8h
  const toHours = (c: number) => (c / maxCount) * 8;
  const maxH = 8;

  const yLabels = ["8h", "6h", "4h", "2h", "0h"];
  const yPcts   = [100, 75, 50, 25, 0];

  return (
    <>
      <style>{`
        .wl-card {
          background: var(--panel); border: 1px solid var(--line);
          border-radius: 18px; padding: 18px 18px 16px;
          box-shadow: var(--shadow-sm);
        }
        .wl-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
        .wl-title { font-size: 15px; font-weight: 700; color: var(--ink); }
        .wl-bars {
          display: grid; grid-template-columns: 16px 1fr;
          gap: 10px; height: 156px; margin-top: 4px;
        }
        .wl-y { display: flex; flex-direction: column; justify-content: space-between; font-size: 10.5px; color: var(--mut-2); text-align: right; padding-bottom: 18px; }
        .wl-bars-wrap { position: relative; }
        .wl-grid-lines { position: absolute; inset: 0 0 18px 0; display: flex; flex-direction: column; justify-content: space-between; pointer-events: none; }
        .wl-grid-lines i { height: 1px; background: #f1f2f7; display: block; }
        .wl-bars-grid {
          position: absolute; inset: 0 0 18px 0;
          display: grid; grid-template-columns: repeat(7, 1fr);
          align-items: end; gap: 6px; padding: 0 2px;
        }
        .wl-bar { width: 70%; margin: 0 auto; border-radius: 6px 6px 2px 2px; background: var(--indigo-soft); position: relative; }
        .wl-bar.active { background: var(--indigo); }
        .wl-bar .val {
          position: absolute; top: -18px; left: 50%; transform: translateX(-50%);
          font-size: 11px; font-weight: 700; color: var(--ink); white-space: nowrap;
        }
        .wl-x-axis {
          position: absolute; bottom: 0; left: 0; right: 0;
          grid-column: 2;
          display: grid; grid-template-columns: repeat(7, 1fr); gap: 6px;
          font-size: 11px; color: var(--mut); text-align: center;
        }
        .wl-x-axis span.cur { color: var(--indigo-deep); font-weight: 700; }
      `}</style>
      <div className="wl-card">
        <div className="wl-head">
          <div className="wl-title">Weekly Workload</div>
        </div>
        <div className="wl-bars">
          <div className="wl-y">
            {yLabels.map(l => <span key={l}>{l}</span>)}
          </div>
          <div className="wl-bars-wrap">
            <div className="wl-grid-lines">
              <i/><i/><i/><i/><i/>
            </div>
            <div className="wl-bars-grid">
              {bars.map((b, i) => {
                const heightPct = maxCount > 0 ? (b.count / maxCount) * 100 : 0;
                const hours = toHours(b.count);
                return (
                  <div
                    key={i}
                    className={`wl-bar${b.isToday ? " active" : ""}`}
                    style={{ height: `${Math.max(4, heightPct)}%` }}
                    title={`${b.label}: ${b.count} item${b.count !== 1 ? "s" : ""}`}
                  >
                    {b.isToday && b.count > 0 && (
                      <span className="val">{hours.toFixed(1)}h</span>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="wl-x-axis">
              {bars.map((b, i) => (
                <span key={i} className={b.isToday ? "cur" : ""}>{b.label}</span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
