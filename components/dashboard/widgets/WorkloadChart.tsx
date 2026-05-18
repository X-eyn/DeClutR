"use client";

import { useMemo, useState, useEffect } from "react";
import { startOfWeek, addDays, isSameDay, isToday, format } from "date-fns";
import Modal from "@/components/ui/Modal";
import ItemCard from "@/components/dashboard/ItemCard";
import type { TemporalItemWithRelations } from "@/types";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const PRIORITY_LEVELS = ["CRITICAL", "HIGH", "MEDIUM", "LOW"] as const;
const PRIORITY_COLOR: Record<string, string> = {
  CRITICAL: "#312e81",
  HIGH:     "#6366f1",
  MEDIUM:   "#a5b4fc",
  LOW:      "#e0e7ff",
};
const PRIORITY_LABEL: Record<string, string> = {
  CRITICAL: "Critical",
  HIGH:     "High",
  MEDIUM:   "Medium",
  LOW:      "Low",
};

interface WorkloadChartProps {
  items: TemporalItemWithRelations[];
  onEdit?: (item: TemporalItemWithRelations) => void;
  onComplete?: (id: string) => void;
  onDelete?: (id: string) => void;
}

function plural(n: number, word: string) {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

export default function WorkloadChart({ items, onEdit, onComplete, onDelete }: WorkloadChartProps) {
  const [hovered, setHovered] = useState<number | null>(null);
  const [entered, setEntered] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState("");
  const [modalItems, setModalItems] = useState<TemporalItemWithRelations[]>([]);

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

      const segments = PRIORITY_LEVELS.map(level => {
        const levelItems = dayItems.filter(it => it.priority === level);
        return { level, count: levelItems.length, color: PRIORITY_COLOR[level] };
      }).filter(s => s.count > 0);

      return {
        label,
        today: isToday(date),
        items: dayItems,
        date,
        count: dayItems.length,
        segments,
      };
    });
  }, [items]);

  const yMax = Math.max(3, ...bars.map(b => b.count));

  const openDayModal = (dayIndex: number) => {
    const bar = bars[dayIndex];
    if (bar.items.length === 0) return;
    setModalTitle(`${bar.label}, ${format(bar.date, "MMM d")} — ${plural(bar.count, "item")}`);
    setModalItems(bar.items);
    setModalOpen(true);
  };

  const hBar = hovered !== null ? bars[hovered] : null;

  function hoverBreakdown(segments: { level: string; count: number }[]) {
    return segments.map(s => `${s.count} ${PRIORITY_LABEL[s.level] ?? s.level}`).join(", ");
  }

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
          min-width: 0;
        }
        .wl-title {
          font-size: 15px;
          font-weight: 700;
          color: var(--ink);
          white-space: nowrap;
          flex-shrink: 0;
        }
        .wl-hover-info {
          font-size: 12px;
          color: var(--indigo);
          font-weight: 600;
          white-space: nowrap;
          min-width: 120px;
          text-align: right;
          transition: opacity 0.2s ease;
          flex-shrink: 0;
        }

        .wl-chart {
          display: grid;
          grid-template-columns: 22px 1fr;
          gap: 6px;
          height: 150px;
          margin-top: 4px;
        }
        .wl-y {
          display: flex;
          flex-direction: column-reverse;
          justify-content: space-between;
          font-size: 10.5px;
          color: var(--mut-2);
          text-align: right;
          padding-bottom: 20px;
          user-select: none;
        }

        .wl-plot {
          position: relative;
          overflow: visible;
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
          z-index: 1;
        }

        .wl-bar-col {
          height: 100%;
          position: relative;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: flex-end;
          cursor: pointer;
        }

        .wl-bar-val {
          position: absolute;
          top: 2px;
          left: 0; right: 0;
          text-align: center;
          font-size: 12px;
          font-weight: 800;
          color: var(--indigo);
          pointer-events: none;
          transition: opacity 0.18s ease, transform 0.22s cubic-bezier(0.34,1.56,0.64,1);
        }

        .wl-bar-stack {
          width: 70%;
          display: flex;
          flex-direction: column-reverse;
          border-radius: 5px 5px 3px 3px;
          overflow: hidden;
          pointer-events: none;
          transform-origin: bottom center;
          transition: transform 0.22s cubic-bezier(0.34,1.56,0.64,1);
        }

        .wl-bar-seg {
          width: 100%;
          transition:
            height 0.65s cubic-bezier(0.34,1.56,0.64,1),
            opacity 0.22s ease;
        }

        .wl-x-axis {
          position: absolute;
          bottom: 0; left: 0; right: 0;
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          font-size: 11px;
          color: var(--mut);
          text-align: center;
          z-index: 1;
        }
        .wl-x-axis span {
          white-space: nowrap;
          transition: color 0.2s ease;
        }
        .wl-x-axis span.today { color: var(--indigo-deep); font-weight: 700; }
        .wl-x-axis span.lit   { color: var(--indigo); font-weight: 700; }

        .wl-modal-list { display: flex; flex-direction: column; gap: 10px; }
        .wl-modal-empty { text-align: center; padding: 32px 0; color: var(--mut); font-size: 13.5px; }
      `}</style>

      <div className="wl-card">
        <div className="wl-head">
          <div className="wl-title">Weekly Workload</div>
          <div className="wl-hover-info" style={{ opacity: hBar != null ? 1 : 0 }}>
            {hBar != null
              ? hBar.segments.length > 0
                ? hoverBreakdown(hBar.segments)
                : "0 items"
              : null}
          </div>
        </div>

        <div className="wl-chart">
          <div className="wl-y">
            {Array.from({ length: yMax + 1 }, (_, i) => (
              <span key={i}>{i}</span>
            ))}
          </div>

          <div className="wl-plot" onMouseLeave={() => setHovered(null)}>
            <div className="wl-gridlines">
              {Array.from({ length: yMax }, (_, i) => <i key={i} />)}
            </div>

            <div className="wl-bars-row">
              {bars.map((b, i) => {
                const isDimmed = hovered !== null && hovered !== i;
                const totalHeightPct = yMax > 0 ? (b.count / yMax) * 100 : 0;

                return (
                  <div
                    key={i}
                    className="wl-bar-col"
                    onMouseEnter={() => setHovered(i)}
                    onClick={() => openDayModal(i)}
                  >
                    <div
                      className="wl-bar-val"
                      style={{
                        opacity: hovered === i && b.count > 0 ? 1 : 0,
                        transform: hovered === i ? "translateY(0)" : "translateY(5px)",
                      }}
                    >
                      {b.count}
                    </div>

                    <div
                      className="wl-bar-stack"
                      style={{
                        height: entered ? `${Math.max(b.count > 0 ? 8 : 2, totalHeightPct)}%` : "0%",
                        opacity: isDimmed ? 0.28 : 1,
                        transform: hovered === i ? "scaleX(1.06)" : "scaleX(1)",
                        transition: [
                          `height 0.65s cubic-bezier(0.34,1.56,0.64,1) ${entered ? "0s" : `${i * 0.07}s`}`,
                          "opacity 0.22s ease",
                          "transform 0.22s cubic-bezier(0.34,1.56,0.64,1)",
                        ].join(", "),
                      }}
                    >
                      {b.segments.map(seg => {
                        const segPct = b.count > 0 ? (seg.count / b.count) * 100 : 0;
                        return (
                          <div
                            key={seg.level}
                            className="wl-bar-seg"
                            style={{
                              height: entered ? `${segPct}%` : "0%",
                              background: seg.color,
                            }}
                          />
                        );
                      })}
                    </div>
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

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={modalTitle}>
        <div className="wl-modal-list">
          {modalItems.length === 0 ? (
            <div className="wl-modal-empty">No items to display</div>
          ) : (
            modalItems.map(item => (
              <ItemCard
                key={item.id}
                item={item}
                onComplete={id => { onComplete?.(id); setModalItems(prev => prev.map(i => i.id === id ? { ...i, status: "COMPLETED" } : i)); }}
                onDelete={id => { onDelete?.(id); setModalItems(prev => prev.filter(i => i.id !== id)); }}
                onEdit={item => { onEdit?.(item); setModalOpen(false); }}
              />
            ))
          )}
        </div>
      </Modal>
    </>
  );
}
