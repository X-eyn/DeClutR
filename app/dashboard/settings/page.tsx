"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { signOut } from "next-auth/react";
import { useItems } from "@/components/dashboard/ItemsProvider";
import UserAvatar from "@/components/ui/UserAvatar";

const PREFS_KEY = "tempoflow_prefs";

interface Prefs {
  defaultPriority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  defaultType: "DEADLINE" | "EVENT" | "REMINDER" | "TASK";
}

const DEFAULT_PREFS: Prefs = {
  defaultPriority: "MEDIUM",
  defaultType: "TASK",
};

interface GoogleStatus {
  connected: boolean;
  scopes: string[];
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: "var(--panel)", border: "1.5px solid var(--line)",
      borderRadius: 18, padding: "24px 26px", marginBottom: 18,
    }}>
      <div style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)", marginBottom: 20 }}>{title}</div>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 16 }}>
      <label style={{ fontSize: 11.5, fontWeight: 600, color: "var(--mut)", textTransform: "uppercase", letterSpacing: ".04em" }}>
        {label}
      </label>
      {children}
    </div>
  );
}

function SelectInput({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      style={{
        background: "var(--bg)", border: "1.5px solid var(--line)",
        borderRadius: 10, padding: "9px 12px",
        fontSize: 13.5, color: "var(--ink)", fontFamily: "inherit",
        outline: "none", cursor: "pointer", maxWidth: 280,
      }}
    >
      {options.map(o => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

export default function SettingsPage() {
  const { data: session, status } = useSession();
  const { items, deleteItem } = useItems();
  const [googleStatus, setGoogleStatus] = useState<GoogleStatus | null>(null);
  const [prefs, setPrefs] = useState<Prefs>(() => {
    if (typeof window === "undefined") return DEFAULT_PREFS;
    try {
      const stored = localStorage.getItem(PREFS_KEY);
      return stored ? { ...DEFAULT_PREFS, ...JSON.parse(stored) } : DEFAULT_PREFS;
    } catch {
      return DEFAULT_PREFS;
    }
  });
  const [toast, setToast] = useState<{ msg: string; type: "info" | "error" | "success" } | null>(null);
  const [clearLoading, setClearLoading] = useState(false);

  useEffect(() => {
    fetch("/api/google/connect")
      .then(r => r.json())
      .then(d => setGoogleStatus({ connected: d.connected ?? false, scopes: d.scopes ?? [] }))
      .catch(() => setGoogleStatus({ connected: false, scopes: [] }));
  }, []);

  function showToast(msg: string, type: "info" | "error" | "success" = "info") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 5000);
  }

  function savePrefs(updated: Partial<Prefs>) {
    const next = { ...prefs, ...updated };
    setPrefs(next);
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
    showToast("Preferences saved.", "success");
  }

  async function handleClearCompleted() {
    if (!confirm("This will permanently delete all completed items. Continue?")) return;
    const completedItems = items.filter((item) => item.status === "COMPLETED");
    if (completedItems.length === 0) {
      showToast("No completed items to clear.", "info");
      return;
    }

    setClearLoading(true);
    try {
      await Promise.all(completedItems.map((item) => deleteItem(item.id)));
      showToast(`Deleted ${completedItems.length} completed item${completedItems.length === 1 ? "" : "s"}.`, "success");
    } catch {
      showToast("Something went wrong. Please try again.", "error");
    } finally {
      setClearLoading(false);
    }
  }

  function handleDisconnectGoogle() {
    showToast(
      "To disconnect Google, revoke access at myaccount.google.com/permissions",
      "info"
    );
  }

  const user = session?.user;

  const hasCalendar = googleStatus?.scopes.some(s => s.includes("calendar")) ?? false;
  const hasTasks = googleStatus?.scopes.some(s => s.includes("tasks")) ?? false;

  return (
    <>
      <style>{`
        .set-wrap { padding: 22px 24px 40px; min-width: 0; max-width: 720px; }
        .set-title { font-size: 26px; font-weight: 800; letter-spacing: -0.02em; color: var(--ink); }
        .set-sub { color: var(--mut); margin-top: 6px; font-size: 14.5px; margin-bottom: 28px; }

        .profile-row { display: flex; align-items: center; gap: 18px; }
        .profile-avatar {
          width: 64px; height: 64px; border-radius: 18px; flex-shrink: 0;
          background: linear-gradient(135deg, #fbbf24, #f97316);
          display: grid; place-items: center; overflow: hidden;
          font-size: 22px; font-weight: 800; color: white;
        }
        .profile-info { flex: 1; }
        .profile-name { font-size: 18px; font-weight: 700; color: var(--ink); margin-bottom: 3px; }
        .profile-email { font-size: 13.5px; color: var(--mut); margin-bottom: 8px; }
        .profile-note {
          display: inline-flex; align-items: center; gap: 6px;
          font-size: 12px; color: var(--mut-2); background: var(--line-2);
          padding: 4px 10px; border-radius: 8px;
        }

        .google-status { display: flex; flex-direction: column; gap: 12px; }
        .google-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
        .scope-pills { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 2px; }
        .scope-pill {
          display: inline-flex; align-items: center; gap: 5px;
          font-size: 12px; font-weight: 600; padding: 4px 10px;
          border-radius: 99px; border: 1.5px solid;
        }
        .scope-pill.on { background: var(--green-tint); border-color: #bbf7d0; color: #065f46; }
        .scope-pill.off { background: var(--line-2); border-color: var(--line); color: var(--mut); }

        .connect-btn {
          display: inline-flex; align-items: center; gap: 7px;
          padding: 9px 18px; background: var(--indigo);
          border: none; border-radius: 10px;
          font-size: 13px; font-weight: 600; color: white;
          cursor: pointer; font-family: inherit;
          transition: background .15s; text-decoration: none; flex-shrink: 0;
        }
        .connect-btn:hover { background: var(--indigo-deep); }
        .disconnect-btn {
          display: inline-flex; align-items: center; gap: 7px;
          padding: 9px 18px; background: var(--bg);
          border: 1.5px solid var(--line); border-radius: 10px;
          font-size: 13px; font-weight: 600; color: var(--mut);
          cursor: pointer; font-family: inherit;
          transition: all .15s; flex-shrink: 0;
        }
        .disconnect-btn:hover { border-color: var(--red); color: var(--red); background: var(--red-tint); }

        .danger-row { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 14px 0; border-bottom: 1px solid var(--line); }
        .danger-row:last-child { border-bottom: none; }
        .danger-info { flex: 1; }
        .danger-label { font-size: 14px; font-weight: 600; color: var(--ink); margin-bottom: 3px; }
        .danger-desc { font-size: 12.5px; color: var(--mut); }
        .danger-btn {
          flex-shrink: 0; padding: 9px 18px;
          border-radius: 10px; font-size: 13px; font-weight: 600;
          cursor: pointer; font-family: inherit;
          transition: all .15s; border: 1.5px solid;
        }
        .danger-btn.red { background: var(--red-tint); border-color: #fca5a5; color: var(--red); }
        .danger-btn.red:hover { background: var(--red); color: white; border-color: var(--red); }
        .danger-btn.red:disabled { opacity: .5; cursor: not-allowed; }

        /* Toast */
        .settings-toast {
          position: fixed; bottom: 28px; right: 28px; z-index: 100;
          padding: 13px 20px; border-radius: 12px;
          font-size: 13.5px; font-weight: 500; max-width: 400px;
          box-shadow: 0 8px 32px rgba(15,23,42,.12);
          display: flex; align-items: flex-start; gap: 10px;
          animation: toast-in .2s ease;
        }
        .settings-toast.info { background: var(--indigo-soft); color: var(--indigo-deep); border: 1px solid var(--indigo-soft-2); }
        .settings-toast.success { background: var(--green-tint); color: #065f46; border: 1px solid #bbf7d0; }
        .settings-toast.error { background: var(--red-tint); color: var(--red); border: 1px solid #fca5a5; }
        @keyframes toast-in { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
        .toast-link { color: inherit; text-underline-offset: 2px; }
      `}</style>

      <div className="set-wrap">
        <div className="set-title">Settings</div>
        <div className="set-sub">Manage your profile, integrations and preferences.</div>

        {/* Profile */}
        <SectionCard title="Profile">
          {status === "loading" ? (
            <div style={{ height: 64, background: "var(--line)", borderRadius: 12, animation: "skeleton-pulse 1.6s ease-in-out infinite" }} />
          ) : (
            <div className="profile-row">
              <UserAvatar className="profile-avatar" src={user?.image} name={user?.name} email={user?.email} />
              <div className="profile-info">
                <div className="profile-name">{user?.name ?? "User"}</div>
                <div className="profile-email">{user?.email ?? ""}</div>
                <div className="profile-note">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="9"/>
                    <path d="M12 8v4"/><circle cx="12" cy="16" r=".5" fill="currentColor"/>
                  </svg>
                  Your account is managed by Google Sign-In
                </div>
              </div>
            </div>
          )}
          <style>{`@keyframes skeleton-pulse { 0%,100%{opacity:1} 50%{opacity:.5} }`}</style>
        </SectionCard>

        {/* Google Integration */}
        <SectionCard title="Google Integration">
          {googleStatus === null ? (
            <div style={{ color: "var(--mut)", fontSize: 13.5 }}>Checking connection…</div>
          ) : googleStatus.connected ? (
            <div className="google-status">
              <div className="google-row">
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--ink)", marginBottom: 10 }}>
                    Connected to Google
                  </div>
                  <div className="scope-pills">
                    <span className={`scope-pill ${hasCalendar ? "on" : "off"}`}>
                      {hasCalendar ? (
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                      ) : (
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                      )}
                      Google Calendar
                    </span>
                    <span className={`scope-pill ${hasTasks ? "on" : "off"}`}>
                      {hasTasks ? (
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                      ) : (
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                      )}
                      Google Tasks
                    </span>
                  </div>
                </div>
                <button className="disconnect-btn" onClick={handleDisconnectGoogle}>
                  Disconnect
                </button>
              </div>
              {googleStatus.scopes.length > 0 && (
                <div style={{ fontSize: 12, color: "var(--mut)", background: "var(--line-2)", borderRadius: 10, padding: "10px 12px" }}>
                  <strong style={{ color: "var(--mut)" }}>Granted scopes: </strong>
                  {googleStatus.scopes.join(", ")}
                </div>
              )}
            </div>
          ) : (
            <div>
              <div style={{ fontSize: 13.5, color: "var(--mut)", marginBottom: 16 }}>
                Connect your Google account to sync items to Google Calendar and Google Tasks.
              </div>
              <Link href="/api/auth/signin/google" className="connect-btn">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>
                </svg>
                Connect Google
              </Link>
            </div>
          )}
        </SectionCard>

        {/* Preferences */}
        <SectionCard title="Preferences">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
            <Field label="Default Priority">
              <SelectInput
                value={prefs.defaultPriority}
                onChange={v => savePrefs({ defaultPriority: v as Prefs["defaultPriority"] })}
                options={[
                  { value: "LOW", label: "Low" },
                  { value: "MEDIUM", label: "Medium" },
                  { value: "HIGH", label: "High" },
                  { value: "CRITICAL", label: "Critical" },
                ]}
              />
            </Field>
            <Field label="Default Item Type">
              <SelectInput
                value={prefs.defaultType}
                onChange={v => savePrefs({ defaultType: v as Prefs["defaultType"] })}
                options={[
                  { value: "TASK", label: "Task" },
                  { value: "DEADLINE", label: "Deadline" },
                  { value: "EVENT", label: "Event" },
                  { value: "REMINDER", label: "Reminder" },
                ]}
              />
            </Field>
          </div>
          <div style={{ fontSize: 12, color: "var(--mut-2)", marginTop: 4 }}>
            These preferences are stored locally in your browser and are not synced across devices.
          </div>
        </SectionCard>

        {/* Danger Zone */}
        <SectionCard title="Danger Zone">
          <div className="danger-row">
            <div className="danger-info">
              <div className="danger-label">Sign Out</div>
              <div className="danger-desc">You will be redirected to the login page.</div>
            </div>
            <button
              className="danger-btn red"
              onClick={() => signOut({ callbackUrl: "/login" })}
            >
              Sign Out
            </button>
          </div>
          <div className="danger-row">
            <div className="danger-info">
              <div className="danger-label">Clear All Completed Items</div>
              <div className="danger-desc">Permanently delete all items with &quot;Completed&quot; status. This cannot be undone.</div>
            </div>
            <button
              className="danger-btn red"
              disabled={clearLoading}
              onClick={handleClearCompleted}
            >
              {clearLoading ? "Clearing…" : "Clear Completed"}
            </button>
          </div>
        </SectionCard>
      </div>

      {/* Toast */}
      {toast && (
        <div className={`settings-toast ${toast.type}`}>
          {toast.type === "info" && (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
              <circle cx="12" cy="12" r="9"/>
              <path d="M12 8v4"/><circle cx="12" cy="16" r=".5" fill="currentColor"/>
            </svg>
          )}
          {toast.type === "success" && (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          )}
          {toast.type === "error" && (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
              <circle cx="12" cy="12" r="9"/>
              <line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
            </svg>
          )}
          <span>
            {toast.msg}
            {toast.type === "info" && toast.msg.includes("myaccount.google.com") && (
              <>
                {" — "}
                <a
                  href="https://myaccount.google.com/permissions"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="toast-link"
                  style={{ fontWeight: 600 }}
                >
                  Open Google permissions
                </a>
              </>
            )}
          </span>
          <button
            onClick={() => setToast(null)}
            style={{ background: "none", border: "none", cursor: "pointer", color: "inherit", marginLeft: "auto", padding: 0, flexShrink: 0, display: "grid", placeItems: "center" }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
      )}
    </>
  );
}
