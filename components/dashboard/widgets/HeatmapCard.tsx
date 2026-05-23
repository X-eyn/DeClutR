"use client";

import React, { useMemo, useState, useEffect, useCallback } from "react";
import { addDays, format, isSameDay, startOfDay, startOfWeek } from "date-fns";
import type { TemporalItemWithRelations } from "@/types";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const PALETTE = ["#f4f7fb", "#dce6ff", "#a5b4fc", "#6366f1", "#312e81"];
const SLOT_COUNT = 24;
const SLOT_MINUTES = 60;
const DAY_MINUTES = 24 * 60;

const PRIORITY_RANK: Record<string, number> = { LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 };

const TIME_BLOCKS = [
  { start: 0,  end: 6,  label: "Night",    color: "rgba(148,163,184,0.04)" },
  { start: 6,  end: 12, label: "Morning",  color: "rgba(251,191,36,0.04)" },
  { start: 12, end: 18, label: "Afternoon",color: "rgba(99,102,241,0.04)" },
  { start: 18, end: 24, label: "Evening",  color: "rgba(168,85,247,0.04)" },
];

type ItemWindow = {
  item: TemporalItemWithRelations;
  startMin: number;
  endMin: number;
  label: string;
};

type HeatmapCell = {
  di: number;
  si: number;
  date: Date;
  startMin: number;
  endMin: number;
  label: string;
  items: ItemWindow[];
  intensity: number;
};

interface HeatmapCardProps {
  items: TemporalItemWithRelations[];
  onEdit?: (item: TemporalItemWithRelations) => void;
}

function toMinutes(date: Date) {
  return date.getHours() * 60 + date.getMinutes();
}

function clampMinutes(value: number) {
  return Math.max(0, Math.min(DAY_MINUTES, value));
}

function hourLabel(minutes: number) {
  if (minutes >= DAY_MINUTES) return "12 AM";
  const hour = Math.floor(minutes / 60);
  if (hour === 0) return "12 AM";
  if (hour < 12) return `${hour} AM`;
  if (hour === 12) return "12 PM";
  return `${hour - 12} PM`;
}

function slotLabel(startMin: number, endMin: number) {
  return `${hourLabel(startMin)}-${hourLabel(endMin)}`;
}

function formatItemTime(item: TemporalItemWithRelations, window: Pick<ItemWindow, "startMin" | "endMin" | "label">) {
  if (item.allDay) return "All day";
  if (item.startDate) {
    const start = new Date(item.startDate);
    const due = new Date(item.dueDate);
    if (!Number.isNaN(start.getTime()) && !Number.isNaN(due.getTime()) && start < due && shouldUseTimedRange(item, start, due)) {
      return `${format(start, "h:mm a")} - ${format(due, "h:mm a")}`;
    }
  }
  return window.label;
}

function shouldUseTimedRange(item: TemporalItemWithRelations, start: Date, due: Date) {
  return item.type === "EVENT" || isSameDay(start, due);
}

function getItemWindowForDay(item: TemporalItemWithRelations, day: Date): ItemWindow | null {
  const due = new Date(item.dueDate);
  if (Number.isNaN(due.getTime())) return null;

  const dayStart = startOfDay(day);
  const dayEnd = addDays(dayStart, 1);

  if (item.allDay) {
    const start = item.startDate ? new Date(item.startDate) : null;
    const spansDay =
      start && !Number.isNaN(start.getTime()) && start < due
        ? due > dayStart && start < dayEnd
        : isSameDay(due, day);

    if (!spansDay) return null;

    return {
      item,
      startMin: 0,
      endMin: DAY_MINUTES,
      label: "All day",
    };
  }

  if (item.startDate) {
    const start = new Date(item.startDate);
    if (
      !Number.isNaN(start.getTime()) &&
      start < due &&
      due > dayStart &&
      start < dayEnd &&
      shouldUseTimedRange(item, start, due)
    ) {
      const startMin = clampMinutes(isSameDay(start, day) ? toMinutes(start) : 0);
      const endMin = clampMinutes(isSameDay(due, day) ? toMinutes(due) : DAY_MINUTES);
      if (endMin > startMin) {
        return {
          item,
          startMin,
          endMin,
          label: `${format(start, "h:mm a")} - ${format(due, "h:mm a")}`,
        };
      }
    }
  }

  if (!isSameDay(due, day)) return null;

  const dueMin = clampMinutes(toMinutes(due));
  const startMin = Math.min(Math.floor(dueMin / SLOT_MINUTES) * SLOT_MINUTES, DAY_MINUTES - SLOT_MINUTES);

  return {
    item,
    startMin,
    endMin: startMin + SLOT_MINUTES,
    label: `Due ${format(due, "h:mm a")}`,
  };
}

function overlapsSlot(window: ItemWindow, slotStart: number, slotEnd: number) {
  return slotStart < window.endMin && slotEnd > window.startMin;
}

function plural(count: number, singular: string) {
  return `${count} ${singular}${count === 1 ? "" : "s"}`;
}

function priorityTone(priority: TemporalItemWithRelations["priority"]) {
  if (priority === "CRITICAL") return "critical";
  if (priority === "HIGH") return "high";
  if (priority === "LOW") return "low";
  return "medium";
}

export default function HeatmapCard({ items, onEdit }: HeatmapCardProps) {
  const [entered, setEntered] = useState(false);
  const [hoveredCell, setHoveredCell] = useState<HeatmapCell | null>(null);
  const [hoveredDay, setHoveredDay] = useState<number | null>(null);
  const [selectedCell, setSelectedCell] = useState<HeatmapCell | null>(null);
  const [priorityFilter, setPriorityFilter] = useState<string | null>(null);

  useEffect(() => {
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setEntered(true)));
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setSelectedCell(null);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const { grid, todayDow, weekItems, topPriorityCell } = useMemo(() => {
    const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
    const todayDow = (new Date().getDay() + 6) % 7;
    const baseItems = items.filter(item => item.status !== "COMPLETED" && item.status !== "ARCHIVED");
    const activeItems = priorityFilter
      ? baseItems.filter(item => item.priority === priorityFilter)
      : baseItems;
    const represented = new Map<string, TemporalItemWithRelations>();

    const grid: HeatmapCell[][] = DAYS.map((_, di) => {
      const date = addDays(weekStart, di);

      return Array.from({ length: SLOT_COUNT }, (_, si) => {
        const startMin = si * SLOT_MINUTES;
        const endMin = startMin + SLOT_MINUTES;
        const slotItems = activeItems
          .map(item => getItemWindowForDay(item, date))
          .filter((entry): entry is ItemWindow => entry !== null && overlapsSlot(entry, startMin, endMin));

        for (const entry of slotItems) represented.set(entry.item.id, entry.item);

        let intensity = 0;
        if (slotItems.length > 0) {
          intensity = slotItems.reduce((max, entry) => Math.max(max, PRIORITY_RANK[entry.item.priority] ?? 2), 0);
        }

        return {
          di,
          si,
          date,
          startMin,
          endMin,
          label: slotLabel(startMin, endMin),
          items: slotItems,
          intensity,
        };
      });
    });

    const topPriorityCell = grid
      .flat()
      .reduce<HeatmapCell | null>((best, cell) => {
        if (cell.intensity === 0) return best;
        if (!best || cell.intensity > best.intensity) return cell;
        if (cell.intensity === best.intensity && cell.date < best.date) return cell;
        return best;
      }, null);

    return { grid, todayDow, weekItems: Array.from(represented.values()), topPriorityCell };
  }, [items, priorityFilter]);

  const onCellEnter = useCallback((cell: HeatmapCell) => {
    setHoveredCell(cell);
    setHoveredDay(null);
  }, []);

  const onDayEnter = useCallback((di: number) => {
    setHoveredDay(di);
    setHoveredCell(null);
  }, []);

  const clearGridFocus = useCallback(() => {
    setHoveredCell(null);
    setHoveredDay(null);
  }, []);

  const openSlot = useCallback((cell: HeatmapCell) => {
    if (cell.items.length === 0) {
      setSelectedCell(null);
      return;
    }
    setSelectedCell(cell);
  }, []);

  const statusText = hoveredCell
    ? `${format(hoveredCell.date, "EEE, MMM d")}  |  ${hoveredCell.label}  |  ${
        hoveredCell.items.length === 0 ? "free" : plural(hoveredCell.items.length, "item")
      }`
    : hoveredDay !== null
      ? `${format(grid[hoveredDay][0].date, "EEEE, MMM d")}  |  ${plural(
          new Set(grid[hoveredDay].flatMap(cell => cell.items.map(entry => entry.item.id))).size,
          "item"
        )}`
      : weekItems.length > 0
        ? `${plural(weekItems.length, "active item")} this week`
        : "No active scheduled items this week";

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
          position: relative;
          overflow: hidden;
        }
        .hm-card:hover { box-shadow: 0 6px 28px rgba(0,0,0,0.08); }

        .hm-head {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 12px;
          margin-bottom: 12px;
        }
        .hm-title { font-size: 15px; font-weight: 700; color: var(--ink); }
        .hm-title .muted { color: var(--mut); font-weight: 500; font-size: 13px; }
        .hm-summary {
          font-size: 11.5px;
          color: var(--mut);
          font-weight: 600;
          white-space: nowrap;
          padding-top: 2px;
        }

        .hm-grid {
          display: grid;
          grid-template-columns: 34px repeat(24, minmax(0, 1fr));
          gap: 2px;
          align-items: center;
        }
        .hm-hour-row {
          grid-column: 1 / -1;
          display: grid;
          grid-template-columns: 34px repeat(24, minmax(0, 1fr));
          gap: 2px;
          font-size: 10px;
          color: var(--mut-2);
          margin-bottom: 2px;
          user-select: none;
        }
        .hm-hour {
          min-width: 0;
          overflow: visible;
          white-space: nowrap;
          text-align: center;
          padding-bottom: 1px;
        }
        .hm-hour.major {
          font-weight: 700;
          color: var(--mut);
          font-size: 10.5px;
        }
        .hm-hour.blank { color: transparent; }

        .hm-time-block {
          grid-column: 2 / -1;
          display: grid;
          grid-template-columns: repeat(24, minmax(0, 1fr));
          gap: 2px;
          position: absolute;
          inset: 0;
          pointer-events: none;
          z-index: 0;
        }
        .hm-time-block-seg {
          border-radius: 4px;
          opacity: 0.38;
        }
        .hm-grid-wrap {
          position: relative;
          overflow: hidden;
        }

        .hm-day-label {
          font-size: 11px;
          color: var(--mut);
          font-weight: 650;
          cursor: default;
          transition: color 0.2s ease, opacity 0.22s ease, transform 0.22s cubic-bezier(0.34,1.56,0.64,1);
          user-select: none;
        }
        .hm-day-label.today { color: var(--indigo-deep); font-weight: 800; }
        .hm-day-label.lit { color: var(--ink); transform: translateX(2px); }
        .hm-day-label.dim { opacity: 0.35; }

        .hm-cell {
          appearance: none;
          border: 0;
          padding: 0;
          width: 100%;
          aspect-ratio: 1.25;
          min-height: 10px;
          border-radius: 4px;
          cursor: default;
          transition:
            opacity 0.25s ease,
            transform 0.22s cubic-bezier(0.34,1.56,0.64,1),
            box-shadow 0.2s ease,
            background 0.16s ease;
          transform-origin: center;
          position: relative;
          background-clip: padding-box;
          isolation: isolate;
        }
        .hm-cell::after {
          content: "";
          position: absolute;
          inset: 0;
          border-radius: inherit;
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.88);
          opacity: 0.95;
          pointer-events: none;
        }
        .hm-cell.empty::before {
          content: "";
          position: absolute;
          inset: 0;
          border-radius: inherit;
          background: linear-gradient(180deg, rgba(255,255,255,0.42), rgba(255,255,255,0.06));
          opacity: 0.92;
          pointer-events: none;
        }
        .hm-cell.filled {
          cursor: pointer;
          box-shadow: 0 1px 4px rgba(99,102,241,0.1);
        }
        .hm-cell.filled:hover,
        .hm-cell.filled:focus-visible {
          outline: none;
          transform: scale(1.34);
          z-index: 2;
          box-shadow: 0 8px 18px rgba(79,70,229,0.22), inset 0 0 0 1px rgba(255,255,255,0.62);
        }
        .hm-cell.selected {
          transform: scale(1.22);
          z-index: 2;
          box-shadow: 0 0 0 2px white, 0 0 0 4px rgba(79,70,229,0.42);
        }
        .hm-cell.dim { opacity: 0.22; }
        .hm-cell.empty:hover {
          box-shadow: 0 0 0 1px rgba(203,213,225,0.24);
        }

        .hm-status {
          min-height: 18px;
          margin-top: 10px;
          font-size: 11.5px;
          color: var(--indigo);
          font-weight: 650;
          letter-spacing: 0.01em;
          transition: color 0.2s ease;
        }

        .hm-time-blocks { display: flex; gap: 12px; margin-top: 8px; font-size: 10.5px; color: var(--mut-2); }
        .hm-time-blocks span { opacity: 0.5; transition: opacity 0.2s ease; }
        .hm-time-blocks span:hover { opacity: 1; }

        .hm-legend {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-top: 6px;
          font-size: 11px;
          color: var(--mut);
        }
        .hm-scale { display: flex; gap: 3px; align-items: center; }
        .hm-scale-item {
          width: 18px;
          height: 12px;
          border-radius: 3px;
          display: block;
          cursor: pointer;
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.75);
          transition: transform 0.22s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.2s ease, opacity 0.2s ease;
        }
        .hm-scale-item:hover { transform: scale(1.35); box-shadow: 0 2px 8px rgba(0,0,0,0.15); }
        .hm-scale-item.active {
          transform: translateY(-1px) scale(1.18);
          box-shadow:
            0 0 0 1px rgba(148,163,184,0.32),
            0 6px 14px rgba(79,70,229,0.14),
            inset 0 1px 0 rgba(255,255,255,0.8);
          border-radius: 3px;
        }
        .hm-scale-item.dim { opacity: 0.3; }

        .hm-slot-modal {
          position: absolute;
          top: 54px;
          right: 16px;
          width: min(320px, calc(100% - 32px));
          max-height: calc(100% - 76px);
          overflow: auto;
          background: rgba(255,255,255,0.96);
          border: 1px solid rgba(226,232,240,0.95);
          border-radius: 14px;
          box-shadow: 0 18px 46px rgba(15,23,42,0.16);
          padding: 12px;
          z-index: 8;
          animation: hm-modal-in 0.22s cubic-bezier(0.34,1.56,0.64,1);
          backdrop-filter: blur(12px);
        }
        @keyframes hm-modal-in {
          from { opacity: 0; transform: translateY(8px) scale(0.96); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .hm-slot-head {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 10px;
          margin-bottom: 10px;
        }
        .hm-slot-kicker {
          color: var(--mut);
          font-size: 11px;
          font-weight: 650;
        }
        .hm-slot-title {
          color: var(--ink);
          font-size: 14px;
          font-weight: 800;
          margin-top: 2px;
        }
        .hm-close {
          appearance: none;
          border: 0;
          background: var(--line-2);
          color: var(--mut);
          width: 26px;
          height: 26px;
          border-radius: 8px;
          cursor: pointer;
          font-weight: 800;
          line-height: 1;
          transition: background 0.2s ease, color 0.2s ease, transform 0.2s cubic-bezier(0.34,1.56,0.64,1);
        }
        .hm-close:hover { background: var(--indigo-soft); color: var(--indigo); transform: scale(1.06); }
        .hm-slot-list { display: flex; flex-direction: column; gap: 8px; }
        .hm-slot-item {
          appearance: none;
          border: 1px solid var(--line);
          background: white;
          border-radius: 10px;
          padding: 9px 10px;
          text-align: left;
          cursor: pointer;
          transition: border-color 0.2s ease, box-shadow 0.22s ease, transform 0.22s cubic-bezier(0.34,1.56,0.64,1);
        }
        .hm-slot-item:hover {
          border-color: rgba(99,102,241,0.38);
          box-shadow: 0 8px 18px rgba(79,70,229,0.1);
          transform: translateY(-1px);
        }
        .hm-slot-item-title {
          color: var(--ink);
          font-size: 13px;
          font-weight: 750;
          line-height: 1.25;
        }
        .hm-slot-item-meta {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 6px;
          color: var(--mut);
          font-size: 11.5px;
          margin-top: 6px;
        }
        .hm-pill {
          border-radius: 999px;
          padding: 2px 7px;
          font-size: 10.5px;
          font-weight: 800;
          letter-spacing: 0.02em;
        }
        .hm-pill.critical, .hm-pill.high { background: #fee2e2; color: #b91c1c; }
        .hm-pill.medium { background: #fef3c7; color: #92400e; }
        .hm-pill.low { background: #dcfce7; color: #166534; }

        @media (max-width: 760px) {
          .hm-card { padding: 18px 16px 15px; }
          .hm-head { flex-direction: column; align-items: flex-start; gap: 4px; }
          .hm-summary { white-space: normal; }
          .hm-grid, .hm-hour-row { grid-template-columns: 30px repeat(24, minmax(8px, 1fr)); gap: 2px; }
          .hm-hour { font-size: 8.5px; }
          .hm-cell { min-height: 9px; border-radius: 3px; }
        }
      `}</style>

      <div className="hm-card">
        <div className="hm-head">
          <div className="hm-title">
            Schedule Heatmap <span className="muted">(This Week)</span>
          </div>
          <div className="hm-summary">
            {topPriorityCell && topPriorityCell.intensity > 0
              ? `Most Critical: ${format(topPriorityCell.date, "EEE MMM d")} — ${topPriorityCell.label}`
              : "All clear this week"}
          </div>
        </div>

        <div className="hm-grid-wrap">
          <div className="hm-time-block">
            {TIME_BLOCKS.map((block, bi) => (
              <div
                key={bi}
                className="hm-time-block-seg"
                style={{
                  gridColumn: `${block.start + 1} / ${block.end + 1}`,
                  background: block.color,
                }}
              />
            ))}
          </div>
          <div className="hm-grid" onMouseLeave={clearGridFocus}>
          <div className="hm-hour-row">
            <span />
            {Array.from({ length: SLOT_COUNT }, (_, si) => {
              const showLabel = si % 3 === 0;
              const isMajor = si === 0 || si === 12;
              return (
                <span key={si} className={`hm-hour${showLabel ? isMajor ? " major" : "" : " blank"}`}>
                  {showLabel ? hourLabel(si * SLOT_MINUTES) : "."}
                </span>
              );
            })}
          </div>

          {DAYS.map((day, di) => {
            const isRowHovered = hoveredDay === di;
            const isRowDimmed = hoveredDay !== null && hoveredDay !== di;

            return (
              <React.Fragment key={di}>
                <span
                  className={[
                    "hm-day-label",
                    di === todayDow ? "today" : "",
                    isRowHovered ? "lit" : "",
                    isRowDimmed ? "dim" : "",
                  ].join(" ").trim()}
                  onMouseEnter={() => onDayEnter(di)}
                >
                  {day}
                </span>

                {grid[di].map(cell => {
                  const isThisCell = hoveredCell?.di === cell.di && hoveredCell?.si === cell.si;
                  const isSelected = selectedCell?.di === cell.di && selectedCell?.si === cell.si;
                  const isCellDimmed =
                    (hoveredCell !== null && !isThisCell) ||
                    isRowDimmed;
                  const filled = cell.items.length > 0;

                  return (
                    <button
                      key={cell.si}
                      type="button"
                      className={[
                        "hm-cell",
                        filled ? "filled" : "empty",
                        isCellDimmed ? "dim" : "",
                        isSelected ? "selected" : "",
                      ].join(" ").trim()}
                      style={{
                        background: PALETTE[cell.intensity],
                        opacity: entered ? undefined : 0,
                        transform: entered
                          ? isThisCell && filled
                            ? "scale(1.34)"
                            : isSelected
                            ? "scale(1.22)"
                            : "scale(1)"
                          : "scale(0.45)",
                        transition: [
                          `opacity ${entered ? "0.15s" : `0.4s ease ${di * 0.045 + cell.si * 0.004}s`}`,
                          `transform ${entered
                            ? "0.22s cubic-bezier(0.34,1.56,0.64,1)"
                            : `0.4s cubic-bezier(0.34,1.56,0.64,1) ${di * 0.045 + cell.si * 0.004}s`
                          }`,
                          "box-shadow 0.2s ease",
                          "background 0.16s ease",
                        ].join(", "),
                      }}
                      aria-label={`${format(cell.date, "EEEE, MMM d")}, ${cell.label}, ${
                        filled ? plural(cell.items.length, "item") : "free"
                      }`}
                      onMouseEnter={() => onCellEnter(cell)}
                      onFocus={() => onCellEnter(cell)}
                      onClick={() => openSlot(cell)}
                    />
                  );
                })}
              </React.Fragment>
            );
          })}
        </div>
        </div>

        <div className="hm-status">{statusText}</div>

        <div className="hm-time-blocks">
          {TIME_BLOCKS.map(b => <span key={b.label}>{b.label}</span>)}
        </div>

        <div className="hm-legend">
          <span>Free</span>
          <div className="hm-scale">
            <span
              className={`hm-scale-item${priorityFilter === null ? " active" : ""}`}
              style={{ background: PALETTE[0] }}
              onClick={() => setPriorityFilter(null)}
              title="Show all"
            />
            {(["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const).map((level, i) => {
              const isActive = priorityFilter === level;
              const isDimmed = priorityFilter !== null && priorityFilter !== level;
              return (
                <span
                  key={level}
                  className={`hm-scale-item${isActive ? " active" : ""}${isDimmed ? " dim" : ""}`}
                  style={{ background: PALETTE[i + 1] }}
                  onClick={() => setPriorityFilter(isActive ? null : level)}
                  title={`${level} priority`}
                />
              );
            })}
          </div>
          <span>Critical</span>
        </div>

        {selectedCell && selectedCell.items.length > 0 && (
          <div className="hm-slot-modal" role="dialog" aria-label="Scheduled items in selected time slot">
            <div className="hm-slot-head">
              <div>
                <div className="hm-slot-kicker">{format(selectedCell.date, "EEEE, MMM d")}</div>
                <div className="hm-slot-title">
                  {selectedCell.label} | {plural(selectedCell.items.length, "item")}
                </div>
              </div>
              <button type="button" className="hm-close" aria-label="Close slot details" onClick={() => setSelectedCell(null)}>
                x
              </button>
            </div>

            <div className="hm-slot-list">
              {selectedCell.items.map(entry => (
                <button
                  key={entry.item.id}
                  type="button"
                  className="hm-slot-item"
                  onClick={() => onEdit?.(entry.item)}
                >
                  <div className="hm-slot-item-title">{entry.item.title}</div>
                  <div className="hm-slot-item-meta">
                    <span>{entry.item.type}</span>
                    <span>{formatItemTime(entry.item, entry)}</span>
                    <span className={`hm-pill ${priorityTone(entry.item.priority)}`}>{entry.item.priority}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
