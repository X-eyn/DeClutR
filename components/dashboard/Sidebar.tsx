"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "next-auth/react";

interface SidebarProps {
  user: { name?: string | null; email?: string | null; image?: string | null };
  reminderCount?: number;
}

const nav = [
  {
    href: "/dashboard", label: "Dashboard", badge: false,
    icon: <svg className="nav-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/></svg>,
  },
  {
    href: "/dashboard/calendar", label: "Calendar", badge: false,
    icon: <svg className="nav-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="17" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="16" y1="2" x2="16" y2="6"/></svg>,
  },
  {
    href: "/dashboard/tasks", label: "Tasks", badge: false,
    icon: <svg className="nav-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="17" rx="2.5"/><path d="M8 11l3 3 5-6"/></svg>,
  },
  {
    href: "/dashboard/reminders", label: "Reminders", badge: true,
    icon: <svg className="nav-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>,
  },
  {
    href: "/dashboard/notes", label: "Notes", badge: false,
    icon: <svg className="nav-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="13" y2="17"/></svg>,
  },
  {
    href: "/dashboard/timeline", label: "Timeline", badge: false,
    icon: <svg className="nav-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="6" x2="14" y2="6"/><line x1="3" y1="12" x2="11" y2="12"/><line x1="3" y1="18" x2="16" y2="18"/><circle cx="18" cy="6" r="2"/><circle cx="15" cy="12" r="2"/><circle cx="20" cy="18" r="2"/></svg>,
  },
  {
    href: "/dashboard/insights", label: "Insights", badge: false,
    icon: <svg className="nav-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><circle cx="12" cy="16" r=".5" fill="currentColor"/></svg>,
  },
  {
    href: "/dashboard/settings", label: "Settings", badge: false,
    icon: <svg className="nav-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
  },
  {
    href: "/dashboard/sync", label: "Sync & Logs", badge: false,
    icon: <svg className="nav-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>,
  },
];

export default function Sidebar({ reminderCount = 0 }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const [focusMode, setFocusMode] = useState(() =>
    typeof window !== "undefined" && localStorage.getItem("tempoflow_focus_mode") === "true"
  );

  useEffect(() => {
    const prefetchAll = () => nav.forEach(({ href }) => router.prefetch(href));
    if ("requestIdleCallback" in window) {
      const id = window.requestIdleCallback(prefetchAll, { timeout: 1200 });
      return () => window.cancelIdleCallback(id);
    }
    const id = globalThis.setTimeout(prefetchAll, 250);
    return () => globalThis.clearTimeout(id);
  }, [router]);

  useEffect(() => {
    document.documentElement.dataset.focusMode = focusMode ? "true" : "false";
  }, [focusMode]);

  function toggleFocusMode() {
    const next = !focusMode;
    setFocusMode(next);
    localStorage.setItem("tempoflow_focus_mode", String(next));
    document.documentElement.dataset.focusMode = next ? "true" : "false";
  }

  return (
    <>
      <style>{`
        .sidebar {
          background: var(--panel);
          border-right: 1px solid var(--line);
          padding: 22px 18px 20px;
          display: flex; flex-direction: column; gap: 6px;
          position: sticky; top: 0; height: 100vh; overflow-y: auto;
          width: 248px; flex-shrink: 0;
        }
        .brand { display: flex; align-items: center; gap: 12px; padding: 4px 6px 22px; }
        .brand-mark {
          width: 42px; height: 42px; border-radius: 14px;
          background: linear-gradient(135deg, #6366f1, #818cf8);
          display: grid; place-items: center; color: white;
          box-shadow: 0 6px 16px rgba(99,102,241,.28); flex-shrink: 0;
        }
        .brand-name { font-size: 19px; font-weight: 800; letter-spacing: -0.01em; color: var(--ink); }
        .brand-tag { font-size: 11.5px; color: var(--mut); margin-top: 1px; }
        .nav { display: flex; flex-direction: column; gap: 4px; margin-top: 2px; }
        .nav-item {
          display: flex; align-items: center; gap: 12px;
          padding: 11px 12px; border-radius: 11px;
          color: var(--ink-2); font-weight: 500; font-size: 14px;
          cursor: pointer; position: relative;
          transition: background .15s ease; text-decoration: none;
        }
        .nav-item:hover { background: #f6f7fb; }
        .nav-item.active { background: var(--indigo-soft); color: var(--indigo-deep); font-weight: 600; }
        .nav-item.active .nav-ico { color: var(--indigo-deep) !important; }
        .nav-ico { color: var(--mut); width: 18px; height: 18px; flex-shrink: 0; }
        .nav-badge {
          margin-left: auto; background: var(--red); color: white;
          font-size: 11px; font-weight: 700; padding: 2px 7px;
          border-radius: 99px; min-width: 22px; text-align: center;
        }
        .focus-card {
          margin-top: auto; background: #f8f8fc;
          border: 1px solid var(--line); border-radius: 16px;
          padding: 18px 14px 14px; text-align: center;
        }
        .focus-orb {
          width: 54px; height: 54px; margin: 4px auto 12px;
          border-radius: 50%; background: var(--violet-soft);
          display: grid; place-items: center; color: var(--violet);
        }
        .focus-title { font-weight: 700; font-size: 15px; color: var(--ink); }
        .focus-sub { font-size: 12px; color: var(--mut); margin: 4px 14px 14px; line-height: 1.4; }
        .focus-btn {
          width: 100%; padding: 10px 12px; background: var(--indigo);
          color: white; border: 0; border-radius: 10px;
          font-weight: 600; font-size: 13.5px; cursor: pointer;
          font-family: inherit; transition: background .15s ease;
        }
        .focus-btn:hover { background: var(--indigo-deep); }
        :root[data-focus-mode="true"] .dash-row-2,
        :root[data-focus-mode="true"] .dash-row-3,
        :root[data-focus-mode="true"] .filter-tabs,
        :root[data-focus-mode="true"] .seed-btn {
          display: none !important;
        }
        :root[data-focus-mode="true"] .dash-row-1 {
          grid-template-columns: 1fr !important;
        }
        .help-link {
          margin-top: 18px; display: flex; align-items: center; gap: 10px;
          color: var(--mut); font-size: 13px; cursor: pointer;
          padding: 6px 4px; justify-content: space-between;
          background: none; border: none; width: 100%; font-family: inherit;
        }
        .help-left { display: flex; align-items: center; gap: 10px; }
      `}</style>

      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>
            </svg>
          </div>
          <div>
            <div className="brand-name">TempoFlow</div>
            <div className="brand-tag">Master your time.</div>
          </div>
        </div>

        <nav className="nav">
          {nav.map(({ href, label, icon, badge }) => {
            const activePath = pendingHref && pendingHref !== pathname ? pendingHref : pathname;
            const active = activePath === href || (href !== "/dashboard" && activePath.startsWith(href));
            return (
              <Link
                key={href}
                href={href}
                prefetch
                className={`nav-item${active ? " active" : ""}`}
                onMouseEnter={() => router.prefetch(href)}
                onFocus={() => router.prefetch(href)}
                onPointerDown={() => setPendingHref(href)}
                onClick={() => setPendingHref(href)}
              >
                {icon}
                {label}
                {badge && reminderCount > 0 && (
                  <span className="nav-badge">{reminderCount}</span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="focus-card">
          <div className="focus-orb">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.4" fill="currentColor"/>
            </svg>
          </div>
          <div className="focus-title">Focus Mode</div>
          <div className="focus-sub">Minimize distractions<br/>and get things done.</div>
          <button className="focus-btn" onClick={toggleFocusMode}>
            {focusMode ? "Exit Focus" : "Start Focus"}
          </button>
        </div>

        <button className="help-link" onClick={() => signOut({ callbackUrl: "/login" })}>
          <div className="help-left">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            <span>Sign out</span>
          </div>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
      </aside>
    </>
  );
}
