"use client";

import { useState, useEffect, useMemo } from "react";
import { format, formatDistanceToNow, isThisWeek, startOfWeek, endOfWeek } from "date-fns";
import type { TemporalItemWithRelations } from "@/types";

const TYPE_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  DEADLINE: { label: "Deadline", color: "#ef4444", bg: "#fee2e2" },
  EVENT:    { label: "Event",    color: "#3b82f6", bg: "#dbeafe" },
  TASK:     { label: "Task",     color: "#8b5cf6", bg: "#ede9fe" },
  REMINDER: { label: "Reminder", color: "#f59e0b", bg: "#fef3c7" },
};

const PRIORITY_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  LOW:      { label: "Low",      color: "#64748b", bg: "#f1f5f9" },
  MEDIUM:   { label: "Medium",   color: "#1d4ed8", bg: "#dbeafe" },
  HIGH:     { label: "High",     color: "#92400e", bg: "#fef3c7" },
  CRITICAL: { label: "Critical", color: "#b91c1c", bg: "#fee2e2" },
};

function StatCard({
  label,
  value,
  sub,
  accent,
  icon,
}: {
  label: string;
  value: string | number;
  sub?: string;
  accent: string;
  icon: React.ReactNode;
}) {
  return (
    <div style={{
      background: "var(--panel)", border: "1.5px solid var(--line)",
      borderRadius: 16, padding: "20px 22px",
      display: "flex", flexDirection: "column", gap: 10,
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--mut)", textTransform: "uppercase", letterSpacing: ".04em" }}>{label}</span>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: accent, display: "grid", placeItems: "center",
        }}>
          {icon}
        </div>
      </div>
      <div style={{ fontSize: 32, fontWeight: 800, color: "var(--ink)", letterSpacing: "-0.02em", lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 12.5, color: "var(--mut)" }}>{sub}</div>}
    </div>
  );
}

function HBarChart({
  title,
  items,
  config,
}: {
  title: string;
  items: [string, number][];
  config: Record<string, { label: string; color: string; bg: string }>;
}) {
  const max = Math.max(...items.map(([, v]) => v), 1);
  return (
    <div style={{
      background: "var(--panel)", border: "1.5px solid var(--line)",
      borderRadius: 16, padding: "20px 22px",
    }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)", marginBottom: 18 }}>{title}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {items.map(([key, count]) => {
          const cfg = config[key];
          const pct = (count / max) * 100;
          return (
            <div key={key}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 5 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                  <span style={{
                    display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: cfg.color, flexShrink: 0,
                  }} />
                  <span style={{ fontSize: 13, fontWeight: 500, color: "var(--ink-2)" }}>{cfg.label}</span>
                </div>
                <span style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>{count}</span>
              </div>
              <div style={{ height: 7, background: "var(--line)", borderRadius: 99, overflow: "hidden" }}>
                <div style={{
                  height: "100%", width: `${pct}%`, background: cfg.color,
                  borderRadius: 99, transition: "width .5s ease",
                  opacity: count === 0 ? 0.25 : 1,
                }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TypeBadge({ type }: { type: string }) {
  const cfg = TYPE_CONFIG[type] ?? { label: type, color: "#64748b", bg: "#f1f5f9" };
  return (
    <span style={{
      fontSize: 10.5, fontWeight: 700, padding: "2px 8px", borderRadius: 99,
      background: cfg.bg, color: cfg.color, letterSpacing: ".03em",
      textTransform: "uppercase" as const, flexShrink: 0,
    }}>
      {cfg.label}
    </span>
  );
}

export default function InsightsPage() {
  const [items, setItems] = useState<TemporalItemWithRelations[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/items?limit=500")
      .then(r => r.json())
      .then(d => setItems(d.items ?? []))
      .finally(() => setLoading(false));
  }, []);

  const stats = useMemo(() => {
    const now = new Date();
    const nonArchived = items.filter(i => i.status !== "ARCHIVED");
    const total = nonArchived.filter(i => i.status !== "COMPLETED").length;
    const completed = nonArchived.filter(i => i.status === "COMPLETED").length;
    const completionRate = nonArchived.length > 0
      ? Math.round((completed / nonArchived.length) * 100)
      : 0;
    const overdue = nonArchived.filter(i =>
      i.status !== "COMPLETED" && new Date(i.dueDate) < now
    ).length;
    const thisWeekStart = startOfWeek(now, { weekStartsOn: 1 });
    const thisWeekEnd = endOfWeek(now, { weekStartsOn: 1 });
    const thisWeek = items.filter(i => {
      const d = new Date(i.dueDate);
      return d >= thisWeekStart && d <= thisWeekEnd && i.status !== "COMPLETED" && i.status !== "ARCHIVED";
    }).length;

    const byType: [string, number][] = ["DEADLINE", "EVENT", "TASK", "REMINDER"].map(t => [
      t,
      items.filter(i => i.type === t && i.status !== "ARCHIVED").length,
    ]);

    const byPriority: [string, number][] = ["CRITICAL", "HIGH", "MEDIUM", "LOW"].map(p => [
      p,
      items.filter(i => i.priority === p && i.status !== "ARCHIVED").length,
    ]);

    const recent = [...items]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 10);

    const recentCompleted = [...items]
      .filter(i => i.status === "COMPLETED")
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 10);

    return { total, completionRate, overdue, thisWeek, byType, byPriority, recent, recentCompleted };
  }, [items]);

  if (loading) {
    return (
      <div style={{ padding: "22px 24px 40px" }}>
        <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.02em", color: "var(--ink)", marginBottom: 8 }}>Insights</div>
        <div style={{ color: "var(--mut)", fontSize: 14.5, marginBottom: 28 }}>Productivity analytics at a glance.</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 20 }}>
          {[0, 1, 2, 3].map(i => (
            <div key={i} style={{
              background: "var(--panel)", border: "1.5px solid var(--line)",
              borderRadius: 16, padding: "20px 22px", height: 110,
              animation: "skeleton-pulse 1.6s ease-in-out infinite",
            }} />
          ))}
        </div>
        <style>{`@keyframes skeleton-pulse { 0%,100%{opacity:1} 50%{opacity:.5} }`}</style>
      </div>
    );
  }

  return (
    <>
      <style>{`
        .ins-wrap { padding: 22px 24px 40px; min-width: 0; }
        .ins-title { font-size: 26px; font-weight: 800; letter-spacing: -0.02em; color: var(--ink); }
        .ins-sub { color: var(--mut); margin-top: 6px; font-size: 14.5px; margin-bottom: 28px; }
        .ins-stat-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 22px; }
        .ins-charts-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 22px; }
        .ins-activity-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        .ins-section-title { font-size: 14px; font-weight: 700; color: var(--ink); margin-bottom: 14px; }
        .ins-list-item {
          display: flex; align-items: center; gap: 10px;
          padding: 10px 0; border-bottom: 1px solid var(--line);
        }
        .ins-list-item:last-child { border-bottom: none; padding-bottom: 0; }
        .ins-list-title { flex: 1; font-size: 13px; font-weight: 500; color: var(--ink); min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .ins-list-when { font-size: 11.5px; color: var(--mut-2); flex-shrink: 0; }
        .ins-empty-list { font-size: 13px; color: var(--mut); text-align: center; padding: 24px 0; }
      `}</style>
      <div className="ins-wrap">
        <div className="ins-title">Insights</div>
        <div className="ins-sub">Productivity analytics at a glance.</div>

        {/* Stat cards */}
        <div className="ins-stat-row">
          <StatCard
            label="Total Active"
            value={stats.total}
            sub="Non-archived, non-completed"
            accent="var(--indigo-soft)"
            icon={
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--indigo)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="9" rx="1.5"/>
                <rect x="14" y="3" width="7" height="5" rx="1.5"/>
                <rect x="14" y="12" width="7" height="9" rx="1.5"/>
                <rect x="3" y="16" width="7" height="5" rx="1.5"/>
              </svg>
            }
          />
          <StatCard
            label="Completion Rate"
            value={`${stats.completionRate}%`}
            sub={`${items.filter(i => i.status === "COMPLETED").length} items completed`}
            accent="var(--green-tint)"
            icon={
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            }
          />
          <StatCard
            label="Overdue"
            value={stats.overdue}
            sub="Past due date, not completed"
            accent="var(--red-tint)"
            icon={
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--red)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="9"/>
                <path d="M12 8v4"/><circle cx="12" cy="16" r=".5" fill="var(--red)"/>
              </svg>
            }
          />
          <StatCard
            label="This Week"
            value={stats.thisWeek}
            sub="Due within current week"
            accent="var(--amber-soft)"
            icon={
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--amber)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="17" rx="2"/>
                <line x1="3" y1="9" x2="21" y2="9"/>
                <line x1="8" y1="2" x2="8" y2="6"/>
                <line x1="16" y1="2" x2="16" y2="6"/>
              </svg>
            }
          />
        </div>

        {/* Charts */}
        <div className="ins-charts-row">
          <HBarChart title="Items by Type" items={stats.byType} config={TYPE_CONFIG} />
          <HBarChart title="Items by Priority" items={stats.byPriority} config={PRIORITY_CONFIG} />
        </div>

        {/* Activity lists */}
        <div className="ins-activity-row">
          {/* Recent Activity */}
          <div style={{
            background: "var(--panel)", border: "1.5px solid var(--line)",
            borderRadius: 16, padding: "20px 22px",
          }}>
            <div className="ins-section-title">Recent Activity</div>
            {stats.recent.length === 0 ? (
              <div className="ins-empty-list">No items yet.</div>
            ) : (
              stats.recent.map(item => (
                <div key={item.id} className="ins-list-item">
                  <TypeBadge type={item.type} />
                  <span className="ins-list-title">{item.title}</span>
                  <span className="ins-list-when">
                    {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
                  </span>
                </div>
              ))
            )}
          </div>

          {/* Completion Timeline */}
          <div style={{
            background: "var(--panel)", border: "1.5px solid var(--line)",
            borderRadius: 16, padding: "20px 22px",
          }}>
            <div className="ins-section-title">Recently Completed</div>
            {stats.recentCompleted.length === 0 ? (
              <div className="ins-empty-list">No completed items yet. Keep going!</div>
            ) : (
              stats.recentCompleted.map(item => (
                <div key={item.id} className="ins-list-item">
                  <span style={{
                    width: 8, height: 8, borderRadius: "50%",
                    background: "var(--green)", flexShrink: 0, display: "inline-block",
                  }} />
                  <span className="ins-list-title" style={{ textDecoration: "line-through", color: "var(--mut)" }}>
                    {item.title}
                  </span>
                  <span className="ins-list-when">
                    {format(new Date(item.updatedAt), "MMM d")}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </>
  );
}
