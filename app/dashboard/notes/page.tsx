"use client";

import { useState, useEffect } from "react";
import Modal from "@/components/ui/Modal";
import ItemForm from "@/components/dashboard/ItemForm";
import type { TemporalItemWithRelations, CreateItemInput } from "@/types";
import { format } from "date-fns";

function isNoteItem(item: TemporalItemWithRelations) {
  return item.type === "TASK" && item.status !== "ARCHIVED" && new Date(item.dueDate).getFullYear() >= 2099;
}

export default function NotesPage() {
  const [notes, setNotes] = useState<TemporalItemWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [editNote, setEditNote] = useState<TemporalItemWithRelations | null>(null);
  const [googleConnected, setGoogleConnected] = useState(false);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/items?type=TASK&limit=500")
      .then(res => res.json())
      .then(json => {
        if (cancelled) return;
        const items = Array.isArray(json) ? json : json.items ?? [];
        setNotes(items.filter(isNoteItem));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    fetch("/api/google/connect")
      .then(r => r.json())
      .then(d => {
        if (!cancelled) setGoogleConnected(d.connected ?? false);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, []);

  const filteredNotes = notes.filter(n => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      n.title.toLowerCase().includes(q) ||
      (n.description ?? "").toLowerCase().includes(q) ||
      n.tags.some(t => t.name.toLowerCase().includes(q))
    );
  });

  async function handleCreate(data: CreateItemInput) {
    const payload: CreateItemInput = {
      ...data,
      type: "TASK",
      dueDate: "2099-12-31T00:00:00.000Z",
    };
    const res = await fetch("/api/items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (json.item) {
      setNotes(prev => [json.item, ...prev]);
      setShowCreate(false);
    }
  }

  async function handleUpdate(data: CreateItemInput) {
    if (!editNote) return;
    const res = await fetch(`/api/items/${editNote.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (json.item) {
      setNotes(prev => prev.map(n => n.id === editNote.id ? json.item : n));
      setEditNote(null);
    }
  }

  async function handleDelete(id: string) {
    const previous = notes;
    setNotes(prev => prev.filter(n => n.id !== id));
    try {
      const res = await fetch(`/api/items/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete note");
    } catch {
      setNotes(previous);
    }
  }

  return (
    <>
      <style>{`
        .notes-wrap { padding: 22px 24px 40px; min-width: 0; }

        .notes-header {
          display: flex; align-items: flex-start; justify-content: space-between;
          gap: 20px; margin-bottom: 24px;
        }
        .notes-title { font-size: 26px; font-weight: 800; letter-spacing: -0.02em; color: var(--ink); }
        .notes-sub { color: var(--mut); margin-top: 6px; font-size: 14.5px; }

        .notes-toolbar {
          display: flex; align-items: center; gap: 10px; margin-bottom: 24px;
        }
        .notes-search {
          flex: 1; max-width: 440px;
          background: var(--panel); border: 1.5px solid var(--line);
          border-radius: 12px; padding: 10px 14px;
          display: flex; align-items: center; gap: 10px;
        }
        .notes-search input {
          border: 0; outline: 0; flex: 1;
          font-family: inherit; font-size: 14px;
          color: var(--ink); background: transparent;
        }
        .notes-search input::placeholder { color: var(--mut-2); }
        .notes-search:focus-within { border-color: var(--indigo); }

        .notes-add-btn {
          display: inline-flex; align-items: center; gap: 7px;
          padding: 10px 18px; background: var(--indigo);
          border: none; border-radius: 11px;
          font-size: 13.5px; font-weight: 600; color: white;
          cursor: pointer; font-family: inherit;
          transition: background .15s; flex-shrink: 0;
        }
        .notes-add-btn:hover { background: var(--indigo-deep); }

        .notes-count {
          font-size: 13px; color: var(--mut); padding: 0 4px;
        }

        /* Masonry grid */
        .notes-masonry {
          columns: 3 280px; gap: 16px;
        }
        .note-card {
          break-inside: avoid; margin-bottom: 16px;
          background: var(--panel); border: 1.5px solid var(--line);
          border-radius: 16px; padding: 18px 18px 14px;
          cursor: pointer; transition: box-shadow .15s, border-color .15s;
          position: relative;
        }
        .note-card:hover {
          box-shadow: 0 4px 24px rgba(15,23,42,.08);
          border-color: #d8d9e3;
        }
        .note-card-title {
          font-size: 15px; font-weight: 700; color: var(--ink);
          line-height: 1.35; margin-bottom: 8px; padding-right: 52px;
        }
        .note-card-body {
          font-size: 13px; color: var(--mut); line-height: 1.55;
          display: -webkit-box; -webkit-line-clamp: 6; -webkit-box-orient: vertical; overflow: hidden;
          margin-bottom: 12px; white-space: pre-wrap; word-break: break-word;
        }
        .note-card-footer {
          display: flex; align-items: center; flex-wrap: wrap; gap: 6px;
          border-top: 1px solid var(--line); padding-top: 10px; margin-top: 4px;
        }
        .note-date { font-size: 11.5px; color: var(--mut-2); }
        .note-tag {
          font-size: 11px; padding: 2px 8px; border-radius: 99px;
          background: var(--indigo-soft); color: var(--indigo-deep);
          font-weight: 500;
        }
        .note-actions {
          position: absolute; top: 14px; right: 14px;
          display: flex; gap: 4px;
          opacity: 0; transition: opacity .15s;
        }
        .note-card:hover .note-actions { opacity: 1; }
        .note-action-btn {
          width: 28px; height: 28px; border-radius: 7px; border: none;
          background: none; cursor: pointer; display: grid; place-items: center;
          color: var(--mut); transition: all .12s; font-family: inherit;
        }
        .note-action-btn:hover.edit { color: var(--indigo); background: var(--indigo-soft); }
        .note-action-btn:hover.del { color: var(--red); background: var(--red-tint); }

        /* Empty state */
        .notes-empty {
          text-align: center; padding: 80px 40px;
          color: var(--mut);
        }
        .notes-empty-icon {
          width: 72px; height: 72px; border-radius: 24px;
          background: var(--indigo-soft); display: grid; place-items: center;
          margin: 0 auto 20px; color: var(--indigo);
        }
        .notes-empty-title { font-size: 18px; font-weight: 700; color: var(--ink); margin-bottom: 8px; }
        .notes-empty-sub { font-size: 14px; color: var(--mut); margin-bottom: 24px; }
        .notes-empty-btn {
          display: inline-flex; align-items: center; gap: 7px;
          padding: 11px 22px; background: var(--indigo);
          border: none; border-radius: 11px;
          font-size: 14px; font-weight: 600; color: white;
          cursor: pointer; font-family: inherit;
          transition: background .15s;
        }
        .notes-empty-btn:hover { background: var(--indigo-deep); }

        .notes-skeleton {
          columns: 3 280px; gap: 16px;
        }
        .skeleton-card {
          break-inside: avoid; margin-bottom: 16px;
          background: var(--panel); border: 1.5px solid var(--line);
          border-radius: 16px; padding: 18px;
          animation: skeleton-pulse 1.6s ease-in-out infinite;
        }
        .skeleton-line {
          background: var(--line); border-radius: 6px; margin-bottom: 8px;
        }
        @keyframes skeleton-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: .5; }
        }
      `}</style>

      <div className="notes-wrap">
        {/* Header */}
        <div className="notes-header">
          <div>
            <div className="notes-title">Notes</div>
            <div className="notes-sub">Your personal notebook — capture ideas, thoughts and more.</div>
          </div>
          <button className="notes-add-btn" onClick={() => setShowCreate(true)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            New Note
          </button>
        </div>

        {/* Toolbar */}
        <div className="notes-toolbar">
          <div className="notes-search">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              placeholder="Search notes…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--mut)", padding: 0, display: "grid", placeItems: "center" }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            )}
          </div>
          {!loading && (
            <span className="notes-count">
              {filteredNotes.length} {filteredNotes.length === 1 ? "note" : "notes"}
              {search && notes.length !== filteredNotes.length && ` of ${notes.length}`}
            </span>
          )}
        </div>

        {/* Content */}
        {loading ? (
          <div className="notes-skeleton">
            {[120, 80, 160, 100, 90, 140].map((h, i) => (
              <div key={i} className="skeleton-card">
                <div className="skeleton-line" style={{ height: 16, width: "75%" }} />
                <div className="skeleton-line" style={{ height: 12, width: "100%" }} />
                <div className="skeleton-line" style={{ height: 12, width: "88%" }} />
                <div className="skeleton-line" style={{ height: 12, width: "60%", marginBottom: 0 }} />
                <div style={{ height: h - 80, minHeight: 0 }} />
              </div>
            ))}
          </div>
        ) : filteredNotes.length === 0 ? (
          <div className="notes-empty">
            <div className="notes-empty-icon">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/>
                <path d="M14 3v6h6"/>
                <line x1="8" y1="13" x2="16" y2="13"/>
                <line x1="8" y1="17" x2="13" y2="17"/>
              </svg>
            </div>
            {search ? (
              <>
                <div className="notes-empty-title">No notes match &quot;{search}&quot;</div>
                <div className="notes-empty-sub">Try a different search term or clear the filter.</div>
                <button className="notes-empty-btn" onClick={() => setSearch("")}>
                  Clear search
                </button>
              </>
            ) : (
              <>
                <div className="notes-empty-title">No notes yet</div>
                <div className="notes-empty-sub">Start capturing your ideas, thoughts, and tasks here.</div>
                <button className="notes-empty-btn" onClick={() => setShowCreate(true)}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                  </svg>
                  Write your first note
                </button>
              </>
            )}
          </div>
        ) : (
          <div className="notes-masonry">
            {filteredNotes.map(note => (
              <div
                key={note.id}
                className="note-card"
                onClick={() => setEditNote(note)}
              >
                <div className="note-card-title">{note.title}</div>
                {note.description && (
                  <div className="note-card-body">{note.description}</div>
                )}
                <div className="note-card-footer">
                  <span className="note-date">
                    {format(new Date(note.createdAt), "MMM d, yyyy")}
                  </span>
                  {note.tags.map(tag => (
                    <span key={tag.id} className="note-tag">{tag.name}</span>
                  ))}
                </div>

                <div className="note-actions" onClick={e => e.stopPropagation()}>
                  <button
                    className="note-action-btn edit"
                    title="Edit note"
                    onClick={e => { e.stopPropagation(); setEditNote(note); }}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>
                  </button>
                  <button
                    className="note-action-btn del"
                    title="Delete note"
                    onClick={e => {
                      e.stopPropagation();
                      if (confirm(`Delete "${note.title}"?`)) handleDelete(note.id);
                    }}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6"/>
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="New Note">
        <ItemForm
          onSubmit={handleCreate}
          onCancel={() => setShowCreate(false)}
          googleConnected={googleConnected}
          initialData={{
            type: "TASK",
            priority: "LOW",
            dueDate: "2099-12-31T00:00:00.000Z",
          }}
        />
      </Modal>

      {/* Edit modal */}
      <Modal open={!!editNote} onClose={() => setEditNote(null)} title="Edit Note">
        {editNote && (
          <ItemForm
            onSubmit={handleUpdate}
            onCancel={() => setEditNote(null)}
            googleConnected={googleConnected}
            initialData={{
              title: editNote.title,
              description: editNote.description ?? undefined,
              type: "TASK",
              priority: editNote.priority as CreateItemInput["priority"],
              dueDate: editNote.dueDate as unknown as string,
              tags: editNote.tags.map(t => t.name),
              allDay: editNote.allDay,
              reminderMinutes: editNote.reminderMinutes,
            }}
          />
        )}
      </Modal>
    </>
  );
}
