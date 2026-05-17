"use client";

import { useMemo } from "react";
import { isThisWeek } from "date-fns";
import type { TemporalItemWithRelations } from "@/types";

interface TimeAllocationDonutProps {
  items: TemporalItemWithRelations[];
}

const SEGMENTS = [
  { key: "TASK",     label: "Focused Work", color: "#8b5cf6" },
  { key: "EVENT",    label: "Classes",      color: "#6366f1" },
  { key: "DEADLINE", label: "Meetings",     color: "#ef4444" },
  { key: "REMINDER", label: "Personal",     color: "#cbd5e1" },
] as const;

export default function TimeAllocationDonut({ items }: TimeAllocationDonutProps) {
  const { segments, total, totalHours } = useMemo(() => {
    const weekItems = items.filter(
      i => i.status !== "COMPLETED" && i.status !== "ARCHIVED" && isThisWeek(new Date(i.dueDate), { weekStartsOn: 1 })
    );
    const total = Math.max(weekItems.length, 1);
    const counts = SEGMENTS.map(s => ({
      ...s,
      count: weekItems.filter(i => i.type === s.key).length,
    }));
    const totalCount = counts.reduce((s, c) => s + c.count, 0) || 1;
    const segments = counts.map(c => ({
      ...c,
      pct: Math.round((c.count / totalCount) * 100),
    }));
    // Ensure pcts sum to 100
    const sum = segments.reduce((s, c) => s + c.pct, 0);
    if (sum !== 100 && segments.length > 0) segments[0].pct += 100 - sum;
    const totalHours = Math.max(weekItems.length * 2, 4); // estimate 2h per item
    return { segments, total, totalHours };
  }, [items]);

  // Build SVG donut using stroke-dasharray
  // Circle circumference = 2 * π * r (r = 15.915 gives circ ≈ 100 for easy %)
  const r = 15.915;
  const circ = 2 * Math.PI * r; // ≈ 100

  let offset = 25; // start at top (−90° = 25% offset)
  const arcs = segments.map(s => {
    const dashLen = (s.pct / 100) * 100;
    const arc = { ...s, dashLen, offset: -offset + 25 };
    offset += dashLen;
    return arc;
  });

  // If all zero (no week items), show placeholder
  const allZero = segments.every(s => s.pct === 0);
  const displaySegs = allZero
    ? [
        { ...SEGMENTS[0], pct: 56 },
        { ...SEGMENTS[1], pct: 20 },
        { ...SEGMENTS[2], pct: 12 },
        { ...SEGMENTS[3], pct: 12 },
      ]
    : segments;

  let arcOffset = 25;
  const displayArcs = displaySegs.map(s => {
    const dashLen = (s.pct / 100) * 100;
    const arc = { ...s, dashLen, arcOffset: -(arcOffset - 25) };
    arcOffset += dashLen;
    return arc;
  });

  return (
    <>
      <style>{`
        .alloc-card {
          background: var(--panel); border: 1px solid var(--line);
          border-radius: 18px; padding: 20px 18px;
          box-shadow: var(--shadow-sm);
        }
        .alloc-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
        .alloc-title { font-size: 15px; font-weight: 700; color: var(--ink); }
        .alloc-title .muted { color: var(--mut); font-weight: 500; font-size: 13px; }
        .alloc-body { display: flex; align-items: center; gap: 14px; }
        .alloc-donut { width: 118px; height: 118px; flex-shrink: 0; position: relative; }
        .alloc-center {
          position: absolute; inset: 0;
          display: flex; flex-direction: column; align-items: center; justify-content: center;
        }
        .alloc-center b { font-size: 22px; font-weight: 800; letter-spacing: -0.02em; color: var(--ink); }
        .alloc-center span { font-size: 11px; color: var(--mut); }
        .alloc-legend { display: flex; flex-direction: column; gap: 7px; flex: 1; min-width: 0; }
        .alloc-leg { display: flex; align-items: center; gap: 7px; font-size: 12px; color: var(--ink-2); white-space: nowrap; }
        .alloc-leg .sw { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
        .alloc-leg b { margin-left: auto; font-weight: 700; font-size: 12px; color: var(--ink); }
      `}</style>
      <div className="alloc-card">
        <div className="alloc-head">
          <div className="alloc-title">
            Time Allocation <span className="muted">(This Week)</span>
          </div>
        </div>
        <div className="alloc-body">
          <div className="alloc-donut">
            <svg viewBox="0 0 42 42" width="118" height="118">
              <circle cx="21" cy="21" r={r} fill="white" stroke="#f1f2f7" strokeWidth="6"/>
              {displayArcs.map((s, i) => (
                <circle
                  key={i}
                  cx="21" cy="21" r={r}
                  fill="transparent"
                  stroke={s.color}
                  strokeWidth="6"
                  strokeDasharray={`${s.dashLen} ${100 - s.dashLen}`}
                  strokeDashoffset={s.arcOffset}
                  transform="rotate(-90 21 21)"
                />
              ))}
            </svg>
            <div className="alloc-center">
              <b>{totalHours}h</b>
              <span>Total</span>
            </div>
          </div>
          <div className="alloc-legend">
            {displaySegs.map((s, i) => (
              <div key={i} className="alloc-leg">
                <span className="sw" style={{ background: s.color }} />
                {s.label}
                <b>{s.pct}%</b>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
