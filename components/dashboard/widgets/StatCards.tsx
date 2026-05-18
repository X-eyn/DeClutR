"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { isToday, isThisWeek, isThisMonth } from "date-fns";
import { interpretTimeLeft } from "@/lib/time";
import Modal from "@/components/ui/Modal";
import ItemCard from "@/components/dashboard/ItemCard";
import type { DashboardStats, TemporalItemWithRelations } from "@/types";

interface StatCardsProps {
  stats: DashboardStats;
  items: TemporalItemWithRelations[];
  onEdit?: (item: TemporalItemWithRelations) => void;
  onComplete?: (id: string) => void;
  onDelete?: (id: string) => void;
}

function dedupeById(list: TemporalItemWithRelations[]) {
  const seen = new Set<string>();
  return list.filter(item => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

export default function StatCards({ stats, items, onEdit, onComplete, onDelete }: StatCardsProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState("");
  const [modalItems, setModalItems] = useState<TemporalItemWithRelations[]>([]);

  const openModal = (title: string, modalItemsList: TemporalItemWithRelations[]) => {
    setModalTitle(title);
    setModalItems(dedupeById(modalItemsList));
    setModalOpen(true);
  };

  const active = items.filter(i => i.status !== "COMPLETED" && i.status !== "ARCHIVED");

  // only MEDIUM+ priority qualifies as "critical" — LOW is intentionally excluded
  function isUrgent(item: TemporalItemWithRelations) {
    const u = interpretTimeLeft(new Date(item.dueDate)).urgency;
    return (u === "overdue" || u === "critical" || u === "high") && item.priority !== "LOW";
  }

  const nextCritical = useMemo(() =>
    active
      .slice()
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
      .find(isUrgent),
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

  const overdueCount = active.filter(i => interpretTimeLeft(new Date(i.dueDate)).urgency === "overdue" && i.priority !== "LOW").length;
  const overdueItems = active
    .filter(i => interpretTimeLeft(new Date(i.dueDate)).urgency === "overdue" && i.priority !== "LOW")
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

  const nextThreeCritical = active
    .slice()
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
    .filter(isUrgent)
    .slice(0, 3);

  const allCriticalItems = active
    .slice()
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
    .filter(isUrgent);

  const todayByType = [
    { label: "Events", filter: () => todayEvents.filter(i => i.type === "EVENT"), color: "var(--indigo)" },
    { label: "Tasks",  filter: () => todayTasks.filter(i => i.type === "TASK"),   color: "var(--violet)" },
    { label: "Due",    filter: () => todayTasks.filter(i => i.type === "DEADLINE"), color: "var(--red)" },
  ].map(t => ({ ...t, count: t.filter().length })).filter(t => t.count > 0);

  const nextTodayItem = active
    .filter(i => isToday(new Date(i.dueDate)))
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())[0];

  const weekRemaining = weekTasks.length;
  const weekDaysLeft  = 5 - new Date().getDay() + (new Date().getDay() === 0 ? -2 : new Date().getDay() === 6 ? -1 : 0);

  const monthOverdueItems = monthDeadlines.filter(i => interpretTimeLeft(new Date(i.dueDate)).urgency === "overdue");
  const monthOverdue      = monthOverdueItems.length;
  const monthUpcomingItems = monthDeadlines.filter(i => interpretTimeLeft(new Date(i.dueDate)).urgency !== "overdue");
  const monthUpcoming = monthUpcomingItems.length;

  const allWeekItems = [...weekTasks, ...weekCompleted];
  const allMonthItems = [...monthDeadlines, ...monthEvents, ...monthCompleted];

  return (
    <>
      <style>{`
        .stat-row {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 10px;
          height: 100%;
          align-items: stretch;
        }
        .stat {
          background: var(--panel);
          border: 1px solid var(--line);
          border-radius: 18px;
          padding: 16px;
          display: flex;
          flex-direction: column;
          height: 100%;
          min-height: 0;
          min-width: 0;
          overflow: hidden;
          box-shadow: var(--shadow-sm);
          box-sizing: border-box;
          cursor: pointer;
          transition: box-shadow 0.35s ease, transform 0.28s cubic-bezier(0.34,1.56,0.64,1), border-color 0.2s ease;
        }
        .stat:hover {
          box-shadow: 0 6px 28px rgba(0,0,0,0.08);
          transform: translateY(-2px);
          border-color: #d8d9e3;
        }
        .stat:active {
          transform: translateY(0px) scale(0.99);
          transition: transform 0.12s ease;
        }

        /* ── Header ── */
        .stat-header {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-shrink: 0;
          min-width: 0;
        }
        .stat-ico {
          width: 38px; height: 38px;
          border-radius: 11px;
          display: grid; place-items: center;
          flex-shrink: 0;
          transition: transform 0.28s cubic-bezier(0.34,1.56,0.64,1);
        }
        .stat:hover .stat-ico {
          transform: scale(1.08);
        }
        .stat-headtxt {
          display: flex;
          flex-direction: column;
          gap: 1px;
          min-width: 0;
          flex: 1;
          overflow: hidden;
        }
        .stat-label {
          font-size: 11px;
          color: var(--mut);
          font-weight: 500;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .stat-value {
          font-size: 20px;
          font-weight: 800;
          letter-spacing: -0.02em;
          line-height: 1.15;
          color: var(--ink);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          transition: transform 0.28s cubic-bezier(0.34,1.56,0.64,1), color 0.2s ease;
        }
        .stat:hover .stat-value {
          transform: scale(1.02);
        }
        .stat-value .unit {
          font-weight: 600;
          font-size: 14px;
          color: var(--ink-2);
          margin-left: 2px;
        }

        /* ── Divider ── */
        .stat-sep {
          height: 1px;
          background: var(--line);
          flex-shrink: 0;
          margin: 10px 0;
          transition: background 0.2s ease;
        }
        .stat:hover .stat-sep {
          background: #d8d9e3;
        }

        /* ── Body ── */
        .stat-body {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 6px;
          min-height: 0;
          overflow: hidden;
        }

        /* mini text */
        .stat-meta {
          font-size: 11.5px;
          color: var(--mut);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .stat-link {
          color: var(--indigo);
          font-weight: 600;
          font-size: 12.5px;
          display: inline-flex;
          align-items: center;
          gap: 3px;
          text-decoration: none;
          white-space: nowrap;
          flex-shrink: 0;
          transition: transform 0.2s ease, color 0.2s ease;
        }
        .stat-link:hover {
          transform: translateX(3px);
          color: var(--indigo-deep);
        }

        /* pill */
        .stat-pill {
          display: inline-flex;
          align-items: center;
          padding: 1px 7px;
          border-radius: 99px;
          font-size: 10.5px;
          font-weight: 700;
          flex-shrink: 0;
          white-space: nowrap;
          cursor: pointer;
          transition: transform 0.28s cubic-bezier(0.34,1.56,0.64,1), opacity 0.2s ease, box-shadow 0.2s ease;
        }
        .stat-pill:hover {
          transform: scale(1.1);
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        .stat:hover .stat-pill {
          transform: scale(1.05);
        }

        /* mini item list */
        .stat-mini-list { display: flex; flex-direction: column; gap: 3px; overflow: hidden; }
        .stat-mini-item {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 11.5px;
          color: var(--ink-2);
          overflow: hidden;
          padding: 2px 4px;
          border-radius: 6px;
          cursor: pointer;
          transition: background 0.2s ease, transform 0.2s ease;
        }
        .stat-mini-item:hover {
          background: var(--line-2);
          transform: translateX(3px);
        }
        .stat-mini-item span:last-child {
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .stat-mini-dot { width: 5px; height: 5px; border-radius: 50%; flex-shrink: 0; transition: transform 0.28s cubic-bezier(0.34,1.56,0.64,1); }
        .stat:hover .stat-mini-dot {
          transform: scale(1.4);
        }

        /* type chips */
        .stat-type-row { display: flex; gap: 5px; overflow: hidden; }
        .stat-type-chip {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          background: var(--surface, #f7f8fc);
          border-radius: 9px;
          padding: 5px 6px;
          gap: 1px;
          min-width: 0;
          overflow: hidden;
          cursor: pointer;
          transition: transform 0.28s cubic-bezier(0.34,1.56,0.64,1), background 0.2s ease, box-shadow 0.2s ease;
        }
        .stat-type-chip:hover {
          transform: translateY(-2px);
          background: #eef0f7;
          box-shadow: 0 2px 8px rgba(0,0,0,0.06);
        }
        .stat-type-chip-val { font-size: 14px; font-weight: 800; line-height: 1; transition: transform 0.28s cubic-bezier(0.34,1.56,0.64,1); }
        .stat:hover .stat-type-chip-val {
          transform: scale(1.08);
        }
        .stat-type-chip-lbl { font-size: 10px; color: var(--mut); font-weight: 500; white-space: nowrap; }

        /* 3-stat row */
        .stat-three { display: flex; align-items: flex-start; gap: 0; overflow: hidden; }
        .stat-three-item { flex: 1; display: flex; flex-direction: column; gap: 1px; min-width: 0; overflow: hidden; cursor: pointer; transition: transform 0.28s cubic-bezier(0.34,1.56,0.64,1), opacity 0.2s ease; }
        .stat-three-item:hover {
          transform: translateY(-2px);
          opacity: 0.85;
        }
        .stat-three-val { font-size: 17px; font-weight: 800; color: var(--ink); line-height: 1; transition: transform 0.28s cubic-bezier(0.34,1.56,0.64,1), color 0.2s ease; }
        .stat:hover .stat-three-val {
          transform: scale(1.05);
        }
        .stat-three-lbl { font-size: 10px; color: var(--mut); font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .stat-three-div { width: 1px; background: var(--line); align-self: stretch; margin: 0 8px; flex-shrink: 0; transition: background 0.2s ease; }
        .stat:hover .stat-three-div {
          background: #d8d9e3;
        }

        /* progress */
        .stat-progress-wrap { display: flex; flex-direction: column; gap: 4px; cursor: pointer; }
        .stat-progress-row { display: flex; justify-content: space-between; align-items: center; }
        .stat-progress-meta { font-size: 11.5px; color: var(--mut); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; cursor: pointer; transition: color 0.2s ease; }
        .stat-progress-meta:hover { color: var(--indigo); }
        .stat-pct-lbl { font-size: 10.5px; font-weight: 700; white-space: nowrap; transition: transform 0.28s cubic-bezier(0.34,1.56,0.64,1); cursor: pointer; }
        .stat-pct-lbl:hover { transform: scale(1.08); }
        .stat:hover .stat-pct-lbl {
          transform: scale(1.05);
        }
        .stat-bar { height: 5px; background: #edeef3; border-radius: 99px; overflow: hidden; }
        .stat-bar > span { display: block; height: 100%; border-radius: 99px; transition: width 0.75s cubic-bezier(0.4,0,0.2,1); }

        /* modal list */
        .stat-modal-list { display: flex; flex-direction: column; gap: 10px; }
        .stat-modal-empty { text-align: center; padding: 32px 0; color: var(--mut); font-size: 13.5px; }
      `}</style>
      <div className="stat-row">

        {/* Card 1: Next Critical Deadline */}
        <div className="stat" onClick={() => openModal("Critical & Urgent Items", allCriticalItems)}>
          <div className="stat-header">
            <div className="stat-ico" style={{ background: "var(--red-tint)", color: "var(--red)" }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 22h14"/><path d="M5 2h14"/>
                <path d="M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22"/>
                <path d="M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2"/>
              </svg>
            </div>
            <div className="stat-headtxt">
              <div className="stat-label">Critical Deadline</div>
              {nextCritical ? (
                <div className="stat-value">{hoursLeft}h <span style={{ fontSize: 15 }}>{minsRemainder}m</span></div>
              ) : (
                <div className="stat-value" style={{ fontSize: 15 }}>All clear</div>
              )}
            </div>
            {overdueCount > 0 && (
              <span
                className="stat-pill"
                style={{ background: "var(--red-tint)", color: "var(--red)" }}
                onClick={e => { e.stopPropagation(); openModal("Overdue Items", overdueItems); }}
              >
                {overdueCount} overdue
              </span>
            )}
          </div>

          <div className="stat-sep" />

          <div className="stat-body">
            {nextThreeCritical.length > 0 ? (
              <>
                <div className="stat-meta">Urgent items</div>
                <div className="stat-mini-list">
                  {nextThreeCritical.map(item => {
                    const u = interpretTimeLeft(new Date(item.dueDate)).urgency;
                    const c = u === "overdue" ? "var(--red)" : u === "critical" ? "#f97316" : "#eab308";
                    return (
                      <div
                        className="stat-mini-item"
                        key={item.id}
                        onClick={e => { e.stopPropagation(); onEdit?.(item); }}
                      >
                        <span className="stat-mini-dot" style={{ background: c }} />
                        <span>{item.title}</span>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <div className="stat-meta">No urgent items right now</div>
            )}
          </div>
        </div>

        {/* Card 2: Today's Schedule */}
        <div className="stat" onClick={() => openModal("Today's Schedule", todayEvents)}>
          <div className="stat-header">
            <div className="stat-ico" style={{ background: "var(--indigo-soft)", color: "var(--indigo)" }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="17" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/>
                <line x1="8" y1="2" x2="8" y2="6"/><line x1="16" y1="2" x2="16" y2="6"/>
              </svg>
            </div>
            <div className="stat-headtxt">
              <div className="stat-label">Today&apos;s Schedule</div>
              <div className="stat-value">{todayEvents.length}<span className="unit">items</span></div>
            </div>
          </div>

          <div className="stat-sep" />

          <div className="stat-body">
            {todayByType.length > 0 ? (
              <div className="stat-type-row">
                {todayByType.map(t => (
                  <div
                    className="stat-type-chip"
                    key={t.label}
                    onClick={e => { e.stopPropagation(); openModal(`Today — ${t.label}`, t.filter()); }}
                  >
                    <span className="stat-type-chip-val" style={{ color: t.color }}>{t.count}</span>
                    <span className="stat-type-chip-lbl">{t.label}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="stat-meta">Nothing scheduled today</div>
            )}
            {nextTodayItem && (
              <div
                className="stat-mini-item"
                style={{ marginTop: 2 }}
                onClick={e => { e.stopPropagation(); onEdit?.(nextTodayItem); }}
              >
                <span className="stat-mini-dot" style={{ background: "var(--indigo)" }} />
                <span style={{ fontWeight: 600, color: "var(--ink)" }}>{nextTodayItem.title}</span>
              </div>
            )}
            <div style={{ flex: 1 }} />
            <Link className="stat-link" href="/dashboard/calendar" onClick={e => e.stopPropagation()}>View agenda →</Link>
          </div>
        </div>

        {/* Card 3: This Week */}
        <div className="stat" onClick={() => openModal("This Week's Items", allWeekItems)}>
          <div className="stat-header">
            <div className="stat-ico" style={{ background: "var(--green-tint)", color: "var(--green)" }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-6"/>
              </svg>
            </div>
            <div className="stat-headtxt">
              <div className="stat-label">This Week</div>
              <div className="stat-value">{weekTasks.length}<span className="unit">tasks</span></div>
            </div>
          </div>

          <div className="stat-sep" />

          <div className="stat-body">
            <div className="stat-three">
              <div
                className="stat-three-item"
                onClick={e => { e.stopPropagation(); openModal("Completed This Week", weekCompleted); }}
              >
                <div className="stat-three-val" style={{ color: "var(--green)" }}>{weekCompleted.length}</div>
                <div className="stat-three-lbl">Completed</div>
              </div>
              <div className="stat-three-div" />
              <div
                className="stat-three-item"
                onClick={e => { e.stopPropagation(); openModal("Remaining This Week", weekTasks); }}
              >
                <div className="stat-three-val">{weekRemaining}</div>
                <div className="stat-three-lbl">Remaining</div>
              </div>
              <div className="stat-three-div" />
              <div
                className="stat-three-item"
                onClick={e => { e.stopPropagation(); openModal("Events This Week", weekEvents); }}
              >
                <div className="stat-three-val">{weekEvents.length}</div>
                <div className="stat-three-lbl">Events</div>
              </div>
            </div>
            <div style={{ flex: 1 }} />
            <div className="stat-progress-wrap">
              <div className="stat-progress-row">
                <span className="stat-progress-meta">{weekDaysLeft > 0 ? `${weekDaysLeft}d left` : "Last day"}</span>
                <span
                  className="stat-pct-lbl"
                  style={{ color: "var(--green)" }}
                  onClick={e => { e.stopPropagation(); openModal("Week Progress", allWeekItems); }}
                >
                  {weekPct}% done
                </span>
              </div>
              <div className="stat-bar">
                <span style={{ width: `${weekPct}%`, background: "var(--green)" }} />
              </div>
            </div>
          </div>
        </div>

        {/* Card 4: This Month */}
        <div className="stat" onClick={() => openModal("This Month's Items", allMonthItems)}>
          <div className="stat-header">
            <div className="stat-ico" style={{ background: "var(--violet-soft)", color: "var(--violet)" }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>
              </svg>
            </div>
            <div className="stat-headtxt">
              <div className="stat-label">This Month</div>
              <div className="stat-value">{monthDeadlines.length}<span className="unit">due</span></div>
            </div>
          </div>

          <div className="stat-sep" />

          <div className="stat-body">
            <div className="stat-three">
              <div
                className="stat-three-item"
                onClick={e => { e.stopPropagation(); openModal("Completed This Month", monthCompleted); }}
              >
                <div className="stat-three-val" style={{ color: "var(--violet)" }}>{monthCompleted.length}</div>
                <div className="stat-three-lbl">Done</div>
              </div>
              <div className="stat-three-div" />
              <div
                className="stat-three-item"
                onClick={e => { e.stopPropagation(); openModal("Overdue This Month", monthOverdueItems); }}
              >
                <div className="stat-three-val" style={{ color: monthOverdue > 0 ? "var(--red)" : "var(--ink)" }}>{monthOverdue}</div>
                <div className="stat-three-lbl">Overdue</div>
              </div>
              <div className="stat-three-div" />
              <div
                className="stat-three-item"
                onClick={e => { e.stopPropagation(); openModal("Events This Month", monthEvents); }}
              >
                <div className="stat-three-val">{monthEvents.length}</div>
                <div className="stat-three-lbl">Events</div>
              </div>
            </div>
            <div style={{ flex: 1 }} />
            <div className="stat-progress-wrap">
              <div className="stat-progress-row">
                <span
                  className="stat-progress-meta"
                  onClick={e => { e.stopPropagation(); openModal("Upcoming This Month", monthUpcomingItems); }}
                >
                  {monthUpcoming} upcoming
                </span>
                <span
                  className="stat-pct-lbl"
                  style={{ color: "var(--violet)" }}
                  onClick={e => { e.stopPropagation(); openModal("Month Progress", allMonthItems); }}
                >
                  {monthPct}% done
                </span>
              </div>
              <div className="stat-bar">
                <span style={{ width: `${monthPct}%`, background: "var(--violet)" }} />
              </div>
            </div>
          </div>
        </div>

      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={modalTitle}>
        <div className="stat-modal-list">
          {modalItems.length === 0 ? (
            <div className="stat-modal-empty">No items to display</div>
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
