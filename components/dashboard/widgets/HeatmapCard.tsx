"use client";

import React, { useMemo } from "react";
import { startOfWeek, addDays, isSameDay } from "date-fns";
import type { TemporalItemWithRelations } from "@/types";

interface HeatmapCardProps {
  items: TemporalItemWithRelations[];
}

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const HOUR_LABELS = ["6 AM", "9 AM", "12 PM", "3 PM", "6 PM", "9 PM"];
const PALETTE = ["#f1f2f7", "#dbe1ff", "#a5b4fc", "#6366f1", "#4338ca"];

// 28 half-hour slots: 6 AM – 8 PM (14 hours × 2)
const SLOT_COUNT = 28;
const SLOT_START_HOUR = 6; // 6 AM

export default function HeatmapCard({ items }: HeatmapCardProps) {
  const { grid, todayDow } = useMemo(() => {
    const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
    const today = new Date();
    const todayDow = ((today.getDay() + 6) % 7); // 0=Mon

    // 7 days × 28 slots
    const grid: number[][] = Array.from({ length: 7 }, (_, di) => {
      const date = addDays(weekStart, di);
      const dayItems = items.filter(
        i => i.status !== "COMPLETED" && isSameDay(new Date(i.dueDate), date)
      );
      return Array.from({ length: SLOT_COUNT }, (_, si) => {
        const slotHour = SLOT_START_HOUR + Math.floor(si / 2);
        const slotMin  = (si % 2) * 30;
        // Count items near this time slot (±30min)
        let count = 0;
        for (const item of dayItems) {
          const dt = new Date(item.dueDate);
          const h = dt.getHours();
          const m = dt.getMinutes();
          // End-of-day deadlines (23:xx) → spread across afternoon 14-18
          if (h >= 22) {
            if (slotHour >= 14 && slotHour <= 17) count += 1;
          } else {
            const itemSlot = Math.floor(((h - SLOT_START_HOUR) * 60 + m) / 30);
            if (Math.abs(itemSlot - si) <= 1) count += 1;
          }
        }
        return Math.min(count, 4);
      });
    });

    return { grid, todayDow };
  }, [items]);

  return (
    <>
      <style>{`
        .hm-card {
          background: var(--panel); border: 1px solid var(--line);
          border-radius: 18px; padding: 20px 20px 16px;
          box-shadow: var(--shadow-sm);
        }
        .hm-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; }
        .hm-title { font-size: 15px; font-weight: 700; color: var(--ink); }
        .hm-title .muted { color: var(--mut); font-weight: 500; font-size: 13px; }
        .hm-inner {
          display: grid;
          grid-template-columns: 32px repeat(28, 1fr);
          gap: 3px;
          align-items: center;
        }
        .hm-hour-row {
          grid-column: 1 / span 29;
          display: grid;
          grid-template-columns: 32px repeat(28, 1fr);
          gap: 3px;
          font-size: 10.5px;
          color: var(--mut-2);
          margin-bottom: 2px;
        }
        .hm-col-label { grid-column: span 4; text-align: left; }
        .hm-day-label { font-size: 11px; color: var(--mut); font-weight: 600; }
        .hm-day-label.today { color: var(--indigo-deep); font-weight: 700; }
        .hm-cell { aspect-ratio: 1; border-radius: 3px; min-height: 13px; }
        .hm-legend { display: flex; align-items: center; gap: 8px; margin-top: 14px; font-size: 11px; color: var(--mut); }
        .hm-scale { display: flex; gap: 3px; }
        .hm-scale span { width: 18px; height: 12px; border-radius: 3px; display: block; }
      `}</style>
      <div className="hm-card">
        <div className="hm-head">
          <div className="hm-title">
            Schedule Heatmap <span className="muted">(This Week)</span>
          </div>
        </div>

        <div className="hm-inner">
          {/* Hour header row */}
          <div className="hm-hour-row">
            <span />
            {HOUR_LABELS.map(h => (
              <span key={h} className="hm-col-label">{h}</span>
            ))}
            {/* 4 extra unlabeled cols */}
            <span className="hm-col-label" />
          </div>

          {/* Day rows */}
          {DAYS.map((day, di) => (
            <React.Fragment key={di}>
              <span className={`hm-day-label${di === todayDow ? " today" : ""}`}>
                {day}
              </span>
              {grid[di].map((val, si) => (
                <span
                  key={si}
                  className="hm-cell"
                  style={{ background: PALETTE[val] }}
                  title={`${day} ${SLOT_START_HOUR + Math.floor(si / 2)}:${(si % 2) * 30 === 0 ? "00" : "30"} — intensity ${val}`}
                />
              ))}
            </React.Fragment>
          ))}
        </div>

        <div className="hm-legend">
          <span>Free</span>
          <div className="hm-scale">
            {PALETTE.map((c, i) => (
              <span key={i} style={{ background: c }} />
            ))}
          </div>
          <span>Busy</span>
        </div>
      </div>
    </>
  );
}
