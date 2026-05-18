"use client";

import { useMemo, useState, useEffect } from "react";
import { differenceInMinutes, isSameDay, isThisWeek } from "date-fns";
import type { TemporalItemWithRelations } from "@/types";

interface Segment {
  key: string;
  label: string;
  color: string;
  light: string;
  pct: number;
  hours: number;
  count: number;
}

const SEGMENTS = [
  { key: "TASK",     label: "Focused Work", color: "#8b5cf6", light: "#f5f3ff" },
  { key: "EVENT",    label: "Classes",      color: "#6366f1", light: "#eef2ff" },
  { key: "DEADLINE", label: "Meetings",     color: "#ef4444", light: "#fff1f2" },
  { key: "REMINDER", label: "Personal",     color: "#94a3b8", light: "#f8fafc" },
];

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

export default function TimeAllocationDonut({ items }: { items: TemporalItemWithRelations[] }) {
  const [hovered, setHovered] = useState<number | null>(null);
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setEntered(true)));
    return () => cancelAnimationFrame(id);
  }, []);

  const { segments, totalHours } = useMemo(() => {
    const weekItems = items.filter(
      i =>
        i.status !== "COMPLETED" &&
        i.status !== "ARCHIVED" &&
        isThisWeek(new Date(i.dueDate), { weekStartsOn: 1 })
    );

    const hoursMap: Record<string, number> = {};
    const countMap: Record<string, number> = {};
    for (const seg of SEGMENTS) { hoursMap[seg.key] = 0; countMap[seg.key] = 0; }
    for (const item of weekItems) {
      hoursMap[item.type] = (hoursMap[item.type] ?? 0) + itemHours(item);
      countMap[item.type] = (countMap[item.type] ?? 0) + 1;
    }

    const totalH = Object.values(hoursMap).reduce((a, b) => a + b, 0);

    if (totalH === 0) {
      return {
        segments: SEGMENTS.map(s => ({
          ...s,
          pct: 0,
          hours: 0,
          count: 0,
        })) as Segment[],
        totalHours: 0,
      };
    }

    const raw = SEGMENTS.map(s => ({
      ...s,
      hours: hoursMap[s.key],
      count: countMap[s.key],
      pct: Math.round((hoursMap[s.key] / totalH) * 100),
    })) as Segment[];

    const drift = raw.reduce((a, s) => a + s.pct, 0) - 100;
    if (drift !== 0) raw[0].pct -= drift;

    return { segments: raw, totalHours: Math.round(totalH * 10) / 10 };
  }, [items]);

  // r = 15.915 → circumference ≈ 100, easy % math
  const R = 15.915;
  const arcs = segments.reduce<Array<Segment & { dashLen: number; dashOffset: number }>>((acc, segment) => {
    const dashLen = (segment.pct / 100) * 100;
    const previousLength = acc.reduce((sum, arc) => sum + arc.dashLen, 0);
    acc.push({ ...segment, dashLen, dashOffset: -previousLength });
    return acc;
  }, []);

  const hSeg = hovered !== null ? segments[hovered] : null;
  const centerVal = hSeg
    ? hSeg.hours > 0 ? `${Math.round(hSeg.hours * 10) / 10}h` : `${hSeg.pct}%`
    : `${totalHours}h`;
  const centerSub = hSeg ? hSeg.label : "Total";

  return (
    <>
      <style>{`
        .alloc-card {
          background: var(--panel);
          border: 1px solid var(--line);
          border-radius: 18px;
          padding: 20px 18px;
          box-shadow: var(--shadow-sm);
          transition: box-shadow 0.35s ease;
        }
        .alloc-card:hover {
          box-shadow: 0 6px 28px rgba(0,0,0,0.08);
        }
        .alloc-head {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
        }
        .alloc-title { font-size: 15px; font-weight: 700; color: var(--ink); }
        .alloc-title .muted { color: var(--mut); font-weight: 500; font-size: 13px; }

        .alloc-body { display: flex; align-items: center; gap: 14px; }

        .alloc-donut-wrap {
          width: 118px;
          height: 118px;
          flex-shrink: 0;
          position: relative;
        }
        .alloc-donut-wrap svg {
          display: block;
          width: 118px;
          height: 118px;
        }

        .alloc-center {
          position: absolute;
          inset: 0;
          pointer-events: none;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 1px;
        }
        .alloc-cval {
          font-size: 22px;
          font-weight: 800;
          letter-spacing: -0.03em;
          color: var(--ink);
          line-height: 1;
          transition: transform 0.28s cubic-bezier(0.34,1.56,0.64,1), color 0.2s ease;
        }
        .alloc-csub {
          font-size: 11px;
          color: var(--mut);
          line-height: 1.3;
          max-width: 68px;
          text-align: center;
          transition: opacity 0.2s ease;
        }

        .alloc-legend {
          display: flex;
          flex-direction: column;
          gap: 3px;
          flex: 1;
          min-width: 0;
        }
        .alloc-leg {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 12.5px;
          color: var(--ink-2);
          padding: 6px 8px;
          border-radius: 9px;
          cursor: pointer;
          transition:
            background 0.2s ease,
            transform 0.28s cubic-bezier(0.34,1.56,0.64,1),
            opacity 0.2s ease;
          user-select: none;
          white-space: nowrap;
        }
        .alloc-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          flex-shrink: 0;
          transition:
            transform 0.28s cubic-bezier(0.34,1.56,0.64,1),
            box-shadow 0.2s ease;
        }
        .alloc-leg b {
          margin-left: auto;
          font-weight: 700;
          font-size: 12px;
          transition: color 0.2s ease;
        }
        .alloc-seg {
          cursor: pointer;
          transition:
            stroke-width 0.22s cubic-bezier(0.34,1.56,0.64,1),
            opacity 0.22s ease;
        }
      `}</style>

      <div className="alloc-card">
        <div className="alloc-head">
          <div className="alloc-title">
            Time Allocation <span className="muted">(This Week)</span>
          </div>
        </div>

        <div className="alloc-body">
          <div className="alloc-donut-wrap" onMouseLeave={() => setHovered(null)}>
            <svg viewBox="0 0 42 42" xmlns="http://www.w3.org/2000/svg">
              {/* track */}
              <circle cx="21" cy="21" r={R} fill="none" stroke="#f1f2f7" strokeWidth="5.5" />
              {arcs.map((arc, i) => (
                <circle
                  key={i}
                  className="alloc-seg"
                  cx="21" cy="21" r={R}
                  fill="none"
                  stroke={arc.color}
                  strokeWidth={hovered === i ? 7.5 : 5.5}
                  strokeLinecap="round"
                  strokeDasharray={
                    entered && arc.dashLen > 0
                      ? `${arc.dashLen} ${100 - arc.dashLen}`
                      : "0 100"
                  }
                  strokeDashoffset={arc.dashOffset}
                  transform="rotate(-90 21 21)"
                  style={{
                    opacity: hovered !== null && hovered !== i ? 0.2 : 1,
                    transition: [
                      "stroke-width 0.22s cubic-bezier(0.34,1.56,0.64,1)",
                      "opacity 0.22s ease",
                      entered
                        ? "stroke-dasharray 0.3s ease"
                        : `stroke-dasharray 0.75s cubic-bezier(0.4,0,0.2,1) ${i * 0.13}s`,
                    ].join(", "),
                  }}
                  onMouseEnter={() => setHovered(i)}
                />
              ))}
            </svg>

            <div className="alloc-center">
              <span
                className="alloc-cval"
                style={{
                  transform: hovered !== null ? "scale(0.88)" : "scale(1)",
                  color: hSeg ? hSeg.color : "var(--ink)",
                }}
              >
                {centerVal}
              </span>
              <span className="alloc-csub">{centerSub}</span>
            </div>
          </div>

          <div className="alloc-legend">
            {segments.map((s, i) => (
              <div
                key={i}
                className="alloc-leg"
                style={{
                  opacity: hovered !== null && hovered !== i ? 0.4 : 1,
                  transform: hovered === i ? "translateX(5px)" : "translateX(0)",
                  background: hovered === i ? s.light : "transparent",
                }}
                onMouseEnter={() => setHovered(i)}
                onMouseLeave={() => setHovered(null)}
              >
                <span
                  className="alloc-dot"
                  style={{
                    background: s.color,
                    transform: hovered === i ? "scale(1.5)" : "scale(1)",
                    boxShadow: hovered === i ? `0 0 0 3px ${s.light}, 0 0 0 4px ${s.color}44` : "none",
                  }}
                />
                <span style={{ color: hovered === i ? "var(--ink)" : "var(--ink-2)" }}>
                  {s.label}
                </span>
                <b style={{ color: hovered === i ? s.color : "var(--ink)" }}>{s.pct}%</b>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
