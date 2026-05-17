"use client";

import React, { useMemo, useState, useEffect, useCallback } from "react";
import { startOfWeek, addDays, isSameDay } from "date-fns";
import type { TemporalItemWithRelations } from "@/types";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const HOUR_LABELS = ["6 AM", "9 AM", "12 PM", "3 PM", "6 PM", "9 PM"];
const PALETTE = ["#f1f2f7", "#dbe1ff", "#a5b4fc", "#6366f1", "#4338ca"];
const SLOT_COUNT = 28;
const SLOT_START_HOUR = 6;

interface CellInfo { di: number; si: number; val: number }

function slotLabel(si: number) {
  const h = SLOT_START_HOUR + Math.floor(si / 2);
  const m = (si % 2) * 30;
  const suffix = h < 12 ? "AM" : "PM";
  const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${h12}:${m === 0 ? "00" : "30"} ${suffix}`;
}

export default function HeatmapCard({ items }: { items: TemporalItemWithRelations[] }) {
  const [entered, setEntered] = useState(false);
  const [hoveredCell, setHoveredCell] = useState<CellInfo | null>(null);
  const [hoveredDay, setHoveredDay] = useState<number | null>(null);

  useEffect(() => {
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setEntered(true)));
    return () => cancelAnimationFrame(id);
  }, []);

  const { grid, todayDow } = useMemo(() => {
    const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
    const today = new Date();
    const todayDow = (today.getDay() + 6) % 7;

    const grid: number[][] = Array.from({ length: 7 }, (_, di) => {
      const date = addDays(weekStart, di);
      const dayItems = items.filter(
        i => i.status !== "COMPLETED" && isSameDay(new Date(i.dueDate), date)
      );
      return Array.from({ length: SLOT_COUNT }, (_, si) => {
        const slotHour = SLOT_START_HOUR + Math.floor(si / 2);
        let count = 0;
        for (const item of dayItems) {
          const dt = new Date(item.dueDate);
          const h = dt.getHours();
          const m = dt.getMinutes();
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

  const onCellEnter = useCallback((di: number, si: number, val: number) => {
    setHoveredCell({ di, si, val });
    setHoveredDay(null);
  }, []);

  const onDayEnter = useCallback((di: number) => {
    setHoveredDay(di);
    setHoveredCell(null);
  }, []);

  const onLeave = useCallback(() => {
    setHoveredCell(null);
    setHoveredDay(null);
  }, []);

  const statusText = hoveredCell
    ? `${DAYS[hoveredCell.di]}  ·  ${slotLabel(hoveredCell.si)}  ·  ${
        hoveredCell.val === 0 ? "free" : `${hoveredCell.val} item${hoveredCell.val !== 1 ? "s" : ""}`
      }`
    : hoveredDay !== null
    ? `${DAYS[hoveredDay]}  ·  ${grid[hoveredDay].reduce((a, v) => a + (v > 0 ? 1 : 0), 0)} active slots`
    : null;

  return (
    <>
      <style>{`
        .hm-card {
          background: var(--panel);
          border: 1px solid var(--line);
          border-radius: 18px;
          padding: 20px 20px 16px;
          box-shadow: var(--shadow-sm);
          transition: box-shadow 0.35s ease;
        }
        .hm-card:hover { box-shadow: 0 6px 28px rgba(0,0,0,0.08); }

        .hm-head {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 14px;
        }
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
          user-select: none;
        }
        .hm-col-label { grid-column: span 4; text-align: left; }

        .hm-day-label {
          font-size: 11px;
          color: var(--mut);
          font-weight: 600;
          cursor: pointer;
          transition: color 0.2s ease, transform 0.22s cubic-bezier(0.34,1.56,0.64,1);
          user-select: none;
        }
        .hm-day-label.today { color: var(--indigo-deep); font-weight: 700; }
        .hm-day-label.lit   { color: var(--ink); transform: translateX(2px); }
        .hm-day-label.dim   { opacity: 0.35; }

        .hm-cell {
          aspect-ratio: 1;
          border-radius: 3px;
          min-height: 13px;
          cursor: pointer;
          transition:
            opacity 0.35s ease,
            transform 0.22s cubic-bezier(0.34,1.56,0.64,1),
            background 0.15s ease;
          transform-origin: center;
          position: relative;
        }
        .hm-cell.dim { opacity: 0.25; }
        .hm-cell.lit { transform: scale(1.45); z-index: 1; }

        .hm-status {
          height: 18px;
          margin-top: 10px;
          font-size: 11.5px;
          color: var(--indigo);
          font-weight: 600;
          transition: opacity 0.2s ease;
          letter-spacing: 0.01em;
        }

        .hm-legend {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-top: 6px;
          font-size: 11px;
          color: var(--mut);
        }
        .hm-scale { display: flex; gap: 3px; }
        .hm-scale span {
          width: 18px;
          height: 12px;
          border-radius: 3px;
          display: block;
          transition: transform 0.2s cubic-bezier(0.34,1.56,0.64,1);
        }
        .hm-scale span:hover { transform: scale(1.3); }
      `}</style>

      <div className="hm-card" onMouseLeave={onLeave}>
        <div className="hm-head">
          <div className="hm-title">
            Schedule Heatmap <span className="muted">(This Week)</span>
          </div>
        </div>

        <div className="hm-inner">
          {/* Hour header */}
          <div className="hm-hour-row">
            <span />
            {HOUR_LABELS.map(h => (
              <span key={h} className="hm-col-label">{h}</span>
            ))}
            <span className="hm-col-label" />
          </div>

          {/* Day rows */}
          {DAYS.map((day, di) => {
            const isRowHovered = hoveredDay === di;
            const isRowDimmed  = hoveredDay !== null && hoveredDay !== di;

            return (
              <React.Fragment key={di}>
                <span
                  className={[
                    "hm-day-label",
                    di === todayDow  ? "today" : "",
                    isRowHovered     ? "lit"   : "",
                    isRowDimmed      ? "dim"   : "",
                  ].join(" ").trim()}
                  onMouseEnter={() => onDayEnter(di)}
                >
                  {day}
                </span>

                {grid[di].map((val, si) => {
                  const isThisCell = hoveredCell?.di === di && hoveredCell?.si === si;
                  const isCellDimmed =
                    (hoveredCell !== null && !isThisCell) ||
                    isRowDimmed;
                  const isCellLit = isThisCell;

                  return (
                    <span
                      key={si}
                      className={[
                        "hm-cell",
                        isCellDimmed ? "dim" : "",
                        isCellLit    ? "lit" : "",
                      ].join(" ").trim()}
                      style={{
                        background: PALETTE[val],
                        opacity: entered ? undefined : 0,
                        transform: entered
                          ? (isCellLit ? "scale(1.45)" : "scale(1)")
                          : "scale(0.4)",
                        transition: [
                          `opacity ${entered ? "0.15s" : `0.4s ease ${di * 0.055}s`}`,
                          `transform ${isCellLit
                            ? "0.22s cubic-bezier(0.34,1.56,0.64,1)"
                            : entered
                              ? "0.22s cubic-bezier(0.34,1.56,0.64,1)"
                              : `0.4s cubic-bezier(0.34,1.56,0.64,1) ${di * 0.055}s`
                          }`,
                          "background 0.15s ease",
                        ].join(", "),
                      }}
                      onMouseEnter={() => onCellEnter(di, si, val)}
                    />
                  );
                })}
              </React.Fragment>
            );
          })}
        </div>

        {/* Status bar */}
        <div className="hm-status" style={{ opacity: statusText ? 1 : 0 }}>
          {statusText ?? ""}
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
