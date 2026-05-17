"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { addDays, differenceInCalendarDays, format, isValid, startOfDay } from "date-fns";
import type { TemporalItemWithRelations } from "@/types";

interface TimelineGanttProps {
  items: TemporalItemWithRelations[];
  onEdit?: (item: TemporalItemWithRelations) => void;
}

type TimelineRow = {
  id: string;
  title: string;
  endLabel: string;
  left: number;
  width: number;
  tone: TimelineTone;
};

type TimelineTone = "red" | "orange" | "blue" | "purple";

const AXIS_OFFSETS = [0, 2, 4, 6, 8, 10];
const SPAN_DAYS = 10;
const MAX_ROWS = 5;
const DEFAULT_BAR_DAYS = 3;
const MIN_BAR_WIDTH = 42;
const FOCUSED_TYPES = new Set(["DEADLINE", "TASK"]);
const PRIORITY_RANK: Record<TemporalItemWithRelations["priority"], number> = {
  CRITICAL: 0,
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3,
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function readableBar(left: number, width: number): { left: number; width: number } {
  if (width >= MIN_BAR_WIDTH) {
    return { left, width };
  }

  const targetWidth = Math.min(MIN_BAR_WIDTH, 100);
  const shiftLeft = Math.min(left, targetWidth - width);
  const adjustedLeft = Math.max(0, left - shiftLeft);

  return {
    left: adjustedLeft,
    width: Math.min(targetWidth, 100 - adjustedLeft),
  };
}

function itemTone(item: TemporalItemWithRelations): TimelineTone {
  const hasPersonalTag = item.tags.some(tag => /personal|home|life/i.test(tag.name));

  if (hasPersonalTag) return "purple";
  if (item.priority === "CRITICAL" || item.priority === "HIGH") return "red";
  if (item.priority === "LOW") return "blue";
  if (item.priority === "MEDIUM") return "orange";
  return "purple";
}

function rowRank(item: TemporalItemWithRelations): number {
  const tone = itemTone(item);

  if (tone === "red") return 0;
  if (tone === "orange") return 1;
  if (tone === "blue") return 2;
  return 3;
}

function getDueDate(item: TemporalItemWithRelations): Date | null {
  const due = startOfDay(new Date(item.dueDate));

  return isValid(due) ? due : null;
}

export default function TimelineGantt({ items, onEdit }: TimelineGanttProps) {
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);
  const [hoveredTone, setHoveredTone] = useState<TimelineTone | null>(null);
  const [entered, setEntered] = useState(false);

  const { rows, axisLabels, itemMap } = useMemo(() => {
    const today = startOfDay(new Date());

    const activeUpcoming = items
      .map(item => ({ item, due: getDueDate(item) }))
      .filter((entry): entry is { item: TemporalItemWithRelations; due: Date } =>
        entry.due !== null &&
        entry.item.status !== "COMPLETED" &&
        entry.item.status !== "ARCHIVED" &&
        differenceInCalendarDays(entry.due, today) >= 0 &&
        differenceInCalendarDays(entry.due, today) <= SPAN_DAYS + 2
      );

    const focused = activeUpcoming.filter(entry => FOCUSED_TYPES.has(entry.item.type));
    const upcoming = (focused.length > 0 ? focused : activeUpcoming)
      .sort((a, b) =>
        a.due.getTime() - b.due.getTime() ||
        PRIORITY_RANK[a.item.priority] - PRIORITY_RANK[b.item.priority] ||
        a.item.title.localeCompare(b.item.title)
      )
      .slice(0, MAX_ROWS)
      .sort((a, b) =>
        rowRank(a.item) - rowRank(b.item) ||
        a.due.getTime() - b.due.getTime() ||
        PRIORITY_RANK[a.item.priority] - PRIORITY_RANK[b.item.priority] ||
        a.item.title.localeCompare(b.item.title)
      );

    const itemMap = new Map(upcoming.map(({ item }) => [item.id, item]));
    const rows: TimelineRow[] = upcoming.map(({ item, due }) => {
      const dueOffset = clamp(differenceInCalendarDays(due, today), 0, SPAN_DAYS);
      const start = item.startDate ? startOfDay(new Date(item.startDate)) : null;
      const hasValidStart = start !== null && isValid(start);
      const rawStartOffset = hasValidStart
        ? differenceInCalendarDays(start, today)
        : dueOffset - DEFAULT_BAR_DAYS;
      const startOffset = clamp(Math.min(rawStartOffset, dueOffset), 0, SPAN_DAYS);
      const endOffset = Math.max(dueOffset, startOffset + 0.8);
      const left = (startOffset / SPAN_DAYS) * 100;
      const width = ((Math.min(endOffset, SPAN_DAYS) - startOffset) / SPAN_DAYS) * 100;
      const readable = readableBar(left, width);

      return {
        id: item.id,
        title: item.title,
        endLabel: format(due, "MMM d"),
        left: Number(readable.left.toFixed(2)),
        width: Number(readable.width.toFixed(2)),
        tone: itemTone(item),
      };
    });

    const axisLabels = AXIS_OFFSETS.map(offset => format(addDays(today, offset), "MMM d"));

    return { rows, axisLabels, itemMap };
  }, [items]);

  const activeTone = hoveredTone ?? rows.find(row => row.id === hoveredRow)?.tone ?? null;

  useEffect(() => {
    let secondFrame = 0;

    const firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(() => setEntered(true));
    });

    return () => {
      cancelAnimationFrame(firstFrame);
      cancelAnimationFrame(secondFrame);
    };
  }, []);

  const legendItems = [
    { tone: "red" as const, color: "#ef4444", light: "#fff1f2", label: "High Priority" },
    { tone: "orange" as const, color: "#f59e0b", light: "#fff7ed", label: "Medium Priority" },
    { tone: "blue" as const, color: "#3b82f6", light: "#eff6ff", label: "Low Priority" },
    { tone: "purple" as const, color: "#8b5cf6", light: "#f5f3ff", label: "Personal" },
  ];

  return (
    <>
      <style>{`
        .tl-card {
          background: var(--panel);
          border: 1px solid var(--line);
          border-radius: 18px;
          padding: 16px 18px 13px;
          box-shadow: var(--shadow-sm);
          transition: box-shadow 0.35s ease;
          overflow: hidden;
        }
        .tl-card:hover {
          box-shadow: 0 6px 28px rgba(0,0,0,0.08);
        }
        .tl-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
        .tl-title { font-size: 15px; font-weight: 700; color: var(--ink); }
        .tl-wrap {
          --timeline-pad-left: 34px;
          --timeline-pad-right: 8px;
          position: relative;
          padding-top: 2px;
        }
        .tl-axis {
          display: grid;
          grid-template-columns: repeat(6, 1fr);
          margin-left: var(--timeline-pad-left);
          margin-right: var(--timeline-pad-right);
          padding-bottom: 8px;
          color: var(--mut);
          font-size: 11px;
          font-weight: 650;
          border-bottom: 1px dashed var(--line);
        }
        .tl-axis span {
          text-align: left;
          opacity: 0;
          transform: translateY(4px);
        }
        .tl-card[data-entered="true"] .tl-axis span {
          animation: tl-axis-in 0.32s ease both;
          animation-delay: calc(var(--tl-index) * 45ms);
        }
        .tl-body {
          position: relative;
          margin-left: var(--timeline-pad-left);
          margin-right: var(--timeline-pad-right);
          padding: 6px 0 24px;
        }
        .tl-grid-lines {
          position: absolute;
          inset: 0 0 24px;
          display: grid;
          grid-template-columns: repeat(6, 1fr);
          pointer-events: none;
        }
        .tl-grid-lines i { border-left: 1px dashed rgba(148, 163, 184, 0.2); }
        .tl-grid-lines i:first-child { border-left: 0; }
        .tl-card[data-entered="true"] .tl-grid-lines i {
          animation: tl-grid-in 0.38s ease both;
          animation-delay: calc(80ms + var(--tl-index) * 55ms);
        }
        .tl-row {
          position: relative;
          height: 29px;
          margin-bottom: 5px;
        }
        .tl-pill {
          position: absolute;
          top: 3px;
          height: 24px;
          border-radius: 8px;
          border: 0;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 0 12px;
          color: var(--bar-ink);
          background: var(--bar-bg);
          box-shadow: inset 0 0 0 1px var(--bar-border), 0 8px 18px rgba(15, 23, 42, 0.08);
          font: inherit;
          font-size: 11.5px;
          font-weight: 750;
          line-height: 1;
          overflow: hidden;
          opacity: var(--tl-opacity, 1);
          clip-path: inset(0 0 0 0 round 8px);
          cursor: pointer;
          transition:
            transform 0.28s cubic-bezier(0.34,1.56,0.64,1),
            filter 0.18s ease,
            opacity 0.2s ease,
            box-shadow 0.18s ease;
        }
        .tl-card[data-entered="false"] .tl-pill {
          opacity: 0;
          clip-path: inset(0 100% 0 0 round 8px);
        }
        .tl-card[data-entered="true"] .tl-pill {
          animation: tl-pill-reveal 0.72s cubic-bezier(0.4,0,0.2,1) both;
          animation-delay: calc(90ms + var(--tl-index) * 90ms);
        }
        .tl-pill[data-active="true"] {
          filter: saturate(1.08) brightness(0.98);
          transform: translateY(-2px);
          box-shadow: inset 0 0 0 1px var(--bar-border), 0 12px 24px rgba(15, 23, 42, 0.12);
        }
        .tl-pill:focus-visible {
          outline: 2px solid color-mix(in srgb, var(--bar-ink) 55%, white);
          outline-offset: 2px;
        }
        .tl-pill:disabled {
          cursor: default;
        }
        .tl-pill:disabled:hover {
          filter: none;
          transform: none;
        }
        .tl-pill .end { font-size: 10.5px; opacity: .85; font-weight: 700; white-space: nowrap; }
        .tl-pill .name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .tl-pill[data-tone="red"] {
          --bar-bg: #fee2e2;
          --bar-ink: #991b1b;
          --bar-border: rgba(239, 68, 68, 0.22);
        }
        .tl-pill[data-tone="orange"] {
          --bar-bg: #ffedd5;
          --bar-ink: #9a3412;
          --bar-border: rgba(245, 158, 11, 0.24);
        }
        .tl-pill[data-tone="blue"] {
          --bar-bg: #dbeafe;
          --bar-ink: #1d4ed8;
          --bar-border: rgba(59, 130, 246, 0.22);
        }
        .tl-pill[data-tone="purple"] {
          --bar-bg: #ede9fe;
          --bar-ink: #6d28d9;
          --bar-border: rgba(139, 92, 246, 0.24);
        }
        .today-line {
          position: absolute;
          left: var(--timeline-pad-left);
          top: 44px;
          bottom: 22px;
          width: 0;
          border-left: 2px dashed var(--red);
          border-radius: 2px;
          z-index: 3;
          transform-origin: top;
          opacity: 0;
          transform: scaleY(0);
        }
        .tl-card[data-entered="true"] .today-line {
          animation: tl-today-line-in 0.72s cubic-bezier(0.4,0,0.2,1) 120ms both;
        }
        .today-tag {
          position: absolute;
          left: 0;
          bottom: 1px;
          transform: translateX(-50%);
          background: var(--red);
          color: white;
          font-size: 10px;
          font-weight: 800;
          line-height: 1;
          padding: 5px 8px;
          border-radius: 7px;
          box-shadow: 0 5px 10px rgba(239, 68, 68, 0.22);
          z-index: 4;
          opacity: 0;
        }
        .tl-card[data-entered="true"] .today-tag {
          animation: tl-today-tag-in 0.34s cubic-bezier(0.34,1.56,0.64,1) 260ms both;
        }
        .tl-legend {
          display: flex;
          gap: 24px;
          align-items: center;
          margin-top: 8px;
          font-size: 12px;
          color: var(--mut);
          flex-wrap: wrap;
        }
        .tl-ld {
          display: flex;
          align-items: center;
          gap: 7px;
          padding: 3px 5px;
          margin: -3px -5px;
          border-radius: 8px;
          cursor: pointer;
          user-select: none;
          opacity: var(--tl-opacity, 1);
          transform: var(--tl-legend-shift, translateX(0));
          background: var(--tl-legend-bg, transparent);
          transition:
            background 0.2s ease,
            transform 0.28s cubic-bezier(0.34,1.56,0.64,1),
            opacity 0.2s ease;
        }
        .tl-ld .sw {
          width: 9px;
          height: 9px;
          border-radius: 50%;
          transform: var(--tl-dot-scale, scale(1));
          box-shadow: var(--tl-dot-shadow, none);
          transition:
            transform 0.28s cubic-bezier(0.34,1.56,0.64,1),
            box-shadow 0.2s ease;
        }
        .tl-empty {
          text-align: center;
          padding: 36px 0;
          color: var(--mut);
          font-size: 13px;
          border-top: 1px dashed var(--line);
          border-bottom: 1px dashed var(--line);
        }
        @keyframes tl-axis-in {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes tl-grid-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes tl-pill-reveal {
          from { opacity: 0; clip-path: inset(0 100% 0 0 round 8px); }
          to { opacity: var(--tl-opacity, 1); clip-path: inset(0 0 0 0 round 8px); }
        }
        @keyframes tl-today-line-in {
          from { opacity: 0; transform: scaleY(0); }
          to { opacity: 1; transform: scaleY(1); }
        }
        @keyframes tl-today-tag-in {
          from { opacity: 0; transform: translateX(-50%) translateY(4px) scale(0.92); }
          to { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); }
        }
        @media (prefers-reduced-motion: reduce) {
          .tl-card,
          .tl-axis span,
          .tl-grid-lines i,
          .tl-pill,
          .today-line,
          .today-tag,
          .tl-ld,
          .tl-ld .sw {
            animation: none !important;
            transition: none !important;
          }
          .tl-card[data-entered="false"] .tl-pill,
          .tl-card[data-entered="false"] .tl-axis span,
          .tl-card[data-entered="true"] .tl-axis span,
          .today-line,
          .today-tag {
            opacity: 1;
            transform: none;
            clip-path: none;
          }
        }
      `}</style>
      <div className="tl-card" data-entered={entered}>
        <div className="tl-head">
          <div className="tl-title">Upcoming Deadlines Timeline</div>
        </div>

        {rows.length === 0 ? (
          <div className="tl-empty">No upcoming deadlines to display</div>
        ) : (
          <div className="tl-wrap">
            <div className="tl-axis">
              {axisLabels.map((l, i) => (
                <span key={i} style={{ "--tl-index": i } as CSSProperties}>{l}</span>
              ))}
            </div>

            <div className="today-line" aria-hidden="true" />
            <div className="tl-body">
              <div className="tl-grid-lines" aria-hidden="true">
                {axisLabels.map((label, i) => (
                  <i key={label} style={{ "--tl-index": i } as CSSProperties} />
                ))}
              </div>
              {rows.map((row, i) => {
                const isActive = hoveredRow === row.id || (hoveredTone !== null && hoveredTone === row.tone);
                const isDimmed = (hoveredRow !== null && hoveredRow !== row.id) || (hoveredTone !== null && hoveredTone !== row.tone);
                const pillStyle = {
                  left: `${row.left}%`,
                  width: `${row.width}%`,
                  "--tl-index": i,
                  "--tl-opacity": isDimmed ? 0.42 : 1,
                } as CSSProperties;

                return (
                  <div key={row.id} className="tl-row">
                    <button
                      type="button"
                      className="tl-pill"
                      data-tone={row.tone}
                      data-active={isActive}
                      style={pillStyle}
                      disabled={!onEdit}
                      onMouseEnter={() => setHoveredRow(row.id)}
                      onMouseLeave={() => setHoveredRow(null)}
                      onFocus={() => setHoveredRow(row.id)}
                      onBlur={() => setHoveredRow(null)}
                      onClick={() => { const item = itemMap.get(row.id); if (item) onEdit?.(item); }}
                      aria-label={`Edit ${row.title}, due ${row.endLabel}`}
                    >
                      <span className="name">{row.title}</span>
                      <span className="end">{row.endLabel}</span>
                    </button>
                  </div>
                );
              })}
              <div className="today-tag">Today</div>
            </div>
          </div>
        )}

        <div className="tl-legend">
          {legendItems.map(li => {
            const isActive = activeTone === li.tone;
            const isDimmed = activeTone !== null && activeTone !== li.tone;
            const legendStyle = {
              "--tl-opacity": isDimmed ? 0.4 : 1,
              "--tl-legend-shift": isActive ? "translateX(5px)" : "translateX(0)",
              "--tl-legend-bg": isActive ? li.light : "transparent",
              "--tl-dot-scale": isActive ? "scale(1.5)" : "scale(1)",
              "--tl-dot-shadow": isActive ? `0 0 0 3px ${li.light}, 0 0 0 4px ${li.color}44` : "none",
            } as CSSProperties;

            return (
              <div
                key={li.label}
                className="tl-ld"
                style={legendStyle}
                onMouseEnter={() => setHoveredTone(li.tone)}
                onMouseLeave={() => setHoveredTone(null)}
              >
                <span className="sw" style={{ background: li.color }} />
                {li.label}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
