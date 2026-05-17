"use client";

import Link from "next/link";
import { useMemo } from "react";
import { isToday, isThisWeek, isThisMonth } from "date-fns";
import { interpretTimeLeft } from "@/lib/time";
import type { DashboardStats, TemporalItemWithRelations } from "@/types";

interface StatCardsProps {
  stats: DashboardStats;
  items: TemporalItemWithRelations[];
}

export default function StatCards({ stats, items }: StatCardsProps) {
  const active = items.filter(i => i.status !== "COMPLETED" && i.status !== "ARCHIVED");

  const nextCritical = useMemo(() =>
    active
      .slice()
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
      .find(i => {
        const u = interpretTimeLeft(new Date(i.dueDate)).urgency;
        return u === "overdue" || u === "critical" || u === "high";
      }),
    [active]
  );

  const criticalTime = nextCritical ? interpretTimeLeft(new Date(nextCritical.dueDate)) : null;
  const hoursLeft = criticalTime ? Math.abs(criticalTime.hoursUntil) : 0;
  const minsRemainder = criticalTime ? Math.abs(criticalTime.minutesUntil) % 60 : 0;

  const todayEvents = active.filter(i => isToday(new Date(i.dueDate)));
  const todayTasks  = active.filter(i => isToday(new Date(i.dueDate)) && (i.type === "TASK" || i.type === "DEADLINE"));
  const weekTasks   = active.filter(i => isThisWeek(new Date(i.dueDate), { weekStartsOn: 1 }));
  const weekEvents  = weekTasks.filter(i => i.type === "EVENT");
  const weekCompleted = items.filter(i => i.status === "COMPLETED" && isThisWeek(new Date(i.dueDate), { weekStartsOn: 1 }));
  const weekTotal   = weekTasks.length + weekCompleted.length;
  const weekPct     = weekTotal > 0 ? Math.round((weekCompleted.length / weekTotal) * 100) : 0;

  const monthDeadlines = active.filter(i => isThisMonth(new Date(i.dueDate)) && (i.type === "DEADLINE" || i.type === "TASK"));
  const monthEvents    = active.filter(i => isThisMonth(new Date(i.dueDate)) && i.type === "EVENT");
  const monthCompleted = items.filter(i => i.status === "COMPLETED" && isThisMonth(new Date(i.dueDate)));
  const monthTotal     = monthDeadlines.length + monthCompleted.length;
  const monthPct       = monthTotal > 0 ? Math.round((monthCompleted.length / monthTotal) * 100) : 0;

  return (
    <>
      <style>{`
        .stat-row { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; }
        .stat {
          background: var(--panel); border: 1px solid var(--line);
          border-radius: 18px; padding: 16px 14px;
          display: flex; flex-direction: column; gap: 10px;
          box-shadow: var(--shadow-sm); min-height: 165px; min-width: 0;
        }
        .stat-header { display: flex; align-items: flex-start; gap: 10px; min-width: 0; }
        .stat-headtxt { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
        .stat-ico {
          width: 40px; height: 40px; border-radius: 12px;
          display: grid; place-items: center; flex-shrink: 0;
        }
        .stat-label { font-size: 11.5px; color: var(--mut); font-weight: 500; line-height: 1.25; }
        .stat-value { font-size: 22px; font-weight: 800; letter-spacing: -0.02em; margin-top: -2px; line-height: 1.1; color: var(--ink); }
        .stat-value .unit { font-weight: 600; font-size: 16px; color: var(--ink-2); margin-left: 3px; }
        .stat-meta { font-size: 12.5px; color: var(--mut); }
        .stat-meta.danger { color: var(--red); font-weight: 600; }
        .stat-link { color: var(--indigo); font-weight: 600; font-size: 13px; cursor: pointer; display: inline-flex; align-items: center; gap: 4px; text-decoration: none; }
        .stat-progress { height: 5px; background: #f1f2f7; border-radius: 99px; overflow: hidden; }
        .stat-progress > span { display: block; height: 100%; border-radius: 99px; }
        .stat-pct-row { display: flex; align-items: center; gap: 8px; }
        .stat-pct-label { font-size: 11px; font-weight: 700; white-space: nowrap; }
      `}</style>
      <div className="stat-row">

        {/* Card 1: Next Critical Deadline */}
        <div className="stat">
          <div className="stat-header">
            <div className="stat-ico" style={{ background: "var(--red-tint)", color: "var(--red)" }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 22h14"/>
                <path d="M5 2h14"/>
                <path d="M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22"/>
                <path d="M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2"/>
              </svg>
            </div>
            <div className="stat-headtxt">
              <div className="stat-label">Next Critical Deadline</div>
              {nextCritical ? (
                <div className="stat-value">
                  {hoursLeft}h <span style={{ fontSize: 18 }}>{minsRemainder}m</span>
                </div>
              ) : (
                <div className="stat-value" style={{ fontSize: 17 }}>All clear</div>
              )}
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: "auto" }}>
            <div className="stat-meta">{nextCritical ? nextCritical.title.slice(0, 24) + (nextCritical.title.length > 24 ? "…" : "") : "No critical items"}</div>
            <div className={`stat-meta${nextCritical && criticalTime?.urgency === "overdue" ? " danger" : ""}`}>
              {criticalTime ? criticalTime.label : "—"}
            </div>
          </div>
        </div>

        {/* Card 2: Today's Schedule */}
        <div className="stat">
          <div className="stat-header">
            <div className="stat-ico" style={{ background: "var(--indigo-soft)", color: "var(--indigo)" }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="17" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/>
                <line x1="8" y1="2" x2="8" y2="6"/><line x1="16" y1="2" x2="16" y2="6"/>
              </svg>
            </div>
            <div className="stat-headtxt">
              <div className="stat-label">Today&apos;s Schedule</div>
              <div className="stat-value">
                {todayEvents.length}<span className="unit">Events</span>
              </div>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: "auto" }}>
            <div className="stat-meta">{todayTasks.length} Task{todayTasks.length !== 1 ? "s" : ""}</div>
            <Link className="stat-link" href="/dashboard/calendar">View agenda →</Link>
          </div>
        </div>

        {/* Card 3: This Week */}
        <div className="stat">
          <div className="stat-header">
            <div className="stat-ico" style={{ background: "var(--green-tint)", color: "var(--green)" }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-6"/>
              </svg>
            </div>
            <div className="stat-headtxt">
              <div className="stat-label">This Week</div>
              <div className="stat-value">
                {weekTasks.length}<span className="unit">Tasks</span>
              </div>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: "auto" }}>
            <div className="stat-meta">{weekEvents.length} Event{weekEvents.length !== 1 ? "s" : ""}</div>
            <div className="stat-pct-row">
              <div className="stat-progress" style={{ flex: 1 }}>
                <span style={{ width: `${weekPct}%`, background: "var(--green)" }} />
              </div>
              <span className="stat-pct-label" style={{ color: "var(--green)" }}>{weekPct}% completed</span>
            </div>
          </div>
        </div>

        {/* Card 4: This Month */}
        <div className="stat">
          <div className="stat-header">
            <div className="stat-ico" style={{ background: "var(--violet-soft)", color: "var(--violet)" }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>
              </svg>
            </div>
            <div className="stat-headtxt">
              <div className="stat-label">This Month</div>
              <div className="stat-value">
                {monthDeadlines.length}<span className="unit">Deadlines</span>
              </div>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: "auto" }}>
            <div className="stat-meta">{monthEvents.length} Event{monthEvents.length !== 1 ? "s" : ""}</div>
            <div className="stat-pct-row">
              <div className="stat-progress" style={{ flex: 1 }}>
                <span style={{ width: `${monthPct}%`, background: "var(--violet)" }} />
              </div>
              <span className="stat-pct-label" style={{ color: "var(--violet)" }}>{monthPct}% completed</span>
            </div>
          </div>
        </div>

      </div>
    </>
  );
}
