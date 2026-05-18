"use client";

import Link from "next/link";
import { useMemo } from "react";
import { format, isThisWeek, differenceInHours } from "date-fns";
import type { DashboardStats, TemporalItemWithRelations } from "@/types";

interface InsightsCardProps {
  stats: DashboardStats;
  items: TemporalItemWithRelations[];
}

type InsightVariant = "amber" | "green" | "indigo";

interface Insight {
  variant: InsightVariant;
  icon: React.ReactNode;
  text: React.ReactNode;
}

function AmberIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2"/><path d="M5 3L2 6M19 3l3 3"/>
    </svg>
  );
}
function GreenIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 17 9 11 13 15 21 7"/><polyline points="14 7 21 7 21 14"/>
    </svg>
  );
}
function IndigoIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="17" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/>
      <line x1="8" y1="2" x2="8" y2="6"/><line x1="16" y1="2" x2="16" y2="6"/>
    </svg>
  );
}

export default function InsightsCard({ items }: InsightsCardProps) {
  const insights = useMemo((): Insight[] => {
    const now = new Date();
    const active = items.filter(i => i.status !== "COMPLETED" && i.status !== "ARCHIVED");
    const results: Insight[] = [];

    // Insight 1: next critical deadline
    const critical = active
      .filter(i => new Date(i.dueDate) > now)
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())[0];

    if (critical) {
      const h = differenceInHours(new Date(critical.dueDate), now);
      results.push({
        variant: "amber",
        icon: <AmberIcon />,
        text: <>Your next critical deadline is in <b>{h} hours</b>.</>,
      });
    }

    // Insight 2: focus windows (days this week with 0 items = free for focus)
    const freeWindows = [0,1,2,3,4,5,6]
      .filter(d => {
        const day = new Date(now);
        day.setDate(now.getDate() + d);
        return active.filter(i => {
          const due = new Date(i.dueDate);
          return due.toDateString() === day.toDateString();
        }).length === 0;
      }).length;

    if (freeWindows > 0) {
      results.push({
        variant: "green",
        icon: <GreenIcon />,
        text: <>You have <b>{freeWindows} focus window{freeWindows !== 1 ? "s" : ""}</b> free this week.</>,
      });
    }

    // Insight 3: busiest day from the actual current-week schedule
    const weekItems = active.filter(i => isThisWeek(new Date(i.dueDate), { weekStartsOn: 1 }));
    if (weekItems.length > 0) {
      const counts = new Map<string, { label: string; count: number }>();
      for (const item of weekItems) {
        const due = new Date(item.dueDate);
        const key = format(due, "yyyy-MM-dd");
        const current = counts.get(key) ?? { label: format(due, "EEEE"), count: 0 };
        current.count += 1;
        counts.set(key, current);
      }
      const busiest = Array.from(counts.values()).sort((a, b) => b.count - a.count)[0];
      results.push({
        variant: "indigo",
        icon: <IndigoIcon />,
        text: <>Your busiest day is <b>{busiest.label}</b> with <b>{busiest.count} item{busiest.count !== 1 ? "s" : ""}</b>.</>,
      });
    } else {
      results.push({
        variant: "indigo",
        icon: <IndigoIcon />,
        text: <>Schedule items to track your weekly productivity patterns.</>,
      });
    }

    // Fallback if nothing computed
    if (results.length === 0) {
      results.push({
        variant: "amber",
        icon: <AmberIcon />,
        text: <>No active items yet. Add something to get started!</>,
      });
    }

    return results.slice(0, 3);
  }, [items]);

  const icoStyle: Record<InsightVariant, React.CSSProperties> = {
    amber:  { background: "#fef3c7", color: "#b45309" },
    green:  { background: "var(--green-tint)", color: "var(--green)" },
    indigo: { background: "var(--indigo-soft)", color: "var(--indigo-deep)" },
  };

  return (
    <>
      <style>{`
        .ins-card {
          background: var(--panel); border: 1px solid var(--line);
          border-radius: 18px; padding: 18px 18px 12px;
          box-shadow: var(--shadow-sm);
        }
        .ins-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
        .ins-title-wrap { display: flex; align-items: center; gap: 8px; }
        .ins-title-ico {
          width: 26px; height: 26px; border-radius: 7px;
          background: var(--amber-soft); color: var(--amber);
          display: grid; place-items: center;
        }
        .ins-title { font-size: 15px; font-weight: 700; color: var(--ink); }
        .ins-row {
          display: flex; align-items: flex-start; gap: 12px;
          padding: 12px 0; border-bottom: 1px solid var(--line-2);
        }
        .ins-row:last-of-type { border-bottom: 0; }
        .ins-ico {
          width: 32px; height: 32px; border-radius: 9px;
          display: grid; place-items: center; flex-shrink: 0;
        }
        .ins-text { font-size: 13px; color: var(--ink-2); line-height: 1.45; }
        .ins-text b { color: var(--ink); font-weight: 700; }
        .ins-view-all {
          display: block; text-align: right; padding-right: 2px;
          color: var(--indigo); font-weight: 600; font-size: 13px;
          padding: 8px 2px 2px; cursor: pointer; text-decoration: none;
        }
      `}</style>
      <div className="ins-card">
        <div className="ins-head">
          <div className="ins-title-wrap">
            <div className="ins-title-ico">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 18h6"/><path d="M10 22h4"/>
                <path d="M12 2a7 7 0 0 0-4 12.7c.8.7 1 1.4 1 2.3h6c0-.9.2-1.6 1-2.3A7 7 0 0 0 12 2z"/>
              </svg>
            </div>
            <span className="ins-title">Temporal Insights</span>
          </div>
        </div>

        {insights.map((ins) => (
          <div key={ins.variant} className="ins-row">
            <div className="ins-ico" style={icoStyle[ins.variant]}>{ins.icon}</div>
            <div className="ins-text">{ins.text}</div>
          </div>
        ))}

        <Link className="ins-view-all" href="/dashboard/insights">View all insights →</Link>
      </div>
    </>
  );
}
