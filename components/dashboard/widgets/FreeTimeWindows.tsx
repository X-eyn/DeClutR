"use client";

import Link from "next/link";
import { useMemo } from "react";
import { addDays, format, isSameDay, startOfDay } from "date-fns";
import type { TemporalItemWithRelations } from "@/types";

interface FreeTimeWindowsProps {
  items: TemporalItemWithRelations[];
}

interface FreeWindow {
  label: string;
  timeRange: string;
  duration: string;
  durationMins: number;
}

function minutesToDuration(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (m === 0) return `${h}h 00m`;
  return `${h}h ${String(m).padStart(2, "0")}m`;
}

function timeString(mins: number) {
  const h24 = Math.floor(mins / 60);
  const m = mins % 60;
  const ampm = h24 >= 12 ? "PM" : "AM";
  const h12 = h24 > 12 ? h24 - 12 : h24 === 0 ? 12 : h24;
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}

function shouldUseTimedRange(item: TemporalItemWithRelations, start: Date, due: Date) {
  return item.type === "EVENT" || isSameDay(start, due);
}

export default function FreeTimeWindows({ items }: FreeTimeWindowsProps) {
  const windows = useMemo((): FreeWindow[] => {
    const today = startOfDay(new Date());
    const results: FreeWindow[] = [];

    for (let d = 1; d <= 7 && results.length < 3; d++) {
      const day = addDays(today, d);
      const dayItems = items.filter(
        item =>
          item.status !== "COMPLETED" &&
          item.status !== "ARCHIVED" &&
          isSameDay(new Date(item.dueDate), day)
      );

      const dayStart = 8 * 60;
      const dayEnd = 20 * 60;
      const busy: Array<[number, number]> = [];

      for (const item of dayItems) {
        const due = new Date(item.dueDate);
        const dueMins = due.getHours() * 60 + due.getMinutes();

        if (item.allDay) {
          busy.push([dayStart, dayEnd]);
        } else if (item.startDate) {
          const start = new Date(item.startDate);
          if (!Number.isNaN(start.getTime()) && start < due && shouldUseTimedRange(item, start, due)) {
            const startMins = start.getHours() * 60 + start.getMinutes();
            busy.push([Math.max(dayStart, startMins), Math.min(dayEnd, dueMins)]);
          } else {
            const blockStart = Math.max(dayStart, dueMins - 90);
            busy.push([blockStart, Math.min(dayEnd, blockStart + 90)]);
          }
        } else {
          const blockStart = Math.max(dayStart, dueMins - 90);
          busy.push([blockStart, Math.min(dayEnd, blockStart + 90)]);
        }
      }

      busy.sort((a, b) => a[0] - b[0]);
      const merged: Array<[number, number]> = [];
      for (const slot of busy) {
        if (merged.length === 0 || slot[0] > merged[merged.length - 1][1]) {
          merged.push(slot);
        } else {
          merged[merged.length - 1][1] = Math.max(merged[merged.length - 1][1], slot[1]);
        }
      }

      const gaps: Array<[number, number]> = [];
      let cursor = dayStart;
      for (const [busyStart, busyEnd] of merged) {
        if (busyStart > cursor + 30) gaps.push([cursor, busyStart]);
        cursor = Math.max(cursor, busyEnd);
      }
      if (cursor < dayEnd - 30) gaps.push([cursor, dayEnd]);

      const best = gaps.reduce<[number, number] | null>((acc, gap) => {
        const duration = gap[1] - gap[0];
        if (duration < 60) return acc;
        if (!acc || duration > acc[1] - acc[0]) return gap;
        return acc;
      }, null);

      if (!best) continue;

      const [start, end] = best;
      results.push({
        label: d === 1 ? `Tomorrow, ${format(day, "MMM d")}` : format(day, "EEEE, MMM d"),
        timeRange: `${timeString(start)} - ${timeString(end)}`,
        duration: minutesToDuration(end - start),
        durationMins: end - start,
      });
    }

    return results;
  }, [items]);

  return (
    <>
      <style>{`
        .free-card {
          background: var(--panel); border: 1px solid var(--line);
          border-radius: 18px; padding: 20px 20px 14px;
          box-shadow: var(--shadow-sm);
        }
        .free-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
        .free-card-title { font-size: 15px; font-weight: 700; color: var(--ink); }
        .free-card-title .muted { color: var(--mut); font-weight: 500; font-size: 13px; }
        .free-list { display: flex; flex-direction: column; gap: 10px; }
        .free-item {
          display: flex; align-items: center; gap: 12px;
          padding: 10px 4px;
          border-bottom: 1px solid var(--line-2);
        }
        .free-item:last-child { border-bottom: 0; }
        .free-ico {
          width: 36px; height: 36px; border-radius: 10px;
          background: var(--indigo-soft);
          display: grid; place-items: center;
          color: var(--indigo);
          flex-shrink: 0;
        }
        .free-title { font-weight: 700; font-size: 13.5px; color: var(--ink); }
        .free-time { font-size: 12px; color: var(--mut); margin-top: 1px; }
        .free-dur {
          margin-left: auto;
          font-size: 12.5px; font-weight: 700;
          color: var(--indigo-deep);
          background: var(--indigo-soft);
          padding: 4px 10px; border-radius: 8px;
          white-space: nowrap;
        }
        .free-empty {
          text-align: center;
          padding: 20px 8px 12px;
          color: var(--mut);
          font-size: 12.5px;
          line-height: 1.45;
        }
        .free-view-all {
          display: block; text-align: center;
          color: var(--indigo); font-weight: 600;
          font-size: 13px; padding: 10px 0 2px;
          cursor: pointer; text-decoration: none;
        }
      `}</style>
      <div className="free-card">
        <div className="free-head">
          <div className="free-card-title">
            Free Time Windows <span className="muted">(This Week)</span>
          </div>
        </div>
        <div className="free-list">
          {windows.length === 0 ? (
            <div className="free-empty">No free windows found from the current live schedule.</div>
          ) : (
            windows.map((window, index) => (
              <div key={index} className="free-item">
                <div className="free-ico">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3"/>
                  </svg>
                </div>
                <div>
                  <div className="free-title">{window.label}</div>
                  <div className="free-time">{window.timeRange}</div>
                </div>
                <div className="free-dur">{window.duration}</div>
              </div>
            ))
          )}
        </div>
        <Link className="free-view-all" href="/dashboard/calendar">View all windows {"->"}</Link>
      </div>
    </>
  );
}
