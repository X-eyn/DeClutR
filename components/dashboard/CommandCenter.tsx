"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { format } from "date-fns";
import Modal from "@/components/ui/Modal";
import ItemForm from "@/components/dashboard/ItemForm";
import ItemCard from "@/components/dashboard/ItemCard";
import StatCards from "@/components/dashboard/widgets/StatCards";
import WorkloadChart from "@/components/dashboard/widgets/WorkloadChart";
import TimeAllocationDonut from "@/components/dashboard/widgets/TimeAllocationDonut";
import HeatmapCard from "@/components/dashboard/widgets/HeatmapCard";
import TimelineGantt from "@/components/dashboard/widgets/TimelineGantt";
import FreeTimeWindows from "@/components/dashboard/widgets/FreeTimeWindows";
import DeadlinesList from "@/components/dashboard/widgets/DeadlinesList";
import AgendaCard from "@/components/dashboard/widgets/AgendaCard";
import MiniCalendar from "@/components/dashboard/widgets/MiniCalendar";
import QuickNotes from "@/components/dashboard/widgets/QuickNotes";
import InsightsCard from "@/components/dashboard/widgets/InsightsCard";
import { interpretTimeLeft } from "@/lib/time";
import type { TemporalItemWithRelations, DashboardStats, CreateItemInput } from "@/types";

interface CommandCenterProps {
  initialItems: TemporalItemWithRelations[];
  stats: DashboardStats;
  googleConnected: boolean;
  user?: { name?: string | null; image?: string | null; email?: string | null };
}

const FILTERS = ["All", "Overdue", "Today", "This Week", "DEADLINE", "EVENT", "TASK", "REMINDER", "COMPLETED"] as const;

export default function CommandCenter({ initialItems, googleConnected, user }: CommandCenterProps) {
  const router = useRouter();
  const searchRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState(initialItems);
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<TemporalItemWithRelations | null>(null);
  const [listView, setListView] = useState(false);
  const [filter, setFilter] = useState<string>("All");
  const [search, setSearch] = useState("");
  const [showBell, setShowBell] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [seeding, setSeeding] = useState(false);

  async function handleSeed() {
    setSeeding(true);
    try {
      const res = await fetch("/api/seed", { method: "POST" });
      const json = await res.json();
      if (json.success) {
        // Reload items from server
        const itemsRes = await fetch("/api/items?limit=300");
        const newItems = await itemsRes.json();
        if (Array.isArray(newItems)) setItems(newItems);
      }
    } finally {
      setSeeding(false);
    }
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        searchRef.current?.focus();
        setListView(true);
      }
    }
    function onClickOutside() {
      setShowBell(false);
      setShowUserMenu(false);
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("click", onClickOutside);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("click", onClickOutside);
    };
  }, []);

  const stats = useMemo((): DashboardStats => {
    const now = new Date();
    const active = items.filter(i => i.status !== "COMPLETED" && i.status !== "ARCHIVED");
    return {
      total: active.length,
      overdue: active.filter(i => new Date(i.dueDate) < now).length,
      dueToday: active.filter(i => {
        const d = new Date(i.dueDate);
        return d.toDateString() === now.toDateString();
      }).length,
      dueThisWeek: active.filter(i => {
        const d = new Date(i.dueDate);
        const weekMs = 7 * 24 * 60 * 60 * 1000;
        return d >= now && d <= new Date(now.getTime() + weekMs);
      }).length,
      dueThisMonth: active.filter(i => {
        const d = new Date(i.dueDate);
        return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
      }).length,
      completed: items.filter(i => i.status === "COMPLETED").length,
    };
  }, [items]);

  const filteredItems = useMemo(() => {
    let result = items;
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(i =>
        i.title.toLowerCase().includes(q) ||
        i.description?.toLowerCase().includes(q) ||
        i.tags.some(t => t.name.toLowerCase().includes(q))
      );
    }
    switch (filter) {
      case "Overdue":
        result = result.filter(i => interpretTimeLeft(new Date(i.dueDate)).urgency === "overdue" && i.status !== "COMPLETED");
        break;
      case "Today":
        result = result.filter(i => interpretTimeLeft(new Date(i.dueDate)).daysUntil === 0 && i.status !== "COMPLETED");
        break;
      case "This Week":
        result = result.filter(i => { const tl = interpretTimeLeft(new Date(i.dueDate)); return tl.daysUntil >= 0 && tl.daysUntil <= 7 && i.status !== "COMPLETED"; });
        break;
      case "COMPLETED":
        result = result.filter(i => i.status === "COMPLETED");
        break;
      case "DEADLINE": case "EVENT": case "TASK": case "REMINDER":
        result = result.filter(i => i.type === filter && i.status !== "COMPLETED");
        break;
      default:
        result = result.filter(i => i.status !== "COMPLETED");
    }
    return result.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
  }, [items, filter, search]);

  async function handleCreate(data: CreateItemInput) {
    const res = await fetch("/api/items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (json.item) { setItems(prev => [json.item, ...prev]); setShowForm(false); }
  }

  async function handleUpdate(data: CreateItemInput) {
    if (!editItem) return;
    const res = await fetch(`/api/items/${editItem.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (json.item) { setItems(prev => prev.map(i => i.id === editItem.id ? json.item : i)); setEditItem(null); }
  }

  async function handleComplete(id: string) {
    const res = await fetch(`/api/items/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "COMPLETED" }),
    });
    const json = await res.json();
    if (json.item) setItems(prev => prev.map(i => i.id === id ? json.item : i));
  }

  async function handleDelete(id: string) {
    await fetch(`/api/items/${id}`, { method: "DELETE" });
    setItems(prev => prev.filter(i => i.id !== id));
  }

  // User initials for avatar fallback
  const initials = user?.name
    ? user.name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)
    : "U";
  const displayName = user?.name ?? "User";
  const dateStr = format(new Date(), "EEEE, MMMM d, yyyy");

  const showListView = listView || search.trim().length > 0;

  return (
    <>
      <style>{`
        .cc-wrap { padding: 22px 24px 40px; min-width: 0; }

        /* ===== TOPBAR ===== */
        .topbar {
          display: grid;
          grid-template-columns: auto 1fr auto auto auto auto auto;
          align-items: center;
          gap: 14px;
          margin-bottom: 24px;
        }
        .icon-btn {
          width: 38px; height: 38px; border-radius: 10px;
          background: white; border: 1px solid var(--line);
          display: grid; place-items: center;
          color: var(--mut); cursor: pointer; position: relative;
          flex-shrink: 0;
        }
        .tb-search {
          background: white; border: 1px solid var(--line);
          border-radius: 12px; padding: 9px 14px;
          display: flex; align-items: center; gap: 10px;
          max-width: 460px; width: 100%; justify-self: center;
        }
        .tb-search input {
          border: 0; outline: 0; flex: 1;
          font-family: inherit; font-size: 14px;
          color: var(--ink); background: transparent;
        }
        .tb-search input::placeholder { color: var(--mut-2); }
        .kbd {
          font-size: 11.5px; color: var(--mut);
          background: #f3f4f8; border: 1px solid var(--line);
          padding: 2px 7px; border-radius: 6px; font-weight: 600;
        }
        .date-pill {
          display: flex; align-items: center; gap: 10px;
          color: var(--ink-2); font-weight: 600; font-size: 14px;
          padding: 8px 4px; white-space: nowrap;
        }
        .connected-pill {
          display: inline-flex; align-items: center; gap: 9px;
          background: var(--green-tint); border: 1px solid #bbf7d0;
          color: #065f46; border-radius: 10px;
          padding: 8px 14px 8px 10px;
          font-size: 13px; font-weight: 600; cursor: pointer;
          white-space: nowrap;
        }
        .connected-pill.disconnected {
          background: #f8fafc; border-color: var(--line);
          color: var(--mut);
        }
        .connected-pill .dot {
          width: 7px; height: 7px; border-radius: 50%;
          background: #10b981; margin-left: 2px;
          box-shadow: 0 0 0 3px rgba(16,185,129,.18);
        }
        .connected-pill.disconnected .dot { background: #94a3b8; box-shadow: none; }
        .conn-ico { width: 20px; height: 20px; display: grid; place-items: center; flex: 0 0 20px; }
        .conn-ico svg { width: 20px; height: 20px; display: block; }
        .bell-btn { position: relative; }
        .red-dot {
          position: absolute; top: 8px; right: 9px;
          width: 8px; height: 8px; background: var(--red);
          border-radius: 50%; border: 2px solid white;
        }
        .dropdown-panel {
          position: absolute; top: calc(100% + 8px); right: 0;
          background: white; border: 1px solid var(--line);
          border-radius: 14px; box-shadow: 0 8px 32px rgba(0,0,0,.12);
          z-index: 100; min-width: 280px;
        }
        .dp-header {
          font-size: 13px; font-weight: 700; color: var(--ink);
          padding: 14px 16px 10px; border-bottom: 1px solid var(--line-2);
        }
        .dp-item {
          display: flex; align-items: flex-start; gap: 11px;
          padding: 12px 16px; border-bottom: 1px solid var(--line-2);
          font-size: 13px; color: var(--ink-2);
        }
        .dp-item:last-of-type { border-bottom: 0; }
        .dp-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--red); flex-shrink: 0; margin-top: 4px; }
        .dp-empty { padding: 20px 16px; text-align: center; color: var(--mut); font-size: 13px; }
        .user-dropdown { min-width: 200px; }
        .ud-info { padding: 14px 16px 10px; border-bottom: 1px solid var(--line-2); }
        .ud-name { font-weight: 700; font-size: 14px; color: var(--ink); }
        .ud-email { font-size: 12px; color: var(--mut); margin-top: 2px; }
        .ud-btn {
          display: flex; align-items: center; gap: 10px;
          padding: 11px 16px; font-size: 13.5px; color: var(--ink-2);
          cursor: pointer; width: 100%; background: none; border: none;
          font-family: inherit; text-align: left; border-radius: 0 0 14px 14px;
        }
        .ud-btn:hover { background: #f6f7fb; }
        .ud-btn.danger { color: var(--red); }
        .user-chip {
          display: flex; align-items: center; gap: 10px;
          background: white; border: 1px solid var(--line);
          border-radius: 12px; padding: 5px 14px 5px 5px;
          cursor: pointer;
        }
        .avatar {
          width: 36px; height: 36px; border-radius: 10px;
          background: linear-gradient(135deg, #fbbf24, #f97316);
          display: grid; place-items: center;
          color: white; font-weight: 700; font-size: 14px;
          overflow: hidden; position: relative; flex-shrink: 0;
        }
        .user-name { font-weight: 700; font-size: 14px; color: var(--ink); }

        /* ===== HEADLINE ===== */
        .headline {
          display: flex; justify-content: space-between;
          align-items: flex-start; gap: 28px; margin-bottom: 20px;
        }
        .h-title { font-size: 26px; font-weight: 800; letter-spacing: -0.02em; color: var(--ink); }
        .h-sub { color: var(--mut); margin-top: 6px; font-size: 14.5px; }
        .add-btn {
          display: inline-flex; align-items: center; gap: 7px;
          padding: 10px 18px; background: var(--indigo);
          border: none; border-radius: 11px;
          font-size: 13.5px; font-weight: 600; color: white;
          cursor: pointer; font-family: inherit;
          transition: background .15s; flex-shrink: 0;
        }
        .add-btn:hover { background: var(--indigo-deep); }
        .seed-btn {
          display: inline-flex; align-items: center; gap: 7px;
          padding: 10px 16px; background: #f0fdf4;
          border: 1px solid #86efac; border-radius: 11px;
          font-size: 13px; font-weight: 600; color: #15803d;
          cursor: pointer; font-family: inherit;
          transition: all .15s; flex-shrink: 0;
        }
        .seed-btn:hover { background: #dcfce7; }
        .seed-btn:disabled { opacity: .6; cursor: not-allowed; }
        .view-all-btn {
          display: inline-flex; align-items: center; gap: 7px;
          padding: 10px 16px; background: white;
          border: 1px solid var(--line); border-radius: 11px;
          font-size: 13px; font-weight: 500; color: var(--ink-2);
          cursor: pointer; font-family: inherit; transition: all .15s;
          margin-right: 8px;
        }
        .view-all-btn:hover { border-color: var(--indigo); color: var(--indigo); }
        .view-all-btn.active { background: var(--indigo-soft); border-color: var(--indigo-soft-2); color: var(--indigo-deep); }

        /* ===== DASHBOARD ROWS ===== */
        .dash-row { display: grid; gap: 18px; margin-bottom: 18px; }
        .dash-row-1 { grid-template-columns: 7fr 2fr 3fr; }
        .dash-row-2 { grid-template-columns: 4fr 5fr 3fr; }
        .dash-row-3 { grid-template-columns: 4fr 4fr 3fr 3fr; }

        /* ===== LIST VIEW ===== */
        .cc-filters { display: flex; align-items: center; gap: 6px; margin-bottom: 16px; flex-wrap: wrap; }
        .cc-filter-btn {
          padding: 6px 12px; border-radius: 8px; font-size: 12px; font-weight: 500;
          cursor: pointer; border: 1px solid transparent; font-family: inherit;
          background: none; color: var(--ink-2); transition: all .12s;
        }
        .cc-filter-btn:hover { background: var(--line-2); }
        .cc-filter-btn.active {
          background: var(--indigo-soft); color: var(--indigo-deep);
          border-color: var(--indigo-soft-2); font-weight: 600;
        }
        .cc-list-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 12px; }
        .cc-empty {
          grid-column: 1/-1; text-align: center; padding: 52px 0;
          color: var(--mut); font-size: 13.5px;
        }
      `}</style>

      <div className="cc-wrap">

        {/* ===== TOPBAR ===== */}
        <div className="topbar">
          {/* Hamburger / menu toggle */}
          <div className="icon-btn" onClick={() => setListView(v => !v)} title="Toggle list view">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/>
            </svg>
          </div>

          {/* Search */}
          <div className="tb-search">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              ref={searchRef}
              placeholder="Search everything..."
              value={search}
              onChange={e => { setSearch(e.target.value); if (e.target.value) setListView(true); }}
            />
            <span className="kbd">⌘ K</span>
          </div>

          {/* Date */}
          <div className="date-pill">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="17" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/>
              <line x1="8" y1="2" x2="8" y2="6"/><line x1="16" y1="2" x2="16" y2="6"/>
            </svg>
            {dateStr}
          </div>

          {/* Google Calendar */}
          <div
            className={`connected-pill${googleConnected ? "" : " disconnected"}`}
            onClick={() => router.push("/dashboard/sync")}
            title="Manage Google integrations"
          >
            <span className="conn-ico">
              <svg viewBox="0 0 200 200" aria-hidden="true" focusable="false">
                <g transform="translate(3.75 3.75)">
                  <path fill="#FFFFFF" d="M148.882 43.618l-47.368-5.263-57.895 5.263L38.355 96.25l5.263 52.632 52.632 6.579 52.632-6.579 5.263-53.947-5.263-51.317z" />
                  <path fill="#1A73E8" d="M65.211 125.276c-3.934-2.658-6.658-6.539-8.145-11.671l9.132-3.763c.829 3.158 2.276 5.605 4.342 7.342 2.053 1.737 4.553 2.592 7.474 2.592 2.987 0 5.553-.908 7.697-2.724s3.224-4.132 3.224-6.934c0-2.868-1.132-5.211-3.395-7.026s-5.105-2.724-8.5-2.724h-5.276v-9.039H76.5c2.921 0 5.382-.789 7.382-2.368 2-1.579 3-3.737 3-6.487 0-2.447-.895-4.395-2.684-5.855s-4.053-2.197-6.803-2.197c-2.684 0-4.816.711-6.395 2.145s-2.724 3.197-3.447 5.276l-9.039-3.763c1.197-3.395 3.395-6.395 6.618-8.987 3.224-2.592 7.342-3.895 12.342-3.895 3.697 0 7.026.711 9.974 2.145 2.947 1.434 5.263 3.421 6.934 5.947 1.671 2.539 2.5 5.382 2.5 8.539 0 3.224-.776 5.947-2.329 8.184-1.553 2.237-3.461 3.947-5.724 5.145v.539c2.987 1.25 5.421 3.158 7.342 5.724 1.908 2.566 2.868 5.632 2.868 9.211s-.908 6.776-2.724 9.579c-1.816 2.803-4.329 5.013-7.513 6.618-3.197 1.605-6.789 2.421-10.776 2.421-4.616.005-8.879-1.324-12.813-3.982z" />
                  <path fill="#1A73E8" d="M121.25 79.961l-9.974 7.25-5.013-7.605 17.987-12.974h6.895v61.197h-9.895V79.961z" />
                  <path fill="#EA4335" d="M148.882 196.25l47.368-47.368-23.684-10.526-23.684 10.526-10.526 23.684 10.526 23.684z" />
                  <path fill="#34A853" d="M33.092 172.566l10.526 23.684h105.263v-47.368H43.618l-10.526 23.684z" />
                  <path fill="#4285F4" d="M12.039-3.75C3.316-3.75-3.75 3.316-3.75 12.039v136.842l23.684 10.526 23.684-10.526V43.618h105.263l10.526-23.684L148.882-3.75H12.039z" />
                  <path fill="#188038" d="M-3.75 148.882v31.579c0 8.724 7.066 15.789 15.789 15.789h31.579v-47.368H-3.75z" />
                  <path fill="#FBBC04" d="M148.882 43.618v105.263h47.368V43.618l-23.684-10.526-23.684 10.526z" />
                  <path fill="#1967D2" d="M196.25 43.618V12.039c0-8.724-7.066-15.789-15.789-15.789h-31.579v47.368h47.368z" />
                </g>
              </svg>
            </span>
            {googleConnected ? "Google Calendar Connected" : "Connect Google Calendar"}
            <span className="dot" />
          </div>

          {/* Google Tasks */}
          <div
            className={`connected-pill${googleConnected ? "" : " disconnected"}`}
            onClick={() => router.push("/dashboard/sync")}
            title="Manage Google Tasks integration"
          >
            <span className="conn-ico">
              <svg viewBox="0 0 527.15 500" aria-hidden="true" focusable="false">
                <polygon fill="#0066DA" points="410.4,58.3 368.8,81.2 348.2,120.6 368.8,168.8 407.8,211 450,187.5 475.9,142.8 450,87.5" />
                <path fill="#2684FC" d="M249.3 219.4l98.9-98.9c29.1 22.1 50.5 53.8 59.6 90.4L272.1 346.7c-12.2 12.2-32 12.2-44.2 0l-91.5-91.5c-9.8-9.8-9.8-25.6 0-35.3l39-39c9.8-9.8 25.6-9.8 35.3 0l38.6 38.5zM519.8 63.6l-39.7-39.7c-9.7-9.7-25.6-9.7-35.3 0l-34.4 34.4c27.5 23 49.9 51.8 65.5 84.5l43.9-43.9c9.8-9.7 9.8-25.6 0-35.3zM412.5 250c0 89.8-72.8 162.5-162.5 162.5S87.5 339.8 87.5 250 160.2 87.5 250 87.5c36.9 0 70.9 12.3 98.2 33.1l62.2-62.2C367 21.9 311.1 0 250 0 111.9 0 0 111.9 0 250s111.9 250 250 250 250-111.9 250-250c0-38.3-8.7-74.7-24.1-107.2L407.8 211c3 12.5 4.7 25.6 4.7 39z" />
              </svg>
            </span>
            {googleConnected ? "Google Tasks Connected" : "Connect Tasks"}
            <span className="dot" />
          </div>

          {/* Bell */}
          <div
            className="icon-btn bell-btn"
            onClick={() => { setShowBell(v => !v); setShowUserMenu(false); }}
            style={{ position: "relative" }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/>
              <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>
            </svg>
            {stats.overdue > 0 && <span className="red-dot" />}
            {showBell && (
              <div className="dropdown-panel" onClick={e => e.stopPropagation()}>
                <div className="dp-header">Notifications {stats.overdue > 0 && `· ${stats.overdue} overdue`}</div>
                {items.filter(i => i.status !== "COMPLETED" && i.status !== "ARCHIVED" && new Date(i.dueDate) < new Date()).slice(0, 5).map(item => (
                  <div key={item.id} className="dp-item" onClick={() => { setEditItem(item); setShowBell(false); }}>
                    <span className="dp-dot" />
                    <div>
                      <div style={{ fontWeight: 600, color: "var(--ink)", marginBottom: 2 }}>{item.title}</div>
                      <div style={{ fontSize: 12, color: "var(--mut)" }}>Overdue · {new Date(item.dueDate).toLocaleDateString()}</div>
                    </div>
                  </div>
                ))}
                {stats.overdue === 0 && <div className="dp-empty">All caught up!</div>}
              </div>
            )}
          </div>

          {/* User chip */}
          <div
            className="user-chip"
            onClick={() => { setShowUserMenu(v => !v); setShowBell(false); }}
            style={{ position: "relative" }}
          >
            <div className="avatar">
              {user?.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={user.image} alt={displayName} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                <svg viewBox="0 0 36 36" style={{ width: "100%", height: "100%" }}>
                  <rect width="36" height="36" fill="#fde68a"/>
                  <circle cx="18" cy="14.5" r="6.5" fill="#f3d2a8"/>
                  <path d="M5 36c0-7.5 5.8-12 13-12s13 4.5 13 12z" fill="#1e3a8a"/>
                  <text x="18" y="19" textAnchor="middle" fontSize="11" fontWeight="800" fill="#1e293b" fontFamily="system-ui">{initials}</text>
                </svg>
              )}
            </div>
            <div className="user-name">{displayName}</div>
            {showUserMenu && (
              <div className="dropdown-panel user-dropdown" onClick={e => e.stopPropagation()}>
                <div className="ud-info">
                  <div className="ud-name">{displayName}</div>
                  <div className="ud-email">{user?.email}</div>
                </div>
                <button className="ud-btn" onClick={() => { router.push("/dashboard/settings"); setShowUserMenu(false); }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
                  Settings
                </button>
                <button className="ud-btn danger" onClick={() => signOut({ callbackUrl: "/login" })}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ===== HEADLINE ===== */}
        <div className="headline">
          <div>
            <div className="h-title">Your Time at a Glance</div>
            <div className="h-sub">Understand your deadlines, events, and free time instantly.</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {items.length === 0 && (
              <button className="seed-btn" onClick={handleSeed} disabled={seeding}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2a10 10 0 1 0 10 10"/><path d="M12 6v6l4 2"/>
                </svg>
                {seeding ? "Loading…" : "Load demo data"}
              </button>
            )}
            <button
              className={`view-all-btn${showListView ? " active" : ""}`}
              onClick={() => { setListView(v => !v); if (listView) setSearch(""); }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/>
                <line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
              </svg>
              All Items
            </button>
            <button className="add-btn" onClick={() => setShowForm(true)}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              Add Item
            </button>
          </div>
        </div>

        {showListView ? (
          /* ---- List View ---- */
          <>
            <div className="cc-filters">
              {FILTERS.map(f => (
                <button
                  key={f}
                  className={`cc-filter-btn${filter === f ? " active" : ""}`}
                  onClick={() => setFilter(f)}
                >
                  {f}
                </button>
              ))}
            </div>
            <div className="cc-list-grid">
              {filteredItems.length === 0 ? (
                <div className="cc-empty">
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: "0 auto 12px", display: "block" }}>
                    <circle cx="12" cy="12" r="9"/><path d="M8 12h8"/>
                  </svg>
                  No items found.{" "}
                  <button
                    onClick={() => setShowForm(true)}
                    style={{ color: "var(--indigo)", textDecoration: "underline", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: "inherit" }}
                  >
                    Add one?
                  </button>
                </div>
              ) : (
                filteredItems.map(item => (
                  <ItemCard key={item.id} item={item} onComplete={handleComplete} onDelete={handleDelete} onEdit={setEditItem} />
                ))
              )}
            </div>
          </>
        ) : (
          /* ---- Dashboard View ---- */
          <>
            {/* ROW 1: Stat Cards (7fr) | Weekly Workload (2fr) | Time Allocation (3fr) */}
            <div className="dash-row dash-row-1">
              <StatCards stats={stats} items={items} onEdit={setEditItem} onComplete={handleComplete} onDelete={handleDelete} />
              <WorkloadChart items={items} onEdit={setEditItem} onComplete={handleComplete} onDelete={handleDelete} />
              <TimeAllocationDonut items={items} />
            </div>

            {/* ROW 2: Heatmap (4fr) | Timeline (5fr) | Free Windows (3fr) */}
            <div className="dash-row dash-row-2">
              <HeatmapCard items={items} onEdit={setEditItem} />
              <TimelineGantt items={items} onEdit={setEditItem} />
              <FreeTimeWindows items={items} />
            </div>

            {/* ROW 3: Deadlines (4fr) | Agenda (4fr) | Calendar (3fr) | Notes+Insights (3fr) */}
            <div className="dash-row dash-row-3">
              <DeadlinesList items={items} onEdit={setEditItem} />
              <AgendaCard items={items} onEdit={setEditItem} />
              <MiniCalendar items={items} />
              <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                <QuickNotes items={items} onComplete={handleComplete} onAddItem={() => router.push("/dashboard/notes")} />
                <InsightsCard stats={stats} items={items} />
              </div>
            </div>
          </>
        )}
      </div>

      {/* Create modal */}
      <Modal open={showForm} onClose={() => setShowForm(false)} title="Add New Item">
        <ItemForm onSubmit={handleCreate} onCancel={() => setShowForm(false)} googleConnected={googleConnected} />
      </Modal>

      {/* Edit modal */}
      <Modal open={!!editItem} onClose={() => setEditItem(null)} title="Edit Item">
        {editItem && (
          <ItemForm
            onSubmit={handleUpdate}
            onCancel={() => setEditItem(null)}
            googleConnected={googleConnected}
            initialData={{
              title: editItem.title,
              description: editItem.description ?? undefined,
              type: editItem.type as CreateItemInput["type"],
              priority: editItem.priority as CreateItemInput["priority"],
              dueDate: editItem.dueDate as unknown as string,
              startDate: editItem.startDate as unknown as string | undefined,
              allDay: editItem.allDay,
              reminderMinutes: editItem.reminderMinutes,
              tags: editItem.tags.map(t => t.name),
            }}
          />
        )}
      </Modal>
    </>
  );
}
